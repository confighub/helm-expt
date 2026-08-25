#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readYaml } from "./lib/proof-common.mjs";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");
const documents = {
  doctrine: read("docs/reference/config-catalog-doctrine.md"),
  dataModel: read("docs/user/confighub-data-model.md"),
  vocabulary: read("docs/user/model-and-vocabulary.md"),
  flattening: read("docs/reference/flattening-alignment.md"),
  deployment: read("site/how-it-works.html"),
  deploymentReference: read("site/deployment-reference.html"),
  catalog: read("site/charts/index.html"),
  home: read("site/index.html"),
  examples: read("site/testing.html"),
  ask: read("site/ask.html"),
  promote: read("site/promote.html"),
  tryAicr: read("site/try-aicr.html"),
  docs: read("site/docs.html"),
  verification: read("site/verification.html"),
  ai: read("site/ai.html"),
  configHub: read("site/confighub.html"),
};
const failures = [];
const assessmentCases = JSON.parse(read("data/config-assessment-stages/cases.json"));
const aicrSnapshotReview = readYaml(join(root, "data/aicr-snapshot-review/review.yaml"));
const assessmentStageOrder = [
  "inspection",
  "materialization",
  "destination",
  "post-deployment",
];

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

function requireText(scope, text, label) {
  requireCondition(scope.includes(text), `${label}: missing ${JSON.stringify(text)}`);
}

for (const [label, document] of Object.entries({
  doctrine: documents.doctrine,
  vocabulary: documents.vocabulary,
})) {
  for (const text of [
    "configuration lineage",
    "source and intent -> exact base -> derived variant -> promoted release",
    "lifecycle handling",
    "requirements -> route intent -> destination resolution -> execution -> receipt",
  ]) {
    requireText(document, text, `${label} two-track model`);
  }
}

for (const [label, document] of Object.entries({
  doctrine: documents.doctrine,
  vocabulary: documents.vocabulary,
  home: documents.home,
  deployment: documents.deployment,
  deploymentReference: documents.deploymentReference,
  catalog: documents.catalog,
  examples: documents.examples,
  ask: documents.ask,
  promote: documents.promote,
  tryAicr: documents.tryAicr,
  docs: documents.docs,
  verification: documents.verification,
  ai: documents.ai,
  configHub: documents.configHub,
})) {
  for (const question of [
    "What do I have?",
    "What will it produce?",
    "Can this destination accept it?",
    "Did it work?",
  ]) {
    requireText(document, question, `${label} assessment boundary`);
  }
}

for (const text of [
  "A derived variant can add, remove, or change",
  "variant, destination, and delivery runtime",
  "Three variant layers",
  "Source variant",
  "Retained base variant",
  "provider-curated",
  "Route intent",
  "Resolved lifecycle route",
  "Recipe is not the general name for a configuration",
  "Digest roles",
  "Do not describe these as \"the same digest.\"",
]) {
  requireText(documents.vocabulary, text, "vocabulary contract");
}

for (const text of [
  "born-flattened",
  "safe-to-flatten",
  "flatten-with-routes",
  "unsafe-to-flatten",
  "Recheck the decision after the base",
]) {
  requireText(documents.flattening, text, "flattening contract");
}

for (const text of [
  "base-revision digest",
  "exact-object digest",
  "OCI manifest digest",
  "ConfigHub Unit data hash",
  "release OCI digest",
]) {
  requireText(documents.doctrine, text, "identity contract");
}

for (const text of [
  "Produce or read the exact objects",
  "Keep the identities separate",
  "Plan the work around ordinary apply",
  "Change, promote, and deliver a reviewed variant",
]) {
  requireText(documents.deploymentReference, text, "public model explanation");
}
requireText(
  documents.deployment,
  "deployment-reference.html",
  "simple deployment page technical-reference link",
);
requireText(documents.catalog, "configuration processing model", "Catalog model link");
requireText(documents.catalog, "alignment report", "Catalog alignment link");

for (const path of [
  "schemas/base-variant-record.schema.json",
  "schemas/flattening-safety-verdict.schema.json",
  "schemas/lifecycle-route-resolution.schema.json",
]) {
  try {
    JSON.parse(read(path));
  } catch (error) {
    failures.push(`${path}: invalid JSON: ${error.message}`);
  }
}

const recordsDocument = JSON.parse(read("data/base-variant-records/records.json"));
const records = recordsDocument.records ?? [];
requireCondition(records.length > 0, "Catalog has no base-variant records");
const sourceCounts = new Map();
let flatteningDecided = 0;
let routesResolved = 0;
let ownershipDeclared = 0;

const allowedBaseDigestRoles = new Set([
  "helm-variant-revision",
  "aicr-platform-index",
  "source-output-inventory",
  "literal-configuration-oci-manifest",
  "source-package-oci-manifest",
  "source-module-oci-manifest",
  "source-file-set",
  "confighub-space-revision",
  "source-file",
  "source-output-record",
]);
const allowedObjectDigestRoles = new Set([
  "canonical-object-set",
  "inventory-file",
  "literal-yaml-file",
]);
const allowedRouteStatuses = new Set([
  "recorded",
  "requires-destination-resolution",
  "blocked",
]);
const allowedAssessmentEvidenceStates = new Set([
  "completed",
  "pending",
  "not-run",
  "blocked",
  "not-applicable",
]);
const allowedAssessmentResultStates = new Set([
  "available",
  "pass",
  "watch",
  "fail",
  "pending",
  "not-run",
  "blocked",
  "not-applicable",
]);

for (const record of records) {
  const name = record.metadata?.name ?? "unnamed-record";
  const spec = record.spec ?? {};
  const sourceType = spec.source?.type ?? "missing";
  sourceCounts.set(sourceType, (sourceCounts.get(sourceType) ?? 0) + 1);
  requireCondition(!Object.hasOwn(spec, "routing"), `${name}: legacy spec.routing is present`);
  requireCondition(
    spec.source?.selection?.name
      && spec.source.selection.kind
      && spec.source.selection.provider
      && spec.source.selection.record,
    `${name}: source selection or curator is missing`,
  );
  requireCondition(
    spec.processing && spec.assessment && spec.lifecycle && spec.ownership,
    `${name}: model envelopes are incomplete`,
  );
  const assessmentStages = spec.assessment?.stages ?? [];
  requireCondition(
    JSON.stringify(assessmentStages.map((stage) => stage.id))
      === JSON.stringify(assessmentStageOrder),
    `${name}: assessment stages are missing or out of order`,
  );
  for (const stage of assessmentStages) {
    requireCondition(
      stage.question
        && stage.answer
        && Array.isArray(stage.requiredInputs)
        && stage.requiredInputs.length > 0
        && typeof stage.catalogMatchRequired === "boolean"
        && typeof stage.sourceIntentRequired === "boolean"
        && typeof stage.destinationAccessRequired === "boolean"
        && typeof stage.deploymentRequired === "boolean"
        && Array.isArray(stage.records)
        && stage.nextAction,
      `${name}/${stage.id}: assessment explanation or prerequisites are incomplete`,
    );
    requireCondition(
      allowedAssessmentEvidenceStates.has(stage.evidenceState),
      `${name}/${stage.id}: invalid evidence state ${stage.evidenceState ?? "missing"}`,
    );
    requireCondition(
      allowedAssessmentResultStates.has(stage.resultState),
      `${name}/${stage.id}: invalid result state ${stage.resultState ?? "missing"}`,
    );
    requireCondition(
      stage.records.every((path) => existsSync(join(root, path))),
      `${name}/${stage.id}: assessment links a missing record`,
    );
    if (["inspection", "materialization"].includes(stage.id)) {
      requireCondition(
        !stage.destinationAccessRequired && !stage.deploymentRequired,
        `${name}/${stage.id}: local assessment incorrectly requires a destination or deployment`,
      );
    }
    if (stage.id === "destination") {
      requireCondition(
        stage.destinationAccessRequired && !stage.deploymentRequired,
        `${name}/${stage.id}: destination prerequisites are incorrect`,
      );
    }
    if (stage.id === "post-deployment") {
      requireCondition(
        stage.destinationAccessRequired && stage.deploymentRequired,
        `${name}/${stage.id}: post-deployment prerequisites are incorrect`,
      );
    }
    if (stage.evidenceState === "blocked") {
      requireCondition(
        ["blocked", "not-run"].includes(stage.resultState),
        `${name}/${stage.id}: blocked evidence is presented as a completed result`,
      );
    }
    if (stage.resultState === "pass") {
      requireCondition(
        stage.evidenceState === "completed" && stage.records.length > 0,
        `${name}/${stage.id}: pass has no completed evidence record`,
      );
    }
  }
  requireCondition(
    allowedBaseDigestRoles.has(spec.baseVariant?.digestRole),
    `${name}: invalid base digest role ${spec.baseVariant?.digestRole ?? "missing"}`,
  );
  requireCondition(
    allowedObjectDigestRoles.has(spec.configuration?.digestRole),
    `${name}: invalid object digest role ${spec.configuration?.digestRole ?? "missing"}`,
  );
  requireCondition(
    /^(sha256:)?[a-f0-9]{64}$/.test(spec.configuration?.digest ?? ""),
    `${name}: exact-object digest is missing or malformed`,
  );
  requireCondition(
    spec.processing?.materialization?.outputDigest === spec.configuration?.digest,
    `${name}: materialization output does not use the exact-object digest`,
  );
  requireCondition(
    Boolean(spec.baseVariant?.digestRecord) && existsSync(join(root, spec.baseVariant.digestRecord)),
    `${name}: base digest record is missing`,
  );
  requireCondition(
    Boolean(spec.configuration?.digestRecord)
      && existsSync(join(root, spec.configuration.digestRecord)),
    `${name}: object digest record is missing`,
  );

  const requirements = spec.lifecycle?.requirements?.items ?? [];
  const requirementIds = requirements.map((item) => item.id);
  requireCondition(
    requirementIds.length === new Set(requirementIds).size,
    `${name}: lifecycle requirement ids are not unique`,
  );
  for (const requirement of requirements) {
    requireCondition(
      requirement.id && requirement.origin && requirement.type && requirement.detail,
      `${name}: lifecycle requirement is incomplete`,
    );
  }

  const routeIntents = spec.lifecycle?.routeIntent?.routes ?? [];
  const routeIds = routeIntents.map((route) => route.id);
  requireCondition(routeIds.length === new Set(routeIds).size, `${name}: route-intent ids are not unique`);
  for (const route of routeIntents) {
    requireCondition(allowedRouteStatuses.has(route.status), `${name}/${route.id}: invalid route status`);
    requireCondition(
      Array.isArray(route.requirementRefs)
        && route.requirementRefs.length > 0
        && route.requirementRefs.every((id) => requirementIds.includes(id)),
      `${name}/${route.id}: route points at an unknown requirement`,
    );
    requireCondition(
      typeof route.automatic === "boolean" && route.proposedActor && route.proposedMechanism,
      `${name}/${route.id}: route intent is incomplete`,
    );
  }

  const targetFacts = spec.lifecycle?.targetFacts;
  requireCondition(
    targetFacts
      && ["recorded", "not-required", "gap"].includes(targetFacts.status)
      && Array.isArray(targetFacts.requirementRefs)
      && targetFacts.requirementRefs.every((id) => requirementIds.includes(id)),
    `${name}: target-fact envelope is incomplete`,
  );
  requireCondition(
    !Object.hasOwn(targetFacts ?? {}, "targetFacts"),
    `${name}: target facts are nested inside the target-fact envelope`,
  );
  for (const route of routeIntents) {
    requireCondition(
      !/^(recorded|not[- ]run|requires|unknown|gap|partial)$/i.test(route.proposedActor),
      `${name}/${route.id}: route actor is a status rather than an actor`,
    );
  }
  const resolution = spec.lifecycle?.resolution;
  requireCondition(
    resolution
      && [
        "awaits-variant-and-target",
        "resolved-for-recorded-targets",
        "not-required",
        "blocked",
        "gap",
      ].includes(resolution.status),
    `${name}: route resolution status is invalid`,
  );
  if (resolution?.status === "resolved-for-recorded-targets") {
    routesResolved += 1;
    requireCondition(resolution.records.length > 0, `${name}: resolved route has no evidence record`);
  }
  if (spec.processing?.flattening?.status === "decided") flatteningDecided += 1;
  if (spec.ownership?.status === "declared") ownershipDeclared += 1;
}

requireCondition(
  JSON.stringify(assessmentCases.stageOrder) === JSON.stringify(assessmentStageOrder),
  "cross-format assessment stage order changed",
);
const assessmentCaseIds = new Set((assessmentCases.cases ?? []).map((item) => item.id));
for (const id of [
  "literal-yaml-inspection",
  "helm-values-materialization",
  "destination-crd-api-check",
  "aicr-snapshot-diff-without-recipe",
  "aicr-expected-resources-components-absent",
  "runtime-request-after-deployment",
]) {
  requireCondition(assessmentCaseIds.has(id), `cross-format assessment fixture is missing: ${id}`);
}
const aicrSnapshot = assessmentCases.cases.find(
  (item) => item.id === "aicr-snapshot-diff-without-recipe",
);
requireCondition(
  aicrSnapshot
    && !aicrSnapshot.catalogMatchRequired
    && !aicrSnapshot.sourceIntentRequired
    && aicrSnapshot.destinationAccessRequired
    && !aicrSnapshot.deploymentRequired,
  "AICR snapshot/diff was made recipe- or deployment-dependent",
);
requireCondition(
  aicrSnapshot?.answer?.includes("observed differences")
    && aicrSnapshot.answer.includes("provider-curated source variant")
    && aicrSnapshot?.claimBoundary?.includes("do not select an intended variant"),
  "AICR snapshot/diff is presented as desired-state or conformance evidence",
);
for (const [label, document] of Object.entries({
  tryAicr: documents.tryAicr,
  catalog: documents.catalog,
})) {
  requireText(document, "provider-curated source variant", `${label} AICR variant boundary`);
  requireText(document, "A difference is not automatically a fault", `${label} AICR observation boundary`);
}
const expectedResources = assessmentCases.cases.find(
  (item) => item.id === "aicr-expected-resources-components-absent",
);
requireCondition(
  expectedResources
    && expectedResources.deploymentRequired
    && expectedResources.evidenceState === "blocked"
    && expectedResources.resultState === "not-run",
  "missing AICR expected-resources deployment is presented as failed conformance",
);
requireCondition(
  aicrSnapshotReview.kind === "ConfigReviewRecord"
    && aicrSnapshotReview.spec?.source?.format === "aicr-snapshot"
    && aicrSnapshotReview.spec?.observedDifferences?.length === 2,
  "the retained AICR snapshot review is missing or no longer records both observed differences",
);
requireCondition(
  aicrSnapshotReview.spec?.variantAssessment?.baseline?.result === "pass"
    && aicrSnapshotReview.spec?.variantAssessment?.target?.result === "pass"
    && aicrSnapshotReview.spec?.variantAssessment?.targetUsingBaselineProfile?.result === "finding",
  "the AICR snapshot review no longer separates observed differences from variant-aware findings",
);
requireCondition(
  aicrSnapshotReview.spec?.selectedIntent?.profileCatalog?.sha256
    && aicrSnapshotReview.spec?.selectedIntent?.upstream?.sourceCatalogRecordSha256
    && aicrSnapshotReview.spec?.snapshots?.baseline?.sha256
    && aicrSnapshotReview.spec?.snapshots?.target?.sha256,
  "the AICR snapshot review does not retain the profile, source, and snapshot identities",
);
requireCondition(
  aicrSnapshotReview.spec?.assessmentClasses?.postDeploymentValidation?.evidenceState === "blocked"
    && aicrSnapshotReview.spec?.assessmentClasses?.postDeploymentValidation?.resultState === "not-run"
    && aicrSnapshotReview.spec?.assessmentClasses?.postDeploymentValidation?.executionOutcome === "missing-deployment-timeout",
  "the AICR snapshot review presents a missing deployment as a conformance result",
);

const resolutionRoot = join(root, "data/lifecycle-route-resolutions");
const resolutionFiles = readdirSync(resolutionRoot)
  .filter((name) => name.endsWith(".yaml"))
  .sort();
requireCondition(resolutionFiles.length >= 3, "fewer than three lifecycle route resolutions are recorded");
for (const file of resolutionFiles) {
  const resolution = readYaml(join(resolutionRoot, file));
  requireCondition(
    resolution.kind === "LifecycleRouteResolution"
      && resolution.spec?.configuration?.digest
      && resolution.spec?.configuration?.digestRole
      && resolution.spec?.configuration?.baseRevisionDigest
      && resolution.spec?.destination?.deliveryRuntime
      && Array.isArray(resolution.spec?.routes)
      && resolution.status?.decision,
    `${file}: lifecycle route resolution is incomplete`,
  );
}

const summary = read("data/base-variant-records/summary.md");
requireText(summary, `All **${records.length}/${records.length} records**`, "generated alignment summary");
requireText(summary, "The model is ahead", "generated evidence-gap summary");
requireCondition(
  !read("scripts/site/config-workshop-yaml.js").includes("spec?.routing"),
  "browser processor still reads legacy spec.routing",
);

const corpus = Object.values(documents).join("\n");
for (const [name, document] of Object.entries(documents)) {
  if (/recipe\s*(?:→|->)\s*render\s*(?:→|->)\s*record\s*(?:→|->)\s*route/i.test(document)) {
    failures.push(`${name}: presents a Helm recipe as the source-neutral model`);
  }
}
for (const match of corpus.matchAll(/full rendering/gi)) {
  const context = corpus.slice(Math.max(0, match.index - 80), match.index + 80);
  if (!/do not call/i.test(context)) {
    failures.push(`unsupported "full rendering" usage: ${context.replaceAll("\n", " ")}`);
  }
}

if (failures.length) {
  console.error(`configuration processing model failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const sourceSummary = [...sourceCounts.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([source, count]) => `${source}=${count}`)
  .join(", ");
console.log(
  `verified ${records.length}/${records.length} Catalog records against the cross-format model (${sourceSummary}); flattening decided=${flatteningDecided}, routes resolved=${routesResolved}, ownership declared=${ownershipDeclared}`,
);
