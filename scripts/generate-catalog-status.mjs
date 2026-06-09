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
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal Argo CD install shape and is the safer first production-review base.",
      "no-crds is supported when CRD lifecycle is owned outside this package, but remains target-prerequisite-needed.",
      "CRD ownership, cluster RBAC, raw extension slots, hook/lifecycle boundary, StatefulSet/Secret ownership, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; Argo CD needs target Secret ownership, admin credential rotation, repository policy, resource policy, and fresh controller readiness checks before support.",
      "The live GitOps/OCI row demonstrates sync mechanics but remains runtime-watch until generated/runtime Secret and bootstrap policy are resolved.",
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
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal External Secrets install shape.",
      "no-crds is supported when CRD lifecycle is owned outside this package.",
      "CRD lifecycle, webhook readiness, controller-owned webhook Secret fields, cluster RBAC, extension slots, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; default is the stronger first production-review path, while no-crds requires compatible CRDs to be staged and observed in the target cluster.",
    ],
  },
  "grafana/grafana": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "generated-passwords is the simplest install path and records generated Secret separation.",
      "existing-secret-ingress is supported when admin Secret and ingress/TLS target facts are satisfied.",
      "Cluster RBAC, generated Secret ownership, target Secret preflight, extension-slot policy, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; target UI exposure, resource policy, and workload security posture must be chosen for the target scope.",
    ],
  },
  "grafana/loki": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "single-binary-filesystem is the simplest local Loki path and has live Helm-vs-ConfigHub OCI parity.",
      "simple-scalable-minio is supported as the local multi-component object-store variant, but remains target-resource sensitive.",
      "Default render blocking, storage policy, cluster RBAC, lifecycle policy, extension slots, MinIO Secret ownership, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; the first review path should prefer single-binary-filesystem unless the target explicitly accepts the scalable object-store topology.",
    ],
  },
  "grafana/tempo": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "local-persistent is the simplest local Tempo path, with storage/runtime caveats recorded for review.",
      "s3-query-observability is supported when the S3 target Secret and Prometheus Operator ServiceMonitor API are staged in the target cluster.",
      "Chart deprecation, storage/backup/rollback policy, target facts, extension slots, runtime service risk, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; the final decision should choose the maintained successor chart or explicit legacy support and target runtime checks.",
    ],
  },
  "hashicorp/consul": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default-control-plane is the simplest local Consul control-plane path.",
      "secure-mesh-existing-secrets is supported when the declared Secret target facts are satisfied.",
      "default-control-plane has regular Helm, ConfigHub kubectl apply, and ConfigHub OCI/Argo live parity with healthy runtime, and is the stronger first production-review base.",
      "secure-mesh-existing-secrets is useful review input for TLS, ACL, gossip, gateway, UI ingress, and mesh topology, but remains runtime-review-needed until target capacity and bootstrap policy are proven.",
      "CRD ownership, cluster RBAC, target Secret preflight, webhook readiness, lifecycle boundary, extension slots, storage/rollback, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; Consul needs target CRD ownership, TLS/ACL/secret rotation, mesh/gateway posture, security policy, backup/restore, and fresh runtime checks before support.",
    ],
  },
  "hashicorp/vault": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default is the simplest local Vault chart path and the safer first production-review base.",
      "ha-raft-ui is supported as a richer HA/Raft/UI proof, but has target-sensitive service-selector and runtime caveats.",
      "RBAC, injector webhook, extension slots, storage/init/unseal/recovery, TLS posture, service exposure, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; Vault needs explicit init/unseal, recovery material, TLS, backup/restore, and live observation procedures before support.",
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
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal Longhorn install shape and is the safer first production-review base.",
      "ui-ingress is supported when ingress exposure assumptions are declared, but needs target ingress, TLS, auth, and exposure policy before production use.",
      "CRD ownership, cluster RBAC, pre-upgrade hook boundary, webhook/recovery service readiness, privileged storage workload posture, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; Longhorn needs target node prerequisites, backup/restore, data rollback, storage-class ownership, and live observation procedures before support.",
    ],
  },
  "prometheus-community/kube-prometheus-stack": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal kube-prometheus-stack install shape.",
      "no-crds is supported when CRD lifecycle is owned outside this package.",
      "default is the stronger first production-review base because it includes CRDs and has local observation evidence.",
      "no-crds is supported only when compatible Prometheus Operator CRDs are already staged and observed in the target cluster.",
      "CRD ownership, cluster RBAC, generated Grafana credential binding, raw monitoring extension slots, webhook readiness, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; kube-prometheus-stack needs target CRD ownership, webhook TLS lifecycle, resource/security posture, scrape scope, and fresh runtime checks before support.",
      "The committed ConfigHub apply and OCI/Argo live rows demonstrate semantic parity but remain runtime-watch until Prometheus Operator readiness is resolved for the target.",
    ],
  },
  "prometheus-community/prometheus": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal Prometheus chart install shape.",
      "server-only-ephemeral is supported as the simplest short-lived local proof path.",
      "Cluster RBAC, extension-slot policy, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; target security posture, scrape scope, storage, and resource policy must be chosen for the target scope.",
      "server-only-ephemeral is the narrower first production-review base; default includes the bundled monitoring stack and node-exporter host access.",
    ],
  },
  "secrets-store-csi-driver/secrets-store-csi-driver": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal CSI driver install shape.",
      "sync-secret-rotation is supported when Secret sync and rotation assumptions are declared.",
      "CRD ownership, cluster RBAC, provider/platform extension slots, node DaemonSet posture, synced Secret rotation, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; target policy must accept privileged-node CSI behavior and choose the provider integration and synced Secret model.",
    ],
  },
  "ingress-nginx/ingress-nginx": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal ingress-nginx admission-webhook install shape.",
      "admission-disabled is supported as the simpler webhook-free variant.",
      "Cluster RBAC, hook lifecycle, webhook-readiness routing, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; controller health, admission behavior, probe wiring, and workload posture must be chosen for the target scope.",
      "admission-disabled is the simpler first production-review base; default needs target-backed webhook lifecycle observation before production use.",
    ],
  },
  "jetstack/cert-manager": {
    productionReadiness: "production-review-ready",
    notes: [
      "Supported for local-test and proof-demo usage through real cub installer and ConfigHub receipts.",
      "default preserves the normal cert-manager controller/webhook install shape.",
      "crds-enabled is supported when CRD lifecycle ownership is intentionally accepted for the local-test scope.",
      "CRD lifecycle, webhook readiness, startup API hook routing, cluster RBAC, extension slots, and scan/gate warnings are recorded as production review input.",
      "Production recommendation remains a separate decision; crds-enabled is the stronger first production-review path, while default requires compatible CRDs to be staged and observed in the target cluster.",
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
