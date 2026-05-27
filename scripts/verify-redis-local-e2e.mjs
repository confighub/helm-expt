import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const args = process.argv.slice(2);
const variantName = optionValue("--variant") ?? "default";
if (!["default", "reuse-existing-secret"].includes(variantName)) {
  throw new Error(`unsupported Redis local e2e verifier variant: ${variantName}`);
}
const runName = variantName === "default" ? "latest" : `${variantName}-latest`;
const runRoot = join(repoRoot, "runs", "redis-local-kind", runName);
const variantRevision = `recipes/bitnami/redis/25.5.3/revisions/${variantName}/r001/variant-revision.yaml`;
const releaseObjects = join(
  repoRoot,
  "recipes",
  "bitnami",
  "redis",
  "25.5.3",
  "revisions",
  variantName,
  "r001",
  "rendered",
  "release-objects.yaml",
);

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
  return JSON.parse(execFileSync("python3", ["-c", script, path], { encoding: "utf8" }));
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const receiptPath = join(runRoot, "observation-receipt.yaml");
  const pongPath = join(runRoot, "redis-pong.txt");
  const objectsPath = join(runRoot, "kubectl-objects.txt");

  check(existsSync(receiptPath), "missing local e2e observation receipt");
  check(existsSync(pongPath), "missing Redis PONG evidence");
  check(existsSync(objectsPath), "missing kubectl object evidence");

  const receipt = parseYamlFile(receiptPath);
  check(receipt.kind === "ObservationReceipt", "receipt must be ObservationReceipt");
  check(receipt.spec.variantRevision === variantRevision, `observation receipt must point at the ${variantName} Redis revision`);
  check(receipt.spec.result === "pass", "local e2e result must be pass");
  check(receipt.spec.variant === variantName, "local e2e receipt variant mismatch");
  check(receipt.spec.target?.kind === "kind", "target kind must be kind");
  check(receipt.spec.target?.name === "helm-expt-redis", "target cluster must be helm-expt-redis");
  check(receipt.spec.target?.context === "kind-helm-expt-redis", "target context mismatch");
  check(receipt.spec.target?.namespace === "redis", "target namespace must be redis");
  check(
    receipt.spec.renderedObjectSetSHA256 === sha256File(releaseObjects),
    "observation receipt rendered object digest mismatch",
  );
  check(Boolean(receipt.spec.targetFacts?.defaultStorageClass?.name), "default StorageClass target fact missing");
  if (variantName === "reuse-existing-secret") {
    const requiredSecret = receipt.spec.targetFacts?.requiredSecret;
    const secretEvidencePath = join(runRoot, requiredSecret?.evidencePath ?? "");
    check(requiredSecret?.namespace === "redis", "reuse local e2e required Secret namespace mismatch");
    check(requiredSecret?.name === "redis-existing-secret", "reuse local e2e required Secret name mismatch");
    check(requiredSecret?.key === "redis-password", "reuse local e2e required Secret key mismatch");
    check(requiredSecret?.status === "applied-by-test", "reuse local e2e required Secret status mismatch");
    check(existsSync(secretEvidencePath), "reuse local e2e required Secret evidence missing");
    check(requiredSecret.evidenceSHA256 === sha256File(secretEvidencePath), "reuse local e2e required Secret evidence digest mismatch");
    check(
      receipt.spec.checks?.some((check) => check.name === "target-secret-present" && check.result === "pass"),
      "reuse local e2e target-secret-present check missing",
    );
  }
  check(receipt.spec.checks?.some((check) => check.name === "redis-ping" && check.result === "pass"), "redis-ping check missing");
  check(
    receipt.spec.checks?.some((check) => check.name === "redis-pvcs-bound" && check.result === "pass" && check.count === 4),
    "redis-pvcs-bound check missing",
  );
  check(readFileSync(pongPath, "utf8").includes("PONG"), "PONG evidence does not contain PONG");
  const pingCheck = receipt.spec.checks.find((check) => check.name === "redis-ping");
  check(pingCheck.evidenceSHA256 === sha256File(pongPath), "PONG evidence digest mismatch");
  check(receipt.spec.kubectlObjects?.sha256 === sha256File(objectsPath), "kubectl object evidence digest mismatch");

  console.log("verified Redis local kind e2e observation receipt");
}

main();
