import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const docPath = join(repoRoot, "docs", "reference", "enterprise-parity-contract.md");
const docsIndexPath = join(repoRoot, "docs", "README.md");
const fixturePath = join(repoRoot, "tests", "enterprise-parity-fixture", "packet.json");

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(path) {
  check(existsSync(path), `missing ${relative(path)}`);
  return readFileSync(path, "utf8");
}

function relative(path) {
  return path.replace(`${repoRoot}/`, "");
}

function includesAll(text, phrases, context) {
  const normalizedText = text.toLowerCase();
  for (const phrase of phrases) {
    check(normalizedText.includes(phrase.toLowerCase()), `${context} missing phrase: ${phrase}`);
  }
}

const doc = readText(docPath);
const docsIndex = readText(docsIndexPath);
const packet = JSON.parse(readText(fixturePath));
const packetText = JSON.stringify(packet, null, 2);

for (const privateField of ["customerName", "hostnames", "internalUrls", "secretValues"]) {
  check(!packetText.includes(privateField), `enterprise parity fixture must not include ${privateField}`);
}

includesAll(
  doc,
  [
    "first-party Helm charts",
    "values-only",
    "ApplicationSet",
    "source shape summary",
    "Privacy mode",
    "Chart and values input digests",
    "Argo source reference shape",
    "Base or variant route decision",
    "Rendered object count",
    "Semantic diff result",
    "Fan-out",
    "Density",
    "Target facts",
    "Proof boundary reached",
    "Proof gaps",
    "Non-claims",
    "Next safe action",
    "density x fan-out = blast radius",
    "Do not claim field-complete provenance",
    "Do not claim fleet-wide bounded propagation",
    "Do not claim production support",
  ],
  "enterprise parity contract",
);

check(docsIndex.includes("(./reference/enterprise-parity-contract.md)"), "docs/README.md must assign a role to enterprise parity contract");

check(packet.schema === "helm-expt.enterprise-parity-packet.v1", "fixture schema mismatch");
check(packet.privacyMode === "customer-safe-aggregate", "fixture must use customer-safe aggregate privacy mode");
check(packet.status === "repo-only-contract-fixture", "fixture must be repo-only");

const sourceKinds = new Set((packet.sourceShapes ?? []).map((source) => source.kind));
for (const requiredKind of ["first-party-helm-chart", "helm-values-repo", "argo-applicationset"]) {
  check(sourceKinds.has(requiredKind), `fixture missing source shape ${requiredKind}`);
}

const valuesSource = packet.sourceShapes.find((source) => source.kind === "helm-values-repo");
const appSetSource = packet.sourceShapes.find((source) => source.kind === "argo-applicationset");

check(valuesSource.leafFields > 0, "values source must expose density input");
check(Array.isArray(appSetSource.generatedTargets), "ApplicationSet source must expose generated targets");
check(appSetSource.generatedTargets.length > 1, "ApplicationSet fixture must have fan-out greater than one");

check(packet.metrics.density === valuesSource.leafFields, "density must equal selected values leaf field count");
check(packet.metrics.fanOut === appSetSource.generatedTargets.length, "fan-out must equal generated target count");
check(packet.metrics.blastRadius === packet.metrics.density * packet.metrics.fanOut, "blast radius must equal density x fan-out");

check(packet.renderedObjectCount > 0, "fixture must include rendered object count");
check(Boolean(packet.semanticDiffResult), "fixture must include semantic diff result");
check(Boolean(packet.routeDecision?.decision), "fixture must include base or variant route decision");
check(Array.isArray(packet.targetFacts) && packet.targetFacts.length >= 2, "fixture must include target facts");
check(Boolean(packet.proofBoundaryReached), "fixture must include proof boundary reached");
check(Array.isArray(packet.proofGaps) && packet.proofGaps.length >= 3, "fixture must include proof gaps");
check(Array.isArray(packet.nonClaims) && packet.nonClaims.length >= 3, "fixture must include non-claims");
check(Boolean(packet.nextSafeAction), "fixture must include next safe action");

for (const requiredOutput of [
  "source shape summary",
  "privacy mode",
  "chart and values input digests",
  "Argo source reference shape",
  "base or variant route decision",
  "rendered object count",
  "semantic diff result",
  "fan-out",
  "density",
  "blast radius",
  "target facts",
  "proof boundary reached",
  "proof gaps",
  "non-claims",
  "next safe action",
]) {
  check(packet.requiredOutputs.includes(requiredOutput), `fixture requiredOutputs missing ${requiredOutput}`);
}

console.log("verified enterprise parity contract and synthetic fixture");
