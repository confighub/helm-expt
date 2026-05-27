import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const statuses = recipeRoots().map(buildStatus);
  for (const status of statuses) write(status.path, status.yaml);
  console.log(`wrote ${statuses.length} catalog status file(s)`);
} else if (mode === "--verify") {
  verifyStatuses();
  console.log("verified catalog status files");
} else {
  console.log(`Usage:
  node scripts/generate-catalog-status.mjs --generate
  node scripts/generate-catalog-status.mjs --verify`);
}

function recipeRoots() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.endsWith("/recipe.yaml"))
    .map((file) => dirname(file))
    .sort();
}

function buildStatus(root) {
  const recipe = readYaml(join(root, "recipe.yaml"));
  const sourceLock = readYaml(join(root, "source-lock.yaml"));
  const helmPlan = readYaml(join(root, "helm-plan.yaml"));
  const chart = helmPlan.spec?.readiness?.chart ?? sourceLock.spec?.ref ?? `${sourceLock.spec?.repositoryName}/${sourceLock.spec?.chart}`;
  const version = String(helmPlan.spec?.readiness?.version ?? sourceLock.spec?.version ?? recipe.metadata?.version ?? "");
  const variantNames = (recipe.spec?.variants ?? []).map((path) => dirname(path).split("/").at(-1));
  const proofTier = recipe.metadata?.labels?.["confighub.io/proof-tier"] ?? "bespoke-top20";
  const status = statusFor(chart, proofTier, variantNames.length);
  const name = `${chart.replaceAll("/", "-")}-${version}`;
  const productionReadiness =
    chart === "bitnami/redis" ? "blocked-by-current-scan-gate" : "not-reviewed-for-production";
  const supportLevel =
    status === "catalog-supported"
      ? "supported-for-declared-scopes"
      : status === "catalog-candidate"
        ? "promotion-review-needed"
        : "machine-proof-only";
  const supportedVariants = status === "catalog-supported" ? variantNames : [];
  const candidateVariants = status === "catalog-supported" ? [] : variantNames;
  const notes =
    chart === "bitnami/redis"
      ? [
          "First deliberately supported catalog entry.",
          "Supported scope is local-test until scan findings have production dispositions.",
          "Both variants are Helm-equivalent through cub install setup.",
        ]
      : status === "catalog-candidate"
        ? ["Machine proof exists; human product review must confirm the supported variants and production dispositions."]
        : ["Machine proof exists; catalog support is not claimed until variant and product review are complete."];

  return {
    path: join(root, "catalog-status.yaml"),
    yaml: `apiVersion: helm-expt.confighub.com/v1alpha1
kind: CatalogStatus
metadata:
  name: ${quote(name)}
spec:
  chart: ${quote(chart)}
  version: ${quote(version)}
  status: ${quote(status)}
  supportLevel: ${quote(supportLevel)}
  supportedScopes:
${status === "catalog-supported" ? "    - local-test" : "    []"}
  productionReadiness: ${quote(productionReadiness)}
  supportedVariants:
${listYaml(supportedVariants)}
  candidateVariants:
${listYaml(candidateVariants)}
  deferredVariants: []
  review:
    lastReviewed: "2026-05-27"
    humanReviewRequired: ${status === "catalog-supported" ? "false" : "true"}
    productReviewRequired: ${status === "catalog-supported" ? "false" : "true"}
  notes:
${listYaml(notes)}
`,
  };
}

function statusFor(chart, proofTier, variantCount) {
  if (chart === "bitnami/redis") return "catalog-supported";
  if (proofTier === "next80-full") return "proof-grade";
  if (variantCount > 1) return "catalog-candidate";
  return "proof-grade";
}

function verifyStatuses() {
  const roots = recipeRoots();
  check(roots.length === 100, `expected 100 recipe roots, found ${roots.length}`);
  let supported = 0;
  for (const root of roots) {
    const recipe = readYaml(join(root, "recipe.yaml"));
    const variantNames = new Set((recipe.spec?.variants ?? []).map((path) => dirname(path).split("/").at(-1)));
    const statusPath = join(root, "catalog-status.yaml");
    check(existsSync(statusPath), `${relativeRepo(root)} missing catalog-status.yaml`);
    const status = readYaml(statusPath);
    check(status.kind === "CatalogStatus", `${relativeRepo(statusPath)} kind must be CatalogStatus`);
    check(
      ["catalog-supported", "catalog-candidate", "proof-grade", "blocked"].includes(status.spec?.status),
      `${relativeRepo(statusPath)} has invalid status ${status.spec?.status}`,
    );
    for (const variant of [...(status.spec?.supportedVariants ?? []), ...(status.spec?.candidateVariants ?? [])]) {
      check(variantNames.has(variant), `${relativeRepo(statusPath)} references unknown variant ${variant}`);
    }
    if (status.spec?.status === "catalog-supported") supported += 1;
  }
  check(supported === 1, `expected exactly one catalog-supported recipe, found ${supported}`);
  const redisStatus = readFileSync(join(repoRoot, "recipes", "bitnami", "redis", "25.5.3", "catalog-status.yaml"), "utf8");
  check(redisStatus.includes("status: \"catalog-supported\""), "Redis must be the first catalog-supported recipe");
}

function listYaml(values) {
  if (!values.length) return "    []";
  return values.map((value) => `    - ${quote(value)}`).join("\n");
}

function quote(value) {
  return JSON.stringify(String(value));
}
