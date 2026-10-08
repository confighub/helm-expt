// One literal configuration OCI bundle for each base of the four NVIDIA charts
// in the Catalog, and the receipt that says a bundle was published.
//
// Each chart version is already published as a signed installer package that
// holds several bases. This module builds the other artifact, one per base:
// the exact objects Helm rendered for that base, the route files that say what
// has to happen around them, a requirements file that says what the target
// must already have, and a short guide. The shape is the one the Catalog
// already publishes for Helm entries (scripts/publish-certified-bundles.mjs):
// one tar+gzip layer under application/vnd.confighub.config.bundle.v1 with
// upstream.yaml at the root, routes under routes/ and the guide as README.md.
//
// A bundle built here is not a row in data/certified-bundles/receipts.csv. A
// row there is a certified image, and the ConfigHub-ready lane requires a
// recorded upload into a ConfigHub organization for every certified image.
// Nothing here has been uploaded. The publication is recorded by its own
// receipt under runs/catalog-literal-bundles/, as the NIMService variants are
// (scripts/lib/nimservice-publication.mjs).
//
// Everything is built in this process from committed bytes. The tar, the gzip
// container and the manifest are written byte by byte, so the digests are the
// same on every machine. Nothing in this module contacts a registry.
// scripts/publish-nvidia-literal-bundles.mjs does the pushing, and only when
// the maintainer asks.
//
// A base counts as published only when a tracked receipt exists whose digests
// equal the ones computed here. A receipt for other bytes is refused.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYamlFiles, readYamlText, repoRoot, serializeYaml, trackedExists } from "./proof-common.mjs";
import { deterministicGzip, deterministicTar, readLayerFiles, writeNimServiceOciLayout } from "./nimservice-publication.mjs";

export const NVIDIA_LITERAL_BUNDLE_CHARTS = [
  "nvidia/cluster-readiness-engine",
  "nvidia/gpu-operator",
  "nvidia/k8s-nim-operator",
  "nvidia/nvsentinel",
];
export const LITERAL_BUNDLE_REGISTRY = "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles";
export const LITERAL_BUNDLE_ARTIFACT_TYPE = "application/vnd.confighub.config.bundle.v1";
export const LITERAL_BUNDLE_LAYER_TYPE = "application/vnd.oci.image.layer.v1.tar+gzip";
export const LITERAL_BUNDLE_RECEIPT_KIND = "CatalogLiteralBundlePublicationReceipt";
export const LITERAL_BUNDLE_PLAN_KIND = "CatalogLiteralBundlePlan";
export const LITERAL_BUNDLE_RECEIPT_ROOT = "runs/catalog-literal-bundles";
export const NVIDIA_LITERAL_BUNDLE_DATA_ROOT = "data/nvidia-literal-bundles";
export const LITERAL_BUNDLE_PLAN_FILE = "literal-config-oci.yaml";
export const LITERAL_BUNDLE_PUBLISHED_STATUS = "published-with-receipt";
export const LITERAL_BUNDLE_UNPUBLISHED_STATUS = "not-published-in-this-record";
export const NVIDIA_LITERAL_BUNDLE_GENERATOR = "scripts/generate-nvidia-literal-bundles.mjs";
// The largest retained render is about 2 MB. A staged file above this size is
// not a render, a route, a requirements file or a guide, and the build refuses
// it.
export const LITERAL_BUNDLE_STAGED_FILE_MAX_BYTES = 4 * 1024 * 1024;

const INTENT_ROOT = "data/helm-render-intents/intents";
const INTENT_FILE = /^nvidia-(cluster-readiness-engine|gpu-operator|k8s-nim-operator|nvsentinel)-.+\.yaml$/;
const OCI_MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json";
const OCI_EMPTY_CONFIG_TYPE = "application/vnd.oci.empty.v1+json";
const OCI_EMPTY_CONFIG = Buffer.from("{}");
const CREATED_ANNOTATION = "1970-01-01T00:00:00Z";
const ROUTE_LANE = "flatten-with-routes";
const LANES = new Set([ROUTE_LANE, "safe-to-flatten"]);

// Built-in kinds whose scope is fixed by Kubernetes. A custom kind is counted
// apart, because its scope is set by a definition this module does not read.
const CLUSTER_SCOPED_KINDS = new Set([
  "APIService", "ClusterRole", "ClusterRoleBinding", "CustomResourceDefinition", "IngressClass",
  "MutatingWebhookConfiguration", "Namespace", "PersistentVolume", "PriorityClass", "RuntimeClass",
  "StorageClass", "ValidatingAdmissionPolicy", "ValidatingAdmissionPolicyBinding", "ValidatingWebhookConfiguration",
]);
const NAMESPACED_KINDS = new Set([
  "ConfigMap", "CronJob", "DaemonSet", "Deployment", "HorizontalPodAutoscaler", "Ingress", "Job", "Lease",
  "NetworkPolicy", "PersistentVolumeClaim", "Pod", "PodDisruptionBudget", "PodMonitor", "PrometheusRule",
  "ReplicaSet", "Role", "RoleBinding", "Secret", "Service", "ServiceAccount", "ServiceMonitor", "StatefulSet",
]);

// One spelling of a value whatever order its keys were written or read in. A
// receipt is written as YAML and read back with its keys sorted, so a plain
// JSON comparison of the two would call a faithful receipt different.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

const sha256Hex = (data) => createHash("sha256").update(data).digest("hex");
const digestOf = (data) => `sha256:${sha256Hex(data)}`;
const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

export const literalBundleReceiptRel = (recordName) => `${LITERAL_BUNDLE_RECEIPT_ROOT}/${recordName}/publication-receipt.yaml`;
export const nvidiaLiteralBundleDir = (recordName) => `${NVIDIA_LITERAL_BUNDLE_DATA_ROOT}/${recordName}`;

// --- what one base is, read from committed files ---------------------------

function verdictRelFor(recipeRel, base, root) {
  const own = `${recipeRel}/publication/flattening-safety-verdict-${base}.yaml`;
  return existsSync(join(root, own)) ? own : `${recipeRel}/publication/flattening-safety-verdict.yaml`;
}

function packagedFile(root, packageRoot, packagePath, installerPackageRef) {
  const repositoryPath = `${packageRoot}/${packagePath}`;
  const path = join(root, repositoryPath);
  check(existsSync(path), `${repositoryPath} is named by a lifecycle action or a target fact and is missing`);
  const data = readFileSync(path);
  return { installerPackage: installerPackageRef, path: packagePath, repositoryPath, sha256: digestOf(data), bytes: data.length };
}

function namespaceFacts(entry) {
  const named = entry.objects.filter((object) => object.namespace === entry.namespace).length;
  const elsewhere = [...new Set(entry.objects.map((object) => object.namespace).filter((value) => value && value !== entry.namespace))].sort();
  const unnamed = entry.objects.filter((object) => !object.namespace);
  const namespacedUnnamed = unnamed.filter((object) => NAMESPACED_KINDS.has(object.kind)).length;
  const customUnnamed = unnamed.filter((object) => !NAMESPACED_KINDS.has(object.kind) && !CLUSTER_SCOPED_KINDS.has(object.kind));
  const holdsNamespaceObject = entry.objects.some((object) => object.kind === "Namespace" && object.name === entry.namespace);
  const sentences = [
    holdsNamespaceObject
      ? `The bundle holds the Namespace object ${entry.namespace}.`
      : `The bundle holds no Namespace object, so the namespace ${entry.namespace} must exist on the target before these objects are applied.`,
  ];
  if (namespacedUnnamed > 0) {
    sentences.push(`${plural(namespacedUnnamed, "namespaced object")} ${namespacedUnnamed === 1 ? "sets" : "set"} no namespace and must be applied into ${entry.namespace}.`);
  }
  if (customUnnamed.length > 0) {
    sentences.push(`${plural(customUnnamed.length, "object")} of a custom kind ${customUnnamed.length === 1 ? "sets" : "set"} no namespace. This file does not decide whether those kinds are namespaced.`);
  }
  return {
    name: entry.namespace,
    namespaceObjectInBundle: holdsNamespaceObject,
    objectsNamingThisNamespace: named,
    otherNamespacesNamed: elsewhere,
    namespacedObjectsNamingNoNamespace: namespacedUnnamed,
    customKindObjectsNamingNoNamespace: customUnnamed.length,
    customKindsNamingNoNamespace: [...new Set(customUnnamed.map((object) => object.kind))].sort(),
    statement: sentences.join(" "),
  };
}

function buildEntry(intent, { root, inventories, verdicts, lifecycles }) {
  const recordName = intent.metadata.name;
  const spec = intent.spec;
  const chart = spec.chart.name;
  check(NVIDIA_LITERAL_BUNDLE_CHARTS.includes(chart), `${recordName}: ${chart} is not one of the four NVIDIA charts this module covers`);
  const version = spec.chart.version;
  const base = spec.baseVariant;
  const chartName = chart.split("/").at(-1);
  const packageRoot = `packages/${chart}/${version}`;
  const revision = /\/revisions\/[^/]+\/(r\d+)\//.exec(spec.renderOutput.revision)?.[1];
  check(revision, `${recordName}: the intent names no numbered revision`);
  const entry = {
    recordName,
    intentRel: `${INTENT_ROOT}/${recordName}.yaml`,
    chart,
    chartName,
    repository: chart.split("/")[0],
    version,
    base,
    revision,
    namespace: spec.renderInputs.namespace,
    releaseName: spec.renderInputs.releaseName,
    kubeVersion: spec.renderInputs.capabilityProfile?.kubeVersion ?? "",
    hookPolicy: spec.renderInputs.hookPolicy ?? "",
    valuesProfileRel: spec.renderInputs.valuesProfile ?? "",
    installerPackageRef: spec.renderInputs.installerPackageOciRef ?? "",
    objectsRel: spec.renderOutput.renderedObjects,
    inventoryRel: spec.renderOutput.objectInventory,
    upstreamRel: `${spec.renderOutput.packageBase}/upstream.yaml`,
    packageRoot,
    verdictRel: verdictRelFor(spec.renderInputs.recipe, base, root),
    dataDir: nvidiaLiteralBundleDir(recordName),
  };
  check(entry.namespace && entry.releaseName, `${recordName}: the intent names no namespace or release`);
  check(/^oci:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/.test(entry.installerPackageRef), `${recordName}: the intent names no digest-pinned installer package`);

  const inventory = inventories.get(join(root, entry.inventoryRel));
  check(inventory?.spec?.objects?.length > 0, `${recordName}: ${entry.inventoryRel} lists no objects`);
  entry.objects = inventory.spec.objects.map((object) => ({ apiVersion: object.apiVersion, kind: object.kind, name: object.name, namespace: object.namespace ?? "" }));
  entry.objectCount = entry.objects.length;
  check(inventory.spec.objectCount === entry.objectCount, `${recordName}: ${entry.inventoryRel} counts ${inventory.spec.objectCount} objects and lists ${entry.objectCount}`);
  const upstream = readFileSync(join(root, entry.upstreamRel));
  entry.objectSetSha256 = sha256Hex(upstream);
  check(
    entry.objectSetSha256 === inventory.spec.sourceSHA256 && entry.objectSetSha256 === sha256Hex(readFileSync(join(root, entry.objectsRel))),
    `${recordName}: ${entry.upstreamRel} is not the retained render at ${entry.objectsRel}`,
  );
  // A base is rendered with hooks set aside. A hook object in the bundle would
  // run at install time, and a Secret would put its value in a public image.
  check(!upstream.includes("helm.sh/hook"), `${recordName}: ${entry.upstreamRel} carries a Helm hook annotation, and a hook object must not travel in a literal bundle`);
  entry.secretObjects = entry.objects.filter((object) => object.kind === "Secret").length;
  check(entry.secretObjects === 0, `${recordName}: the render holds ${plural(entry.secretObjects, "Secret object")}, and a bundle with a Secret needs its own review before it is built`);

  const verdict = verdicts.get(join(root, entry.verdictRel));
  entry.lane = verdict?.spec?.verdict?.lane;
  check(LANES.has(entry.lane), `${recordName}: ${entry.verdictRel} decides ${entry.lane ?? "nothing"}, and only a flattened lane has a literal bundle`);
  check(
    verdict.spec.chart?.name === chartName && verdict.spec.chart?.version === version && [base, "default"].includes(verdict.spec.auditedBase),
    `${recordName}: ${entry.verdictRel} is a verdict for another chart, version or base`,
  );
  entry.verdictRoutes = verdict.spec.verdict.routes ?? [];
  entry.verdictRationale = verdict.spec.verdict.rationale ?? "";

  // Definitions the render holds, and definitions the target must already have.
  entry.crdsInBundle = entry.objects.filter((object) => object.kind === "CustomResourceDefinition").map((object) => object.name).sort();
  const required = spec.targetFacts?.declared?.requiredCRDs ?? [];
  const inBundle = new Set(entry.crdsInBundle);
  const missingFacts = entry.crdsInBundle.filter((name) => !required.some((item) => item.name === name));
  check(missingFacts.length === 0, `${recordName}: the render holds ${missingFacts.join(", ")} and the intent records no target fact for it`);
  entry.serverSideApply = required.some((item) => item.applyMode === "server-side");
  const packagePathOf = (item) => String(item.packageSource ?? "").replace(/^package:\/\//, "");
  entry.crdsOnTarget = required.filter((item) => !inBundle.has(item.name)).map((item) => ({
    name: item.name,
    purpose: item.purpose,
    packagedCopy: packagedFile(root, packageRoot, packagePathOf(item), entry.installerPackageRef),
  }));
  const bundledFact = required.find((item) => inBundle.has(item.name));
  entry.crdPackagedCopy = bundledFact ? packagedFile(root, packageRoot, packagePathOf(bundledFact), entry.installerPackageRef) : null;

  // The Helm hooks the base leaves out, as the package records them.
  const lifecycleRel = `${packageRoot}/prerequisites/${chartName}-lifecycle/lifecycle-actions.yaml`;
  const lifecycle = lifecycles.get(join(root, lifecycleRel));
  entry.lifecycleRel = lifecycle ? lifecycleRel : "";
  const actions = lifecycle?.spec?.bases?.find((candidate) => candidate.name === base)?.actions ?? [];
  check(!lifecycle || actions.length > 0, `${recordName}: ${lifecycleRel} records no actions for base ${base}`);
  entry.lifecycleActions = actions.filter((action) => action.phase !== "pre-apply").map((action, index) => {
    check(
      action.automatic === false && action.evidenceState === "not-run",
      `${recordName}: the ${action.phase} action in ${lifecycleRel} is no longer recorded as not automatic and not run, so its route wording needs review`,
    );
    return {
      order: index + 1,
      phase: action.phase,
      helmHook: action.helmHook,
      name: action.name,
      detail: action.detail,
      invokedBy: action.invokedBy,
      automatic: false,
      evidenceState: "not-run",
      objects: packagedFile(root, packageRoot, action.source, entry.installerPackageRef),
    };
  });

  // Certificates the base asks cert-manager on the target to issue. The render
  // holds the Certificate and Issuer objects and no CA bundle.
  const identity = (object) => ({ apiVersion: object.apiVersion, kind: object.kind, name: object.name, namespace: object.namespace });
  entry.certificateObjects = entry.objects.filter((object) => object.apiVersion.startsWith("cert-manager.io/")).map(identity);
  entry.webhookObjects = entry.objects.filter((object) => /^(Validating|Mutating)WebhookConfiguration$/.test(object.kind)).map(identity);
  entry.caInjectionAnnotated = upstream.includes("cert-manager.io/inject-ca-from");
  check(
    entry.certificateObjects.length === 0 || entry.crdsOnTarget.some((crd) => crd.name.endsWith(".cert-manager.io")),
    `${recordName}: the render holds cert-manager objects and the intent records no cert-manager definition as a target fact`,
  );

  entry.namespaceFacts = namespaceFacts(entry);
  entry.generated = generatedFiles(entry);
  const routeCount = entry.generated.filter((file) => file.role.startsWith("route:")).length;
  if (entry.lane === ROUTE_LANE) {
    check(routeCount > 0, `${recordName}: the verdict is ${ROUTE_LANE} and no route file could be built from the committed package`);
    const declared = (entry.crdsInBundle.length > 0 ? 1 : 0) + entry.lifecycleActions.length + (entry.certificateObjects.length > 0 ? 1 : 0);
    check(
      entry.verdictRoutes.length === declared,
      `${recordName}: ${entry.verdictRel} names ${plural(entry.verdictRoutes.length, "route")}, and the committed files support ${declared} (definition ordering, ${plural(entry.lifecycleActions.length, "lifecycle action")}, and a certificate route when the render holds cert-manager objects)`,
    );
  } else {
    check(routeCount === 0 && entry.lifecycleActions.length === 0, `${recordName}: the verdict is ${entry.lane} and the package records a route for this base, so the verdict needs review`);
  }
  return entry;
}

// --- the generated companion files ------------------------------------------

function provenance(entry, generatedFrom) {
  return { emittedBy: NVIDIA_LITERAL_BUNDLE_GENERATOR, generatedFrom, verdictRef: entry.verdictRel };
}

function crdOrderingRoute(entry) {
  const definitions = { order: 1, name: "custom-resource-definitions", selector: { kinds: ["CustomResourceDefinition"], names: entry.crdsInBundle } };
  definitions.waitFor = "every named definition reports the Established condition";
  if (entry.serverSideApply) definitions.applyMode = "server-side";
  definitions.objectCount = entry.crdsInBundle.length;
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-crd-ordering` },
    spec: {
      quirkClass: "crd-ordering",
      routeKind: "apply-ordering",
      discharges: "Without an ordering declaration, per-file Units apply in no guaranteed order, so a custom resource can reach the cluster before the definition that gives it meaning.",
      declaration: {
        stages: [
          definitions,
          { order: 2, name: "everything-else", selector: { kinds: ["*"] }, objectCount: entry.objectCount - entry.crdsInBundle.length },
        ],
        packagedCopy: entry.crdPackagedCopy,
      },
      executedBy: {
        runtimes: [
          { name: "Argo CD", mechanism: "sync waves, the earlier stage at the lower wave number", proven: false },
          { name: "Flux", mechanism: "dependsOn between the definitions Kustomization and the rest", proven: false },
          { name: "cub-direct applier", mechanism: "apply stage one and wait for establishment before stage two", proven: false },
        ],
        automatic: false,
        evidenceState: "not-run",
      },
      boundedness: [
        "the route orders what the bundle contains; a definition this bundle does not ship must already exist on the target, and requirements/target-requirements.yaml names each one",
        "establishment is observed by the delivery runtime, so this route declares the wait and does not prove it happened",
        "no runtime has run this ordering for this base",
      ],
      provenance: provenance(entry, [entry.inventoryRel, entry.intentRel]),
    },
  };
}

function lifecycleRoute(entry) {
  const names = entry.lifecycleActions.map((action) => action.phase);
  const phases = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0];
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-lifecycle-actions` },
    spec: {
      quirkClass: "helm-hooks",
      routeKind: "lifecycle-action",
      discharges: `The chart defines Helm hooks for ${phases}. The base was rendered without them, because a hook object applied with the other objects runs at install time. Each action below names the hook objects the installer package holds and says when they apply.`,
      declaration: {
        actions: entry.lifecycleActions,
        hookObjectsInThisBundle: false,
        applyWithBase: "never",
        onActionFailure: "stop and report; never continue past an action that did not complete",
      },
      executedBy: { invokedBy: "the delivery workflow, one action at its own phase", automatic: false, evidenceState: "not-run" },
      boundedness: [
        "the hook objects stay in the signed installer package and are named here by path and SHA-256; this bundle does not hold them",
        "no action has been run on a cluster, and no receipt says an upgrade or a delete of this flattened base behaved as the chart's hooks would",
      ],
      provenance: provenance(entry, [entry.lifecycleRel, entry.intentRel]),
    },
  };
}

function certificateRoute(entry) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-webhook-certificate` },
    spec: {
      quirkClass: "webhook-ca",
      routeKind: "target-controller",
      discharges: "The base holds a webhook configuration with no CA bundle and the cert-manager objects that ask for its certificate. Nothing in the bundle issues that certificate. cert-manager on the target issues it and injects the CA.",
      declaration: {
        controller: "cert-manager",
        installedByThisBundle: false,
        requiredDefinitions: entry.crdsOnTarget.filter((crd) => crd.name.endsWith(".cert-manager.io")).map((crd) => crd.name),
        certificateObjects: entry.certificateObjects,
        webhookObjects: entry.webhookObjects,
        caInjectionAnnotationInRender: entry.caInjectionAnnotated,
        waitFor: "each Certificate reports Ready and each webhook configuration carries a CA bundle, before the webhook is relied on",
      },
      executedBy: { invokedBy: "cert-manager running on the target", automatic: false, evidenceState: "not-run" },
      boundedness: [
        "cert-manager and its definitions are a requirement on the target; requirements/target-requirements.yaml names each definition",
        "no target has issued this certificate for this base, and no receipt says the webhook answered",
      ],
      provenance: provenance(entry, [entry.inventoryRel, entry.intentRel]),
    },
  };
}

function targetRequirements(entry) {
  const valuesPath = entry.valuesProfileRel;
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleTargetRequirements",
    metadata: { name: `${entry.recordName}-target-requirements` },
    spec: {
      subject: { catalogEntry: entry.recordName, chart: entry.chart, version: entry.version, base: entry.base, revision: entry.revision },
      namespace: entry.namespaceFacts,
      customResourceDefinitions: {
        inBundle: {
          count: entry.crdsInBundle.length,
          names: entry.crdsInBundle,
          orderedBy: entry.crdsInBundle.length > 0 ? "routes/crd-ordering.yaml" : "",
        },
        requiredOnTarget: entry.crdsOnTarget,
      },
      applyMode: entry.serverSideApply ? "server-side" : "not-recorded",
      render: {
        renderer: "helm",
        releaseName: entry.releaseName,
        namespace: entry.namespace,
        kubeVersion: entry.kubeVersion,
        hookPolicy: entry.hookPolicy,
        valuesProfile: valuesPath,
      },
      flattening: { lane: entry.lane, verdict: entry.verdictRel },
      sourcePackage: entry.installerPackageRef,
      checked: "No destination has been checked against these requirements.",
      provenance: provenance(entry, [entry.intentRel, entry.inventoryRel]),
    },
  };
}

function spaceGuide(entry, files) {
  const rows = files.map((file) => `| \`${file.path}\` | ${file.describes} |`);
  const before = [entry.namespaceFacts.statement];
  if (entry.crdsInBundle.length > 0) {
    before.push(`Apply the ${plural(entry.crdsInBundle.length, "CustomResourceDefinition")} first and wait until each is established. \`routes/crd-ordering.yaml\` declares that order.`);
  }
  for (const crd of entry.crdsOnTarget) {
    before.push(`The target must already have the definition \`${crd.name}\`. This bundle does not hold it.`);
  }
  if (entry.certificateObjects.length > 0) {
    before.push("cert-manager must be running on the target. It issues the webhook certificate the base asks for, and `routes/webhook-certificate.yaml` says what to wait for.");
  }
  if (entry.lifecycleActions.length > 0) {
    before.push(`The chart's Helm hooks are not in this bundle. \`routes/lifecycle-actions.yaml\` names ${plural(entry.lifecycleActions.length, "action")} and the phase each belongs to. Never apply a hook object with the base.`);
  }
  return [
    `# ${entry.chart} ${entry.version}, base ${entry.base}`,
    "",
    "**UNOFFICIAL/EXPERIMENTAL**",
    "",
    `<!-- Generated by ${NVIDIA_LITERAL_BUNDLE_GENERATOR}. Do not edit by hand. -->`,
    "",
    `This bundle holds the ${plural(entry.objectCount, "Kubernetes object")} that Helm rendered for release ${entry.releaseName} in namespace ${entry.namespace}, and the files that say what those objects need. The flattening verdict for this base is ${entry.lane}.`,
    "",
    "## What the bundle holds",
    "",
    "| File | What it is |",
    "| --- | --- |",
    ...rows,
    "",
    "## Before you apply it",
    "",
    ...before.map((line) => `- ${line}`),
    "",
    "## What has not been done",
    "",
    "No route in this bundle has been run on a cluster, and no destination has been checked against the requirements. The bundle holds no container image, no Helm hook object and no Secret.",
    "",
  ].join("\n");
}

// The companion files of one base, in the order they are staged. The guide is
// written last because it lists the others.
function generatedFiles(entry) {
  const files = [];
  const add = (path, role, describes, doc) => files.push({ path, source: `${entry.dataDir}/${path}`, role, describes, text: serializeYaml(doc) });
  if (entry.crdsInBundle.length > 0) {
    add("routes/crd-ordering.yaml", "route: crd-ordering", "The order to apply the objects in, definitions first.", crdOrderingRoute(entry));
  }
  if (entry.lifecycleActions.length > 0) {
    add("routes/lifecycle-actions.yaml", "route: lifecycle-actions", "The Helm hooks the base leaves out, and when each one applies.", lifecycleRoute(entry));
  }
  if (entry.certificateObjects.length > 0) {
    add("routes/webhook-certificate.yaml", "route: webhook-certificate", "The certificate that cert-manager on the target must issue for the webhook.", certificateRoute(entry));
  }
  add("requirements/target-requirements.yaml", "requirement: target", "What the target must already have.", targetRequirements(entry));
  const listed = [
    { path: "upstream.yaml", describes: `The ${plural(entry.objectCount, "rendered object")}, byte for byte as the Catalog retains them.` },
    ...files,
  ];
  files.push({
    path: "README.md",
    source: `${entry.dataDir}/space-guide.md`,
    role: "space-guide",
    describes: "This guide.",
    text: spaceGuide(entry, listed),
  });
  return files;
}

// --- the artifact of one base -------------------------------------------------

// The files the artifact holds and where each comes from. This is the whole
// list. A reader that wants to add a file has to change this function.
export function literalBundleStagedSources(entry) {
  return [
    { path: "upstream.yaml", source: entry.upstreamRel, role: "rendered object set" },
    ...entry.generated.map((file) => ({ path: file.path, source: file.source, role: file.role })),
  ];
}

// Build the artifact. The generated companion files come from memory unless
// readText is given, so the generator can build before it writes and a test
// can change one byte.
export function buildLiteralBundleArtifact(entry, { root = repoRoot, readText } = {}) {
  const generatedText = new Map(entry.generated.map((file) => [file.source, file.text]));
  const read = readText ?? ((rel) => (generatedText.has(rel) ? generatedText.get(rel) : readFileSync(join(root, rel), "utf8")));
  const stagedFiles = literalBundleStagedSources(entry).map((file) => {
    check(/\.(ya?ml|md)$/.test(file.source), `${entry.recordName}: the staged file ${file.source} is not a YAML or Markdown file`);
    const data = Buffer.from(read(file.source), "utf8");
    check(
      data.length > 0 && data.length <= LITERAL_BUNDLE_STAGED_FILE_MAX_BYTES,
      `${entry.recordName}: the staged file ${file.source} is ${data.length} bytes, outside what a render or a companion file can be`,
    );
    return { ...file, data, bytes: data.length, sha256: sha256Hex(data) };
  });
  check(
    stagedFiles[0].sha256 === entry.objectSetSha256,
    `${entry.recordName}: the staged objects are not the retained render bytes at ${entry.upstreamRel}`,
  );
  const bundleName = `catalog-${entry.recordName}`;
  const tag = entry.revision;
  const repository = `${LITERAL_BUNDLE_REGISTRY}/${bundleName}`;
  const layer = deterministicGzip(deterministicTar(stagedFiles));
  const layerDigest = digestOf(layer);
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 2,
    mediaType: OCI_MANIFEST_TYPE,
    artifactType: LITERAL_BUNDLE_ARTIFACT_TYPE,
    config: { mediaType: OCI_EMPTY_CONFIG_TYPE, digest: digestOf(OCI_EMPTY_CONFIG), size: OCI_EMPTY_CONFIG.length },
    layers: [{
      mediaType: LITERAL_BUNDLE_LAYER_TYPE,
      digest: layerDigest,
      size: layer.length,
      annotations: { "org.opencontainers.image.title": `${bundleName}.tar.gz` },
    }],
    annotations: { "org.opencontainers.image.created": CREATED_ANNOTATION },
  }));
  const manifestDigest = digestOf(manifest);
  return {
    recordName: entry.recordName,
    bundleName,
    tag,
    repository,
    reference: `${repository}:${tag}`,
    immutableReference: `${repository}@${manifestDigest}`,
    artifactType: LITERAL_BUNDLE_ARTIFACT_TYPE,
    stagedFiles,
    layer,
    layerDigest,
    layerBytes: layer.length,
    manifest,
    manifestDigest,
    objectCount: entry.objectCount,
    objectSetSha256: `sha256:${entry.objectSetSha256}`,
    receiptRel: literalBundleReceiptRel(entry.recordName),
    planRel: `${entry.dataDir}/${LITERAL_BUNDLE_PLAN_FILE}`,
  };
}

const stagedRows = (artifact) => artifact.stagedFiles.map((file) => ({
  path: file.source,
  stagedAs: file.path,
  role: file.role,
  sha256: file.sha256,
  bytes: file.bytes,
}));

const contentsOf = () => ({ containerImages: false, helmHookObjects: false, secretObjects: 0 });

// The part of a plan and of a receipt that a consumer reads to bind a bundle
// to its files. The field names are the ones a certified-bundle receipt uses,
// so a reader of one shape can read the other: files carry a repository path,
// a bare SHA-256 and a role, and the rendered object set is the one file with
// the role "rendered object set".
function bundleBlock(artifact) {
  return {
    contentsKind: "rendered-config",
    artifactType: artifact.artifactType,
    reference: artifact.reference,
    manifestDigest: artifact.manifestDigest,
    layerDigest: artifact.layerDigest,
    layerBytes: artifact.layerBytes,
    layerMediaType: LITERAL_BUNDLE_LAYER_TYPE,
    objectCount: artifact.objectCount,
    objectSetSha256: artifact.objectSetSha256,
    files: stagedRows(artifact),
    reproducible: true,
  };
}

const sourceBlock = (entry) => ({
  kind: "helm-chart",
  charts: [{ repository: entry.repository, name: entry.chartName, version: entry.version }],
  base: entry.base,
  revision: entry.revision,
  installerPackage: entry.installerPackageRef,
});

const verdictBlock = (entry) => ({ lane: entry.lane, status: "decided", record: entry.verdictRel });

// The committed statement of what would be pushed. It is generated beside the
// companion files, so the local digest is on record before any push and the
// publisher can refuse bytes that differ from it.
export function literalBundlePlanDoc(entry, artifact) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: LITERAL_BUNDLE_PLAN_KIND,
    metadata: { name: entry.recordName },
    spec: {
      catalogEntry: entry.recordName,
      source: sourceBlock(entry),
      verdict: verdictBlock(entry),
      bundle: bundleBlock(artifact),
      contents: {
        statement: "The artifact holds the retained render of one base, its route files, its requirements file and its guide. It holds no container image, no Helm hook object and no Secret.",
        ...contentsOf(),
      },
      publication: {
        receipt: artifact.receiptRel,
        rule: "The base is published only when that receipt is tracked and its digests equal the ones in this file. This file does not say whether it is.",
        publisher: "scripts/publish-nvidia-literal-bundles.mjs",
      },
    },
  };
}

export function literalBundleReceiptDoc(entry, artifact, { observedAt, pushCommand, anonymousPull }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: LITERAL_BUNDLE_RECEIPT_KIND,
    metadata: { name: entry.recordName },
    spec: {
      catalogEntry: entry.recordName,
      plan: artifact.planRel,
      source: sourceBlock(entry),
      verdict: verdictBlock(entry),
      bundle: { ...bundleBlock(artifact), immutableReference: artifact.immutableReference },
      contents: contentsOf(),
      push: { result: "pass", command: pushCommand },
      anonymousPull,
      configHubUpload: "not-run. This receipt records a registry publication and nothing else.",
      signature: "none. The Catalog does not sign literal configuration bundles.",
      observedAt,
    },
    status: { result: "pass" },
  };
}

// Every way a receipt can fail to be the receipt of this artifact. An empty
// list means the receipt records a push and an anonymous pull of these bytes.
export function literalBundlePublicationProblems(receipt, entry, artifact) {
  const problems = [];
  const expect = (condition, message) => { if (!condition) problems.push(message); };
  const spec = receipt?.spec ?? {};
  const bundle = spec.bundle ?? {};
  expect(receipt?.kind === LITERAL_BUNDLE_RECEIPT_KIND, `it is not a ${LITERAL_BUNDLE_RECEIPT_KIND}`);
  expect(receipt?.metadata?.name === entry.recordName && spec.catalogEntry === entry.recordName, `it names ${receipt?.metadata?.name ?? "nothing"} and not ${entry.recordName}`);
  expect(bundle.manifestDigest === artifact.manifestDigest, `its manifest digest is ${bundle.manifestDigest ?? "missing"}, and the committed bytes build ${artifact.manifestDigest}`);
  expect(bundle.layerDigest === artifact.layerDigest && bundle.layerBytes === artifact.layerBytes, `its layer is ${bundle.layerDigest ?? "missing"}, and the committed bytes build ${artifact.layerDigest}`);
  expect(bundle.reference === artifact.reference, `its reference is ${bundle.reference ?? "missing"} and not ${artifact.reference}`);
  expect(bundle.immutableReference === artifact.immutableReference, "its immutable reference does not pin the manifest digest");
  expect(bundle.artifactType === artifact.artifactType, `its artifact type is ${bundle.artifactType ?? "missing"}`);
  expect(bundle.objectSetSha256 === artifact.objectSetSha256 && bundle.objectCount === artifact.objectCount, "its object-set digest or object count is not the retained render's");
  expect(canonical(bundle.files ?? []) === canonical(stagedRows(artifact)), "its files are not the render and the companion files this base has now");
  expect(canonical(spec.source ?? {}) === canonical(sourceBlock(entry)), "its source is not this chart, version, base and installer package");
  expect(canonical(spec.verdict ?? {}) === canonical(verdictBlock(entry)), `its verdict is not the ${entry.lane} verdict at ${entry.verdictRel}`);
  expect(canonical(spec.contents ?? {}) === canonical(contentsOf()), "it does not say the artifact holds no container image, no Helm hook object and no Secret");
  expect(spec.plan === artifact.planRel, `it does not name the plan ${artifact.planRel}`);
  expect(spec.push?.result === "pass", "it records no passing push");
  const pull = spec.anonymousPull ?? {};
  expect(
    pull.result === "pass"
      && pull.manifestDigest === artifact.manifestDigest
      && pull.layerDigest === artifact.layerDigest
      && pull.filesMatched === artifact.stagedFiles.length,
    "it records no anonymous pull of this manifest that returned these files",
  );
  expect(/^not-run\b/.test(String(spec.configHubUpload ?? "")), "it does not say that no ConfigHub upload was run");
  expect(/^\d{4}-\d{2}-\d{2}T/.test(String(spec.observedAt ?? "")), "it does not say when the pull was observed");
  expect(receipt?.status?.result === "pass", "its result is not pass");
  return problems;
}

// The publication state of one base. A receipt counts only when Git tracks
// it, because runs/ is ignored and an untracked receipt never reaches a pull
// request. A tracked receipt that does not match the committed bytes is an
// error and not a quiet "not published".
export function loadLiteralBundlePublication(entry, { root = repoRoot, artifact = entry.artifact } = {}) {
  const receiptRel = artifact.receiptRel;
  const receiptPath = join(root, receiptRel);
  if (!existsSync(receiptPath) || !trackedExists(receiptPath)) return { published: false, artifact, receiptRel };
  const text = readFileSync(receiptPath, "utf8");
  const receipt = readYamlText(text);
  const problems = literalBundlePublicationProblems(receipt, entry, artifact);
  check(
    problems.length === 0,
    `${receiptRel} is not a valid publication receipt for ${entry.recordName}: ${problems.join("; ")}. Publish these bytes again or remove the receipt`,
  );
  return {
    published: true,
    artifact,
    receipt,
    receiptRel,
    receiptSha256: digestOf(text),
    observedReference: `oci://${artifact.reference}@${artifact.manifestDigest}`,
  };
}

const PUBLISHED_NOTE = "An anonymous pull returned the exact objects and their companion files. No route has been run, nothing was uploaded to ConfigHub, and this bundle is not a row in the certified-bundle table.";

// What delivery.literalConfigOci of one of these records must be once its
// bundle is published. Without a publication the record keeps what the Helm
// record builder wrote, and the guard below holds it to that.
export function publishedLiteralConfigOci(publication) {
  const artifact = publication.artifact;
  const companions = (prefix) => artifact.stagedFiles
    .filter((file) => file.role.startsWith(prefix))
    .map((file) => ({ path: file.source, sha256: `sha256:${file.sha256}`, role: file.role }));
  return {
    status: LITERAL_BUNDLE_PUBLISHED_STATUS,
    observedReference: publication.observedReference,
    manifestDigest: artifact.manifestDigest,
    layerDigest: artifact.layerDigest,
    objectSetSha256: artifact.objectSetSha256,
    receipt: publication.receiptRel,
    receiptSha256: publication.receiptSha256,
    plan: artifact.planRel,
    routes: companions("route:"),
    requirements: companions("requirement:"),
    note: PUBLISHED_NOTE,
  };
}

// The same rule as one sentence of refusal, or an empty string when the
// record's literalConfigOci is exactly what the publication state allows.
export function literalConfigOciProblem(name, actual, publication) {
  if (publication?.published) {
    return canonical(actual ?? {}) === canonical(publishedLiteralConfigOci(publication))
      ? ""
      : `${name}: ${publication.receiptRel} records a publication of ${publication.artifact.manifestDigest}, and delivery.literalConfigOci does not carry exactly that reference, those digests and that receipt`;
  }
  const claimed = Object.keys(actual ?? {}).filter((key) => !["status", "note"].includes(key));
  if (actual?.status === LITERAL_BUNDLE_UNPUBLISHED_STATUS && claimed.length === 0) return "";
  return `${name}: delivery.literalConfigOci says ${actual?.status ?? "nothing"}${actual?.manifestDigest ? ` with ${actual.manifestDigest}` : ""}, and no tracked publication receipt for ${publication?.artifact?.manifestDigest ?? "this base"} exists at ${publication?.receiptRel ?? LITERAL_BUNDLE_RECEIPT_ROOT}`;
}

// --- every base ---------------------------------------------------------------

// Every base of the four charts, discovered from the committed render intents,
// each with its companion files, its artifact and its publication state.
// `receipts: "none"` builds every entry as not published, whatever receipts are
// tracked, so a self-test's fixtures do not change the day a receipt lands.
export function loadNvidiaLiteralBundleEntries({ root = repoRoot, receipts = "tracked" } = {}) {
  check(receipts === "tracked" || receipts === "none", `loadNvidiaLiteralBundleEntries: receipts must be "tracked" or "none", not ${receipts}`);
  const intentPaths = readdirSync(join(root, INTENT_ROOT)).filter((name) => INTENT_FILE.test(name)).sort().map((name) => join(root, INTENT_ROOT, name));
  check(intentPaths.length > 0, `no render intent for the NVIDIA charts was found under ${INTENT_ROOT}`);
  const intents = [...readYamlFiles(intentPaths).values()];
  const pathsOf = (pick) => [...new Set(intents.map(pick))].map((rel) => join(root, rel)).filter((path) => existsSync(path));
  const context = {
    root,
    inventories: readYamlFiles(pathsOf((intent) => intent.spec.renderOutput.objectInventory)),
    verdicts: readYamlFiles(pathsOf((intent) => verdictRelFor(intent.spec.renderInputs.recipe, intent.spec.baseVariant, root))),
    lifecycles: readYamlFiles(pathsOf((intent) => `packages/${intent.spec.chart.name}/${intent.spec.chart.version}/prerequisites/${intent.spec.chart.name.split("/").at(-1)}-lifecycle/lifecycle-actions.yaml`)),
  };
  const entries = intents.map((intent) => {
    const entry = buildEntry(intent, context);
    entry.artifact = buildLiteralBundleArtifact(entry, { root });
    entry.plan = literalBundlePlanDoc(entry, entry.artifact);
    entry.publication = receipts === "none"
      ? { published: false, artifact: entry.artifact, receiptRel: entry.artifact.receiptRel }
      : loadLiteralBundlePublication(entry, { root });
    return entry;
  });
  check(new Set(entries.map((entry) => entry.artifact.manifestDigest)).size === entries.length, "two NVIDIA bases build one manifest digest");
  return entries;
}

// Every file the generator owns, as repo-relative path and text. The plans,
// the companion files and the two summaries say nothing about publication, so
// none of them moves when a receipt lands.
export function nvidiaLiteralBundleOutputs(entries) {
  const outputs = [];
  for (const entry of entries) {
    for (const file of entry.generated) outputs.push({ rel: file.source, text: file.text });
    outputs.push({ rel: entry.artifact.planRel, text: serializeYaml(entry.plan) });
  }
  const header = ["record", "chart", "version", "base", "revision", "verdict_lane", "objects", "crds_in_bundle", "crds_required_on_target", "lifecycle_actions", "route_files", "staged_files", "layer_bytes", "manifest_digest", "planned_reference", "plan", "receipt"];
  const rows = entries.map((entry) => [
    entry.recordName, entry.chart, entry.version, entry.base, entry.revision, entry.lane, entry.objectCount,
    entry.crdsInBundle.length, entry.crdsOnTarget.length, entry.lifecycleActions.length,
    entry.generated.filter((file) => file.role.startsWith("route:")).length, entry.artifact.stagedFiles.length,
    entry.artifact.layerBytes, entry.artifact.manifestDigest, entry.artifact.reference, entry.artifact.planRel, entry.artifact.receiptRel,
  ]);
  outputs.push({ rel: `${NVIDIA_LITERAL_BUNDLE_DATA_ROOT}/bundles.csv`, text: `${[header, ...rows].map((row) => row.join(",")).join("\n")}\n` });
  const routed = entries.filter((entry) => entry.lane === ROUTE_LANE).length;
  outputs.push({
    rel: `${NVIDIA_LITERAL_BUNDLE_DATA_ROOT}/summary.md`,
    text: [
      "# NVIDIA literal configuration bundles",
      "",
      "**UNOFFICIAL/EXPERIMENTAL**",
      "",
      `<!-- Generated by ${NVIDIA_LITERAL_BUNDLE_GENERATOR}. Do not edit by hand. -->`,
      "",
      `The Catalog holds ${entries.length} bases of four NVIDIA charts. Each chart version is published as one signed installer package that holds several bases. This directory plans one more artifact for each base: a literal configuration OCI bundle with the exact rendered objects, the route files, a requirements file and a guide.`,
      "",
      `${routed} bases have a flatten-with-routes verdict and carry at least one route file. ${entries.length - routed} have a safe-to-flatten verdict and carry a requirements file and no route.`,
      "",
      "Each plan records the digest the committed bytes build. This page and the plans do not say whether a bundle is published. A base is published only when a tracked receipt under `runs/catalog-literal-bundles/` records a push and an anonymous pull of exactly that digest. No bundle here is a row in the certified-bundle table, and none has been uploaded to ConfigHub.",
      "",
      "Regenerate with `npm run nvidia-literal-bundles:generate` and check with `npm run nvidia-literal-bundles:verify`. `npm run nvidia-literal-bundles:publish:dry-run` lists what a publication would push.",
      "",
      "| Record | Verdict | Objects | Definitions in bundle | Definitions required on target | Lifecycle actions | Manifest digest |",
      "| --- | --- | ---: | ---: | ---: | ---: | --- |",
      ...entries.map((entry) => `| ${entry.recordName} | ${entry.lane} | ${entry.objectCount} | ${entry.crdsInBundle.length} | ${entry.crdsOnTarget.length} | ${entry.lifecycleActions.length} | \`${entry.artifact.manifestDigest}\` |`),
      "",
    ].join("\n"),
  });
  return outputs;
}

export { readLayerFiles as readLiteralBundleLayerFiles, writeNimServiceOciLayout as writeLiteralBundleOciLayout };
