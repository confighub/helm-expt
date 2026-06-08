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
const redisImageDigest = "sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25";
const defaultValuesText = `image:
  digest: ${redisImageDigest}
auth:
  password: "confighub-redis-password"
`;
const reuseExistingSecretValuesText = `image:
  digest: ${redisImageDigest}
auth:
  existingSecret: redis-existing-secret
  existingSecretPasswordKey: redis-password
`;
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

function canonicalObjectMap(path) {
  const script = `
import json
import sys
import yaml

result = {}
for doc in yaml.safe_load_all(open(sys.argv[1], "r", encoding="utf-8")):
    if not isinstance(doc, dict):
        continue
    metadata = doc.get("metadata") or {}
    key = "|".join([
        str(doc.get("apiVersion", "")),
        str(doc.get("kind", "")),
        str(metadata.get("namespace", "")),
        str(metadata.get("name", "")),
    ])
    result[key] = json.dumps(doc, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
print(json.dumps(result, sort_keys=True))
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
    "effective-values-reuse-existing-secret.yaml",
    "diffs/default-to-reuse-existing-secret.yaml",
    "recipe.yaml",
    "variants/default/variant.yaml",
    "variants/reuse-existing-secret/variant.yaml",
    "revisions/default/r001/variant-revision.yaml",
    "revisions/default/r001/rendered/release-objects.yaml",
    "revisions/default/r001/rendered/object-inventory.yaml",
    "revisions/default/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/default/r001/receipts/render-receipt.yaml",
    "revisions/default/r001/receipts/scan-receipt.yaml",
    "revisions/default/r001/receipts/install-gate.yaml",
    "revisions/reuse-existing-secret/r001/variant-revision.yaml",
    "revisions/reuse-existing-secret/r001/rendered/release-objects.yaml",
    "revisions/reuse-existing-secret/r001/rendered/object-inventory.yaml",
    "revisions/reuse-existing-secret/r001/receipts/helm-equivalence-receipt.yaml",
    "revisions/reuse-existing-secret/r001/receipts/render-receipt.yaml",
    "revisions/reuse-existing-secret/r001/receipts/scan-receipt.yaml",
    "revisions/reuse-existing-secret/r001/receipts/install-gate.yaml",
  ];
  for (const relative of requiredFiles) required(root, relative);
  check(!existsSync(join(root, "variants", "standalone")), "old standalone variant directory must not exist");
  check(!existsSync(join(root, "revisions", "standalone")), "old standalone revision directory must not exist");

  const sourceLock = parseYamlFile(join(root, "source-lock.yaml"));
  const dependencyLock = parseYamlFile(join(root, "dependency-lock.yaml"));
  const valueModel = parseYamlFile(join(root, "value-model.yaml"));
  const effectiveValues = parseYamlFile(join(root, "effective-values.yaml"));
  const reuseEffectiveValues = parseYamlFile(join(root, "effective-values-reuse-existing-secret.yaml"));
  const variantDiff = parseYamlFile(join(root, "diffs", "default-to-reuse-existing-secret.yaml"));
  const recipe = parseYamlFile(join(root, "recipe.yaml"));
  const variant = parseYamlFile(join(root, "variants", "default", "variant.yaml"));
  const reuseVariant = parseYamlFile(join(root, "variants", "reuse-existing-secret", "variant.yaml"));
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
  const packageReceiptPath = existingRelative(
    root,
    sourceLock.spec.evidence?.installerPackageReceipt,
    "source evidence installerPackageReceipt",
  );
  const packageReceipt = parseYamlFile(packageReceiptPath);
  check(packageReceipt.kind === "InstallerPackageReceipt", "source evidence must be an InstallerPackageReceipt");
  check(
    packageReceipt.spec.chart?.repository === sourceLock.spec.repositoryName,
    "source lock repository must match installer package receipt",
  );
  check(
    packageReceipt.spec.chart?.name === sourceLock.spec.chart,
    "source lock chart name must match installer package receipt",
  );
  check(
    String(packageReceipt.spec.chart?.version) === String(sourceLock.spec.version),
    "source lock version must match installer package receipt",
  );
  check(
    packageReceipt.spec.package?.path === "packages/bitnami/redis/25.5.3",
    "installer package receipt must point at current packages/ path",
  );

  check(dependencyLock.kind === "DependencyLock", "dependency-lock.yaml must be DependencyLock");
  const common = dependencyLock.spec.dependencies?.find((dependency) => dependency.name === "common");
  check(common?.version === "2.39.0", "dependency lock must include common 2.39.0");
  check(recipe.spec.chartRef.sourceLock === "source-lock.yaml", "recipe must reference source-lock.yaml");
  check(recipe.spec.chartRef.dependencyLock === "dependency-lock.yaml", "recipe must reference dependency-lock.yaml");
  check(recipe.spec.variants?.includes("variants/default/variant.yaml"), "recipe must include default variant");
  check(
    recipe.spec.variants?.includes("variants/reuse-existing-secret/variant.yaml"),
    "recipe must include reuse-existing-secret variant",
  );

  check(variant.kind === "Variant", "default variant must be Variant");
  check(variant.metadata.name === "default", "variant name must be default");
  check(variant.spec.namespace === "redis", "variant namespace must be redis");
  check(variant.spec.releaseName === "redis", "variant releaseName must be redis");
  check(variant.spec.capabilityProfile.kubeVersion === "1.30.0", "variant kubeVersion must be 1.30.0");
  check(variant.spec.hookPolicy === "no-hooks", "variant hook policy must be no-hooks");

  check(reuseVariant.kind === "Variant", "reuse-existing-secret variant must be Variant");
  check(reuseVariant.metadata.name === "reuse-existing-secret", "reuse-existing-secret variant name mismatch");
  check(reuseVariant.spec.namespace === "redis", "reuse-existing-secret namespace must be redis");
  check(reuseVariant.spec.releaseName === "redis", "reuse-existing-secret releaseName must be redis");
  check(
    reuseVariant.spec.valuesProfile === "../../effective-values-reuse-existing-secret.yaml",
    "reuse-existing-secret values profile mismatch",
  );
  const requiredSecret = reuseVariant.spec.targetFacts?.requiredSecrets?.[0];
  check(requiredSecret?.namespace === "redis", "reuse-existing-secret target secret namespace mismatch");
  check(requiredSecret?.name === "redis-existing-secret", "reuse-existing-secret target secret name mismatch");
  check(
    requiredSecret?.keys?.includes("redis-password"),
    "reuse-existing-secret target secret key redis-password missing",
  );

  const effectiveValuesFile = effectiveValues.spec.files?.[0];
  check(effectiveValuesFile?.sha256, "effective values SHA must be present");
  check(effectiveValuesFile?.source === "inline-proof", "default values must be inline proof values");
  check(
    effectiveValuesFile.sha256 === sha256(defaultValuesText),
    "default inline values SHA mismatch",
  );
  check(
    effectiveValues.spec.values?.auth?.password === "confighub-redis-password",
    "default value auth.password mismatch",
  );
  check(
    effectiveValues.spec.values?.image?.digest === redisImageDigest,
    "default value image.digest mismatch",
  );
  const reuseEffectiveValuesFile = reuseEffectiveValues.spec.files?.[0];
  check(reuseEffectiveValuesFile?.source === "inline-proof", "reuse-existing-secret values must be inline proof values");
  check(
    reuseEffectiveValuesFile?.sha256 === sha256(reuseExistingSecretValuesText),
    "reuse-existing-secret inline values SHA mismatch",
  );
  check(
    reuseEffectiveValues.spec.values?.image?.digest === redisImageDigest,
    "reuse-existing-secret value image.digest mismatch",
  );
  check(
    reuseEffectiveValues.spec.values?.auth?.existingSecret === "redis-existing-secret",
    "reuse-existing-secret value auth.existingSecret mismatch",
  );
  check(
    reuseEffectiveValues.spec.values?.auth?.existingSecretPasswordKey === "redis-password",
    "reuse-existing-secret value auth.existingSecretPasswordKey mismatch",
  );
  check(
    !Object.hasOwn(reuseEffectiveValues.spec.values?.auth ?? {}, "password"),
    "reuse-existing-secret values must not store auth.password",
  );
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
    equivalence.spec.regularHelm.renderedSHA256 === releaseDigest,
    "regular Helm SHA mismatch",
  );
  check(equivalence.spec.regularHelm.objectCount === 14, "regular Helm object count must be 14");
  check(equivalence.spec.cubInstall.objectCountIncludingSecretsAndSupportObjects === 15, "cub object count must be 15");
  check(equivalence.spec.cubInstall.uploadedManifestFiles === 14, "cub uploaded manifest count must be 14");
  check(equivalence.spec.cubInstall.separatedSecretFiles === 1, "cub separated secret count must be 1");
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
  check(scanReceipt.spec.result === "warn", "Redis scan receipt must warn while PDB findings exist");
  check(scanReceipt.spec.findingCounts?.high === 0, "Redis scan receipt must record 0 high findings after image digest pinning");
  check(scanReceipt.spec.findingCounts?.medium === 2, "Redis scan receipt must record 2 medium findings");
  check(scanReceipt.spec.findingCounts?.low === 0, "Redis scan receipt must record 0 low findings");
  check(scanReceipt.spec.findings?.length === 2, "Redis scan receipt must list 2 findings");
  check(
    scanReceipt.spec.findings.filter((finding) => finding.rule === "mutable-image-tag").length === 0,
    "Redis scan receipt must not list mutable-image-tag findings after image digest pinning",
  );
  check(
    scanReceipt.spec.findings.filter((finding) => finding.rule === "pdb-unhealthy-pod-eviction-policy").length === 2,
    "Redis scan receipt must list 2 PDB unhealthy eviction policy findings",
  );
  check(installGate.spec.renderedObjectSetSHA256 === releaseDigest, "install gate rendered digest mismatch");
  check(installGate.spec.decision === "warn", "install gate must warn with remaining scan findings");
  check(installGate.spec.allowedScopes?.includes("local-test"), "install gate must allow local-test only");
  check(installGate.spec.blockedScopes?.includes("production"), "install gate must block production with high findings");

  const reuseRevisionRoot = join(root, "revisions", "reuse-existing-secret", "r001");
  const reuseRenderedRoot = join(reuseRevisionRoot, "rendered");
  const reuseReceiptsRoot = join(reuseRevisionRoot, "receipts");
  const reuseRevision = parseYamlFile(join(reuseRevisionRoot, "variant-revision.yaml"));
  const reuseInventory = parseYamlFile(join(reuseRenderedRoot, "object-inventory.yaml"));
  const reuseEquivalence = parseYamlFile(join(reuseReceiptsRoot, "helm-equivalence-receipt.yaml"));
  const reuseRenderReceipt = parseYamlFile(join(reuseReceiptsRoot, "render-receipt.yaml"));
  const reuseScanReceipt = parseYamlFile(join(reuseReceiptsRoot, "scan-receipt.yaml"));
  const reuseInstallGate = parseYamlFile(join(reuseReceiptsRoot, "install-gate.yaml"));
  const reuseReleaseObjectsPath = join(reuseRenderedRoot, "release-objects.yaml");
  const reuseReleaseText = readFileSync(reuseReleaseObjectsPath, "utf8");
  const reuseReleaseDigest = sha256File(reuseReleaseObjectsPath);
  const reuseObjectIdentities = parseRenderedObjects(reuseReleaseObjectsPath);
  const reuseUniqueObjectIdentities = new Set(reuseObjectIdentities);
  check(reuseObjectIdentities.length === 13, "Redis reuse-existing-secret must have exactly 13 Helm release objects");
  check(
    reuseUniqueObjectIdentities.size === reuseObjectIdentities.length,
    "Redis reuse-existing-secret must not have duplicate objects",
  );
  check(
    !reuseObjectIdentities.some((identity) => identity.includes("|Secret|")),
    "Redis reuse-existing-secret must not render a Secret",
  );
  check(
    reuseReleaseText.includes("secretName: redis-existing-secret"),
    "Redis reuse-existing-secret StatefulSets must reference redis-existing-secret",
  );
  check(reuseInventory.spec.objectCount === 13, "reuse-existing-secret inventory must record 13 objects");
  check(reuseInventory.spec.sourceSHA256 === reuseReleaseDigest, "reuse-existing-secret inventory source digest mismatch");
  check(reuseInventory.spec.objects.length === 13, "reuse-existing-secret inventory must list 13 objects");

  const reuseVariantDigest = sha256File(join(root, "variants", "reuse-existing-secret", "variant.yaml"));
  const reuseEffectiveValuesDigest = sha256File(join(root, "effective-values-reuse-existing-secret.yaml"));
  check(reuseRevision.spec.digestInputs.recipeSHA256 === recipeDigest, "reuse revision recipe digest mismatch");
  check(reuseRevision.spec.digestInputs.variantSHA256 === reuseVariantDigest, "reuse revision variant digest mismatch");
  check(
    reuseRevision.spec.digestInputs.effectiveValuesSHA256 === reuseEffectiveValuesDigest,
    "reuse revision effective-values digest mismatch",
  );
  check(
    reuseRevision.spec.digestInputs.renderedObjectSetSHA256 === reuseReleaseDigest,
    "reuse revision rendered digest mismatch",
  );
  check(
    reuseRenderReceipt.spec.outputs.renderedObjectSetSHA256 === reuseReleaseDigest,
    "reuse render receipt rendered digest mismatch",
  );
  check(reuseRenderReceipt.spec.outputs.objectCount === 13, "reuse render receipt object count must be 13");
  check(reuseRenderReceipt.spec.outputs.renderedSecretCount === 0, "reuse render receipt rendered Secret count must be 0");
  check(
    reuseRenderReceipt.spec.outputs.secretCountSeparatedByCubInstall === 0,
    "reuse render receipt separated secret count must be 0",
  );
  check(reuseEquivalence.spec.regularHelm.renderedSHA256 === reuseReleaseDigest, "reuse regular Helm SHA mismatch");
  check(reuseEquivalence.spec.regularHelm.objectCount === 13, "reuse regular Helm object count must be 13");
  check(
    reuseEquivalence.spec.cubInstall.objectCountIncludingSecretsAndSupportObjects === 14,
    "reuse cub object count must be 14",
  );
  check(reuseEquivalence.spec.cubInstall.uploadedManifestFiles === 14, "reuse uploaded manifest count must be 14");
  check(reuseEquivalence.spec.cubInstall.separatedSecretFiles === 0, "reuse separated secret count must be 0");
  check(reuseEquivalence.spec.cubInstall.semanticObjectMatches === "13/13", "reuse semantic match must be 13/13");
  check(reuseEquivalence.spec.result === "pass", "reuse Helm equivalence must pass");
  check(
    !reuseEquivalence.spec.classifications?.some((entry) => entry.identity === "v1|Secret|redis|redis"),
    "reuse equivalence must not classify a rendered Redis Secret",
  );
  check(reuseScanReceipt.spec.renderedObjectSetSHA256 === reuseReleaseDigest, "reuse scan receipt rendered digest mismatch");
  check(reuseScanReceipt.spec.result === "warn", "reuse scan receipt must warn while PDB findings exist");
  check(reuseScanReceipt.spec.findingCounts?.high === 0, "reuse scan receipt must record 0 high findings after image digest pinning");
  check(reuseScanReceipt.spec.findingCounts?.medium === 2, "reuse scan receipt must record 2 medium findings");
  check(reuseInstallGate.spec.renderedObjectSetSHA256 === reuseReleaseDigest, "reuse install gate rendered digest mismatch");
  check(reuseInstallGate.spec.decision === "warn", "reuse install gate must warn with remaining scan findings");
  check(reuseInstallGate.spec.allowedScopes?.includes("local-test"), "reuse install gate must allow local-test only");
  check(reuseInstallGate.spec.blockedScopes?.includes("production"), "reuse install gate must block production");

  const defaultObjectMap = canonicalObjectMap(releaseObjectsPath);
  const reuseObjectMap = canonicalObjectMap(reuseReleaseObjectsPath);
  const defaultKeys = new Set(Object.keys(defaultObjectMap));
  const reuseKeys = new Set(Object.keys(reuseObjectMap));
  const removedObjects = [...defaultKeys].filter((key) => !reuseKeys.has(key)).sort();
  const addedObjects = [...reuseKeys].filter((key) => !defaultKeys.has(key)).sort();
  const changedObjects = [...defaultKeys]
    .filter((key) => reuseKeys.has(key) && defaultObjectMap[key] !== reuseObjectMap[key])
    .sort();
  check(variantDiff.kind === "VariantDiff", "variant diff must be VariantDiff");
  check(
    variantDiff.spec.from?.renderedObjectSetSHA256 === releaseDigest,
    "variant diff default rendered digest mismatch",
  );
  check(
    variantDiff.spec.to?.renderedObjectSetSHA256 === reuseReleaseDigest,
    "variant diff reuse rendered digest mismatch",
  );
  check(JSON.stringify(variantDiff.spec.removedObjects?.map((entry) => entry.identity).sort()) === JSON.stringify(removedObjects), "variant diff removed object summary mismatch");
  check(JSON.stringify(variantDiff.spec.addedObjects ?? []) === JSON.stringify(addedObjects), "variant diff added object summary mismatch");
  check(JSON.stringify(variantDiff.spec.changedObjects?.map((entry) => entry.identity).sort()) === JSON.stringify(changedObjects), "variant diff changed object summary mismatch");
  check(variantDiff.spec.summary?.removedObjects === 1, "variant diff removed count mismatch");
  check(variantDiff.spec.summary?.addedObjects === 0, "variant diff added count mismatch");
  check(variantDiff.spec.summary?.changedObjects === 2, "variant diff changed count mismatch");
  const diffTargetFact = variantDiff.spec.addedTargetFacts?.[0];
  check(diffTargetFact?.kind === "Secret", "variant diff added target fact kind mismatch");
  check(diffTargetFact?.namespace === "redis", "variant diff added target fact namespace mismatch");
  check(diffTargetFact?.name === "redis-existing-secret", "variant diff added target fact name mismatch");
  check(diffTargetFact?.keys?.includes("redis-password"), "variant diff added target fact key mismatch");

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
    "Redis scan receipt must warn while PDB findings exist",
  );

  expectFailure(
    "old standalone variant directory is rejected",
    (root) => {
      cpSync(join(root, "variants", "default"), join(root, "variants", "standalone"), { recursive: true });
    },
    "old standalone variant directory must not exist",
  );

  expectFailure(
    "reuse-existing-secret target fact tampering is rejected",
    (root) => {
      const path = join(root, "variants", "reuse-existing-secret", "variant.yaml");
      writeFileSync(path, readFileSync(path, "utf8").replace("redis-existing-secret", "wrong-secret"));
    },
    "reuse-existing-secret target secret name mismatch",
  );

  expectFailure(
    "variant diff lies are rejected",
    (root) => {
      const path = join(root, "diffs", "default-to-reuse-existing-secret.yaml");
      writeFileSync(path, readFileSync(path, "utf8").replace("removedObjects: 1", "removedObjects: 0"));
    },
    "variant diff removed count mismatch",
  );
}

if (selfTest) {
  runSelfTest();
} else {
  verifyProof(proofRoot);
  console.log("verified Redis default and reuse-existing-secret proof artifacts");
}
