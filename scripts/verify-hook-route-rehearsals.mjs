import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  check,
  parseDocs,
  readYaml,
  relativeRepo,
  repoRoot,
  sha256,
} from "./lib/proof-common.mjs";

const rehearsalRoot = join(repoRoot, "data", "hook-route-candidates", "rehearsals");
const minioRoot = join(rehearsalRoot, "bitnami-minio-provisioning");
const receiptPath = join(minioRoot, "rehearsal-receipt.yaml");

verifyMinioProvisioningRehearsal();

console.log("verified hook route rehearsals: 1 receipt(s)");

function verifyMinioProvisioningRehearsal() {
  check(existsSync(receiptPath), `missing ${relativeRepo(receiptPath)}`);
  const receipt = readYaml(receiptPath);
  check(receipt.kind === "HookRouteRehearsalReceipt", "MinIO rehearsal receipt must be a HookRouteRehearsalReceipt");
  check(receipt.spec.chart === "bitnami/minio", "MinIO rehearsal chart must be bitnami/minio");
  check(receipt.spec.version === "17.0.21", "MinIO rehearsal version must be 17.0.21");
  check(receipt.spec.result === "blocked", "MinIO rehearsal must remain blocked until live runtime proof exists");
  check(receipt.spec.disposition === "route-shape-rendered-live-runtime-blocked", "MinIO rehearsal disposition changed unexpectedly");

  const summaryPath = join(minioRoot, "render-summary.json");
  check(existsSync(summaryPath), `missing ${relativeRepo(summaryPath)}`);
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  assertRender(summary, "default-rendered-no-hooks.yaml", "default-rendered-no-hooks.sanitized.yaml", {
    objectCount: 11,
    hookObjectCount: 0,
    rawSha256: receipt.spec.renderEvidence.defaultNoHooks.rawRenderSHA256,
    sanitizedSHA256: receipt.spec.renderEvidence.defaultNoHooks.sanitizedSHA256,
  });
  assertRender(summary, "provisioning-rendered-no-hooks.yaml", "provisioning-rendered-no-hooks.sanitized.yaml", {
    objectCount: 13,
    hookObjectCount: 0,
    rawSha256: receipt.spec.renderEvidence.provisioningNoHooks.rawRenderSHA256,
    sanitizedSHA256: receipt.spec.renderEvidence.provisioningNoHooks.sanitizedSHA256,
  });
  assertRender(summary, "provisioning-rendered-with-hooks.yaml", "provisioning-rendered-with-hooks.sanitized.yaml", {
    objectCount: 14,
    hookObjectCount: 1,
    rawSha256: receipt.spec.renderEvidence.provisioningWithHooks.rawRenderSHA256,
    sanitizedSHA256: receipt.spec.renderEvidence.provisioningWithHooks.sanitizedSHA256,
  });

  const withHooks = summary["provisioning-rendered-with-hooks.yaml"];
  const hook = withHooks.hooks?.[0] ?? {};
  check(hook.kind === "Job", "MinIO provisioning hook must render as a Job");
  check(hook.name === "minio-provisioning", "MinIO provisioning hook Job name changed");
  check(hook.hook === "post-install,post-upgrade", "MinIO provisioning hook phases changed");
  check(hook.deletePolicy === "before-hook-creation", "MinIO provisioning hook delete policy changed");

  const hookJobPath = join(minioRoot, "hook-job.yaml");
  const hookDocs = parseDocs(readFileSync(hookJobPath, "utf8"));
  check(hookDocs.length === 1, "extracted MinIO hook Job must contain one object");
  const hookDoc = hookDocs[0];
  check(hookDoc.kind === "Job", "extracted MinIO hook object must be a Job");
  check(hookDoc.metadata?.annotations?.["helm.sh/hook"] === "post-install,post-upgrade", "extracted MinIO hook annotations changed");

  for (const evidence of receipt.spec.evidenceFiles) {
    const path = join(minioRoot, evidence.path);
    check(existsSync(path), `missing evidence file ${relativeRepo(path)}`);
    check(sha256(readFileSync(path, "utf8")) === evidence.sha256, `evidence SHA mismatch for ${relativeRepo(path)}`);
  }

  const applyText = readFileSync(join(minioRoot, "kubectl-apply-desired.txt"), "utf8");
  check(applyText.includes("deployment.apps/minio created"), "MinIO desired apply did not create deployment/minio");
  check(applyText.includes("deployment.apps/minio-console created"), "MinIO desired apply did not create deployment/minio-console");

  const observeText = readFileSync(join(minioRoot, "kubectl-observe-blocker.txt"), "utf8");
  check(observeText.includes("ImagePullBackOff"), "MinIO blocker evidence must include ImagePullBackOff");
  check(observeText.includes("ErrImagePull"), "MinIO blocker evidence must include ErrImagePull");
  check(observeText.includes("docker.io/bitnami/minio:2025.7.23-debian-12-r3: not found"), "MinIO blocker evidence must include the missing MinIO image tag");
  check(observeText.includes("docker.io/bitnami/minio-object-browser:2.0.2-debian-12-r3: not found"), "MinIO blocker evidence must include the missing console image tag");

  const candidateText = readFileSync(join(repoRoot, "data", "hook-route-candidates", "bitnami-minio.yaml"), "utf8");
  check(candidateText.includes("rehearsal-receipt.yaml"), "MinIO route candidate must link to the rehearsal receipt");
  check(candidateText.includes("image tags did not resolve"), "MinIO route candidate must name the runtime blocker");
}

function assertRender(summary, rawName, sanitizedName, expected) {
  const row = summary[rawName];
  check(row, `render summary missing ${rawName}`);
  const path = join(minioRoot, sanitizedName);
  check(existsSync(path), `missing render file ${relativeRepo(path)}`);
  check(row.objectCount === expected.objectCount, `${rawName} object count changed`);
  check(row.hookObjectCount === expected.hookObjectCount, `${rawName} hook object count changed`);
  check(row.sha256 === expected.rawSha256, `${rawName} raw recorded SHA mismatch`);
  check(sha256(readFileSync(path, "utf8")) === expected.sanitizedSHA256, `${sanitizedName} file SHA mismatch`);
  const text = readFileSync(path, "utf8");
  check(!text.includes("root-password: \"") || text.includes("root-password: <redacted>"), `${sanitizedName} must not publish generated root-password data`);
}
