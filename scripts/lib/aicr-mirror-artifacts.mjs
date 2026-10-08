// The two OCI artifacts each mirrored AICR entry needs before it can be
// delivered, and the receipts that say an artifact was published.
//
// A mirrored entry is a set of rendered Argo CD Applications. Some of those
// Applications take their source from the entry's own AICR bundle, at a
// reference the entry plans. So an entry is deliverable only when two things
// are public. The first is the source package, the retained argocd-helm
// bundle as a Helm chart OCI artifact at the reference the Applications name.
// The second is the literal configuration bundle, the rendered Applications
// with their route files, a requirements file and a guide.
//
// Both artifacts are built in this process from committed bytes. The tar, the
// gzip container and the manifest are written byte by byte, so the digests are
// the same on every machine, and no OCI layout has to be committed. A plan for
// each artifact is committed with its digest, and the generator's verify mode
// rebuilds every artifact and compares.
//
// Nothing in this module contacts a registry. The publisher,
// scripts/publish-aicr-mirror-artifacts.mjs, does the pushing, and only when
// the maintainer asks. An artifact counts as published only when a tracked
// receipt exists whose digests equal the ones computed here. A receipt for
// other bytes is refused.
//
// The plans, the companion files and the summaries say nothing about
// publication, so none of them moves when a receipt lands. The publication
// state reaches a reader through the entry's Catalog record, which
// aicrMirrorDelivery below writes from the receipts.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AICR_BUNDLE_PATH_SOURCE,
  loadAicrRecipeEntries,
  orderingSentences,
} from "./aicr-recipe-entries.mjs";
import {
  INPUT_PLACEHOLDER,
  landingCounts,
  placeholderLandings,
  requiredInputFindings,
} from "./aicr-required-inputs.mjs";
import { deterministicGzip, deterministicTar, readLayerFiles, writeNimServiceOciLayout } from "./nimservice-publication.mjs";
import { check, listFiles, readYamlText, readYamlTexts, repoRoot, serializeYaml, trackedExists } from "./proof-common.mjs";

export const AICR_MIRROR_DATA_ROOT = "data/aicr-mirror-artifacts";
export const AICR_MIRROR_RECEIPT_ROOT = "runs/aicr-mirror-artifacts";
export const AICR_MIRROR_GENERATOR = "scripts/generate-aicr-mirror-artifacts.mjs";
export const AICR_MIRROR_PUBLISHER = "scripts/publish-aicr-mirror-artifacts.mjs";
export const AICR_MIRROR_REGISTRY = "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt";
export const AICR_MIRROR_BUNDLE_REGISTRY = `${AICR_MIRROR_REGISTRY}/bundles`;
export const SOURCE_PACKAGE = "source-package";
export const LITERAL_CONFIG = "literal-config";
export const AICR_MIRROR_ARTIFACT_ROLES = [SOURCE_PACKAGE, LITERAL_CONFIG];
export const AICR_MIRROR_PLAN_KIND = "AicrMirrorArtifactPlan";
export const AICR_MIRROR_RECEIPT_KIND = "AicrMirrorArtifactPublicationReceipt";
export const AICR_MIRROR_PUBLISHED_STATUS = "published-with-receipt";
export const AICR_MIRROR_UNPUBLISHED_STATUS = "not-published";
export const HELM_CONFIG_TYPE = "application/vnd.cncf.helm.config.v1+json";
export const HELM_CHART_LAYER_TYPE = "application/vnd.cncf.helm.chart.content.v1.tar+gzip";
export const LITERAL_ARTIFACT_TYPE = "application/vnd.confighub.config.bundle.v1";
export const LITERAL_LAYER_TYPE = "application/vnd.oci.image.layer.v1.tar+gzip";
// A retained bundle file or a rendered Application is a few kilobytes, and the
// largest is a few hundred. A file above this size is not one of them.
export const AICR_MIRROR_STAGED_FILE_MAX_BYTES = 4 * 1024 * 1024;

// The four states an entry's pair of artifacts can be in. The word is what a
// record carries in evidence.retention, and the first one is the word the
// mirror has always carried.
export const AICR_MIRROR_STATES = {
  neither: "retained-and-rendered-not-published-not-deployed",
  sourceOnly: "source-package-published-literal-bundle-not-published-not-deployed",
  literalOnly: "literal-bundle-published-source-package-missing-not-deliverable",
  both: "source-package-and-literal-bundle-published-not-deployed",
};

const OCI_MANIFEST_TYPE = "application/vnd.oci.image.manifest.v1+json";
const OCI_EMPTY_CONFIG_TYPE = "application/vnd.oci.empty.v1+json";
const OCI_EMPTY_CONFIG = Buffer.from("{}");
const CREATED_ANNOTATION = "1970-01-01T00:00:00Z";
const BUNDLE_INVENTORY = "argocd-helm-bundle-checksums.txt";
const CHART_NAME = "aicr-bundle";
const SYNC_WAVE_ROUTE = "routes/sync-wave-ordering.yaml";
const PLACEHOLDER_ROUTE = "routes/system-node-selector-placeholder.yaml";
const LEFT_OUT_ROUTE = "routes/components-left-out-of-bundle.yaml";
const REQUIREMENTS_FILE = "requirements/target-requirements.yaml";

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
const stripOci = (reference) => String(reference).replace(/^oci:\/\//, "");

export const aicrMirrorDataDir = (id) => `${AICR_MIRROR_DATA_ROOT}/${id}`;
export const aicrMirrorPlanRel = (id, role) => `${aicrMirrorDataDir(id)}/${role}-oci.yaml`;
export const aicrMirrorReceiptRel = (id, role) => `${AICR_MIRROR_RECEIPT_ROOT}/${id}/${role}-receipt.yaml`;

// --- what one mirrored entry is, read from committed files ---------------------

function readBundleInventory(entry, root) {
  const inventoryRel = `${entry.entryRel}/${BUNDLE_INVENTORY}`;
  const inventoryPath = join(root, inventoryRel);
  check(existsSync(inventoryPath), `${inventoryRel} is missing, so the retained bundle of ${entry.id} has no checksum list`);
  const rows = readFileSync(inventoryPath, "utf8").split("\n").filter(Boolean).map((line) => {
    const match = /^([0-9a-f]{64})  ([A-Za-z0-9._\/-]+)$/.exec(line);
    check(match && !match[2].includes(".."), `${inventoryRel}: unparseable row: ${line}`);
    return { path: match[2], sha256: match[1] };
  });
  const bundleRoot = join(root, entry.bundleRel);
  const onDisk = listFiles(bundleRoot).map((path) => path.slice(bundleRoot.length + 1).replaceAll("\\", "/")).sort();
  check(
    JSON.stringify(onDisk) === JSON.stringify(rows.map((row) => row.path).sort()),
    `${entry.bundleRel} does not hold exactly the files ${inventoryRel} lists`,
  );
  const retained = entry.receipt.retained?.sourceBundleInventory ?? {};
  check(
    retained.path === inventoryRel && retained.sha256 === sha256Hex(readFileSync(inventoryPath)) && retained.files === rows.length,
    `${entry.receiptRel} does not record the checksum list at ${inventoryRel} as it is now`,
  );
  return { inventoryRel, rows };
}

// Chart.yaml as AICR writes it is a flat map of scalars, so it is read here
// without a YAML process. Anything else is refused.
function chartMetadata(text, rel) {
  const metadata = {};
  for (const line of text.split("\n").filter((row) => row.trim() && !row.startsWith("#"))) {
    const match = /^([A-Za-z]+): (.*)$/.exec(line);
    check(match, `${rel}: expected a flat map of scalars, found ${line}`);
    metadata[match[1]] = match[2].replace(/^"(.*)"$/, "$1");
  }
  return metadata;
}

function buildEntry(recipeEntry, root) {
  const id = recipeEntry.id;
  check(recipeEntry.bundleRel, `${recipeEntry.entryRel}: a mirrored entry must retain its argocd-helm bundle`);
  const inputs = recipeEntry.receipt.newRequiredInputs ?? [];
  const placeholders = inputs.filter((input) => input.valueStatus === INPUT_PLACEHOLDER);
  const applications = recipeEntry.applications.map((application) => ({
    name: application.name,
    file: application.path.split("/").at(-1),
    source: application.path,
    syncWave: application.syncWave ?? null,
    automatedSync: application.automatedSync,
  }));
  const fileNames = applications.map((application) => application.file);
  check(new Set(fileNames).size === fileNames.length, `${recipeEntry.entryRel}: two rendered Applications share one file name`);
  const sourcePackageRef = `${recipeEntry.sourcePackageRepository}:${recipeEntry.sourcePackageRevision}`;
  check(
    stripOci(recipeEntry.sourcePackageRepository) === `${AICR_MIRROR_REGISTRY}/aicr-${id}/${CHART_NAME}`,
    `${recipeEntry.entryRel}: the rendered Applications name ${recipeEntry.sourcePackageRepository}, which is not this entry's own source package repository`,
  );
  check(
    recipeEntry.receipt.plannedArtifacts?.sourcePackage?.reference === sourcePackageRef,
    `${recipeEntry.receiptRel} plans another source package reference than the one the rendered Applications name`,
  );
  const entry = {
    id,
    recordName: recipeEntry.recordName,
    version: recipeEntry.version,
    overlay: recipeEntry.selectedOverlay,
    entryRel: recipeEntry.entryRel,
    receiptRel: recipeEntry.receiptRel,
    bundleRel: recipeEntry.bundleRel,
    templatesRel: recipeEntry.templatesRel,
    orderingRecipeRel: recipeEntry.orderingRecipeRel,
    platformDigest: recipeEntry.platformDigest,
    indexRel: recipeEntry.indexRel,
    criteria: recipeEntry.receipt.criteria,
    generationInputs: recipeEntry.receipt.generationInputs,
    requiredInputs: inputs,
    placeholders,
    answeredRefusals: recipeEntry.receipt.answeredRefusals ?? [],
    leftOutOfBundle: recipeEntry.leftOutOfBundle,
    leftOutEdges: recipeEntry.leftOutEdges,
    ordering: recipeEntry.ordering,
    orderingText: orderingSentences(recipeEntry),
    nestedSources: recipeEntry.nestedSources,
    applications,
    sourcePackageRef,
    sourcePackageRepository: recipeEntry.sourcePackageRepository,
    sourcePackageTag: recipeEntry.sourcePackageRevision,
    dataDir: aicrMirrorDataDir(id),
  };
  entry.bundlePathApplications = entry.nestedSources.filter((row) => row.kind === AICR_BUNDLE_PATH_SOURCE).map((row) => row.application);
  entry.bundleInventory = readBundleInventory(recipeEntry, root);
  return entry;
}

// --- the source package ---------------------------------------------------------

// The retained bundle as a Helm chart OCI artifact. `readFile` lets a test
// change one byte. The files and their order come from the entry's checksum
// list, and each file is checked against it before it is staged.
export function buildSourcePackageArtifact(entry, { root = repoRoot, readFile } = {}) {
  const read = readFile ?? ((rel) => readFileSync(join(root, rel)));
  const stagedFiles = entry.bundleInventory.rows.map((row) => {
    const source = `${entry.bundleRel}/${row.path}`;
    const data = Buffer.from(read(source));
    check(
      data.length <= AICR_MIRROR_STAGED_FILE_MAX_BYTES,
      `${entry.id}: the bundle file ${source} is ${data.length} bytes, more than a generated bundle file can be`,
    );
    check(
      sha256Hex(data) === row.sha256,
      `${entry.id}: ${source} is not the file ${entry.bundleInventory.inventoryRel} lists, so the retained bundle changed after it was generated`,
    );
    return { path: row.path, source, role: "bundle file", data, bytes: data.length, sha256: row.sha256 };
  });
  const chartFile = stagedFiles.find((file) => file.path === "Chart.yaml");
  check(chartFile, `${entry.id}: the retained bundle holds no Chart.yaml`);
  const chart = chartMetadata(chartFile.data.toString("utf8"), chartFile.source);
  check(
    chart.name === CHART_NAME && chart.version === entry.sourcePackageTag,
    `${entry.id}: the retained chart is ${chart.name} ${chart.version}, and the rendered Applications ask for ${CHART_NAME} ${entry.sourcePackageTag}`,
  );
  const config = Buffer.from(JSON.stringify({
    name: chart.name,
    version: chart.version,
    description: chart.description,
    apiVersion: chart.apiVersion,
    type: chart.type,
  }));
  const layer = deterministicGzip(deterministicTar(stagedFiles, { prefix: `${CHART_NAME}/` }));
  const layerDigest = digestOf(layer);
  const layerTitle = `${CHART_NAME}-${chart.version}.tgz`;
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 2,
    mediaType: OCI_MANIFEST_TYPE,
    config: { mediaType: HELM_CONFIG_TYPE, digest: digestOf(config), size: config.length },
    layers: [{
      mediaType: HELM_CHART_LAYER_TYPE,
      digest: layerDigest,
      size: layer.length,
      annotations: { "org.opencontainers.image.title": layerTitle },
    }],
    annotations: { "org.opencontainers.image.created": CREATED_ANNOTATION },
  }));
  const manifestDigest = digestOf(manifest);
  const repository = stripOci(entry.sourcePackageRepository);
  return {
    role: SOURCE_PACKAGE,
    entryId: entry.id,
    recordName: entry.recordName,
    format: "helm-chart-oci",
    artifactType: HELM_CONFIG_TYPE,
    layerMediaType: HELM_CHART_LAYER_TYPE,
    layerTitle,
    tag: entry.sourcePackageTag,
    repository,
    reference: `${repository}:${entry.sourcePackageTag}`,
    immutableReference: `${repository}@${manifestDigest}`,
    stagedFiles,
    config,
    layer,
    layerDigest,
    layerBytes: layer.length,
    manifest,
    manifestDigest,
    inventory: { path: entry.bundleInventory.inventoryRel, sha256: sha256Hex(readFileSync(join(root, entry.bundleInventory.inventoryRel))) },
    planRel: aicrMirrorPlanRel(entry.id, SOURCE_PACKAGE),
    receiptRel: aicrMirrorReceiptRel(entry.id, SOURCE_PACKAGE),
  };
}

// --- the companion files of the literal bundle -----------------------------------

const provenance = (generatedFrom) => ({ emittedBy: AICR_MIRROR_GENERATOR, generatedFrom });

function syncWaveRoute(entry) {
  const waves = [...new Set(entry.applications.filter((application) => application.syncWave !== null).map((application) => Number(application.syncWave)))]
    .sort((left, right) => left - right);
  const stages = waves.map((wave, position) => {
    const names = entry.applications.filter((application) => application.syncWave !== null && Number(application.syncWave) === wave).map((application) => application.name).sort();
    return { order: position + 1, name: `sync-wave-${wave}`, observedSyncWave: wave, objectCount: names.length, selector: { kinds: ["Application"], names } };
  });
  const root = entry.applications.find((application) => application.syncWave === null);
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-sync-wave-ordering` },
    spec: {
      quirkClass: "crd-ordering",
      routeKind: "apply-ordering",
      discharges:
        "The components of a platform install in a dependency order. Without an ordering declaration the Applications would apply in no guaranteed order, and a component would reach the cluster before the one it depends on.",
      declaration: { platformRoot: { name: root.name, file: root.file, syncWave: "none" }, stages },
      executedBy: {
        runtimes: [{ name: "Argo CD", mechanism: "the sync-wave annotation each Application carries", proven: false }],
        automatic: false,
        evidenceState: "not-run",
      },
      boundedness: [
        ...entry.orderingText,
        "No runtime has executed this route. Nothing in the Catalog has synced this Application set on any cluster.",
      ],
      provenance: provenance([entry.templatesRel, entry.orderingRecipeRel]),
    },
  };
}

function placeholderRoute(entry, input) {
  const placeholder = input.placeholder;
  const fileOf = new Map(entry.applications.map((application) => [application.name, application.file]));
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-${placeholder.route}` },
    spec: {
      quirkClass: "placeholder-input",
      routeKind: "generation-input",
      discharges:
        `AICR refuses to write this bundle without a system node selector, so the bundle was generated with the placeholder ${input.value}. A cluster whose system nodes carry another label leaves every component below unschedulable.`,
      declaration: {
        input: input.input,
        flag: input.flag,
        value: input.value,
        valueStatus: input.valueStatus,
        confirmedOn: input.confirmedOn,
        changeTo: placeholder.changeTo,
        changeEffect: placeholder.changeEffect,
        container: placeholder.container,
        applications: placeholder.applications,
        fieldPaths: placeholder.fieldPaths,
        appearsIn: placeholder.appearsIn.map((row) => ({ application: row.application, file: fileOf.get(row.application) ?? "", valuesPaths: [...row.valuesPaths] })),
        sourcePackageFiles: [...(placeholder.bundleFiles ?? [])],
      },
      executedBy: { invokedBy: "the platform operator, before the bundle is delivered to a destination", automatic: false, evidenceState: "not-run" },
      boundedness: [
        "The value is a placeholder and not a claim about any cluster. It is the value upstream's own EKS training demo uses for its reference clusters.",
        "Editing the value in these Applications alone does not change the source package they point at, which carries the same placeholder in the files listed above. A destination needs a bundle regenerated with its own value, or a variant made from this entry.",
        "No destination label has been observed, and no bundle with another value exists in the Catalog.",
      ],
      provenance: provenance([entry.receiptRel, entry.templatesRel]),
    },
  };
}

function leftOutRoute(entry) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleRoute",
    metadata: { name: `${entry.recordName}-components-left-out-of-bundle` },
    spec: {
      quirkClass: "omitted-component",
      routeKind: "destination-decision",
      discharges:
        `The recipe AICR selected names ${plural(entry.leftOutOfBundle.length, "component")} that the bundle does not deploy. No Application exists for ${entry.leftOutOfBundle.length === 1 ? "it" : "them"}, so a destination that needs ${entry.leftOutOfBundle.length === 1 ? "it" : "one"} has to decide that before delivery.`,
      declaration: {
        components: entry.leftOutOfBundle.map((row) => ({
          name: row.name,
          reason: row.reason,
          dependedOnBy: entry.leftOutEdges.filter((edge) => edge.dependsOn === row.name).map((edge) => edge.component).sort(),
        })),
        inThisBundle: false,
      },
      executedBy: { invokedBy: "the platform operator, before the first sync on a destination", automatic: false, evidenceState: "not-run" },
      boundedness: [
        "The reasons are the ones AICR logged when it wrote the bundle. They were not checked against a cluster.",
        "Including one of these components means regenerating the bundle with the input AICR names, which changes the bundle bytes and every digest of this entry.",
      ],
      provenance: provenance([entry.receiptRel, entry.orderingRecipeRel]),
    },
  };
}

// Values the rendered Applications carry in the clear and a reader should know
// about. They are found by pattern in the bytes, so the list names the file.
function literalCredentials(entry, read) {
  const found = [];
  for (const application of entry.applications) {
    const match = /^\s*adminPassword: (\S+)\s*$/m.exec(read(application.source));
    if (match) found.push({ application: application.name, file: application.file, key: "adminPassword", value: match[1] });
  }
  return found;
}

function targetRequirements(entry, sourcePackage, credentials) {
  const namespaceApplications = entry.applications.length;
  const charts = entry.nestedSources.filter((row) => row.kind !== AICR_BUNDLE_PATH_SOURCE).map((row) => ({
    application: row.application,
    repoURL: row.repoURL,
    ...(row.chart ? { chart: row.chart } : {}),
    targetRevision: row.targetRevision,
  }));
  const automated = entry.applications.filter((application) => application.automatedSync).length;
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: "BundleTargetRequirements",
    metadata: { name: `${entry.recordName}-target-requirements` },
    spec: {
      subject: { catalogEntry: entry.recordName, source: "NVIDIA AICR", version: entry.version, overlay: entry.overlay, platformDigest: entry.platformDigest },
      deliveryRuntime: {
        name: "Argo CD",
        api: "argoproj.io/v1alpha1 Application",
        namespace: "argocd",
        statement: `All ${namespaceApplications} objects in this bundle are Argo CD Applications in the argocd namespace. Argo CD and its Application API must exist on the destination before they are applied.`,
      },
      sourcePackage: {
        reference: entry.sourcePackageRef,
        manifestDigest: sourcePackage.manifestDigest,
        applications: entry.bundlePathApplications,
        statement: `${entry.bundlePathApplications.length} of the ${namespaceApplications} Applications ${entry.bundlePathApplications.length === 1 ? "takes its" : "take their"} source from this Helm chart package. Argo CD must be able to pull it at that reference, and the bytes this bundle was built against have that manifest digest.`,
      },
      upstreamCharts: charts,
      recipeCriteria: entry.criteria,
      generationInputs: entry.generationInputs,
      ...(entry.placeholders.length > 0
        ? { placeholders: entry.placeholders.map((input) => ({ input: input.input, value: input.value, changeTo: input.placeholder.changeTo, route: PLACEHOLDER_ROUTE })) }
        : {}),
      ...(entry.answeredRefusals.length > 0
        ? { answeredRefusals: entry.answeredRefusals.map((answer) => ({ input: answer.input, value: answer.value, valueOrigin: answer.valueOrigin })) }
        : {}),
      ...(entry.leftOutOfBundle.length > 0
        ? { componentsLeftOutOfBundle: { names: entry.leftOutOfBundle.map((row) => row.name), route: LEFT_OUT_ROUTE } }
        : {}),
      ...(credentials.length > 0
        ? {
            literalCredentials: credentials.map((row) => ({
              ...row,
              statement: `${row.file} sets ${row.key} to the literal ${row.value} in its chart values. Replace it for any destination that matters.`,
            })),
          }
        : {}),
      automatedSync: {
        applications: automated,
        statement: `${automated} of the ${namespaceApplications} Applications carry an automated sync policy with prune and self-heal. A destination has to accept that before they are applied.`,
      },
      checked: "No destination has been checked against these requirements.",
      provenance: provenance([entry.receiptRel, entry.templatesRel, entry.indexRel]),
    },
  };
}

function spaceGuide(entry, listed, credentials) {
  const rows = listed.map((file) => `| \`${file.path}\` | ${file.describes} |`);
  const before = [
    "Argo CD and its Application API must exist on the destination, with the argocd namespace.",
    `${plural(entry.bundlePathApplications.length, "Application")} ${entry.bundlePathApplications.length === 1 ? "takes its" : "take their"} source from the Helm chart package at \`${entry.sourcePackageRef}\`. Argo CD must be able to pull that package. \`${REQUIREMENTS_FILE}\` names its digest.`,
    `The destination must match the criteria AICR generated this recipe for, which are ${Object.entries(entry.criteria).map(([key, value]) => `${key}=${value}`).join(", ")}.`,
  ];
  for (const input of entry.placeholders) {
    before.push(`The Applications carry the placeholder \`${input.value}\` in ${plural(input.placeholder.fieldPaths, "field path")}. Change it to ${input.placeholder.changeTo}. \`${PLACEHOLDER_ROUTE}\` lists every place.`);
  }
  for (const answer of entry.answeredRefusals) {
    before.push(`The bundle was generated with \`${answer.flag} ${answer.value}\`. A destination whose GPU nodes carry another taint needs another value.`);
  }
  if (entry.leftOutOfBundle.length > 0) {
    before.push(`The recipe names ${entry.leftOutOfBundle.map((row) => row.name).join(", ")}, and the bundle does not deploy ${entry.leftOutOfBundle.length === 1 ? "it" : "them"}. \`${LEFT_OUT_ROUTE}\` records why.`);
  }
  for (const credential of credentials) {
    before.push(`\`${credential.file}\` sets \`${credential.key}\` to the literal \`${credential.value}\`. Replace it for any destination that matters.`);
  }
  before.push(`Apply the Applications in the order \`${SYNC_WAVE_ROUTE}\` declares. Argo CD does that itself when the sync-wave annotations are kept.`);
  return [
    `# AICR ${entry.version}, overlay ${entry.overlay}`,
    "",
    "**UNOFFICIAL/EXPERIMENTAL**",
    "",
    `<!-- Generated by ${AICR_MIRROR_GENERATOR}. Do not edit by hand. -->`,
    "",
    `This bundle holds the ${plural(entry.applications.length, "Argo CD Application")} that Helm rendered from the bundle NVIDIA AICR ${entry.version} generated for the ${entry.overlay} overlay, and the files that say what those Applications need. The Applications are the wrapper. Argo CD renders the charts they point at when it syncs them.`,
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
    "No route in this bundle has been run on a cluster, and no destination has been checked against the requirements. No Argo CD instance has synced these Applications. The bundle holds no container image and no Secret object.",
    "",
  ].join("\n");
}

// The companion files of one entry, in the order they are staged. The guide is
// written last because it lists the others.
function generatedFiles(entry, sourcePackage, read) {
  const files = [];
  const add = (path, role, describes, doc) => files.push({ path, source: `${entry.dataDir}/${path}`, role, describes, text: serializeYaml(doc) });
  const credentials = literalCredentials(entry, read);
  add(SYNC_WAVE_ROUTE, "route: sync-wave-ordering", "The order to apply the Applications in.", syncWaveRoute(entry));
  for (const input of entry.placeholders) {
    check(input.placeholder.route === "system-node-selector-placeholder", `${entry.id}: no route file is written for the placeholder route ${input.placeholder.route}`);
    add(PLACEHOLDER_ROUTE, "route: system-node-selector-placeholder", "The placeholder system node selector, and every place it lands.", placeholderRoute(entry, input));
  }
  if (entry.leftOutOfBundle.length > 0) {
    add(LEFT_OUT_ROUTE, "route: components-left-out-of-bundle", "The components the recipe names and the bundle does not deploy.", leftOutRoute(entry));
  }
  add(REQUIREMENTS_FILE, "requirement: target", "What the destination must already have.", targetRequirements(entry, sourcePackage, credentials));
  const listed = [
    ...entry.applications.map((application) => ({ path: application.file, describes: `The Application ${application.name}, byte for byte as the Catalog retains it.` })),
    ...files,
  ];
  files.push({ path: "README.md", source: `${entry.dataDir}/space-guide.md`, role: "space-guide", describes: "This guide.", text: spaceGuide(entry, listed, credentials) });
  return files;
}

// --- the literal configuration bundle ---------------------------------------------

// The files the artifact holds and where each comes from. This is the whole
// list. A reader that wants to add a file has to change this function.
export function aicrMirrorLiteralStagedSources(entry) {
  return [
    ...entry.applications.map((application) => ({ path: application.file, source: application.source, role: "argo-cd-application" })),
    ...entry.generated.map((file) => ({ path: file.path, source: file.source, role: file.role })),
  ];
}

export function buildLiteralConfigArtifact(entry, { root = repoRoot, readText } = {}) {
  const generatedText = new Map(entry.generated.map((file) => [file.source, file.text]));
  const read = readText ?? ((rel) => (generatedText.has(rel) ? generatedText.get(rel) : readFileSync(join(root, rel), "utf8")));
  const checksums = new Map(
    readFileSync(join(root, entry.entryRel, "argocd-rendered", "checksums.txt"), "utf8").split("\n").filter(Boolean).map((line) => {
      const [sha, path] = line.split("  ");
      return [path.split("/").at(-1), sha];
    }),
  );
  const stagedFiles = aicrMirrorLiteralStagedSources(entry).map((file) => {
    check(/\.(ya?ml|md)$/.test(file.source), `${entry.id}: the staged file ${file.source} is not a YAML or Markdown file`);
    const data = Buffer.from(read(file.source), "utf8");
    check(
      data.length > 0 && data.length <= AICR_MIRROR_STAGED_FILE_MAX_BYTES,
      `${entry.id}: the staged file ${file.source} is ${data.length} bytes, outside what an Application or a companion file can be`,
    );
    const sha256 = sha256Hex(data);
    if (file.role === "argo-cd-application") {
      check(
        checksums.get(file.path) === sha256,
        `${entry.id}: the staged Application ${file.source} is not the retained render that ${entry.entryRel}/argocd-rendered/checksums.txt lists`,
      );
    }
    return { ...file, data, bytes: data.length, sha256 };
  });
  check(
    stagedFiles.filter((file) => file.role === "argo-cd-application").length === checksums.size,
    `${entry.id}: the bundle does not stage every rendered Application`,
  );
  const bundleName = `catalog-${entry.recordName}`;
  const tag = entry.version;
  const repository = `${AICR_MIRROR_BUNDLE_REGISTRY}/${bundleName}`;
  const layer = deterministicGzip(deterministicTar(stagedFiles));
  const layerDigest = digestOf(layer);
  const layerTitle = `${bundleName}.tar.gz`;
  const manifest = Buffer.from(JSON.stringify({
    schemaVersion: 2,
    mediaType: OCI_MANIFEST_TYPE,
    artifactType: LITERAL_ARTIFACT_TYPE,
    config: { mediaType: OCI_EMPTY_CONFIG_TYPE, digest: digestOf(OCI_EMPTY_CONFIG), size: OCI_EMPTY_CONFIG.length },
    layers: [{ mediaType: LITERAL_LAYER_TYPE, digest: layerDigest, size: layer.length, annotations: { "org.opencontainers.image.title": layerTitle } }],
    annotations: { "org.opencontainers.image.created": CREATED_ANNOTATION },
  }));
  const manifestDigest = digestOf(manifest);
  return {
    role: LITERAL_CONFIG,
    entryId: entry.id,
    recordName: entry.recordName,
    format: "config-bundle-oci",
    artifactType: LITERAL_ARTIFACT_TYPE,
    layerMediaType: LITERAL_LAYER_TYPE,
    layerTitle,
    bundleName,
    tag,
    repository,
    reference: `${repository}:${tag}`,
    immutableReference: `${repository}@${manifestDigest}`,
    stagedFiles,
    layer,
    layerDigest,
    layerBytes: layer.length,
    manifest,
    manifestDigest,
    objectCount: entry.applications.length,
    planRel: aicrMirrorPlanRel(entry.id, LITERAL_CONFIG),
    receiptRel: aicrMirrorReceiptRel(entry.id, LITERAL_CONFIG),
  };
}

// --- plans and receipts -------------------------------------------------------------

const stagedRows = (artifact) => artifact.stagedFiles.map((file) => ({
  path: file.source,
  stagedAs: file.path,
  role: file.role,
  sha256: file.sha256,
  bytes: file.bytes,
}));

// A source package holds many files that are all one kind, so its plan and its
// receipt bind them through the entry's checksum list. A literal bundle lists
// each file, because its files are of several kinds.
function artifactBlock(artifact) {
  return {
    role: artifact.role,
    format: artifact.format,
    artifactType: artifact.artifactType,
    reference: artifact.reference,
    manifestDigest: artifact.manifestDigest,
    layerDigest: artifact.layerDigest,
    layerBytes: artifact.layerBytes,
    layerMediaType: artifact.layerMediaType,
    ...(artifact.role === SOURCE_PACKAGE
      ? { fileCount: artifact.stagedFiles.length, files: { inventory: artifact.inventory.path, inventorySha256: artifact.inventory.sha256 } }
      : { objectCount: artifact.objectCount, fileCount: artifact.stagedFiles.length, files: stagedRows(artifact) }),
    reproducible: true,
  };
}

const sourceBlock = (entry) => ({
  kind: "aicr-overlay",
  name: "NVIDIA AICR",
  version: entry.version,
  overlay: entry.overlay,
  entry: entry.entryRel,
  generationReceipt: entry.receiptRel,
  platformDigest: entry.platformDigest,
});

const CONTENTS = {
  [SOURCE_PACKAGE]: {
    statement: "The artifact is the Helm chart AICR generated for this overlay, file for file as the entry retains it. It holds no container image and no Secret object.",
    containerImages: false,
    secretObjects: 0,
  },
  [LITERAL_CONFIG]: {
    statement: "The artifact holds the retained Argo CD Applications of one entry, its route files, its requirements file and its guide. It holds no container image and no Secret object.",
    containerImages: false,
    secretObjects: 0,
  },
};

export function aicrMirrorPlanDoc(entry, artifact) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: AICR_MIRROR_PLAN_KIND,
    metadata: { name: `${entry.recordName}-${artifact.role}` },
    spec: {
      catalogEntry: entry.recordName,
      source: sourceBlock(entry),
      artifact: artifactBlock(artifact),
      ...(artifact.role === LITERAL_CONFIG
        ? { needs: { sourcePackage: { reference: entry.sourcePackageRef, manifestDigest: entry.artifacts[SOURCE_PACKAGE].manifestDigest, plan: entry.artifacts[SOURCE_PACKAGE].planRel } } }
        : {}),
      contents: CONTENTS[artifact.role],
      publication: {
        receipt: artifact.receiptRel,
        rule: "The artifact counts as present in the registry only when that receipt is tracked and its digests equal the ones in this file. This file does not say whether it is.",
        publisher: AICR_MIRROR_PUBLISHER,
      },
    },
  };
}

export function aicrMirrorReceiptDoc(entry, artifact, { observedAt, pushCommand, anonymousPull }) {
  return {
    apiVersion: "evidence.confighub.com/v1alpha1",
    kind: AICR_MIRROR_RECEIPT_KIND,
    metadata: { name: `${entry.recordName}-${artifact.role}` },
    spec: {
      catalogEntry: entry.recordName,
      plan: artifact.planRel,
      source: sourceBlock(entry),
      artifact: { ...artifactBlock(artifact), immutableReference: artifact.immutableReference },
      push: { result: "pass", command: pushCommand },
      anonymousPull,
      configHubUpload: "not-run. This receipt records a registry publication and nothing else.",
      delivery: "not-run. No Argo CD instance has pulled or synced this artifact.",
      signature: "none. The Catalog does not sign these artifacts.",
      observedAt,
    },
    status: { result: "pass" },
  };
}

// Every way a receipt can fail to be the receipt of this artifact. An empty
// list means the receipt records a push and an anonymous pull of these bytes.
export function aicrMirrorPublicationProblems(receipt, entry, artifact) {
  const problems = [];
  const expect = (condition, message) => { if (!condition) problems.push(message); };
  const spec = receipt?.spec ?? {};
  const recorded = spec.artifact ?? {};
  const name = `${entry.recordName}-${artifact.role}`;
  expect(receipt?.kind === AICR_MIRROR_RECEIPT_KIND, `it is not a ${AICR_MIRROR_RECEIPT_KIND}`);
  expect(receipt?.metadata?.name === name && spec.catalogEntry === entry.recordName, `it names ${receipt?.metadata?.name ?? "nothing"} and not ${name}`);
  expect(recorded.role === artifact.role, `it is a receipt for the ${recorded.role ?? "unnamed"} artifact and not the ${artifact.role}`);
  expect(recorded.manifestDigest === artifact.manifestDigest, `its manifest digest is ${recorded.manifestDigest ?? "missing"}, and the committed bytes build ${artifact.manifestDigest}`);
  expect(recorded.layerDigest === artifact.layerDigest && recorded.layerBytes === artifact.layerBytes, `its layer is ${recorded.layerDigest ?? "missing"}, and the committed bytes build ${artifact.layerDigest}`);
  expect(recorded.reference === artifact.reference, `its reference is ${recorded.reference ?? "missing"} and not ${artifact.reference}`);
  expect(recorded.immutableReference === artifact.immutableReference, "its immutable reference does not pin the manifest digest");
  expect(canonical(recorded) === canonical({ ...artifactBlock(artifact), immutableReference: artifact.immutableReference }), "its artifact block is not the one these files build now");
  expect(canonical(spec.source ?? {}) === canonical(sourceBlock(entry)), "its source is not this overlay, version and platform digest");
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
  expect(/^not-run\b/.test(String(spec.delivery ?? "")), "it does not say that no delivery was run");
  expect(/^\d{4}-\d{2}-\d{2}T/.test(String(spec.observedAt ?? "")), "it does not say when the pull was observed");
  expect(receipt?.status?.result === "pass", "its result is not pass");
  return problems;
}

// The publication state of one artifact. A receipt counts only when Git tracks
// it, because runs/ is ignored and an untracked receipt never reaches a pull
// request. A tracked receipt that does not match the committed bytes is an
// error and not a quiet "not published".
export function loadAicrMirrorPublication(entry, artifact, { root = repoRoot } = {}) {
  const receiptRel = artifact.receiptRel;
  const receiptPath = join(root, receiptRel);
  if (!existsSync(receiptPath) || !trackedExists(receiptPath)) return { published: false, artifact, receiptRel };
  const text = readFileSync(receiptPath, "utf8");
  const receipt = readYamlText(text);
  const problems = aicrMirrorPublicationProblems(receipt, entry, artifact);
  check(
    problems.length === 0,
    `${receiptRel} is not a valid publication receipt for the ${artifact.role} of ${entry.recordName}: ${problems.join("; ")}. Publish these bytes again or remove the receipt`,
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

// --- what a record says in each publication state ----------------------------------

function publishedBlock(publication) {
  const artifact = publication.artifact;
  return {
    status: AICR_MIRROR_PUBLISHED_STATUS,
    observedReference: publication.observedReference,
    manifestDigest: artifact.manifestDigest,
    layerDigest: artifact.layerDigest,
    receipt: publication.receiptRel,
    receiptSha256: publication.receiptSha256,
    plan: artifact.planRel,
  };
}

function plannedBlock(artifact) {
  return {
    status: AICR_MIRROR_UNPUBLISHED_STATUS,
    plannedRef: `oci://${artifact.reference}`,
    plannedDigest: artifact.manifestDigest,
    plan: artifact.planRel,
  };
}

// Everything a record says about the two artifacts, written from the receipts.
// The record generator writes exactly this and the model verifier recomputes
// it, so a record cannot read as published without a receipt for these bytes,
// and cannot keep saying "not published" beside a valid receipt.
export function aicrMirrorDelivery(entry) {
  const source = entry.publications[SOURCE_PACKAGE];
  const literal = entry.publications[LITERAL_CONFIG];
  const sourceArtifact = entry.artifacts[SOURCE_PACKAGE];
  const literalArtifact = entry.artifacts[LITERAL_CONFIG];
  const count = entry.bundlePathApplications.length;
  const total = entry.applications.length;
  const take = count === 1 ? "takes its source" : "take their source";
  const stateKey = source.published ? (literal.published ? "both" : "sourceOnly") : (literal.published ? "literalOnly" : "neither");
  const companions = (prefix) => literalArtifact.stagedFiles
    .filter((file) => file.role.startsWith(prefix))
    .map((file) => ({ path: file.source, sha256: `sha256:${file.sha256}`, role: file.role }));

  const sourcePackageOci = source.published
    ? { ...publishedBlock(source), note: `An anonymous pull returned the retained bundle, file for file. ${count} of the ${total} Applications ${take} from this package.` }
    : { ...plannedBlock(sourceArtifact), retainedBundle: entry.bundleRel, note: `The retained bundle builds this digest. Nothing has been pushed to the reference, which ${count} of the ${total} Applications name.` };
  const literalConfigOci = literal.published
    ? {
        ...publishedBlock(literal),
        objectCount: literalArtifact.objectCount,
        routes: companions("route:"),
        requirements: companions("requirement:"),
        sourcePackage: source.published ? AICR_MIRROR_PUBLISHED_STATUS : "missing",
        note: source.published
          ? "An anonymous pull returned the exact Applications and their companion files, and the source package they point at is published too. No route has been run and nothing was uploaded to ConfigHub."
          : `An anonymous pull returned the exact Applications and their companion files. The source package ${count} of them point at is not published, so this bundle cannot be delivered yet.`,
      }
    : { ...plannedBlock(literalArtifact), note: "The rendered Applications and their companion files build this digest. Nothing has been pushed." };

  const retained = "They are retained and rendered with the bundle AICR generated";
  const claims = {
    neither: `${retained}, not published, not deployed.`,
    sourceOnly: `${retained}. The source package is published and pulls back anonymously at its planned digest. The literal configuration bundle is not published, and the entry is not deployed.`,
    literalOnly: `${retained}. The literal configuration bundle is published, and the source package its Applications point at is missing from the registry, so the entry cannot be delivered. It is not deployed.`,
    both: `${retained}. The source package and the literal configuration bundle are both published, and each pulls back anonymously at its planned digest. The entry is not deployed.`,
  };
  const limits = {
    neither: [
      `${count} of the ${total} Applications ${take} from ${entry.sourcePackageRepository}, which is not published. This entry cannot be delivered until that package and its literal configuration bundle are.`,
      `Both artifacts are built from committed bytes and planned by digest in ${sourceArtifact.planRel} and ${literalArtifact.planRel}. No OCI artifact is published for this entry.`,
    ],
    sourceOnly: [
      `The source package ${count} of the ${total} Applications ${take} from is published, and ${source.receiptRel} records an anonymous pull of it.`,
      `The literal configuration bundle is not published. It is planned by digest in ${literalArtifact.planRel}.`,
    ],
    literalOnly: [
      `The literal configuration bundle is published, and ${literal.receiptRel} records an anonymous pull of it.`,
      `${count} of the ${total} Applications ${take} from ${entry.sourcePackageRepository}, which is not published. The source package is missing, so this entry cannot be delivered.`,
    ],
    both: [
      `The source package and the literal configuration bundle are both published. ${source.receiptRel} and ${literal.receiptRel} record an anonymous pull of each at its planned digest.`,
      "Publication proves the two artifacts are available and are the retained bytes. It does not prove that any Argo CD instance pulled or synced them.",
    ],
  };
  return {
    state: stateKey,
    retention: AICR_MIRROR_STATES[stateKey],
    deliverable: stateKey === "both",
    packageOciRef: source.published ? source.observedReference : "",
    sourcePackageOci,
    literalConfigOci,
    claim: claims[stateKey],
    limits: limits[stateKey],
    sourcePackageRequirement: source.published
      ? `${count} of the ${total} Applications ${take} from ${entry.sourcePackageRepository} at ${entry.sourcePackageTag}. That package is published, and a destination's Argo CD has to be able to pull it.`
      : `${count} of the ${total} Applications ${take} from ${entry.sourcePackageRepository} at ${entry.sourcePackageTag}. That package is not published, so a destination needs a reachable copy before Argo CD can resolve ${count === 1 ? "it" : "them"}.`,
  };
}

// One sentence of refusal, or an empty string when the record carries exactly
// what the receipts allow.
export function aicrMirrorDeliveryProblem(name, record, entry, { claim = true } = {}) {
  const expected = aicrMirrorDelivery(entry);
  const delivery = record?.spec?.delivery ?? {};
  for (const [role, key] of [[SOURCE_PACKAGE, "sourcePackageOci"], [LITERAL_CONFIG, "literalConfigOci"]]) {
    if (canonical(delivery[key] ?? {}) === canonical(expected[key])) continue;
    const publication = entry.publications[role];
    return publication.published
      ? `${name}: ${publication.receiptRel} records a publication of ${publication.artifact.manifestDigest}, and delivery.${key} does not carry exactly that reference, that digest and that receipt`
      : `${name}: delivery.${key} says ${delivery[key]?.status ?? "nothing"}${delivery[key]?.manifestDigest ? ` with ${delivery[key].manifestDigest}` : ""}, and no tracked publication receipt for ${publication.artifact.manifestDigest} exists at ${publication.receiptRel}`;
  }
  if ((record.spec?.source?.packageOciRef ?? "") !== expected.packageOciRef) {
    return `${name}: source.packageOciRef is ${record.spec?.source?.packageOciRef || "empty"}, and the receipts allow ${expected.packageOciRef || "none"}`;
  }
  if (record.spec?.evidence?.retention !== expected.retention) {
    return `${name}: evidence.retention says ${record.spec?.evidence?.retention}, and the receipts make it ${expected.retention}`;
  }
  if (claim && !String(record.status?.claim ?? "").endsWith(expected.claim)) {
    return `${name}: the claim does not end with the sentence the receipts allow, which is "${expected.claim}"`;
  }
  return "";
}

// --- every mirrored entry -------------------------------------------------------------

// Every mirrored overlay, each with its two artifacts, its plans and its
// publication state. `receipts: "none"` builds every entry as not published,
// whatever receipts are tracked, so a self-test's fixtures do not change the
// day a receipt lands.
const entryCache = new Map();

export function loadAicrMirrorEntries({ root = repoRoot, receipts = "tracked", verdictRoot = "" } = {}) {
  check(receipts === "tracked" || receipts === "none", `loadAicrMirrorEntries: receipts must be "tracked" or "none", not ${receipts}`);
  const key = `${root}|${receipts}|${verdictRoot}`;
  if (entryCache.has(key)) return entryCache.get(key);
  const mirrored = loadAicrRecipeEntries({ root, verdictRoot }).filter((entry) => entry.origin === "mirrored-overlay");
  const entries = mirrored.map((recipeEntry) => {
    const entry = buildEntry(recipeEntry, root);
    const read = (rel) => readFileSync(join(root, rel), "utf8");
    const sourcePackage = buildSourcePackageArtifact(entry, { root });
    entry.generated = generatedFiles(entry, sourcePackage, read);
    const literalConfig = buildLiteralConfigArtifact(entry, { root });
    entry.artifacts = { [SOURCE_PACKAGE]: sourcePackage, [LITERAL_CONFIG]: literalConfig };
    entry.plans = {
      [SOURCE_PACKAGE]: aicrMirrorPlanDoc(entry, sourcePackage),
      [LITERAL_CONFIG]: aicrMirrorPlanDoc(entry, literalConfig),
    };
    entry.publications = Object.fromEntries(AICR_MIRROR_ARTIFACT_ROLES.map((role) => [
      role,
      receipts === "none"
        ? { published: false, artifact: entry.artifacts[role], receiptRel: entry.artifacts[role].receiptRel }
        : loadAicrMirrorPublication(entry, entry.artifacts[role], { root }),
    ]));
    return entry;
  });
  for (const role of AICR_MIRROR_ARTIFACT_ROLES) {
    const references = entries.map((entry) => entry.artifacts[role].reference);
    check(new Set(references).size === references.length, `two mirrored entries would push their ${role} to one reference`);
  }
  const literalDigests = entries.map((entry) => entry.artifacts[LITERAL_CONFIG].manifestDigest);
  check(new Set(literalDigests).size === literalDigests.length, "two mirrored entries build one literal configuration bundle digest");
  entryCache.set(key, entries);
  return entries;
}

// The recorded placeholder locations of one entry, compared with the rendered
// bytes. This parses every Application's chart values, so only the verifier
// and the publisher pay for it.
export function aicrMirrorRequiredInputFindings(entry, { root = repoRoot, published = true } = {}) {
  if (entry.requiredInputs.length === 0) return [];
  const docs = readYamlTexts(entry.applications.map((application) => readFileSync(join(root, application.source), "utf8")));
  const findings = [];
  for (const input of entry.requiredInputs) {
    const landings = input.valueStatus === INPUT_PLACEHOLDER ? placeholderLandings(docs, input.value) : [];
    findings.push(...requiredInputFindings(input, { published, landings }));
    if (input.valueStatus !== INPUT_PLACEHOLDER) continue;
    const token = String(input.value).split("=")[1];
    const holding = entry.bundleInventory.rows
      .filter((row) => readFileSync(join(root, entry.bundleRel, row.path), "utf8").includes(token))
      .map((row) => `argocd-helm-bundle/${row.path}`);
    if (JSON.stringify(holding) !== JSON.stringify(input.placeholder?.bundleFiles ?? [])) {
      findings.push(`${input.input}: the recorded bundle files that hold the placeholder differ from the retained bundle, where ${holding.length} file(s) hold ${token}`);
    }
    if (landingCounts(landings).fieldPaths === 0) findings.push(`${input.input}: the placeholder lands in no rendered Application`);
  }
  return findings.map((finding) => `${entry.id}: ${finding}`);
}

// Every file the generator owns, as repo-relative path and text. None of them
// says anything about publication, so none moves when a receipt lands.
export function aicrMirrorOutputs(entries) {
  const outputs = [];
  for (const entry of entries) {
    for (const file of entry.generated) outputs.push({ rel: file.source, text: file.text });
    for (const role of AICR_MIRROR_ARTIFACT_ROLES) outputs.push({ rel: entry.artifacts[role].planRel, text: serializeYaml(entry.plans[role]) });
  }
  const header = [
    "entry", "record", "version", "overlay", "applications", "bundle_files", "source_package_reference", "source_package_manifest_digest", "source_package_layer_bytes",
    "literal_config_reference", "literal_config_manifest_digest", "literal_config_files", "route_files", "placeholder", "components_left_out",
    "source_package_plan", "literal_config_plan", "source_package_receipt", "literal_config_receipt",
  ];
  const rows = entries.map((entry) => {
    const source = entry.artifacts[SOURCE_PACKAGE];
    const literal = entry.artifacts[LITERAL_CONFIG];
    return [
      entry.id, entry.recordName, entry.version, entry.overlay, entry.applications.length, source.stagedFiles.length, `oci://${source.reference}`, source.manifestDigest, source.layerBytes,
      `oci://${literal.reference}`, literal.manifestDigest, literal.stagedFiles.length, entry.generated.filter((file) => file.role.startsWith("route:")).length,
      entry.placeholders.map((input) => input.value).join(" "), entry.leftOutOfBundle.map((row) => row.name).join(" "),
      source.planRel, literal.planRel, source.receiptRel, literal.receiptRel,
    ];
  });
  outputs.push({ rel: `${AICR_MIRROR_DATA_ROOT}/artifacts.csv`, text: `${[header, ...rows].map((row) => row.join(",")).join("\n")}\n` });
  const withPlaceholder = entries.filter((entry) => entry.placeholders.length > 0).length;
  const withLeftOut = entries.filter((entry) => entry.leftOutOfBundle.length > 0).length;
  const version = entries[0]?.version ?? "";
  outputs.push({
    rel: `${AICR_MIRROR_DATA_ROOT}/summary.md`,
    text: [
      "# AICR mirror artifacts",
      "",
      "**UNOFFICIAL/EXPERIMENTAL**",
      "",
      `<!-- Generated by ${AICR_MIRROR_GENERATOR}. Do not edit by hand. -->`,
      "",
      `The Catalog mirrors ${entries.length} overlays of NVIDIA AICR ${version}. Each entry is a set of rendered Argo CD Applications, and some of those Applications take their source from the entry's own AICR bundle. An entry can be delivered only when two artifacts are in the registry, so this directory plans both for every entry.`,
      "",
      "The source package is the retained argocd-helm bundle as a Helm chart OCI artifact, at the reference the Applications name. The literal configuration bundle holds the rendered Applications, the route files, a requirements file and a guide.",
      "",
      `${withPlaceholder} entries carry a route for the placeholder system node selector, and ${withLeftOut} carry a route for components the recipe names and the bundle does not deploy. Every entry carries the sync-wave ordering route.`,
      "",
      "Each plan records the digest the committed bytes build. No OCI layout is committed, because both artifacts are rebuilt byte for byte from the retained files. This page and the plans do not say whether an artifact is in the registry. An artifact counts as present only when a tracked receipt under `runs/aicr-mirror-artifacts/` records a push and an anonymous pull of exactly that digest. Nothing here has been uploaded to ConfigHub or synced by Argo CD.",
      "",
      "Regenerate with `npm run aicr-mirror-artifacts:generate` and check with `npm run aicr-mirror-artifacts:verify`. `npm run aicr-mirror-artifacts:publish:dry-run` lists what a publication would push.",
      "",
      "| Entry | Applications | Bundle files | Source package digest | Literal bundle digest |",
      "| --- | ---: | ---: | --- | --- |",
      ...entries.map((entry) => `| ${entry.id} | ${entry.applications.length} | ${entry.artifacts[SOURCE_PACKAGE].stagedFiles.length} | \`${entry.artifacts[SOURCE_PACKAGE].manifestDigest}\` | \`${entry.artifacts[LITERAL_CONFIG].manifestDigest}\` |`),
      "",
    ].join("\n"),
  });
  return outputs;
}

// The files in a layer this module wrote. A source package's files sit under
// the chart name, and that prefix is taken off so the paths are the bundle's.
export function readAicrMirrorLayerFiles(artifact, layer = artifact.layer) {
  const prefix = artifact.role === SOURCE_PACKAGE ? `${CHART_NAME}/` : "";
  return readLayerFiles(layer).map((file) => {
    check(file.path.startsWith(prefix), `the layer holds ${file.path}, which is outside ${prefix}`);
    return { path: file.path.slice(prefix.length), data: file.data };
  });
}

export { writeNimServiceOciLayout as writeAicrMirrorOciLayout };
