import { existsSync } from "node:fs";
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

const supportedCatalogEntries = {
  "bitnami/redis": {
    notes: [
      "First deliberately supported catalog entry.",
      "Supported scope is local-test until scan findings have production dispositions.",
      "Both variants are Helm-equivalent through cub install setup.",
    ],
  },
  "bitnami/nginx": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub install and ConfigHub receipts.",
      "http-clusterip is the simplest low-friction happy path.",
      "existing-tls-ingress is supported when the declared TLS Secret target facts are satisfied.",
      "Production remains blocked until ingress exposure, NetworkPolicy, PDB, and scan/gate findings have dispositions.",
    ],
  },
  "bitnami/postgresql": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub install and ConfigHub receipts.",
      "generated-passwords is the simplest install path and records generated Secret separation.",
      "existing-secret is supported when the declared postgresql-auth target fact is satisfied.",
      "Production remains blocked until StatefulSet/PVC, backup/restore, generated fact, and scan/gate findings have dispositions.",
    ],
  },
  "metrics-server/metrics-server": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub install and ConfigHub receipts.",
      "default is the expected quick path for a standard metrics-server install.",
      "external-tls-ca is supported when the declared metrics-server-tls target fact is satisfied.",
      "Production remains blocked until APIService readiness, cluster RBAC, and scan/gate findings have dispositions.",
    ],
  },
  "ingress-nginx/ingress-nginx": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub install and ConfigHub receipts.",
      "default preserves the normal ingress-nginx admission-webhook install shape.",
      "admission-disabled is supported as the simpler webhook-free variant.",
      "Production remains blocked until admission webhook lifecycle, cluster RBAC, and scan/gate findings have dispositions.",
    ],
  },
  "jetstack/cert-manager": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub install and ConfigHub receipts.",
      "default preserves the normal cert-manager controller/webhook install shape.",
      "crds-enabled is supported when CRD lifecycle ownership is intentionally accepted for the local-test scope.",
      "Production remains blocked until CRD lifecycle/upgrade, webhook readiness, cluster RBAC, and scan/gate findings have dispositions.",
    ],
  },
};

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
    status === "catalog-supported" ? "blocked-by-current-scan-gate" : "not-reviewed-for-production";
  const supportLevel =
    status === "catalog-supported"
      ? "supported-for-declared-scopes"
      : status === "catalog-candidate"
        ? "promotion-review-needed"
        : "machine-proof-only";
  const supportedVariants = status === "catalog-supported" ? variantNames : [];
  const candidateVariants = status === "catalog-supported" ? [] : variantNames;
  const notes =
    supportedCatalogEntries[chart]?.notes ??
    (status === "catalog-candidate"
        ? ["Machine proof exists; human product review must confirm the supported variants and production dispositions."]
        : ["Machine proof exists; catalog support is not claimed until variant and product review are complete."]);

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
  if (supportedCatalogEntries[chart]) return "catalog-supported";
  if (proofTier === "next80-full") return "proof-grade";
  if (variantCount > 1) return "catalog-candidate";
  return "proof-grade";
}

function verifyStatuses() {
  const roots = recipeRoots();
  check(roots.length === 100, `expected 100 recipe roots, found ${roots.length}`);
  let supported = 0;
  const supportedCharts = new Set();
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
    if (status.spec?.status === "catalog-supported") {
      supported += 1;
      supportedCharts.add(status.spec?.chart);
    }
  }
  const expectedSupported = Object.keys(supportedCatalogEntries);
  check(
    supported === expectedSupported.length,
    `expected ${expectedSupported.length} catalog-supported recipe(s), found ${supported}`,
  );
  for (const chart of expectedSupported) {
    check(supportedCharts.has(chart), `expected ${chart} to be catalog-supported`);
  }
}

function listYaml(values) {
  if (!values.length) return "    []";
  return values.map((value) => `    - ${quote(value)}`).join("\n");
}

function quote(value) {
  return JSON.stringify(String(value));
}
