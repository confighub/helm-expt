import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const defaultProofRoot = join(repoRoot, "recipes", "bitnami", "redis", "25.5.3");
const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const proofRoot = resolve(optionValue("--proof-root") ?? defaultProofRoot);

function optionValue(name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1];
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function sha256File(path) {
  return sha256(readFileSync(path));
}

function parseYamlFile(path) {
  const script = `
import json
import sys
import yaml

with open(sys.argv[1], "r", encoding="utf-8") as handle:
    docs = list(yaml.safe_load_all(handle))
docs = [doc for doc in docs if doc is not None]
print(json.dumps(docs[0] if len(docs) == 1 else docs, sort_keys=True))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", script, path], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    }),
  );
}

function existingRelative(root, relativePath, label) {
  check(Boolean(relativePath), `${label} path must be present`);
  let path = resolve(root, relativePath);
  if (!existsSync(path) && root !== defaultProofRoot) {
    path = resolve(defaultProofRoot, relativePath);
  }
  check(existsSync(path), `${label} path does not exist: ${relativePath}`);
  return path;
}

function parseRenderedObjects(path) {
  const script = `
import json
import sys
import yaml

objects = []
for doc in yaml.load_all(open(sys.argv[1], "r", encoding="utf-8"), Loader=yaml.BaseLoader):
    if not isinstance(doc, dict):
        continue
    metadata = doc.get("metadata")
    if not isinstance(metadata, dict):
        continue
    api_version = str(doc.get("apiVersion", ""))
    kind = str(doc.get("kind", ""))
    namespace = str(metadata.get("namespace", ""))
    name = str(metadata.get("name", ""))
    if api_version and kind and name:
        objects.append("|".join([api_version, kind, namespace, name]))
print(json.dumps(objects, sort_keys=True))
`;
  return JSON.parse(
    execFileSync("python3", ["-c", script, path], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 100,
    }),
  );
}

function fail(message) {
  throw new Error(message);
}

function check(condition, message) {
  if (!condition) fail(message);
}

function required(root, relativePath) {
  const path = join(root, relativePath);
  check(existsSync(path), `missing required file ${relativePath}`);
  return path;
}

function verifyProof(root) {
  const revisionRoot = join(root, "revisions", "default", "r001");
  const renderedRoot = join(revisionRoot, "rendered");
  const receiptsRoot = join(revisionRoot, "receipts");
  const requiredFiles = [
    "README.md",
    "helm-plan.yaml",
    "chart-dossier.yaml",
    "source-lock.yaml",
    "dependency-lock.yaml",
    "control-points.yaml",
    "value-model.yaml",
    "effective-values.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
  ];
  for (const relative of requiredFiles) required(root, relative);
  check(!existsSync(join(root, "variants", "standalone")), "old standalone variant directory must not exist");
  check(!existsSync(join(root, "revisions", "standalone")), "old standalone revision directory must not exist");

  const sourceLock = parseYamlFile(join(root, "source-lock.yaml"));
  const dependencyLock = parseYamlFile(join(root, "dependency-lock.yaml"));
  const valueModel = parseYamlFile(join(root, "value-model.yaml"));
  const effectiveValues = parseYamlFile(join(root, "effective-values.yaml"));
  const recipe = parseYamlFile(join(root, "recipe.yaml"));
  const variant = parseYamlFile(join(root, "variants", "default", "variant.yaml"));
  const revision = parseYamlFile(join(revisionRoot, "variant-revision.yaml"));
  const inventory = parseYamlFile(join(renderedRoot, "object-inventory.yaml"));
  const equivalence = parseYamlFile(join(receiptsRoot, "helm-equivalence-receipt.yaml"));
  const renderReceipt = parseYamlFile(join(receiptsRoot, "render-receipt.yaml"));
  const scanReceipt = parseYamlFile(join(receiptsRoot, "scan-receipt.yaml"));
  const installGate = parseYamlFile(join(receiptsRoot, "install-gate.yaml"));

  check(sourceLock.kind === "SourceLock", "source-lock.yaml must be SourceLock");
  check(sourceLock.spec.repositoryName === "bitnami", "source repository must be bitnami");
  check(sourceLock.spec.chart === "redis", "source chart must be redis");
  check(sourceLock.spec.version === "25.5.3", "source chart version must be 25.5.3");
  check(
    sourceLock.spec.contentURL === "oci://registry-1.docker.io/bitnamicharts/redis:25.5.3",
    "source content URL mismatch",
  );
  check(Boolean(sourceLock.spec.archiveSHA256), "source archive SHA must be present");
  const archiveReceiptPath = existingRelative(root, sourceLock.spec.evidence?.archiveReceipt, "source evidence archiveReceipt");
  const archiveReceipt = parseYamlFile(archiveReceiptPath);
  check(
    archiveReceipt.spec.chart.archiveSHA256 === sourceLock.spec.archiveSHA256,
    "source lock archive SHA must match archive receipt",
  );

  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  const common = dependencyLock.spec.dependencies?.find((dependency) => dependency.name === "common");
  check(common?.version === "2.39.0", "dependency lock must include common 2.39.0");
  check(recipe.spec.chartRef.sourceLock === "source-lock.yaml", "recipe must reference source-lock.yaml");
  check(recipe.spec.chartRef.dependencyLock === "dependency-lock.yaml", "recipe must reference dependency-lock.yaml");

  check(variant.kind === "Variant", "default variant must be Variant");
  check(variant.metadata.name === "default", "variant name must be default");
  check(variant.spec.namespace === "redis", "variant namespace must be redis");
  check(variant.spec.releaseName === "redis", "variant releaseName must be redis");
  check(variant.spec.capabilityProfile.kubeVersion === "1.30.0", "variant kubeVersion must be 1.30.0");
  check(variant.spec.hookPolicy === "no-hooks", "variant hook policy must be no-hooks");

  const effectiveValuesFile = effectiveValues.spec.files?.[0];
  check(effectiveValuesFile?.sha256, "effective values SHA must be present");
  const effectiveValuesSource = existingRelative(root, effectiveValuesFile?.sourcePath, "effective values source");
  check(effectiveValuesFile.sha256 === sha256File(effectiveValuesSource), "effective values source SHA mismatch");
  check(valueModel.spec.unknownValues, "value model must state unknownValues status");
  check(valueModel.spec.deadValues, "value model must state deadValues status");
  check(valueModel.spec.ignoredValues, "value model must state ignoredValues status");

  const releaseObjectsPath = join(renderedRoot, "release-objects.yaml");
  const releaseDigest = sha256File(releaseObjectsPath);
  const objectIdentities = parseRenderedObjects(releaseObjectsPath);
  const uniqueObjectIdentities = new Set(objectIdentities);
  check(objectIdentities.length === 14, "Redis default must have exactly 14 Helm release objects");
  check(uniqueObjectIdentities.size === objectIdentities.length, "Redis default must not have duplicate objects");
  check(inventory.spec.objectCount === 14, "object inventory must record 14 objects");
  check(inventory.spec.sourceSHA256 === releaseDigest, "object inventory source digest mismatch");
  check(inventory.spec.objects.length === 14, "object inventory must list 14 objects");

  const recipeDigest = sha256File(join(root, "recipe.yaml"));
  const variantDigest = sha256File(join(root, "variants", "default", "variant.yaml"));
  const effectiveValuesDigest = sha256File(join(root, "effective-values.yaml"));
  check(revision.spec.digestInputs.recipeSHA256 === recipeDigest, "variant revision recipe digest mismatch");
  check(revision.spec.digestInputs.variantSHA256 === variantDigest, "variant revision variant digest mismatch");
  check(
    revision.spec.digestInputs.effectiveValuesSHA256 === effectiveValuesDigest,
    "variant revision effective-values digest mismatch",
  );
  check(revision.spec.digestInputs.renderedObjectSetSHA256 === releaseDigest, "variant revision rendered digest mismatch");

  check(renderReceipt.spec.outputs.renderedObjectSetSHA256 === releaseDigest, "render receipt rendered digest mismatch");
  check(renderReceipt.spec.outputs.objectCount === 14, "render receipt object count must be 14");
  check(renderReceipt.spec.outputs.secretCountSeparatedByCubInstall === 1, "render receipt separated secret count must be 1");

  check(
    equivalence.spec.regularHelm.renderedSHA256 === "362dbc4854421a23ea48da4ee7e72dbc98422fa9affc26ac372c761d4b90e10d",
    "regular Helm SHA mismatch",
  );
  check(equivalence.spec.regularHelm.objectCount === 14, "regular Helm object count must be 14");
  check(equivalence.spec.cubInstall.objectCountIncludingSecretsAndSupportObjects === 15, "cub object count must be 15");
  check(equivalence.spec.cubInstall.semanticObjectMatches === "14/14", "semantic object match must be 14/14");
  check(equivalence.spec.result === "pass", "Helm equivalence must pass");
  const namespaceClassification = equivalence.spec.classifications?.find(
    (entry) => entry.identity === "v1|Namespace||redis",
  );
  check(
    namespaceClassification?.classification === "installer-support-object",
    "namespace support object must be classified",
  );

  check(scanReceipt.spec.renderedObjectSetSHA256 === releaseDigest, "scan receipt rendered digest mismatch");
  check(
    scanReceipt.spec.scanner?.name === "helm-expt-local-rendered-object-scan",
    "scan receipt scanner name mismatch",
  );
  check(Boolean(scanReceipt.spec.policyBundleDigest), "scan receipt policy bundle digest must be present");
  check(scanReceipt.spec.result === "warn", "Redis scan receipt must warn while high findings exist");
  check(scanReceipt.spec.findingCounts?.high === 2, "Redis scan receipt must record 2 high findings");
  check(scanReceipt.spec.findingCounts?.medium === 2, "Redis scan receipt must record 2 medium findings");
  check(scanReceipt.spec.findingCounts?.low === 0, "Redis scan receipt must record 0 low findings");
  check(scanReceipt.spec.findings?.length === 4, "Redis scan receipt must list 4 findings");
  check(
    scanReceipt.spec.findings.filter((finding) => finding.rule === "mutable-image-tag").length === 2,
    "Redis scan receipt must list 2 mutable-image-tag findings",
  );
  check(
    scanReceipt.spec.findings.filter((finding) => finding.rule === "pdb-unhealthy-pod-eviction-policy").length === 2,
    "Redis scan receipt must list 2 PDB unhealthy eviction policy findings",
  );
  check(installGate.spec.renderedObjectSetSHA256 === releaseDigest, "install gate rendered digest mismatch");
  check(installGate.spec.decision === "warn", "install gate must warn with high scan findings");
  check(installGate.spec.allowedScopes?.includes("local-test"), "install gate must allow local-test only");
  check(installGate.spec.blockedScopes?.includes("production"), "install gate must block production with high findings");

  return true;
}

function expectFailure(name, mutate, expectedMessage) {
  const tempRoot = mkdtempSync(join(tmpdir(), "helm-expt-redis-proof-"));
  const tempProof = join(tempRoot, "25.5.3");
  try {
    cpSync(defaultProofRoot, tempProof, { recursive: true });
    mutate(tempProof);
    try {
      verifyProof(tempProof);
    } catch (error) {
      if (String(error.message).includes(expectedMessage)) {
        console.log(`self-test passed: ${name}`);
        return;
      }
      throw new Error(
        `self-test ${name} failed with unexpected error:\n${error.message}\nexpected to include: ${expectedMessage}`,
      );
    }
    throw new Error(`self-test ${name} unexpectedly passed`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
}

function runSelfTest() {
  expectFailure(
    "rendered object digest tampering is rejected",
    (root) => {
      const path = join(root, "revisions", "default", "r001", "rendered", "release-objects.yaml");
      writeFileSync(path, `${readFileSync(path, "utf8")}\n# tampered\n`);
    },
    "object inventory source digest mismatch",
  );

  expectFailure(
    "missing namespace support classification is rejected",
    (root) => {
      const path = join(
        root,
        "revisions",
        "default",
        "r001",
        "receipts",
        "helm-equivalence-receipt.yaml",
      );
      writeFileSync(path, readFileSync(path, "utf8").replace("v1|Namespace||redis", "v1|Namespace||wrong"));
    },
    "namespace support object must be classified",
  );

  expectFailure(
    "false scan success is rejected",
    (root) => {
      const path = join(root, "revisions", "default", "r001", "receipts", "scan-receipt.yaml");
      writeFileSync(path, readFileSync(path, "utf8").replace("result: warn", "result: pass"));
    },
    "Redis scan receipt must warn while high findings exist",
  );

  expectFailure(
    "old standalone variant directory is rejected",
    (root) => {
      cpSync(join(root, "variants", "default"), join(root, "variants", "standalone"), { recursive: true });
    },
    "old standalone variant directory must not exist",
  );
}

if (selfTest) {
  runSelfTest();
} else {
  verifyProof(proofRoot);
  console.log("verified Redis default proof artifacts");
}
