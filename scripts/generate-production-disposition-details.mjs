import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  check,
  listFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "production-disposition");
const detailsPath = join(outputRoot, "dispositions.yaml");
const summaryPath = join(outputRoot, "dispositions.md");
const mode = process.argv[2] ?? "--generate";

const dispositionCatalog = {
  "CRD lifecycle and upgrade policy": {
    owner: "catalog-review",
    requiredEvidence: ["CRD ownership decision", "upgrade ordering", "rollback/deprecation policy"],
    unblockRule: "supported only when CRD ownership and upgrade behavior are explicit",
  },
  "webhook readiness and failure policy": {
    owner: "catalog-review",
    requiredEvidence: ["webhook deployment readiness", "failurePolicy review", "certificate/bootstrap handling"],
    unblockRule: "supported only when webhook failure modes are known before apply",
  },
  "cluster RBAC review": {
    owner: "security-review",
    requiredEvidence: ["cluster-scoped RBAC inventory", "least-privilege disposition", "operator acceptance"],
    unblockRule: "supported only after cluster-scoped permissions have an explicit disposition",
  },
  "storage backup restore and rollback policy": {
    owner: "operate-review",
    requiredEvidence: ["PVC/storage class assumptions", "backup/restore path", "rollback constraints"],
    unblockRule: "supported only when stateful rollback is not hand-waved",
  },
  "generated fact ownership": {
    owner: "catalog-review",
    requiredEvidence: ["generated secret/cert inventory", "persistence or target binding", "rotation policy"],
    unblockRule: "supported only when generated material is captured or deliberately externalized",
  },
  "target fact preflight": {
    owner: "installer-review",
    requiredEvidence: ["installer externalRequires/facts", "preflight command or documented block", "freshness expectation"],
    unblockRule: "supported only when required target facts are checkable before apply",
  },
  "hook and lifecycle phase policy": {
    owner: "catalog-review",
    requiredEvidence: ["hook inventory", "phase mapping", "unsupported hook blockers"],
    unblockRule: "supported only when hooks are mapped to lifecycle policy or intentionally excluded",
  },
  "extension slot provenance and scan policy": {
    owner: "catalog-review",
    requiredEvidence: ["tpl/raw value inventory", "allowed extension slots", "scan coverage for rendered additions"],
    unblockRule: "supported only when extensions are explicit and scanned after render",
  },
  "scan/gate warning disposition": {
    owner: "security-review",
    requiredEvidence: ["local scan receipt", "external scan receipt", "waiver or fix decision"],
    unblockRule: "supported only when warnings are accepted, fixed, or variant-blocking",
  },
};

if (mode === "--generate") {
  const report = buildReport();
  writeReport(report);
  console.log(`wrote ${relativeRepo(detailsPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(detailsPath), "missing production disposition details; run npm run production:disposition:details");
  check(existsSync(summaryPath), "missing production disposition details summary; run npm run production:disposition:details");
  check(readFileSync(detailsPath, "utf8") === report.yaml, "production disposition details are stale");
  check(readFileSync(summaryPath, "utf8") === report.markdown, "production disposition details summary is stale");
  console.log("verified production disposition details");
} else {
  console.log(`Usage:
  node scripts/generate-production-disposition-details.mjs --generate
  node scripts/generate-production-disposition-details.mjs --verify`);
}

function buildReport() {
  const rows = catalogSupportedRows();
  check(rows.length === 20, `expected 20 catalog-supported recipes, found ${rows.length}`);
  const externalScan = externalScanIndex();
  const liveE2E = liveE2EIndex();
  const charts = rows.map((row) => {
    const required = [...row.requiredDispositions].sort();
    return {
      chart: row.chart,
      version: row.version,
      status: "production-blocked",
      supportedLocalTestVariants: row.supportedVariants,
      evidence: {
        recipe: row.recipePath,
        package: row.packagePath,
        configHubProofReceipt: row.configHubProofReceipt,
        externalScanVariants: externalScan.get(row.chart) ?? [],
        liveE2EReceipts: liveE2E.get(row.chart) ?? [],
      },
      dispositions: required.map((name) => ({
        name,
        state: "required",
        ...dispositionCatalog[name],
      })),
      unblockCriteria: [
        "all required dispositions are accepted or fixed",
        "supported variants keep Helm equivalence receipts bound to rendered digests",
        "external scanner findings are bound to rendered digests",
        "live/e2e observation receipts exist for the supported production scope",
      ],
    };
  });
  const knownDispositionNames = new Set(Object.keys(dispositionCatalog));
  const missingCatalog = [...new Set(charts.flatMap((chart) => chart.dispositions.map((item) => item.name)))].filter(
    (name) => !knownDispositionNames.has(name),
  );
  check(missingCatalog.length === 0, `missing disposition catalog entries: ${missingCatalog.join(", ")}`);
  const doc = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ProductionDispositionPlan",
    metadata: {
      name: "top20-production-disposition",
      generatedBy: "scripts/generate-production-disposition-details.mjs",
    },
    spec: {
      claim: "top-20 recipes are supported for local-test; production support is blocked until these dispositions are closed",
      charts,
    },
  };
  return {
    yaml: `${toYaml(doc)}\n`,
    markdown: toMarkdown(charts),
  };
}

function catalogSupportedRows() {
  const rows = [];
  for (const statusPath of listFiles(join(repoRoot, "recipes")).filter((file) => file.endsWith("/catalog-status.yaml"))) {
    const root = dirname(statusPath);
    const status = readYaml(statusPath);
    if (status.spec?.status !== "catalog-supported") continue;
    const index = readYaml(join(root, "artifact-index.yaml"));
    const controls = readYaml(join(root, "control-points.yaml"));
    rows.push({
      chart: status.spec.chart,
      version: String(status.spec.version),
      supportedVariants: status.spec.supportedVariants ?? [],
      recipePath: relativeRepo(root),
      packagePath: index.spec?.installerPackage?.path ?? "",
      configHubProofReceipt: `runs/${slugFor(status.spec.chart)}-confighub-proof/latest/confighub-proof-receipt.yaml`,
      requiredDispositions: requiredDispositions(controls.spec?.points ?? [], index.spec?.variants ?? []),
    });
  }
  return rows.sort((left, right) => left.chart.localeCompare(right.chart));
}

function requiredDispositions(points, variants) {
  const categories = new Set(points.map((point) => point.category));
  const hasCategory = (...names) => names.some((name) => categories.has(name));
  const result = new Set(["scan/gate warning disposition"]);
  if (hasCategory("crds", "crd-policy", "crd-lifecycle", "crd-ownership")) result.add("CRD lifecycle and upgrade policy");
  if (hasCategory("webhooks", "admission-webhook", "webhook-secret")) result.add("webhook readiness and failure policy");
  if (hasCategory("cluster-rbac")) result.add("cluster RBAC review");
  if (hasCategory("stateful-storage", "stateful-workload")) result.add("storage backup restore and rollback policy");
  if (hasCategory("generated-facts")) result.add("generated fact ownership");
  if (hasCategory("target-facts") || variants.some((variant) => variant.targetFactSummary && variant.targetFactSummary !== "none")) {
    result.add("target fact preflight");
  }
  if (hasCategory("lifecycle-policy", "hook-policy")) result.add("hook and lifecycle phase policy");
  if (hasCategory("tpl-extension-slots", "extension-slots", "tpl")) result.add("extension slot provenance and scan policy");
  return result;
}

function externalScanIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "external-scan-lane", "kube-linter-results.json");
  if (!existsSync(path)) return result;
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const row of data.rows ?? []) {
    if (!result.has(row.chart)) result.set(row.chart, []);
    result.get(row.chart).push({
      variant: row.variant,
      result: row.result,
      findingCount: row.findingCount,
      renderedSHA256: row.renderedSHA256,
    });
  }
  return result;
}

function liveE2EIndex() {
  const result = new Map();
  for (const receiptPath of listFiles(join(repoRoot, "runs")).filter((file) => file.endsWith("observation-receipt.json") || file.endsWith("observation-receipt.yaml"))) {
    const receipt = receiptPath.endsWith(".json") ? JSON.parse(readFileSync(receiptPath, "utf8")) : readYaml(receiptPath);
    const chart = receipt.spec?.chart;
    if (!chart) continue;
    if (!result.has(chart)) result.set(chart, []);
    result.get(chart).push(relativeRepo(receiptPath));
  }
  return result;
}

function toMarkdown(charts) {
  return `# Top-20 Production Disposition Details

The top-20 catalog entries are supported for \`local-test\`. This file states
exactly what must be closed before production support can be claimed.

| Chart | Local-test variants | Production state | Required disposition count | Live/e2e receipts |
| --- | --- | --- | ---: | --- |
${charts.map((chart) => `| \`${chart.chart}@${chart.version}\` | ${chart.supportedLocalTestVariants.join(", ")} | ${chart.status} | ${chart.dispositions.length} | ${chart.evidence.liveE2EReceipts.length} |`).join("\n")}

## Standard Disposition Types

${Object.entries(dispositionCatalog)
  .map(([name, item]) => `### ${name}

- owner: ${item.owner}
- required evidence: ${item.requiredEvidence.join("; ")}
- unblock rule: ${item.unblockRule}`)
  .join("\n\n")}

## Rule

No chart leaves \`production-blocked\` until each required disposition is
accepted, fixed, or turned into an explicit variant blocker, and the result is
backed by rendered-digest-bound scan and live/e2e receipts.
`;
}

function writeReport(report) {
  write(detailsPath, report.yaml);
  write(summaryPath, report.markdown);
}

function slugFor(chart) {
  const mapping = {
    "bitnami/redis": "redis",
    "metrics-server/metrics-server": "metrics-server",
    "ingress-nginx/ingress-nginx": "ingress-nginx",
    "jetstack/cert-manager": "cert-manager",
    "external-secrets/external-secrets": "external-secrets",
    "argo-cd/argo-cd": "argo-cd",
    "bitnami/postgresql": "postgresql",
    "bitnami/rabbitmq": "rabbitmq",
    "prometheus-community/kube-prometheus-stack": "kube-prometheus-stack",
    "grafana/loki": "loki",
    "longhorn/longhorn": "longhorn",
    "hashicorp/vault": "vault",
    "secrets-store-csi-driver/secrets-store-csi-driver": "secrets-store-csi-driver",
    "prometheus-community/prometheus": "prometheus",
    "grafana/grafana": "grafana",
    "bitnami/mysql": "mysql",
    "bitnami/mongodb": "mongodb",
    "bitnami/nginx": "nginx",
    "grafana/tempo": "tempo",
    "hashicorp/consul": "consul",
  };
  return mapping[chart] ?? chart.split("/").at(-1);
}
