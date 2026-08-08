#!/usr/bin/env node
// Emits the four reference CertifiedBundleReceipt artifacts for the certified
// bundle model (docs/planning/certified-bundle-model-brief.md). One bundle comes
// from each producer: the catalog (traefik), Kubara (metrics-server),
// eks-inference (gpu-runtime, from its published bundle via a committed
// witness), and the Sveltos example (the kyverno-fleet ClusterProfile). Output
// is a pure function
// of the committed source files. No wall-clock timestamps, no network, no
// cluster. Spec: docs/reference/certified-bundle-spec.md, schema:
// schemas/certified-bundle-receipt.schema.json.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
  sha256File,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

// Route artifacts emitted while building receipts, written alongside them.
const emittedRoutes = [];

const OUT_DIR = join(repoRoot, "data", "certified-bundles");
const WITNESS_DIR = join(OUT_DIR, "witnesses", "eks-inference-gpu-runtime");

const SOURCES = {
  traefikRecipe: "recipes/traefik/traefik/41.0.2",
  traefikPackage: "packages/traefik/traefik/41.0.2",
  kubaraComponent:
    "examples/kubara/current-platform/generated/platform-components/helm/metrics-server",
  kubaraArtifacts: "examples/kubara/current-platform/component-artifacts.yaml",
  kubaraGeneration: "examples/kubara/current-platform/generation-receipt.yaml",
  metricsServerRender:
    "recipes/metrics-server/metrics-server/3.13.1/revisions/default/r001/rendered/release-objects.yaml",
  sveltosProfile: "examples/sveltos/kyverno-fleet/clusterprofile-pilot.yaml",
  sveltosLock: "examples/sveltos/kyverno-fleet/source-lock.yaml",
  sveltosProof: "runs/sveltos-oci-delivery-proof/receipt.yaml",
  witness: "data/certified-bundles/witnesses/eks-inference-gpu-runtime/witness.yaml",
};

// The AICR entries are the first producer whose flattened artifact consists of
// pointers to charts that a delivery runtime renders later. Each entry ships a
// set of Argo CD Application objects: literal YAML that carries an ordering
// declaration, wrapping components that are never flattened here at all.
const AICR_ENTRIES = [
  {
    id: "eks-h100-training-kubeflow",
    name: "aicr-eks-h100-training-kubeflow",
    sourceReceipt: "generation-receipt.yaml",
    kind: "rendered-config",
  },
  {
    id: "eks-h100-inference-nim",
    name: "aicr-eks-h100-inference-nim",
    sourceReceipt: "generation-receipt.yaml",
    kind: "rendered-config",
  },
  {
    id: "cpu-starter",
    name: "aicr-cpu-starter",
    sourceReceipt: "derivation-receipt.yaml",
    kind: "rendered-config",
  },
];

// The canonical home of the Kubara collateral. helm-expt keeps a byte-faithful
// mirror under examples/kubara; when that mirror is stripped, re-point the
// kubara sources above at this repository and path.
const KUBARA_CANONICAL_HOME = {
  repository: "https://github.com/confighub/kubara-confighub",
  commit: "da2c5d81060ead9a8c22d2d0491adcc5c736dfc1",
  path: "examples/kubara/current-platform/generated/platform-components/helm/metrics-server",
};

const EKS_INFERENCE = {
  repository: "https://github.com/confighub/eks-inference",
  commit: "2e1a8823920ca4fc6f124db754b7f8f2cfe7d574",
};

const QUIRK_CLASSES = [
  "helm-hooks",
  "resource-policy-keep",
  "lookup",
  "webhook-ca",
  "capabilities-api-versions",
  "generated-secrets",
  "crd-ordering",
  "immutable-fields",
  "namespace-creation",
  "subchart-conditions",
  "test-hooks",
];

function repoPath(rel) {
  return join(repoRoot, rel);
}

function fileEntry(rel, path) {
  return { path: rel, sha256: sha256File(path), bytes: statSync(path).size };
}

function splitDocs(text) {
  return text
    .split(/^---\s*$/m)
    .map((doc) => doc.trim())
    .filter((doc) => doc.length > 0);
}

function scanRendered(text) {
  const docs = splitDocs(text);
  const kinds = new Map();
  let hookDocs = 0;
  let testHookDocs = 0;
  let keepDocs = 0;
  let emptyCaBundle = 0;
  let secretsWithData = 0;
  const images = new Set();
  let emptySecrets = 0;
  for (const doc of docs) {
    const kindMatch = doc.match(/^kind:\s*"?([A-Za-z0-9.]+)"?\s*$/m);
    const kind = kindMatch ? kindMatch[1] : "unknown";
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    const hookMatch = doc.match(/helm\.sh\/hook["']?\s*:\s*["']?([^"'\n]*)/);
    if (hookMatch) {
      hookDocs += 1;
      if (hookMatch[1].includes("test")) testHookDocs += 1;
    }
    if (/helm\.sh\/resource-policy/.test(doc)) keepDocs += 1;
    if (/caBundle:\s*(""|'')?\s*$/m.test(doc)) emptyCaBundle += 1;
    // A Secret carrying no data is a placeholder for a controller to fill, not
    // a credential frozen into a public artifact. Counting the two together
    // makes a bundle owe an external reference for a Secret that holds nothing.
    // Image references, read from the bundle's own bytes. A container image is
    // the one thing a flattened bundle carries that it does not pin: the YAML
    // is byte-exact and "gatekeeper:v3.22.2" is whatever that tag points at
    // today. The receipt records them so the boundary is visible rather than
    // implied. This reads image: lines, which covers containers and
    // initContainers and misses an image named anywhere else, and the receipt
    // says so.
    for (const match of doc.matchAll(/^\s*image:\s*"?([^"\n]+?)"?\s*$/gm)) {
      const reference = match[1].trim();
      if (reference && !reference.includes("{{")) images.add(reference);
    }
    if (kind === "Secret") {
      if (/^(data|stringData):\s*\S/m.test(doc)) secretsWithData += 1;
      else emptySecrets += 1;
    }
  }
  const count = (kind) => kinds.get(kind) ?? 0;
  return {
    docCount: docs.length,
    kinds,
    hookDocs,
    testHookDocs,
    keepDocs,
    emptyCaBundle,
    crds: count("CustomResourceDefinition"),
    secrets: count("Secret"),
    secretsWithData,
    emptySecrets,
    images: [...images].sort(),
    namespaces: count("Namespace"),
    webhookConfigs:
      count("MutatingWebhookConfiguration") + count("ValidatingWebhookConfiguration"),
    jobs: count("Job") + count("CronJob"),
  };
}

// One disposition row per quirk class, derived from a static scan of rendered
// or literal files. Template-time classes cannot be read off rendered output,
// so they land as not-evaluated with the audit named as the closer.
function scanDispositions(scan, { renderScope, templateEvidence, routeRefs = {} }) {
  const rows = [];
  const audit = "the flattening-safety audit decides the certified disposition";
  rows.push({
    class: "helm-hooks",
    finding: scan.hookDocs > 0 ? "present" : "absent",
    detail:
      scan.hookDocs > 0
        ? `${scan.hookDocs} object(s) carry helm.sh/hook in ${renderScope}`
        : `no helm.sh/hook annotation in ${renderScope}`,
    disposition:
      scan.hookDocs > 0
        ? "lifecycle route executed by the delivery runtime"
        : "none required",
    ...(scan.hookDocs > 0 ? { companionRequired: "lifecycle-job" } : {}),
  });
  rows.push({
    class: "resource-policy-keep",
    finding: scan.keepDocs > 0 ? "present" : "absent",
    detail:
      scan.keepDocs > 0
        ? `${scan.keepDocs} object(s) carry helm.sh/resource-policy in ${renderScope}`
        : `no helm.sh/resource-policy annotation in ${renderScope}; the catalog does not yet scan this class as its own axis (data/quirk-coverage/coverage.csv)`,
    disposition:
      scan.keepDocs > 0
        ? routeRefs["resource-policy-keep"]
          ? `discharged by the route this bundle ships at ${routeRefs["resource-policy-keep"]}`
          : "prune protection emitted beside the bundle"
        : "none required",
    ...(scan.keepDocs > 0 ? { companionRequired: "prune-protection" } : {}),
  });
  rows.push({
    class: "lookup",
    finding: "not-evaluated",
    detail: `template-time construct, invisible in ${renderScope}; ${templateEvidence}`,
    disposition: audit,
  });
  rows.push({
    class: "webhook-ca",
    finding: scan.webhookConfigs > 0 ? "present" : "absent",
    detail:
      scan.webhookConfigs > 0
        ? `${scan.webhookConfigs} webhook configuration(s), ${scan.emptyCaBundle} with an empty caBundle, in ${renderScope}`
        : `no webhook configuration in ${renderScope}`,
    disposition:
      scan.webhookConfigs > 0
        ? "route to cert-manager or a certgen lifecycle route"
        : "none required",
  });
  rows.push({
    class: "capabilities-api-versions",
    finding: "not-evaluated",
    detail: `template-time construct, invisible in ${renderScope}; ${templateEvidence}`,
    disposition: "render inputs pin the kube version and are recorded in this receipt",
  });
  // Only a Secret that carries data freezes anything. An empty one is a shell a
  // controller fills after apply, and making the bundle owe an external
  // reference for it would report a resolution as a debt.
  const withData = scan.secretsWithData ?? scan.secrets;
  const empty = scan.emptySecrets ?? 0;
  rows.push({
    class: "generated-secrets",
    finding: scan.secrets > 0 ? "present" : "absent",
    detail:
      withData > 0
        ? `${withData} Secret object(s) carry data in ${renderScope}; a flattened bundle freezes one draw into a public artifact${empty > 0 ? `, alongside ${empty} empty placeholder(s)` : ""}`
        : empty > 0
          ? `${empty} Secret object(s) in ${renderScope}, none carrying data; these are placeholders a controller populates after apply`
          : `no Secret object in ${renderScope}`,
    disposition:
      withData > 0
        ? "external Secret reference required before certification"
        : empty > 0
          ? "nothing to externalise: the bundle ships the Secret empty and its own controller writes the material"
          : "none required",
    ...(withData > 0 ? { companionRequired: "external-secret-reference" } : {}),
  });
  rows.push({
    class: "crd-ordering",
    finding: scan.crds > 0 ? "present" : "absent",
    detail:
      scan.crds > 0
        ? `${scan.crds} CustomResourceDefinition(s) in ${renderScope}; per-file Units can race their CRDs`
        : `no CustomResourceDefinition in ${renderScope}`,
    disposition:
      scan.crds > 0
        ? routeRefs["crd-ordering"]
          ? `discharged by the route this bundle ships at ${routeRefs["crd-ordering"]}`
          : "explicit ordering declared at ingest (file split or sync waves)"
        : "none required",
    ...(scan.crds > 0 ? { companionRequired: "apply-ordering" } : {}),
  });
  rows.push({
    class: "immutable-fields",
    finding: "not-evaluated",
    detail: "a cross-version property; no second version is compared in this receipt",
    disposition: "versioned replacement route when an upgrade pair is audited",
  });
  rows.push({
    class: "namespace-creation",
    finding: scan.namespaces > 0 ? "present" : "absent",
    detail:
      scan.namespaces > 0
        ? `${scan.namespaces} Namespace object(s) ship in the bundle`
        : "no Namespace object ships in the bundle; the target namespace must exist before apply",
    disposition:
      scan.namespaces > 0 ? "namespace ships as its own Unit" : "declared at ingest",
  });
  rows.push({
    class: "subchart-conditions",
    finding: "not-evaluated",
    detail: `template-time construct, invisible in ${renderScope}; ${templateEvidence}`,
    disposition: audit,
  });
  rows.push({
    class: "test-hooks",
    finding: scan.testHookDocs > 0 ? "present" : "absent",
    detail:
      scan.testHookDocs > 0
        ? `${scan.testHookDocs} object(s) carry a test hook in ${renderScope}`
        : `no test hook in ${renderScope}`,
    disposition: scan.testHookDocs > 0 ? "pruned from the bundle" : "none required",
  });
  return rows;
}

function grab(text, pattern, label) {
  const match = text.match(pattern);
  check(match, `could not read ${label}`);
  return match[1];
}

// When the flattening-safety audit has decided a chart's lane, the receipt
// carries the certified verdict; until then the receipt stays provisional.
function readVerdict(recipeRel) {
  const rel = `${recipeRel}/publication/flattening-safety-verdict.yaml`;
  const path = repoPath(rel);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  return { rel, lane: grab(text, /lane:\s*"([a-z-]+)"/, `${rel} lane`) };
}

function buildLane(verdict, { provisionalLane, provisionalDecidedBy, openQuestions, notes }) {
  if (verdict) {
    return {
      lane: verdict.lane,
      status: "certified",
      decidedBy: `the flattening-safety audit at ${verdict.rel}`,
      notes,
    };
  }
  return {
    lane: provisionalLane,
    status: "provisional",
    decidedBy: provisionalDecidedBy,
    openQuestions,
    notes,
  };
}

// Routes are the companion artifacts a flatten-with-routes bundle ships beside
// its configuration. This one discharges CRD ordering: the bundle ingests one
// Unit per file, so nothing stops a custom resource reaching the cluster before
// the definition it depends on. The route states the ordering as stages any
// runtime can execute, rather than as one tool's annotation.
function buildCrdOrderingRoute({ name, inventoryRel, verdictRel, crdNames, otherCount }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name },
    spec: {
      quirkClass: "crd-ordering",
      routeKind: "apply-ordering",
      discharges:
        "Without an ordering declaration, per-file Units apply in no guaranteed order, so a custom resource can reach the cluster before the definition that gives it meaning.",
      declaration: {
        stages: [
          {
            order: 1,
            name: "custom-resource-definitions",
            selector: { kinds: ["CustomResourceDefinition"], names: crdNames },
            waitFor: "every named definition reports the Established condition",
            objectCount: crdNames.length,
          },
          {
            order: 2,
            name: "everything-else",
            selector: { kinds: ["*"] },
            objectCount: otherCount,
          },
        ],
      },
      executedBy: {
        runtimes: [
          {
            name: "Argo CD",
            mechanism: "sync waves, the earlier stage at the lower wave number",
            proven: false,
          },
          {
            name: "Flux",
            mechanism: "dependsOn between the definitions Kustomization and the rest",
            proven: false,
          },
          {
            name: "cub-direct applier",
            mechanism: "apply stage one and wait for establishment before stage two",
            proven: false,
          },
        ],
        // Ordering is declarative and idempotent, so a runtime may execute it
        // without asking. That is not true of routes that run a Job, which stay
        // manual until observed.
        automatic: true,
      },
      boundedness: [
        "the route orders what the bundle contains; a definition this bundle does not ship must already exist on the target",
        "establishment is observed by the delivery runtime, so this route declares the wait rather than proving it happened",
      ],
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [inventoryRel],
        verdictRef: verdictRel,
      },
    },
  };
}

function buildTraefikReceipt() {
  const recipe = SOURCES.traefikRecipe;
  const sourceLock = readFileSync(repoPath(`${recipe}/source-lock.yaml`), "utf8");
  const variant = readFileSync(repoPath(`${recipe}/variants/default/variant.yaml`), "utf8");
  const revision = readFileSync(
    repoPath(`${recipe}/revisions/default/r001/variant-revision.yaml`),
    "utf8",
  );
  const renderRel = `${recipe}/revisions/default/r001/rendered/release-objects.yaml`;
  const scan = scanRendered(readFileSync(repoPath(renderRel), "utf8"));
  const bundleFileRel = `${SOURCES.traefikPackage}/bases/default/upstream.yaml`;
  const bundleFile = fileEntry(bundleFileRel, repoPath(bundleFileRel));

  // Emit the route this bundle's verdict requires, then carry it as a bundle
  // file so the receipt names it beside the quirk it discharges.
  const inventoryRel = `${recipe}/revisions/default/r001/rendered/object-inventory.yaml`;
  const inventory = readFileSync(repoPath(inventoryRel), "utf8");
  const crdNames = [
    ...inventory.matchAll(/kind: "CustomResourceDefinition"\n\s+name: "([^"]+)"/g),
  ].map((match) => match[1]);
  check(crdNames.length === 25, `expected 25 traefik CRDs, found ${crdNames.length}`);
  const objectCount = Number(grab(revision, /objectCount:\s*(\d+)/, "traefik objectCount"));
  const traefikRouteRel = "data/certified-bundles/routes/catalog/traefik-traefik-41.0.2-default/crd-ordering.yaml";
  const traefikRoute = buildCrdOrderingRoute({
    name: "traefik-traefik-41.0.2-default-crd-ordering",
    inventoryRel,
    verdictRel: `${recipe}/publication/flattening-safety-verdict.yaml`,
    crdNames,
    otherCount: objectCount - crdNames.length,
  });
  const traefikRouteText = `${toYaml(traefikRoute)}\n`;
  emittedRoutes.push({ path: repoPath(traefikRouteRel), contents: traefikRouteText });
  const traefikRouteFile = {
    path: traefikRouteRel,
    sha256: sha256(traefikRouteText),
    bytes: Buffer.byteLength(traefikRouteText),
  };
  const renderedSetSha = grab(
    revision,
    /renderedObjectSetSHA256:\s*"([a-f0-9]{64})"/,
    "traefik renderedObjectSetSHA256",
  );
  check(
    bundleFile.sha256 === renderedSetSha,
    "traefik package upstream.yaml no longer matches the recorded rendered object set",
  );
  const dispositions = scanDispositions(scan, {
    renderScope: "the committed default-variant render",
    templateEvidence:
      "the chart family shows lookup and capabilities use in data/master-catalog-matrix (40.2.0 rows)",
    routeRefs: { "crd-ordering": traefikRouteRel },
  });
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "catalog-traefik-traefik-41.0.2-default" },
    spec: {
      producer: {
        name: "config-workshop-catalog",
        repository: "https://github.com/confighub/helm-expt",
      },
      source: {
        kind: "helm-chart",
        charts: [
          {
            repository: grab(sourceLock, /repositoryURL:\s*"([^"]+)"/, "traefik repositoryURL"),
            name: "traefik",
            version: grab(sourceLock, /^\s+version:\s*"([^"]+)"/m, "traefik version"),
            appVersion: grab(sourceLock, /appVersion:\s*"([^"]+)"/, "traefik appVersion"),
            packageSHA256: grab(sourceLock, /packageSHA256:\s*"([a-f0-9]{64})"/, "traefik packageSHA256"),
            exactArtifactUrl: grab(sourceLock, /url:\s*"([^"]+)"/, "traefik exactArtifact url"),
          },
        ],
        evidence: [
          `${recipe}/source-lock.yaml`,
          `${recipe}/variants/default/variant.yaml`,
          `${recipe}/revisions/default/r001/variant-revision.yaml`,
          `${recipe}/publication/installer-package-receipt.yaml`,
        ],
      },
      renderInputs: {
        renderer: "helm",
        kubeVersion: grab(variant, /kubeVersion:\s*"([^"]+)"/, "traefik kubeVersion"),
        apiVersions: [],
        hookPolicy: grab(variant, /hookPolicy:\s*"([^"]+)"/, "traefik hookPolicy"),
        releaseName: grab(variant, /releaseName:\s*"([^"]+)"/, "traefik releaseName"),
        namespace: grab(variant, /namespace:\s*"([^"]+)"/, "traefik namespace"),
        valuesRef: `${recipe}/effective-values.yaml`,
        valuesSHA256: grab(
          revision,
          /effectiveValuesSHA256:\s*"([a-f0-9]{64})"/,
          "traefik effectiveValuesSHA256",
        ),
      },
      bundle: {
        contentsKind: "rendered-config",
        files: [
          { ...bundleFile, role: "rendered object set" },
          { ...traefikRouteFile, role: "route: crd-ordering" },
        ],
        objectCount: Number(grab(revision, /objectCount:\s*(\d+)/, "traefik objectCount")),
        objectInventoryRef: `${recipe}/revisions/default/r001/rendered/object-inventory.yaml`,
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: buildLane(readVerdict(recipe), {
        provisionalLane: "flatten-with-routes",
        provisionalDecidedBy:
          "static scan over the committed default-variant render; hooks, keep-policy, webhooks, and generated secrets are absent there, and 25 CRDs need an ordering declaration",
        openQuestions: [
          "lookup and capabilities use needs the template-level audit",
          "webhook and generated-secret templates are values-gated in this chart, so other variants can change the disposition set",
        ],
        notes:
          "The lane holds for the default base; the verdict's variantScope records how hub webhooks and persistence move it.",
      }),
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [
          `${recipe}/source-lock.yaml`,
          `${recipe}/variants/default/variant.yaml`,
          `${recipe}/revisions/default/r001/variant-revision.yaml`,
          renderRel,
          bundleFileRel,
        ],
      },
    },
  };
}

// A catalog bundle for a base whose lane permits flattening. Traefik keeps its
// own builder because it predates this one; everything after it comes through
// here, which is what makes publishing more bundles a matter of deciding lanes
// rather than writing code.
function buildCatalogBundleReceipt({ recipe, packageRoot, base, chartName, verdictFile, notes, hookObservation }) {
  const sourceLock = readFileSync(repoPath(`${recipe}/source-lock.yaml`), "utf8");
  const revisionRel = `${recipe}/revisions/${base}/r001/variant-revision.yaml`;
  const revision = readFileSync(repoPath(revisionRel), "utf8");
  const renderRel = `${recipe}/revisions/${base}/r001/rendered/release-objects.yaml`;
  const inventoryRel = `${recipe}/revisions/${base}/r001/rendered/object-inventory.yaml`;
  const renderText = readFileSync(repoPath(renderRel), "utf8");
  const scan = scanRendered(renderText);
  const bundleFileRel = `${packageRoot}/bases/${base}/upstream.yaml`;
  const bundleFile = fileEntry(bundleFileRel, repoPath(bundleFileRel));
  check(
    bundleFile.sha256 === grab(revision, /renderedObjectSetSHA256:\s*"([a-f0-9]{64})"/, `${base} renderedObjectSetSHA256`),
    `${chartName} ${base}: the package base no longer matches the recorded rendered object set`,
  );

  const verdictRel = `${recipe}/publication/${verdictFile}`;
  const verdictText = readFileSync(repoPath(verdictRel), "utf8");
  const lane = grab(verdictText, /lane:\s*"([a-z-]+)"/, `${verdictRel} lane`);
  check(lane !== "do-not-flatten", `${chartName} ${base} is do-not-flatten and must not be bundled`);

  const inventory = readFileSync(repoPath(inventoryRel), "utf8");
  const crdNames = [...inventory.matchAll(/kind: "CustomResourceDefinition"\n\s+name: "([^"]+)"/g)].map((m) => m[1]);
  const objectCount = Number(grab(revision, /objectCount:\s*(\d+)/, `${base} objectCount`));

  // Which rendered objects carry the keep promise, read from the render rather
  // than assumed from the chart, because a base decides what actually renders.
  const protectedObjects = [];
  for (const doc of splitDocs(renderText)) {
    if (!/helm\.sh\/resource-policy/.test(doc)) continue;
    const kind = doc.match(/^kind:\s*"?([A-Za-z0-9.]+)"?\s*$/m)?.[1];
    const name = doc.match(/^\s{2}name:\s*"?([^"\n]+)"?/m)?.[1];
    if (kind && name) protectedObjects.push({ kind, name: name.trim() });
  }
  protectedObjects.sort((a, b) => (`${a.kind}/${a.name}` < `${b.kind}/${b.name}` ? -1 : 1));

  // The version belongs in the slug. Without it two versions of the same chart
  // and base write their routes to the same directory, and the second one wins
  // silently. external-secrets ships 2.5.0 and 2.8.0 in exactly that shape.
  const chartVersion = recipe.split("/").pop();
  const slug = `${chartName.replace("/", "-")}-${chartVersion}-${base}`;
  const routeFiles = [];
  if (crdNames.length > 0) {
    const routeRel = `data/certified-bundles/routes/catalog/${slug}/crd-ordering.yaml`;
    const route = buildCrdOrderingRoute({
      name: `${slug}-crd-ordering`,
      inventoryRel,
      verdictRel,
      crdNames: crdNames.sort(),
      otherCount: objectCount - crdNames.length,
    });
    const text = `${toYaml(route)}\n`;
    emittedRoutes.push({ path: repoPath(routeRel), contents: text });
    routeFiles.push({ path: routeRel, sha256: sha256(text), bytes: Buffer.byteLength(text), role: "route: crd-ordering" });
  }
  if (protectedObjects.length > 0) {
    const routeRel = `data/certified-bundles/routes/catalog/${slug}/prune-protection.yaml`;
    const route = buildPruneProtectionRoute({
      name: `${slug}-prune-protection`,
      protectedObjects,
      renderRel,
      verdictRel,
    });
    const text = `${toYaml(route)}\n`;
    emittedRoutes.push({ path: repoPath(routeRel), contents: text });
    routeFiles.push({
      path: routeRel,
      sha256: sha256(text),
      bytes: Buffer.byteLength(text),
      role: "route: resource-policy-keep",
    });
  }

  // A hook route is driven by the chart, not by the render. Flattening is
  // precisely what removes the hook objects, so a render-only scan reports the
  // class absent at the exact moment it matters most.
  if (hookObservation) {
    const routeRel = `data/certified-bundles/routes/catalog/${slug}/lifecycle.yaml`;
    const route = buildObservedLifecycleRoute({
      name: `${slug}-lifecycle`,
      observationRel: hookObservation.observationRel,
      hookDocCount: hookObservation.hookDocCount,
      verdictRel,
    });
    const text = `${toYaml(route)}\n`;
    emittedRoutes.push({ path: repoPath(routeRel), contents: text });
    routeFiles.push({ path: routeRel, sha256: sha256(text), bytes: Buffer.byteLength(text), role: "route: helm-hooks" });
  }

  const routeRefs = {};
  for (const file of routeFiles) routeRefs[file.role.slice("route:".length).trim()] = file.path;
  const dispositions = scanDispositions(scan, {
    renderScope: `the committed ${base} render`,
    templateEvidence: `the chart's template-level evidence is recorded in ${verdictRel}`,
    routeRefs,
  });

  if (hookObservation) {
    const row = dispositions.find((entry) => entry.class === "helm-hooks");
    check(
      row.finding === "absent",
      `${chartName} ${base}: the render carries hook objects, so the hook route would double-count them`,
    );
    row.finding = "present";
    row.detail = `${hookObservation.hookDocCount} hook object(s) in the packaged chart, none of which survive into the committed ${base} render`;
    row.disposition = `discharged by the route this bundle ships at ${routeRefs["helm-hooks"]}, whose stages were observed on a live cluster`;
    row.companionRequired = "lifecycle-job";
    row.evidence = hookObservation.observationRel;
  }

  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: `catalog-${slug}` },
    spec: {
      producer: { name: "config-workshop-catalog", repository: "https://github.com/confighub/helm-expt" },
      source: {
        kind: "helm-chart",
        charts: [
          {
            repository: grab(sourceLock, /repositoryURL:\s*"?([^"\n]+)"?/, `${chartName} repositoryURL`).trim(),
            name: chartName.split("/").pop(),
            version: grab(sourceLock, /^\s+version:\s*"?([^"\n]+)"?/m, `${chartName} version`).trim(),
            packageSHA256: grab(sourceLock, /packageSHA256:\s*"?([a-f0-9]{64})"?/, `${chartName} packageSHA256`),
          },
        ],
        evidence: [`${recipe}/source-lock.yaml`, revisionRel, verdictRel],
      },
      bundle: {
        contentsKind: "rendered-config",
        files: [{ ...bundleFile, role: "rendered object set" }, ...routeFiles],
        objectCount,
        objectInventoryRef: inventoryRel,
        images: buildImageInventory(scan.images),
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: {
        lane,
        status: "certified",
        decidedBy: `the flattening-safety audit at ${verdictRel}`,
        notes: notes ?? catalogBundleNote({ crds: scan.crds, keep: scan.keepDocs, lane }),
      },
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [`${recipe}/source-lock.yaml`, revisionRel, renderRel, bundleFileRel],
      },
    },
  };
}

function buildKubaraReceipt() {
  const componentDir = repoPath(SOURCES.kubaraComponent);
  const files = listFiles(componentDir)
    .map((path) => ({
      rel: relative(componentDir, path).split("/").join("/"),
      path,
    }))
    .sort((a, b) => (a.rel < b.rel ? -1 : 1))
    .map(({ rel, path }) => fileEntry(rel, path));
  const artifacts = readFileSync(repoPath(SOURCES.kubaraArtifacts), "utf8");
  const entry = artifacts.match(
    /- service: metrics-server\n\s+canonicalIdentity: ([^\n]+)\n\s+wrapperVersion: ([^\n]+)\n\s+version: ([^\n]+)\n\s+url: ([^\n]+)\n\s+sha256: ([a-f0-9]{64})/,
  );
  check(entry, "could not read the metrics-server entry in component-artifacts.yaml");
  const [, canonicalIdentity, wrapperVersion, version, url, sha] = entry;
  const scan = scanRendered(readFileSync(repoPath(SOURCES.metricsServerRender), "utf8"));
  const dispositions = scanDispositions(scan, {
    renderScope:
      "the catalog's committed metrics-server 3.13.1 default-variant render (the same chart version this wrapper pins; wrapper values can differ)",
    templateEvidence:
      "the catalog recipe at recipes/metrics-server/metrics-server/3.13.1 carries the chart-level evidence",
  });
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "kubara-current-platform-metrics-server" },
    spec: {
      producer: {
        name: "kubara",
        repository: KUBARA_CANONICAL_HOME.repository,
        commit: KUBARA_CANONICAL_HOME.commit,
      },
      source: {
        kind: "kubara-component",
        charts: [
          {
            repository: canonicalIdentity.trim(),
            name: "metrics-server",
            version: version.trim(),
            packageSHA256: sha,
            exactArtifactUrl: url.trim(),
          },
        ],
        canonicalHome: KUBARA_CANONICAL_HOME,
        evidence: [SOURCES.kubaraArtifacts, SOURCES.kubaraGeneration],
      },
      bundle: {
        contentsKind: "component-definition",
        files: files.map((file) => ({
          ...file,
          role: file.path === "templates/namespace.yaml" ? "namespace template" : "wrapper chart file",
        })),
        compositionIndexRef: SOURCES.kubaraArtifacts,
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: buildLane(readVerdict("recipes/metrics-server/metrics-server/3.13.1"), {
        provisionalLane: "safe-to-flatten",
        provisionalDecidedBy: `static scan over the catalog's render of the wrapped chart version (wrapper version ${wrapperVersion.trim()}); no hooks, keep-policy, webhooks, CRDs, or Secrets there`,
        openQuestions: [
          "the wrapper's own values were not rendered; certification renders the wrapper composition",
          "lookup, capabilities, and subchart conditions need the template-level audit",
        ],
        notes:
          "This bundle carries the component definition, which renders late today. The lane is the wrapped chart's, scoped to the audited base named in its verdict; the wrapper's own values were not rendered.",
      }),
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [
          SOURCES.kubaraComponent,
          SOURCES.kubaraArtifacts,
          SOURCES.metricsServerRender,
        ],
      },
    },
  };
}

// The producer's component set. A "copy" component is literal YAML in the
// producer's tree, so nothing renders and nothing is lost at render time: it is
// born flattened. A chart-sourced component takes the lane its chart's
// flattening-safety verdict decided, cited by exact version.
const EKS_INFERENCE_COMPONENTS = [
  {
    name: "platform-profile",
    sourceKind: "literal-yaml",
    contentsKind: "literal-config",
    notes:
      "The environment-owned values the rest of the stack links against. It renders nothing, so a flattened bundle loses nothing.",
  },
  {
    name: "ack-controllers",
    sourceKind: "helm-chart",
    contentsKind: "rendered-config",
    recipes: [
      "recipes/aws-controllers-k8s/ec2-chart/1.18.4",
      "recipes/aws-controllers-k8s/iam-chart/1.7.3",
      "recipes/aws-controllers-k8s/eks-chart/1.16.3",
    ],
    notes:
      "Three ACK controller charts rendered into one component. The producer already splits CRDs from controllers across Argo sync waves, which is exactly the ordering companion those verdicts require.",
  },
  {
    name: "aws-network",
    sourceKind: "literal-yaml",
    contentsKind: "literal-config",
    notes: "ACK custom resources describing the VPC and its address plan. Nothing templates.",
  },
  {
    name: "eks-cluster",
    sourceKind: "literal-yaml",
    contentsKind: "literal-config",
    notes: "ACK custom resources for the cluster, its node group, and its addons.",
  },
  {
    name: "karpenter-aws",
    sourceKind: "literal-yaml",
    contentsKind: "literal-config",
    notes: "The AWS-side identity wiring Karpenter needs, as ACK custom resources.",
  },
  {
    name: "karpenter",
    sourceKind: "helm-chart",
    contentsKind: "rendered-config",
    recipes: ["recipes/karpenter/karpenter/1.14.0"],
    notes:
      "The Karpenter controller chart, with the producer's handwritten NodePools and EC2NodeClasses shipped beside it in the same bundle.",
  },
  {
    name: "gpu-runtime",
    sourceKind: "helm-chart",
    contentsKind: "rendered-config",
    recipes: ["recipes/nvidia/nvidia-device-plugin/0.19.3"],
    notes:
      "The NVIDIA device plugin, so GPU nodes advertise their hardware. The chart's node-feature-discovery subchart stays gated off in this render.",
  },
  {
    name: "inference-workloads",
    sourceKind: "literal-yaml",
    contentsKind: "literal-config",
    notes: "The model-serving workloads themselves, as literal Kubernetes objects.",
  },
];

function eksInferenceWitnessPath(component) {
  return `data/certified-bundles/witnesses/eks-inference-${component}/witness.yaml`;
}

// A route derived from what the producer already declares. Their pipeline
// splits definitions from controllers and orders them with Argo sync waves, so
// the ordering is real but expressible only to Argo. Reading the waves back out
// and restating them as stages makes the same ordering portable to a runtime
// that has never heard of a sync wave, without inventing an ordering nobody
// chose.
// The third artifact class the model promises. A bundle carries the
// configuration, the routes that say how to apply it, and the words an operator
// needs beside it, so nothing operational or explanatory lives out of band. The
// guide is written from the receipt that ships it, which is why it cannot drift
// from what the bundle actually contains.
// A catalog bundle that has been published cites the artifact rather than the
// committed files it was built from. The publication receipt is written by
// scripts/publish-certified-bundles.mjs and read here, so this generator stays
// offline and a receipt never claims a publication that did not happen.
function publishedBundle(receiptName) {
  const slug = receiptName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const rel = `runs/certified-bundles/${slug}/publication-receipt.yaml`;
  const path = repoPath(rel);
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  return {
    rel,
    reference: grab(text, /reference:\s*"([^"]+)"/, `${rel} reference`),
    manifestDigest: grab(text, /manifestDigest:\s*"(sha256:[a-f0-9]{64})"/, `${rel} manifestDigest`),
    layerDigest: grab(text, /layerDigest:\s*"(sha256:[a-f0-9]{64})"/, `${rel} layerDigest`),
  };
}

// The first route that is not an ordering. Helm promises that an object
// annotated keep survives an uninstall; a reconciler that prunes whatever left
// its desired state does not know that promise exists. The route carries the
// promise as data so any runtime can honour it, and names the objects rather
// than a rule, because a rule that matches by pattern will eventually match
// something nobody meant to keep.
function buildPruneProtectionRoute({ name, protectedObjects, renderRel, verdictRel }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name },
    spec: {
      quirkClass: "resource-policy-keep",
      routeKind: "prune-protection",
      discharges:
        "Helm was asked to keep these objects when the release goes away. A reconciler that prunes anything absent from its desired state will delete them instead, and for a custom resource definition that takes every resource of that kind with it.",
      declaration: {
        protect: protectedObjects,
        onRemovalFromDesiredState: "leave in place and report, never delete",
      },
      executedBy: {
        runtimes: [
          {
            name: "Argo CD",
            mechanism: "Prune=false on each protected resource, or excluding them from automated pruning",
            proven: false,
          },
          {
            name: "Flux",
            mechanism: "kustomize.toolkit.fluxcd.io/prune: disabled on each protected resource",
            proven: false,
          },
          {
            name: "cub-direct applier",
            mechanism: "exclude the protected identities from the delete set it computes",
            proven: false,
          },
        ],
        // Never automatic. Deciding that an object outlives its release is a
        // judgment about data, and the runtimes express it by not acting.
        automatic: false,
      },
      boundedness: [
        "the route protects the objects it names; an object the bundle stops shipping is no longer covered by it",
        "protection is expressed by each runtime as a refusal to delete, so a runtime that ignores the route deletes silently",
        "no runtime is proven to execute this route yet, so today it is a declaration a human enforces",
      ],
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [renderRel],
        verdictRef: verdictRel,
      },
    },
  };
}

// The first route whose stages come from a run rather than from a reading of
// the chart. Every stage below names a check that passed on a live cluster and
// the evidence file it left behind, so the route declares what was watched
// instead of what the chart implies. Inventing stages here would be the exact
// failure the doctrine calls out: observe, then execute, then emit.
function buildObservedLifecycleRoute({ name, observationRel, hookDocCount, verdictRel }) {
  const observation = readYaml(repoPath(observationRel));
  const spec = observation.spec;
  check(spec.result === "pass", `${observationRel} did not pass, so nothing may be routed from it`);

  const passing = spec.checks.filter((row) => row.result === "pass");
  const stages = [];
  let order = 0;
  for (const row of passing) {
    if (!row.evidencePath) continue;
    order += 1;
    stages.push({
      order,
      name: row.name,
      observedDetail: row.detail,
      evidence: `${dirname(observationRel)}/${row.evidencePath}`,
      evidenceSHA256: row.evidenceSHA256,
    });
  }
  check(stages.length > 0, `${observationRel} recorded no evidence-bearing check to route`);

  // Checks the run recorded as actions without leaving a file. Naming them
  // separately keeps the stage list to things a reader can open.
  const actionsWithoutEvidence = passing
    .filter((row) => !row.evidencePath)
    .map((row) => row.name);

  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name },
    spec: {
      quirkClass: "helm-hooks",
      routeKind: "lifecycle-job",
      discharges: `The chart defines ${hookDocCount} hook object(s) that do not travel in a flattened bundle, so the work they do has to happen some other way. A recorded run installed this base without them and watched that work happen as the ordered actions below.`,
      declaration: {
        stages,
        ...(actionsWithoutEvidence.length > 0
          ? { actionsRecordedWithoutArtifacts: actionsWithoutEvidence }
          : {}),
        onStageFailure: "stop and report; never continue past a stage that did not pass",
      },
      executedBy: {
        runtimes: [
          {
            name: "Argo CD",
            mechanism: "PreSync hooks for the stages that precede the workload, with the rest as sync waves",
            proven: false,
          },
          {
            name: "Flux",
            mechanism: "a Kustomization dependsOn chain, one entry per stage",
            proven: false,
          },
          {
            name: "cub-direct applier",
            mechanism: "apply each stage in order and wait on the recorded condition before the next",
            proven: false,
          },
        ],
        // Ordering earned automatic because re-applying it changes nothing. This
        // route runs work, and work is not idempotent by default, so it stays
        // manual until a runtime is watched executing it.
        automatic: false,
      },
      boundedness: [
        `the stages were observed once, on ${spec.observedAt}, against ${spec.chart} ${spec.version} base ${spec.base}`,
        "the observation proves these stages ran and passed, not that they are the only ordering that works",
        "no runtime is proven to execute this route yet, so today it is a declaration a human follows",
        spec.lifecycleModel.claim,
      ],
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [observationRel],
        verdictRef: verdictRel,
      },
    },
  };
}

// Every decided base whose lane permits flattening and that has both a rendered
// release and a package base. The list is the catalog's render-early product,
// and it is deliberately not "every entry": publication is gated on a decided
// lane, so this grows as theme 1 does. A base whose render carries hook objects
// is absent until an observation exists to route them, which is why nvidia's
// nfd-enabled base is not here.
const CATALOG_BUNDLES = [
  { repo: "argo-cd", chart: "argo-cd", version: "9.5.15", base: "default" },
  { repo: "aws-controllers-k8s", chart: "ec2-chart", version: "1.18.4", base: "default" },
  { repo: "aws-controllers-k8s", chart: "ec2-chart", version: "1.18.4", base: "eks-inference" },
  { repo: "aws-controllers-k8s", chart: "eks-chart", version: "1.16.3", base: "default" },
  { repo: "aws-controllers-k8s", chart: "eks-chart", version: "1.16.3", base: "eks-inference" },
  { repo: "aws-controllers-k8s", chart: "iam-chart", version: "1.7.3", base: "default" },
  { repo: "aws-controllers-k8s", chart: "iam-chart", version: "1.7.3", base: "eks-inference" },
  { repo: "external-secrets", chart: "external-secrets", version: "2.5.0", base: "default" },
  { repo: "external-secrets", chart: "external-secrets", version: "2.8.0", base: "default" },
  { repo: "fluent", chart: "fluent-bit", version: "0.57.6", base: "default" },
  { repo: "hashicorp", chart: "vault", version: "0.32.0", base: "default" },
  { repo: "jetstack", chart: "cert-manager", version: "v1.20.2", base: "default" },
  { repo: "jetstack", chart: "cert-manager", version: "v1.21.0", base: "default" },
  { repo: "karpenter", chart: "karpenter", version: "1.14.0", base: "crds-managed" },
  { repo: "karpenter", chart: "karpenter", version: "1.14.0", base: "default" },
  { repo: "karpenter", chart: "karpenter", version: "1.14.0", base: "eks-inference" },
  { repo: "metrics-server", chart: "metrics-server", version: "3.13.0", base: "default" },
  { repo: "metrics-server", chart: "metrics-server", version: "3.13.1", base: "default" },
  { repo: "nvidia", chart: "nvidia-device-plugin", version: "0.19.3", base: "default" },
  { repo: "nvidia", chart: "nvidia-device-plugin", version: "0.19.3", base: "eks-inference" },
  { repo: "prometheus-community", chart: "prometheus-blackbox-exporter", version: "11.15.1", base: "default" },
  { repo: "prometheus-community", chart: "prometheus", version: "29.8.0", base: "default" },
  { repo: "secrets-store-csi-driver", chart: "secrets-store-csi-driver", version: "1.6.0", base: "default" },
];

// A note a reader can check rather than a sentence that fills the field. It
// states what the base actually renders and which companions therefore travel.
function catalogBundleNote({ crds, keep, lane }) {
  if (lane === "safe-to-flatten")
    return "Nothing this base renders is discharged at render time, so the rendered configuration is the whole delivery and no companion travels with it.";
  const parts = [];
  if (crds > 0)
    parts.push(`the ${crds} CustomResourceDefinition(s) it renders, which per-file Units can otherwise race`);
  if (keep > 0)
    parts.push(`the ${keep} object(s) carrying the keep promise, which a pruning reconciler would delete`);
  return `This base needs a companion for ${parts.join(", and for ")}. Each ships inside the bundle beside the rendered configuration.`;
}

// Which verdict file decided a base. Charts with more than one audited base name
// them explicitly, and the rest carry the unsuffixed file.
function verdictFileFor(recipe, base) {
  const suffixed = `${recipe}/publication/flattening-safety-verdict-${base}.yaml`;
  return existsSync(repoPath(suffixed))
    ? `flattening-safety-verdict-${base}.yaml`
    : "flattening-safety-verdict.yaml";
}

// What the bundle deploys, as opposed to what it is. The receipt hashes every
// byte of the rendered YAML, and that YAML names images by tag, so the bytes
// are fixed and the containers they start are not. A tag can be repushed, which
// is the same failure the catalog already records as upstream drift for two
// charts whose version strings moved under them. Recording the references and
// how each is pinned puts that boundary in the receipt instead of leaving a
// reader to assume a certified bundle certifies its images.
function buildImageInventory(references) {
  const rows = (references ?? []).map((reference) => ({
    reference,
    pinnedBy: reference.includes("@sha256:") ? "digest" : "tag",
  }));
  const byTag = rows.filter((row) => row.pinnedBy === "tag").length;
  return {
    scannedFrom: "image: keys in the rendered object set, which covers containers and initContainers",
    count: rows.length,
    pinnedByDigest: rows.length - byTag,
    pinnedByTag: byTag,
    boundary:
      byTag > 0
        ? "this receipt certifies the rendered bytes, not the images they name: a tag can be repushed under the same string"
        : "every image is digest-pinned, so the bundle and what it starts are both fixed",
    references: rows,
  };
}

function buildSpaceGuide({ name, producer, sourceLine, contentsKind, files, verdict, routeFiles, uploadCommand }) {
  const lines = [];
  lines.push(`# ${name}`);
  lines.push("");
  lines.push("<!-- Generated by npm run certified-bundles. Do not edit by hand. -->");
  lines.push("");
  lines.push(`This Space holds one certified bundle, ingested one Unit per file. ${sourceLine}`);
  lines.push("");
  lines.push("## What produced it");
  lines.push("");
  lines.push(`Producer: ${producer}. Contents: ${contentsKind}, ${files.length} file(s).`);
  lines.push("");
  lines.push("## Whether it may ship as plain YAML");
  lines.push("");
  const laneSentence = {
    "safe-to-flatten": "Nothing this bundle carries is discharged at render time, so it delivers as it stands.",
    "flatten-with-routes":
      "This bundle needs companion artifacts to deliver safely. They travel with it, and they are listed below.",
    "do-not-flatten":
      "This source is not certified to ship as literal rendered YAML. The render-late installer path stays its certified route.",
    "born-flattened": "Nothing renders here, so nothing is lost at render time.",
  }[verdict.lane];
  lines.push(`Lane: **${verdict.lane}** (${verdict.status}). ${laneSentence}`);
  lines.push("");
  lines.push(`Decided by: ${verdict.decidedBy}`);
  lines.push("");
  lines.push("## What its routes owe");
  lines.push("");
  if (routeFiles.length > 0) {
    lines.push("This bundle ships the following routes. A delivery runtime executes them; they are not documentation.");
    lines.push("");
    for (const route of routeFiles) lines.push(`- \`${route.path}\` discharges ${route.role.replace("route:", "").trim()}`);
  } else if (verdict.lane === "flatten-with-routes") {
    lines.push(
      "This bundle's lane requires companion artifacts and it ships none yet. Treat its ordering and lifecycle work as unresolved until a route arrives.",
    );
  } else {
    lines.push("This bundle owes no route.");
  }
  lines.push("");
  lines.push("## How it was ingested");
  lines.push("");
  lines.push("```sh");
  lines.push(uploadCommand);
  lines.push("```");
  lines.push("");
  lines.push(
    "The resolved digest is recorded on this Space as a `confighub.com/external-source` annotation, so the exact bytes installed here stay auditable.",
  );
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function buildObservedOrderingRoute({ name, witnessDir, fileRows, witnessRel, verdictRel }) {
  const waves = new Map();
  for (const row of fileRows) {
    const text = readFileSync(join(witnessDir, "files", row.path), "utf8");
    const wave = text.match(/argocd\.argoproj\.io\/sync-wave["']?\s*:\s*["']?(-?\d+)/)?.[1];
    if (wave === undefined) return null;
    const key = Number(wave);
    waves.set(key, [...(waves.get(key) ?? []), row.path]);
  }
  if (waves.size < 2) return null;

  const ordered = [...waves.entries()].sort(([left], [right]) => left - right);
  const stageName = (files) => {
    if (files.every((file) => file.includes("crds"))) return "custom-resource-definitions";
    if (files.every((file) => file.includes("namespace"))) return "namespace";
    if (files.every((file) => file.includes("controller"))) return "controllers";
    return files.map((file) => file.replace(/\.ya?ml$/, "")).join("-and-");
  };

  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name },
    spec: {
      quirkClass: "crd-ordering",
      routeKind: "apply-ordering",
      discharges:
        "Without an ordering declaration, per-file Units apply in no guaranteed order, so a custom resource can reach the cluster before the definition that gives it meaning, and a controller before the namespace that holds it.",
      declaration: {
        stages: ordered.map(([wave, files], index) => ({
          order: index + 1,
          name: stageName(files),
          selector: { files: files.sort() },
          ...(files.some((file) => file.includes("crds"))
            ? { waitFor: "every definition in this stage reports the Established condition" }
            : {}),
          objectCount: files.length,
          observedSyncWave: wave,
        })),
      },
      executedBy: {
        runtimes: [
          {
            name: "Argo CD",
            mechanism: "the sync-wave annotations the producer already emits, which this route reads back",
            proven: false,
          },
          {
            name: "Flux",
            mechanism: "dependsOn between one Kustomization per stage, in the order below",
            proven: false,
          },
          {
            name: "cub-direct applier",
            mechanism: "apply each stage and wait before starting the next",
            proven: false,
          },
        ],
        automatic: true,
      },
      boundedness: [
        "the stages restate the ordering the producer's own sync waves declare; they do not add an ordering nobody chose",
        "the route orders what the bundle contains, so a definition this bundle does not ship must already exist on the target",
        "only Argo is proven to execute this ordering today, because that is the runtime the producer uses",
      ],
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [witnessRel],
        verdictRef: verdictRel,
      },
    },
  };
}

function buildEksInferenceComponentReceipt(component) {
  const witnessRel = eksInferenceWitnessPath(component.name);
  const witnessDir = join(repoRoot, "data", "certified-bundles", "witnesses", `eks-inference-${component.name}`);
  const witness = readFileSync(repoPath(witnessRel), "utf8");
  const manifestDigest = grab(witness, /manifestDigest:\s*"(sha256:[a-f0-9]{64})"/, `${component.name} manifestDigest`);
  const layerDigest = grab(witness, /\bdigest:\s*"(sha256:[a-f0-9]{64})"/, `${component.name} layer digest`);
  const reference = grab(witness, /reference:\s*"([^"]+)"/, `${component.name} reference`);
  const producerCommit = grab(witness, /commit:\s*"([a-f0-9]{7,40})"/, `${component.name} producer commit`);
  const matches = /committedRenderMatches:\s*true/.test(witness);
  check(matches, `${witnessRel} records a bundle that no longer matches the producer's committed render`);

  const fileRows = [];
  // The witness writer emits list entries with the dash on its own line; the
  // hand-authored first witness used the inline form. Accept both.
  const filePattern =
    /-\s*\n?\s*path: "([^"]+)"\n\s+bundlePath: "([^"]+)"\n\s+sha256: "([a-f0-9]{64})"\n\s+bytes: (\d+)/g;
  for (const match of witness.matchAll(filePattern)) {
    const [, witnessRelFile, bundlePath, sha, bytes] = match;
    const onDisk = join(witnessDir, witnessRelFile);
    check(existsSync(onDisk), `witness file missing: ${witnessRelFile}`);
    check(sha256File(onDisk) === sha, `witness file drifted from its recorded hash: ${witnessRelFile}`);
    fileRows.push({ path: bundlePath, sha256: sha, bytes: Number(bytes) });
  }
  check(fileRows.length > 0, `${witnessRel} records no files`);

  const scanText = fileRows
    .map((row) => readFileSync(join(witnessDir, "files", row.path), "utf8"))
    .join("\n---\n");
  const scan = scanRendered(scanText);
  const literal = component.sourceKind === "literal-yaml";
  const dispositions = scanDispositions(scan, {
    renderScope: "the witnessed bundle files",
    templateEvidence: literal
      ? "nothing templates; the producer's source for this component is literal YAML"
      : "the chart's template-level evidence lives in its catalog entry",
  }).map((row) =>
    literal && row.finding === "not-evaluated"
      ? {
          ...row,
          finding: "absent",
          detail: "literal YAML; no template-time construct exists",
          disposition: "none required",
        }
      : row,
  );

  // A chart-sourced component inherits the lane its chart's verdict decided.
  // Where a component wraps several charts, the strictest lane governs.
  const LANE_ORDER = ["safe-to-flatten", "flatten-with-routes", "do-not-flatten"];
  const cited = (component.recipes ?? []).map((recipe) => readVerdict(recipe)).filter(Boolean);
  let verdict;
  if (literal) {
    verdict = {
      lane: "born-flattened",
      status: "certified",
      decidedBy: "the producer's source for this component is literal YAML; nothing renders, so nothing is lost at render time",
      notes: component.notes,
    };
  } else if (cited.length === (component.recipes ?? []).length && cited.length > 0) {
    const strictest = cited.reduce((worst, entry) =>
      LANE_ORDER.indexOf(entry.lane) > LANE_ORDER.indexOf(worst.lane) ? entry : worst,
    );
    verdict = {
      lane: strictest.lane,
      status: "certified",
      decidedBy:
        cited.length === 1
          ? `the flattening-safety audit at ${strictest.rel}`
          : `the strictest of ${cited.length} cited flattening-safety verdicts, ${strictest.rel}`,
      notes: component.notes,
    };
  } else {
    verdict = {
      lane: "do-not-flatten",
      status: "provisional",
      decidedBy: "no flattening-safety verdict covers this component's chart yet",
      notes: component.notes,
    };
  }

  // A component whose verdict requires an ordering companion gets one, built
  // from the ordering the producer already declares.
  let routeFile = null;
  if (verdict.lane === "flatten-with-routes" && verdict.status === "certified") {
    const routeRel = `data/certified-bundles/routes/eks-inference/${component.name}/crd-ordering.yaml`;
    const route = buildObservedOrderingRoute({
      name: `eks-inference-${component.name}-crd-ordering`,
      witnessDir,
      fileRows,
      witnessRel,
      verdictRel: (component.recipes ?? [])
        .map((recipe) => readVerdict(recipe))
        .filter(Boolean)[0]?.rel,
    });
    if (route) {
      const text = `${toYaml(route)}\n`;
      emittedRoutes.push({ path: repoPath(routeRel), contents: text });
      routeFile = {
        path: routeRel,
        sha256: sha256(text),
        bytes: Buffer.byteLength(text),
        role: "route: crd-ordering",
      };
      for (const row of dispositions) {
        if (row.class === "crd-ordering" && row.finding === "present")
          row.disposition = `discharged by the route this bundle ships at ${routeRel}`;
      }
    }
  }

  const spec = {
    producer: {
      name: "eks-inference",
      repository: EKS_INFERENCE.repository,
      commit: producerCommit,
    },
    source: {
      kind: component.sourceKind,
      evidence: [witnessRel, ...(component.recipes ?? []).map((recipe) => `${recipe}/source-lock.yaml`)],
    },
    bundle: {
      artifactType: "application/vnd.confighub.config.bundle.v1",
      reference,
      manifestDigest,
      layerDigest,
      reproducible: true,
      contentsKind: component.contentsKind,
      files: routeFile ? [...fileRows, routeFile] : fileRows,
    },
    ingest: {
      granularity: "per-file",
      spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
      externalSourceAnnotation: "confighub.com/external-source",
      uploadCommand: `cub variant upload --component ${component.name} --variant base --granularity per-file oci://${reference.replace(/:latest$/, "")}`,
    },
    dispositions,
    verdict,
    provenance: {
      emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
      generatedFrom: [witnessRel],
      witness: witnessRel,
    },
  };

  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: `eks-inference-${component.name}` },
    spec,
  };
}

function buildLegacyEksInferenceReceipt() {
  const witness = readFileSync(repoPath(SOURCES.witness), "utf8");
  const manifestDigest = grab(
    witness,
    /manifestDigest:\s*"(sha256:[a-f0-9]{64})"/,
    "witness manifestDigest",
  );
  const layerDigest = grab(witness, /\bdigest:\s*"(sha256:[a-f0-9]{64})"/, "witness layer digest");
  const reference = grab(witness, /reference:\s*"([^"]+)"/, "witness reference");
  const fileRows = [];
  const filePattern =
    /- path: "([^"]+)"\n\s+bundlePath: "([^"]+)"\n\s+sha256: "([a-f0-9]{64})"\n\s+bytes: (\d+)/g;
  for (const match of witness.matchAll(filePattern)) {
    const [, witnessRel, bundlePath, sha, bytes] = match;
    const onDisk = join(WITNESS_DIR, witnessRel);
    check(existsSync(onDisk), `witness file missing: ${witnessRel}`);
    check(
      sha256File(onDisk) === sha,
      `witness file drifted from its recorded hash: ${witnessRel}`,
    );
    fileRows.push({ path: bundlePath, sha256: sha, bytes: Number(bytes) });
  }
  check(fileRows.length === 2, "expected two files in the gpu-runtime witness");
  const scanText = fileRows
    .map((row) =>
      readFileSync(
        join(
          WITNESS_DIR,
          "files",
          row.path,
        ),
        "utf8",
      ),
    )
    .join("\n---\n");
  const scan = scanRendered(scanText);
  const dispositions = scanDispositions(scan, {
    renderScope: "the witnessed bundle files",
    templateEvidence:
      "the chart has no catalog entry yet; the producer's guard checked its five hazard patterns at build time",
  });
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "eks-inference-gpu-runtime" },
    spec: {
      producer: {
        name: "eks-inference",
        repository: EKS_INFERENCE.repository,
        commit: EKS_INFERENCE.commit,
      },
      source: {
        kind: "helm-chart",
        charts: [
          {
            repository: grab(witness, /chartRepository:\s*"([^"]+)"/, "witness chartRepository"),
            name: grab(witness, /chart:\s*"([^"]+)"/, "witness chart"),
            version: grab(witness, /chartVersion:\s*"([^"]+)"/, "witness chartVersion"),
          },
        ],
        evidence: [SOURCES.witness],
      },
      renderInputs: {
        renderer: "helm",
        kubeVersion: grab(witness, /kubeVersion:\s*"([^"]+)"/, "witness kubeVersion"),
        includeCrds: true,
        valuesRef: `${grab(witness, /valuesPath:\s*"([^"]+)"/, "witness valuesPath")} in the producer repository`,
      },
      bundle: {
        artifactType: "application/vnd.confighub.config.bundle.v1",
        reference,
        manifestDigest,
        layerDigest,
        reproducible: true,
        contentsKind: "rendered-config",
        files: fileRows.map((row) => ({
          ...row,
          role: row.path === "00-namespace.yaml" ? "namespace" : "controller",
        })),
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
        uploadCommand:
          "cub variant upload --component gpu-runtime --variant base --granularity per-file oci://ghcr.io/confighub/configs/eks-inference/gpu-runtime",
      },
      dispositions,
      verdict: buildLane(readVerdict("recipes/nvidia/nvidia-device-plugin/0.19.3"), {
        provisionalLane: "safe-to-flatten",
        provisionalDecidedBy:
          "static scan over the witnessed bundle files, agreeing with the producer's build-time guard; no hooks, keep-policy, webhooks, CRDs, or Secrets",
        openQuestions: [
          "lookup, capabilities, and subchart conditions need the template-level audit, which lands with the chart's catalog entry",
        ],
        notes:
          "This receipt certifies a bundle the producer published, not one this repository built. The witness records the pulled digests and the byte agreement with the producer's committed render.",
      }),
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [SOURCES.witness],
        witness: SOURCES.witness,
      },
    },
  };
}

function sveltosNotes() {
  const base =
    "The profile tells Sveltos to install kyverno/kyverno 3.8.1 with Helm on matching clusters. That chart's own lane is decided by its flattening-safety verdict, not by this bundle.";
  const verdict = readVerdict("recipes/kyverno/kyverno/3.8.1");
  if (!verdict) return base;
  return `${base} That verdict is ${verdict.lane} (${verdict.rel}), so the render-late delivery this profile ships is the chart's certified route.`;
}

function buildSveltosReceipt() {
  const profileRel = SOURCES.sveltosProfile;
  const profile = fileEntry("clusterprofile-pilot.yaml", repoPath(profileRel));
  const proof = readFileSync(repoPath(SOURCES.sveltosProof), "utf8");
  const rawSha = grab(proof, /rawSha256:\s*"([a-f0-9]{64})"/, "sveltos rawSha256");
  check(
    profile.sha256 === rawSha,
    "the committed ClusterProfile no longer matches the delivery proof's recorded hash",
  );
  const pilot = proof.match(
    /reference:\s*"(oci:\/\/127\.0\.0\.1:32807\/sveltos-kyverno-staging:pilot)"[\s\S]*?manifestDigest:\s*"(sha256:[a-f0-9]{64})"/,
  );
  check(pilot, "could not read the portable pilot artifact from the delivery proof");
  const scan = scanRendered(readFileSync(repoPath(profileRel), "utf8"));
  const dispositions = scanDispositions(scan, {
    renderScope: "the literal profile",
    templateEvidence: "nothing templates; the source is literal YAML",
  }).map((row) =>
    row.finding === "not-evaluated"
      ? {
          ...row,
          finding: "absent",
          detail: "literal YAML; no template-time construct exists",
          disposition: "none required",
        }
      : row,
  );
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "sveltos-kyverno-fleet-clusterprofile" },
    spec: {
      producer: {
        name: "sveltos-example",
        repository: "https://github.com/confighub/helm-expt",
      },
      source: {
        kind: "confighub-unit",
        evidence: [
          SOURCES.sveltosLock,
          "examples/sveltos/kyverno-fleet/live-receipt.yaml",
          SOURCES.sveltosProof,
        ],
      },
      bundle: {
        reference: pilot[1],
        manifestDigest: pilot[2],
        contentsKind: "literal-config",
        files: [{ ...profile, role: "ClusterProfile" }],
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: {
        lane: "born-flattened",
        status: "certified",
        decidedBy: "the source is literal YAML; nothing renders, so nothing is lost at render time",
        notes: sveltosNotes(),
      },
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [profileRel, SOURCES.sveltosProof],
      },
    },
  };
}

// An AICR entry's bundle is the rendered Argo CD Application set. Two facts
// decide its verdict, and they answer different questions.
//
// The wrapper was produced by rendering AICR's argocd-helm chart, so it is
// flattened output, and it carries sync-wave ordering plus automated sync
// policies that a delivery runtime executes. Ordering declarations are exactly
// what the flatten-with-routes lane covers, so that is the lane, and the route
// is emitted beside the receipt.
//
// The components are a separate question and deliberately out of scope. Each
// Application points at a chart that Argo CD renders at sync time, so no chart
// is flattened by this bundle and no chart's flattening verdict applies to it.
// Those verdicts stay the chart catalog's business.
function buildAicrReceipt(entry) {
  const entryRel = `examples/aicr/${entry.id}`;
  const renderedRel = `${entryRel}/argocd-rendered/templates`;
  const renderedDir = repoPath(renderedRel);
  check(existsSync(renderedDir), `${renderedRel} is missing`);
  const files = listFiles(renderedDir)
    .filter((path) => path.endsWith(".yaml"))
    .sort()
    .map((path) => ({
      ...fileEntry(relative(renderedDir, path), path),
      role: "Argo CD Application",
    }));
  check(files.length > 0, `${renderedRel} contains no Applications`);

  const indexRel = `${entryRel}/digest-index/platform-index.json`;
  const index = JSON.parse(readFileSync(repoPath(indexRel), "utf8"));
  const platformDigest = index.spec?.platformDigest ?? "";
  check(/^sha256:[0-9a-f]{64}$/.test(platformDigest), `${indexRel} records no platform digest`);

  const sourceReceiptRel = `${entryRel}/${entry.sourceReceipt}`;
  const sourceText = readFileSync(repoPath(sourceReceiptRel), "utf8");
  const version = grab(sourceText, /version:\s*"?(v[0-9.]+)"?/, `${entry.id} source version`);

  // The referenced charts, read from the rendered Applications. They are named
  // so the out-of-scope statement is checkable rather than asserted.
  const combined = files.map((row) => readFileSync(join(renderedDir, row.path), "utf8")).join("\n---\n");
  const charts = [...combined.matchAll(/^\s+chart:\s*"?([A-Za-z0-9._-]+)"?\s*$/gm)].map((row) => row[1]);
  const uniqueCharts = [...new Set(charts)].sort();

  // The ordering the bundle carries, read from the sync-waves themselves.
  const stages = files
    .map((row) => {
      const text = readFileSync(join(renderedDir, row.path), "utf8");
      const name = grab(text, /^\s*name:\s*"?([A-Za-z0-9._-]+)"?\s*$/m, `${row.path} name`);
      const wave = text.match(/argocd\.argoproj\.io\/sync-wave:\s*"?(-?\d+)"?/);
      return { name, wave: wave ? Number(wave[1]) : null };
    })
    .filter((row) => row.wave !== null)
    .sort((left, right) => left.wave - right.wave)
    // Ranked one to n. The sync-wave numbers themselves can have gaps, and a
    // route declares a sequence rather than a numbering.
    .map((row, position) => ({
      order: position + 1,
      name: row.name,
      observedSyncWave: row.wave,
      selector: { kinds: ["Application"], names: [row.name] },
    }));

  const routeRel = `data/certified-bundles/routes/aicr/${entry.name}/sync-wave-ordering.yaml`;
  const routeContents = `${toYaml({
      apiVersion: "evidence.confighub.com/v1alpha1",
      kind: "BundleRoute",
      metadata: { name: `${entry.name}-sync-wave-ordering` },
      spec: {
        quirkClass: "crd-ordering",
        routeKind: "apply-ordering",
        discharges:
          "The components of a platform install in a dependency order. Without an ordering declaration the Applications would apply in no guaranteed order, and a component would reach the cluster before the one it depends on.",
        declaration: { stages },
        executedBy: {
          runtimes: [
            {
              name: "Argo CD",
              mechanism: "the sync-wave annotation each Application carries",
              proven: false,
            },
          ],
          automatic: true,
        },
        boundedness: [
          "The order is not this project's invention. AICR computes deploymentOrder from the component dependency graph, and the ordering-parity lane checks that these sync-waves preserve it exactly.",
          "No runtime is proven to execute this route. The closest run, runs/aicr-cpu-starter-delivery, says so itself: the Applications were accepted with their sync waves preserved, the application controller was held at zero replicas, and zero sync operations were observed. Surviving delivery is not the same as being executed.",
        ],
        provenance: {
          emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
          generatedFrom: [renderedRel, `${entryRel}/recipe.yaml`, "data/aicr-ordering-parity/summary.md"],
        },
      },
    })}\n`;
  emittedRoutes.push({ path: repoPath(routeRel), contents: routeContents });

  const scan = scanRendered(combined);
  const dispositions = scanDispositions(scan, {
    renderScope: "the rendered Application set",
    templateEvidence: "the Applications are literal; the charts they reference are not rendered here",
  }).map((row) => {
    if (row.class === "crd-ordering") {
      return {
        ...row,
        finding: "present",
        detail: `${stages.length} Applications carry a sync-wave, and the order they declare is AICR's own deploymentOrder`,
        disposition: `route this bundle ships at ${routeRel}`,
        companionRequired: "apply-ordering",
      };
    }
    return row.finding === "not-evaluated"
      ? {
          ...row,
          detail:
            "not evaluated for this bundle: the charts these Applications reference are rendered by Argo CD at sync time, so no template-time construct is flattened here",
          disposition: "carried by the referenced chart's own catalog verdict",
        }
      : row;
  });

  // Task 22: the lane is decided by a verdict artifact, not asserted in the
  // receipt. The verdict is what the strict ingest gate makes us produce, and
  // producing it is what forces the platform-shape question to be answered.
  const verdictRel = `data/aicr-flattening-verdicts/${entry.name}/flattening-safety-verdict.yaml`;
  emittedRoutes.push({
    path: repoPath(verdictRel),
    contents: `${toYaml({
      apiVersion: "evidence.confighub.com/v1alpha1",
      kind: "FlatteningSafetyVerdict",
      metadata: { name: entry.name },
      spec: {
        subject: {
          kind: "aicr-platform-shape",
          entry: entryRel,
          platformDigest,
          upstreamVersion: version,
          note:
            "The subject is a platform shape rather than a chart. It is the rendered Argo CD Application set produced from AICR's argocd-helm bundle chart.",
        },
        dispositions,
        componentScope: {
          mode: "render-late-by-argo",
          referencedCharts: uniqueCharts,
          statement:
            "Each Application points at a chart that Argo CD renders at sync time. No chart is flattened by this shape, so no chart's flattening verdict is decided here. Those verdicts belong to the chart catalog and are read per chart.",
        },
        verdict: {
          lane: "flatten-with-routes",
          rationale:
            "The Application set is flattened output that carries an ordering declaration the delivery runtime executes. Ordering declarations are what this lane covers. Nothing else in the set needs a companion, because the constructs a flattening audit looks for live in the charts, and the charts are not flattened here.",
          routes: ["sync-wave ordering across the platform components"],
        },
        boundedness: [
          "This verdict decides the wrapper, not the components. A component chart can be do-not-flatten and still ship inside this shape safely, because this shape does not flatten it.",
          "The ordering is upstream's. AICR computes deploymentOrder from the dependency graph, and the ordering-parity lane checks these sync-waves preserve it.",
          "The Applications carry automated sync policies. That is a delivery decision, not a flattening hazard, and the delivery proof holds the controller at zero rather than inheriting it silently.",
          "No workload ran. This verdict is config-plane only, like every AICR receipt.",
        ],
        provenance: {
          emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
          generatedFrom: [renderedRel, indexRel, "data/aicr-ordering-parity/summary.md"],
        },
      },
    })}\n`,
  });


  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: entry.name },
    spec: {
      producer: {
        name: "aicr",
        repository: "https://github.com/confighub/helm-expt",
      },
      source: {
        kind: "aicr-entry",
        canonicalHome: {
          repository: "https://github.com/confighub/helm-expt",
          path: entryRel,
        },
        evidence: [sourceReceiptRel, indexRel, "data/aicr-ordering-parity/summary.md"],
      },
      bundle: {
        contentsKind: entry.kind,
        platformDigest,
        // The route travels inside the bundle, which is what the model means
        // by a companion artifact rather than a side note.
        files: [...files, { path: routeRel, sha256: sha256(routeContents), bytes: routeContents.length, role: "route:crd-ordering" }],
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: {
        lane: "flatten-with-routes",
        status: "certified",
        decidedBy: `the platform-shape flattening verdict at ${verdictRel}`,
        notes: [
          `The bundle is the rendered Argo CD Application set for AICR ${version}. It is flattened output, and it ships with one route: the sync-wave ordering, emitted beside this receipt.`,
          `The ${uniqueCharts.length} charts these Applications reference are not flattened by this bundle. Argo CD renders them at sync time, so their flattening verdicts belong to the chart catalog and are deliberately out of scope here.`,
          "No workload claim attaches. Every AICR receipt proves config-plane mechanics only.",
        ].join(" "),
        componentDelivery: {
          mode: "render-late-by-argo",
          referencedCharts: uniqueCharts,
          outOfScopeReason:
            "a chart this bundle points at is never flattened by it, so this bundle cannot carry that chart's flattening verdict",
        },
      },
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        generatedFrom: [renderedRel, indexRel, sourceReceiptRel],
      },
    },
  };
}

// The KServe entry retains literal serving documents rather than a rendered
// chart, so it takes the born-flattened lane the Sveltos profile takes.
function buildAicrKserveReceipt() {
  const entryRel = "examples/aicr/kserve-nim-inference";
  const roots = ["upstream/kserve/runtimes", "upstream/kserve/nim-models"];
  const files = roots.flatMap((rel) =>
    listFiles(repoPath(`${entryRel}/${rel}`))
      .filter((path) => path.endsWith(".yaml"))
      .sort()
      .map((path) => ({
        ...fileEntry(`${rel}/${relative(repoPath(`${entryRel}/${rel}`), path)}`, path),
        role: "KServe serving document",
      })),
  );
  check(files.length > 0, "the KServe entry retains no serving documents");
  const indexRel = `${entryRel}/digest-index/platform-index.json`;
  const index = JSON.parse(readFileSync(repoPath(indexRel), "utf8"));
  const combined = files
    .map((row) => readFileSync(repoPath(`${entryRel}/${row.path}`), "utf8"))
    .join("\n---\n");
  const scan = scanRendered(combined);
  const dispositions = scanDispositions(scan, {
    renderScope: "the retained serving documents",
    templateEvidence: "nothing templates; the source is literal YAML retained from upstream",
  }).map((row) =>
    row.finding === "not-evaluated"
      ? {
          ...row,
          finding: "absent",
          detail: "literal YAML; no template-time construct exists",
          disposition: "none required",
        }
      : row,
  );
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "CertifiedBundleReceipt",
    metadata: { name: "aicr-kserve-nim-inference" },
    spec: {
      producer: { name: "aicr", repository: "https://github.com/confighub/helm-expt" },
      source: {
        kind: "retained-upstream-tree",
        canonicalHome: { repository: "https://github.com/NVIDIA/nim-deploy", path: "kserve" },
        evidence: [`${entryRel}/retention-receipt.yaml`, indexRel],
      },
      bundle: {
        contentsKind: "literal-config",
        platformDigest: index.spec?.platformDigest ?? "",
        files,
      },
      ingest: {
        granularity: "per-file",
        spacePattern: "{{.Labels.Component}}-{{.Labels.Variant}}",
        externalSourceAnnotation: "confighub.com/external-source",
      },
      dispositions,
      verdict: {
        lane: "born-flattened",
        status: "certified",
        decidedBy: "the source is literal YAML retained from upstream; nothing renders, so nothing is lost at render time",
        notes:
          "The gated container images these documents reference are recorded as references. Nothing here mirrors an NGC artifact, and no NIM container ran to certify this bundle.",
      },
      provenance: {
        emittedBy: "scripts/generate-certified-bundle-receipts.mjs",
        // The entry root is listed so each retained document resolves from it.
        generatedFrom: [entryRel, `${entryRel}/retention-receipt.yaml`, indexRel],
      },
    },
  };
}

function toCsv(rows) {
  const header =
    "producer,name,source_kind,contents_kind,chart,chart_version,bundle_digest,file_count,verdict_lane,verdict_status,oci_reference,oci_published,receipt";
  const lines = rows.map((row) =>
    [
      row.producer,
      row.name,
      row.sourceKind,
      row.contentsKind,
      row.chart,
      row.chartVersion,
      row.digest,
      row.fileCount,
      row.lane,
      row.status,
      row.ociReference,
      row.published,
      row.receipt,
    ].join(","),
  );
  return `${[header, ...lines].join("\n")}\n`;
}

function summaryRow(receipt, receiptRel) {
  const spec = receipt.spec;
  const chart = spec.source.charts?.[0];
  return {
    producer: spec.producer.name,
    name: receipt.metadata.name,
    sourceKind: spec.source.kind,
    contentsKind: spec.bundle.contentsKind,
    chart: chart ? chart.name : "",
    chartVersion: chart ? chart.version : "",
    digest: spec.bundle.manifestDigest ?? spec.bundle.files[0].sha256,
    fileCount: spec.bundle.files.length,
    lane: spec.verdict.lane,
    status: spec.verdict.status,
    receipt: receiptRel,
    ociReference: spec.bundle.reference ?? "",
    published: spec.bundle.manifestDigest ? "published" : "not published",
  };
}

function summaryMd(rows) {
  const lines = [];
  lines.push("# Certified bundle receipts");
  lines.push("");
  lines.push(
    "One receipt shape covers a bundle from every producer. These four reference receipts prove it: the catalog's flattened traefik render, a Kubara component definition, a bundle eks-inference published to its own registry, and the Sveltos example's literal ClusterProfile. The spec lives at docs/reference/certified-bundle-spec.md and the schema at schemas/certified-bundle-receipt.schema.json.",
  );
  lines.push("");
  lines.push("| producer | component | source | OCI | lane | status |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const row of rows) {
    const source = row.chart ? `${row.chart} ${row.chartVersion}` : row.sourceKind;
    const oci = row.ociReference
      ? `\`${row.ociReference}\``
      : row.published === "published"
        ? "published"
        : "not published";
    lines.push(
      `| ${row.producer} | ${row.name.replace(/^(eks-inference|kubara|catalog|sveltos)-/, "")} | ${source} | ${oci} | ${row.lane} | ${row.status} |`,
    );
  }
  lines.push("");
  lines.push(
    "The OCI column states where the bundle is published, and says so plainly when it is not. A bundle without a published reference is still certified: the receipt describes committed bytes, and publication adds a digest to the same receipt shape rather than changing what it claims.",
  );
  lines.push("");
  lines.push(
    "A provisional verdict states what current evidence supports and names its open questions in the receipt. The flattening-safety audit certifies lanes; a lane moves when its receipt changes, never by hand.",
  );
  lines.push("");
  lines.push(
    "The eight eks-inference receipts certify artifacts this repository did not build. Each witness records the pulled manifest and layer digests, and every extracted file hashed identically to the producer's committed render at the recorded commit. Their five literal components are born flattened; the three chart-sourced ones carry the lane their charts' verdicts decided, and where a component wraps several charts the strictest lane governs.",
  );
  lines.push("");
  lines.push(
    "The Kubara receipt reads the byte-faithful mirror under examples/kubara. Its canonicalHome block pins the maintained copy in kubara-confighub, so removing the mirror re-points the generator instead of breaking it silently.",
  );
  lines.push("");
  lines.push("Regenerate with `npm run certified-bundles`. Verify with `npm run certified-bundles:verify`.");
  lines.push("");
  return lines.join("\n");
}

function buildAll() {
  const receipts = [
    { rel: "data/certified-bundles/receipts/catalog/traefik-traefik-41.0.2-default/receipt.yaml", value: buildTraefikReceipt() },
    {
      rel: "data/certified-bundles/receipts/catalog/cert-manager-v1.21.0-crds-enabled/receipt.yaml",
      value: buildCatalogBundleReceipt({
        recipe: "recipes/jetstack/cert-manager/v1.21.0",
        packageRoot: "packages/jetstack/cert-manager/v1.21.0",
        base: "crds-enabled",
        chartName: "jetstack/cert-manager",
        verdictFile: "flattening-safety-verdict-crds-enabled.yaml",
        notes:
          "This base renders the six cert-manager CRDs, so it carries both the keep promise and the ordering hazard, and ships a route for each. The startupapicheck hook is excluded from the render rather than routed, which the hooks disposition states.",
      }),
    },
    {
      rel: "data/certified-bundles/receipts/catalog/gatekeeper-gatekeeper-3.22.2-default/receipt.yaml",
      value: buildCatalogBundleReceipt({
        recipe: "recipes/gatekeeper/gatekeeper/3.22.2",
        packageRoot: "packages/gatekeeper/gatekeeper/3.22.2",
        base: "default",
        chartName: "gatekeeper/gatekeeper",
        verdictFile: "flattening-safety-verdict.yaml",
        hookObservation: {
          observationRel: "runs/hook-lifecycle/gatekeeper-gatekeeper/default/latest/receipt.yaml",
          hookDocCount: 17,
        },
        notes:
          "The first bundle whose hook disposition points at a route rather than at an intention. The chart defines 17 hook objects and none of them travel here, so the lifecycle route carries the stages a recorded live run watched instead: the separated Secret, CRD establishment, controller and webhook readiness, and a server-side admission dry-run. The route is not automatic, because it runs work rather than declaring order.",
      }),
    },
    {
      rel: "data/certified-bundles/receipts/catalog/tigera-operator-v3.32.0-default/receipt.yaml",
      value: buildCatalogBundleReceipt({
        recipe: "recipes/projectcalico/tigera-operator/v3.32.0",
        packageRoot: "packages/projectcalico/tigera-operator/v3.32.0",
        base: "default",
        chartName: "projectcalico/tigera-operator",
        verdictFile: "flattening-safety-verdict.yaml",
        hookObservation: {
          observationRel: "runs/hook-lifecycle/projectcalico-tigera-operator/default/latest/receipt.yaml",
          hookDocCount: 1,
        },
        notes:
          "The teardown is the whole hook story here. A flattened bundle drops the pre-delete Job silently, and the release only misses it when it goes away, which is the worst time to find out. The recorded run rendered that Job and ran it, so the route's stages include the execution itself rather than a rehearsal of it.",
      }),
    },
    ...CATALOG_BUNDLES.map((entry) => {
      const recipe = `recipes/${entry.repo}/${entry.chart}/${entry.version}`;
      return {
        rel: `data/certified-bundles/receipts/catalog/${entry.chart}-${entry.version}-${entry.base}/receipt.yaml`,
        value: buildCatalogBundleReceipt({
          recipe,
          packageRoot: `packages/${entry.repo}/${entry.chart}/${entry.version}`,
          base: entry.base,
          chartName: `${entry.repo}/${entry.chart}`,
          verdictFile: verdictFileFor(recipe, entry.base),
        }),
      };
    }),
    { rel: "data/certified-bundles/receipts/kubara/current-platform-metrics-server/receipt.yaml", value: buildKubaraReceipt() },
    ...EKS_INFERENCE_COMPONENTS.map((component) => ({
      rel: `data/certified-bundles/receipts/eks-inference/${component.name}/receipt.yaml`,
      value: buildEksInferenceComponentReceipt(component),
    })),
    { rel: "data/certified-bundles/receipts/sveltos/kyverno-fleet-clusterprofile/receipt.yaml", value: buildSveltosReceipt() },
    ...AICR_ENTRIES.map((entry) => ({
      rel: `data/certified-bundles/receipts/aicr/${entry.id}/receipt.yaml`,
      value: buildAicrReceipt(entry),
    })),
    { rel: "data/certified-bundles/receipts/aicr/kserve-nim-inference/receipt.yaml", value: buildAicrKserveReceipt() },
  ];
  for (const receipt of receipts) {
    const spec = receipt.value.spec;
    const chart = spec.source.charts?.[0];
    const guideRel = `${receipt.rel.replace(/\/receipt\.yaml$/, "")}/space-guide.md`.replace(
      "data/certified-bundles/receipts/",
      "data/certified-bundles/guides/",
    );
    const routeFiles = spec.bundle.files.filter((file) => String(file.role ?? "").startsWith("route:"));
    const published = publishedBundle(receipt.value.metadata.name);
    const guide = buildSpaceGuide({
      name: receipt.value.metadata.name,
      producer: spec.producer.name,
      sourceLine: chart
        ? `It was produced from ${chart.name} ${chart.version}.`
        : `Its source is ${spec.source.kind.replace(/-/g, " ")}.`,
      contentsKind: spec.bundle.contentsKind,
      files: spec.bundle.files,
      verdict: spec.verdict,
      routeFiles,
      uploadCommand:
        spec.ingest.uploadCommand ??
        (published
          ? `cub variant upload --component ${receipt.value.metadata.name} --variant base --granularity per-file oci://${published.reference.replace(/:latest$/, "")}`
          : `cub variant upload --component ${receipt.value.metadata.name} --variant base --granularity per-file <bundle>`),
    });
    emittedRoutes.push({ path: repoPath(guideRel), contents: guide });

    if (published) {
      spec.bundle.artifactType = "application/vnd.confighub.config.bundle.v1";
      spec.bundle.reference = published.reference;
      spec.bundle.manifestDigest = published.manifestDigest;
      spec.bundle.layerDigest = published.layerDigest;
      spec.bundle.reproducible = true;
      spec.provenance.generatedFrom = [...spec.provenance.generatedFrom, published.rel];
    }
    spec.bundle.files = [
      ...spec.bundle.files,
      {
        path: guideRel,
        sha256: sha256(guide),
        bytes: Buffer.byteLength(guide),
        role: "space-guide",
      },
    ];

    const classes = receipt.value.spec.dispositions.map((row) => row.class);
    check(
      QUIRK_CLASSES.every((cls) => classes.includes(cls)),
      `${receipt.rel} is missing a quirk class row`,
    );
  }
  const rows = receipts.map((receipt) => summaryRow(receipt.value, receipt.rel));
  const outputs = receipts.map((receipt) => ({
    path: repoPath(receipt.rel),
    contents: `${toYaml(receipt.value)}\n`,
  }));
  outputs.push(...emittedRoutes);
  outputs.push({ path: join(OUT_DIR, "receipts.csv"), contents: toCsv(rows) });
  outputs.push({ path: join(OUT_DIR, "summary.md"), contents: summaryMd(rows) });
  return outputs;
}

const outputs = buildAll();
if (mode === "--generate") {
  for (const output of outputs) write(output.path, output.contents);
  console.log(`wrote ${outputs.length} certified-bundle file(s)`);
} else if (mode === "--verify") {
  for (const output of outputs) {
    const rel = relativeRepo(output.path);
    check(existsSync(output.path), `${rel} is missing; run npm run certified-bundles`);
    check(
      readFileSync(output.path, "utf8") === output.contents,
      `${rel} is stale; run npm run certified-bundles`,
    );
  }
  console.log(`verified ${outputs.length} certified-bundle file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-certified-bundle-receipts.mjs --generate
  node scripts/generate-certified-bundle-receipts.mjs --verify`);
}
