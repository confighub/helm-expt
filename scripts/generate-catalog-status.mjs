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
    productionReadiness: "production-review-ready",
    notes: [
      "First deliberately supported catalog entry.",
      "Production recommendation remains a separate decision; the production disposition lane records current review-ready or blocking state.",
      "Both variants are Helm-equivalent through cub installer setup.",
    ],
  },
  "bitnami/nginx": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "http-clusterip is the simplest low-friction happy path.",
      "existing-tls-ingress is supported when the declared TLS Secret target facts are satisfied.",
      "Production recommendation remains a separate decision; the production disposition lane records current review-ready or blocking state.",
    ],
  },
  "bitnami/postgresql": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "generated-passwords is the simplest install path and records generated Secret separation.",
      "existing-secret is supported when the declared postgresql-auth target fact is satisfied.",
      "Production recommendation remains a separate decision; the production disposition lane records current review-ready or blocking state.",
      "Target production review must choose storage class and database backup/restore mechanism before use.",
    ],
  },
  "argo-cd/argo-cd": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal Argo CD install shape.",
      "no-crds is supported when CRD lifecycle is owned outside this package.",
      "Production remains blocked until RBAC, CRD ownership, raw extension slots, and scan/gate findings have dispositions.",
    ],
  },
  "bitnami/mongodb": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "generated-passwords is the simplest install path and records generated Secret separation.",
      "existing-secret-replicaset is supported when the declared MongoDB Secret target facts are satisfied.",
      "Production recommendation remains a separate decision; the production disposition lane records current review-ready or blocking state.",
      "Target production review must choose storage class, MongoDB backup/restore mechanism, and whether the replica-set base is appropriate for the target.",
      "The existing-secret-replicaset base is still marked runtime-review-needed in the base-readiness table.",
    ],
  },
  "bitnami/mysql": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "generated-passwords is the simplest install path and records generated Secret separation.",
      "existing-secret is supported when the declared MySQL Secret target facts are satisfied.",
      "Production recommendation remains a separate decision; the production disposition lane records current review-ready or blocking state.",
      "Target production review must choose storage class and database backup/restore mechanism before use.",
    ],
  },
  "bitnami/rabbitmq": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "generated-passwords is the simplest install path and records generated Secret separation.",
      "existing-secret is supported when the declared RabbitMQ Secret target facts are satisfied.",
      "Production recommendation remains a separate decision; the production disposition lane records current review-ready or blocking state.",
      "Target production review must choose storage class, RabbitMQ recovery policy, and backup/restore mechanism before use.",
    ],
  },
  "external-secrets/external-secrets": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal External Secrets install shape.",
      "no-crds is supported when CRD lifecycle is owned outside this package.",
      "Production remains blocked until CRD/webhook lifecycle, SecretStore expectations, and scan/gate findings have dispositions.",
    ],
  },
  "grafana/grafana": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "generated-passwords is the simplest install path and records generated Secret separation.",
      "existing-secret-ingress is supported when admin Secret and ingress/TLS target facts are satisfied.",
      "Production remains blocked until persistence, ingress exposure, dashboard/config ownership, and scan/gate findings have dispositions.",
    ],
  },
  "grafana/loki": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "single-binary-filesystem is the simplest local Loki path.",
      "simple-scalable-minio is supported as the local multi-component object-store variant.",
      "Production remains blocked until object storage, retention, compactor, storage migration, and scan/gate findings have dispositions.",
    ],
  },
  "grafana/tempo": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "local-persistent is the simplest local Tempo path.",
      "s3-query-observability is supported when object-store and query-path assumptions are declared.",
      "Production remains blocked until object storage, retention, PVC, and scan/gate findings have dispositions.",
    ],
  },
  "hashicorp/consul": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default-control-plane is the simplest local Consul control-plane path.",
      "secure-mesh-existing-secrets is supported when the declared Secret target facts are satisfied.",
      "Production remains blocked until gossip/TLS secret ownership, mesh policy, upgrade safety, and scan/gate findings have dispositions.",
    ],
  },
  "hashicorp/vault": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default is the simplest local Vault chart path.",
      "ha-raft-ui is supported as a richer local HA-shape proof, not a production readiness claim.",
      "Production remains blocked until seal/init, storage, recovery, unseal workflow, and scan/gate findings have dispositions.",
    ],
  },
  "metrics-server/metrics-server": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default is the expected quick path for a standard metrics-server install.",
      "external-tls-ca is supported when the declared metrics-server-tls target fact is satisfied.",
      "Production recommendation remains a separate decision; the production disposition lane records current review-ready or blocking state.",
      "external-tls-ca remains target-sensitive: the Secret and APIService certificate chain must be validated for the target cluster.",
    ],
  },
  "longhorn/longhorn": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal Longhorn install shape.",
      "ui-ingress is supported when ingress exposure assumptions are declared.",
      "Production remains blocked until storage-class ownership, node prerequisites, backup targets, and scan/gate findings have dispositions.",
    ],
  },
  "prometheus-community/kube-prometheus-stack": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal kube-prometheus-stack install shape.",
      "no-crds is supported when CRD lifecycle is owned outside this package.",
      "Production remains blocked until CRD lifecycle, RBAC, webhooks, storage, and scan/gate findings have dispositions.",
    ],
  },
  "prometheus-community/prometheus": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal Prometheus chart install shape.",
      "server-only-ephemeral is supported as the simplest short-lived local proof path.",
      "Cluster RBAC and extension-slot dispositions are recorded as production review input.",
      "Production remains blocked until scan/gate findings and target security posture are resolved or narrowed into a hardened base.",
      "server-only-ephemeral is the narrower first production-review base; default includes the bundled monitoring stack and node-exporter host access.",
    ],
  },
  "secrets-store-csi-driver/secrets-store-csi-driver": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal CSI driver install shape.",
      "sync-secret-rotation is supported when Secret sync and rotation assumptions are declared.",
      "Production remains blocked until provider integration, node DaemonSet policy, rotation expectations, and scan/gate findings have dispositions.",
    ],
  },
  "ingress-nginx/ingress-nginx": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal ingress-nginx admission-webhook install shape.",
      "admission-disabled is supported as the simpler webhook-free variant.",
      "Cluster RBAC, hook lifecycle, and webhook-readiness routing are recorded as production review input.",
      "Production remains blocked until scan/gate findings and target security posture are resolved or narrowed into a hardened base.",
      "admission-disabled is the simpler first production-review base; default needs target-backed webhook lifecycle observation before production use.",
    ],
  },
  "jetstack/cert-manager": {
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
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
    status === "catalog-supported"
      ? (supportedCatalogEntries[chart]?.productionReadiness ?? "blocked-by-current-scan-gate")
      : "not-reviewed-for-production";
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
