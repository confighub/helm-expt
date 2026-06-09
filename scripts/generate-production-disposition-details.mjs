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
const nextActionsPath = join(outputRoot, "next-actions.csv");
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
  console.log(`wrote ${relativeRepo(nextActionsPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(detailsPath), "missing production disposition details; run npm run production:disposition:details");
  check(existsSync(summaryPath), "missing production disposition details summary; run npm run production:disposition:details");
  check(existsSync(nextActionsPath), "missing production disposition next actions; run npm run production:disposition:details");
  check(readFileSync(detailsPath, "utf8") === report.yaml, "production disposition details are stale");
  check(readFileSync(summaryPath, "utf8") === report.markdown, "production disposition details summary is stale");
  check(readFileSync(nextActionsPath, "utf8") === report.nextActionsCsv, "production disposition next actions are stale");
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
  const sourceFeatures = sourceFeatureIndex();
  const extensionSlots = extensionSlotIndex();
  const lifecycleObservations = lifecycleObservationIndex();
  const dispositionReceipts = productionDispositionReceiptIndex();
  const charts = rows.map((row) => {
    const required = [...requiredDispositions(row.controlPoints, row.variants, extensionSlots.has(`${row.chart}@${row.version}`))].sort();
    const source = sourceFeatures.get(row.chart) ?? {};
    const observations = lifecycleObservations.get(row.chart) ?? [];
    const accepted = acceptedDispositionReceipts(row.chart, required, dispositionReceipts);
    const acceptedByDisposition = new Map(accepted.map((receipt) => [receipt.disposition, receipt]));
    const openCount = required.filter((name) => !acceptedByDisposition.has(name)).length;
    return {
      chart: row.chart,
      version: row.version,
      status: openCount === 0 ? "production-review-ready" : "production-blocked",
      supportedLocalTestVariants: row.supportedVariants,
      evidence: {
        recipe: row.recipePath,
        package: row.packagePath,
        configHubProofReceipt: row.configHubProofReceipt,
        externalScanVariants: externalScan.get(row.chart) ?? [],
        liveE2EReceipts: liveE2E.get(row.chart) ?? [],
        sourceHookCount: source.hooks?.count ?? 0,
        lifecyclePolicyBasis: lifecyclePolicyBasis(row.controlPoints, source, observations),
        lifecycleObservationReceipts: observations.map((item) => item.receipt),
        productionDispositionReceipts: accepted.map((item) => item.path),
      },
      dispositions: required.map((name) => {
        const receipt = acceptedByDisposition.get(name);
        return {
          name,
          state: receipt ? "accepted" : "required",
          receipt: receipt?.path,
          ...dispositionCatalog[name],
        };
      }),
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
  checkAllDispositionReceiptsUsed(charts, dispositionReceipts);
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
    nextActionsCsv: toNextActionsCsv(charts),
  };
}

function productionDispositionReceiptIndex() {
  const result = new Map();
  const root = join(repoRoot, "data", "production-disposition", "receipts");
  if (!existsSync(root)) return result;
  for (const receiptPath of listFiles(root).filter((file) => /\.ya?ml$/.test(file))) {
    const receipt = readYaml(receiptPath);
    if (receipt.kind !== "ProductionDispositionReceipt") continue;
    if (receipt.spec?.decision !== "accepted") continue;
    const chart = receipt.spec?.chart;
    const disposition = receipt.spec?.disposition;
    if (!chart || !disposition) continue;
    for (const item of receipt.spec?.evidence ?? []) {
      if (item.path) check(existsSync(join(repoRoot, item.path)), `${relativeRepo(receiptPath)} references missing evidence ${item.path}`);
    }
    result.set(dispositionKey(chart, disposition), {
      chart,
      disposition,
      path: relativeRepo(receiptPath),
      decision: receipt.spec.decision,
      acceptedAt: receipt.spec.acceptedAt ?? "",
    });
  }
  return result;
}

function checkAllDispositionReceiptsUsed(charts, dispositionReceipts) {
  const used = new Set(charts.flatMap((chart) => chart.evidence.productionDispositionReceipts));
  const unused = [...dispositionReceipts.values()].map((receipt) => receipt.path).filter((path) => !used.has(path));
  check(unused.length === 0, `production disposition receipt does not match a required disposition: ${unused.join(", ")}`);
}

function acceptedDispositionReceipts(chart, requiredDispositions, dispositionReceipts) {
  return requiredDispositions
    .map((disposition) => dispositionReceipts.get(dispositionKey(chart, disposition)))
    .filter(Boolean);
}

function dispositionKey(chart, disposition) {
  return `${chart}\u0000${disposition}`;
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
      controlPoints: controls.spec?.points ?? [],
      variants: index.spec?.variants ?? [],
    });
  }
  return rows.sort((left, right) => left.chart.localeCompare(right.chart));
}

function sourceFeatureIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "top500-catalog-analysis", "source", "source-feature-scan.raw.json");
  if (!existsSync(path)) return result;
  for (const row of JSON.parse(readFileSync(path, "utf8"))) result.set(row.chart, row);
  return result;
}

function extensionSlotIndex() {
  const result = new Set();
  const path = join(repoRoot, "data", "extension-slots", "extension-slots.csv");
  if (!existsSync(path)) return result;
  for (const row of parseCsv(readFileSync(path, "utf8"))) result.add(row.chart);
  return result;
}

function lifecycleObservationIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "lifecycle-observations", "cert-manager-eso", "summary.csv");
  if (!existsSync(path)) return result;
  for (const row of parseCsv(readFileSync(path, "utf8"))) {
    if (!result.has(row.chart)) result.set(row.chart, []);
    result.get(row.chart).push(row);
  }
  return result;
}

function lifecyclePolicyBasis(points, source, observations) {
  const categories = new Set(points.map((point) => point.category));
  const bases = [];
  const sourceHookCount = Number(source.hooks?.count ?? 0);
  if (sourceHookCount > 0) bases.push(`source-hooks:${sourceHookCount}`);
  const hookPoint = points.find((point) => point.category === "hook-policy");
  if (hookPoint) bases.push(`recipe-hook-policy:${hookPoint.policy ?? hookPoint.status ?? "declared"}`);
  if (categories.has("lifecycle-policy")) bases.push("recipe-lifecycle-policy");
  if (observations.length > 0) bases.push(`lifecycle-observations:${observations.filter((row) => row.result === "pass").length}/${observations.length}`);
  return bases.length > 0 ? bases : ["none"];
}

function requiredDispositions(points, variants, hasExtensionSlot) {
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
  if (hasCategory("tpl-extension-slots", "extension-slots") || (hasExtensionSlot && hasCategory("tpl"))) {
    result.add("extension slot provenance and scan policy");
  }
  return result;
}

function externalScanIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "external-scan-lane", "kube-linter-results.json");
  if (!existsSync(path)) return result;
  const reviewRows = externalScanReviewIndex();
  const data = JSON.parse(readFileSync(path, "utf8"));
  for (const row of data.rows ?? []) {
    if (!result.has(row.chart)) result.set(row.chart, []);
    const review = reviewRows.get(`${row.chart}\u0000${row.variant}`) ?? {};
    result.get(row.chart).push({
      variant: row.variant,
      result: row.result,
      findingCount: row.findingCount,
      renderedSHA256: row.renderedSHA256,
      topChecks: review.topChecks ?? summarizeFindingChecks(row.findings ?? []),
      renderedPath: review.renderedPath ?? "",
    });
  }
  return result;
}

function externalScanReviewIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "external-scan-lane", "review.csv");
  if (!existsSync(path)) return result;
  for (const row of parseCsv(readFileSync(path, "utf8"))) {
    result.set(`${row.chart}\u0000${row.variant}`, row);
  }
  return result;
}

function summarizeFindingChecks(findings) {
  const counts = new Map();
  for (const finding of findings) {
    const key = finding.check ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([check, count]) => `${check}:${count}`)
    .join(";");
}

function liveE2EIndex() {
  const result = new Map();
  for (const receiptPath of listFiles(join(repoRoot, "runs")).filter((file) => file.endsWith("observation-receipt.json") || file.endsWith("observation-receipt.yaml"))) {
    const receipt = receiptPath.endsWith(".json") ? JSON.parse(readFileSync(receiptPath, "utf8")) : readYaml(receiptPath);
    const chart = chartFromObservation(receipt);
    if (!chart) continue;
    if (!result.has(chart)) result.set(chart, []);
    result.get(chart).push(relativeRepo(receiptPath));
  }
  return result;
}

function chartFromObservation(receipt) {
  if (receipt.spec?.chart) return receipt.spec.chart;
  const variantRevision = String(receipt.spec?.variantRevision ?? "");
  const parts = variantRevision.split("/");
  if (parts[0] === "recipes" && parts.length >= 4) return `${parts[1]}/${parts[2]}`;
  return "";
}

function toMarkdown(charts) {
  const acceptedDispositionCount = charts.reduce((sum, chart) => sum + chart.dispositions.filter((item) => item.state === "accepted").length, 0);
  const closestRows = charts
    .map((chart) => {
      const accepted = chart.dispositions.filter((item) => item.state === "accepted").length;
      const open = chart.dispositions.filter((item) => item.state !== "accepted");
      return { chart, accepted, open };
    })
    .filter((row) => row.accepted > 0 || row.open.length <= 3)
    .sort((left, right) => left.open.length - right.open.length || right.accepted - left.accepted || left.chart.chart.localeCompare(right.chart.chart));
  return `# Top-20 Production Disposition Details

The top-20 catalog entries are supported for \`local-test\`. This file states
exactly what must be closed before production support can be claimed.

The lifecycle columns separate retained source-hook evidence from recipe-level
lifecycle policy and related CRD/webhook/controller observations.

Accepted disposition receipts recorded: ${acceptedDispositionCount}

| Chart | Local-test variants | Production state | Accepted | Open | Source hooks | Lifecycle basis | Live/e2e receipts |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
${charts.map((chart) => {
  const accepted = chart.dispositions.filter((item) => item.state === "accepted").length;
  const open = chart.dispositions.length - accepted;
  return `| \`${chart.chart}@${chart.version}\` | ${chart.supportedLocalTestVariants.join(", ")} | ${chart.status} | ${accepted} | ${open} | ${chart.evidence.sourceHookCount} | ${chart.evidence.lifecyclePolicyBasis.join("; ")} | ${chart.evidence.liveE2EReceipts.length} |`;
}).join("\n")}

## Closest Rows

These rows have accepted production-disposition receipts or three or fewer
open dispositions. They are the clearest next production-review work queue.
The same queue is available as \`next-actions.csv\`.

| Chart | Accepted | Open | Open dispositions | Next receipt | External scan reading |
| --- | ---: | ---: | --- | --- | --- |
${closestRows.map(({ chart, accepted, open }) => `| \`${chart.chart}@${chart.version}\` | ${accepted} | ${open.length} | ${open.map((item) => item.name).join("; ")} | ${open[0] ? nextDispositionReceiptPath(chart.chart, open[0].name) : "-"} | ${externalScanSummary(chart.evidence.externalScanVariants)} |`).join("\n")}

## Standard Disposition Types

${Object.entries(dispositionCatalog)
  .map(([name, item]) => `### ${name}

- owner: ${item.owner}
- required evidence: ${item.requiredEvidence.join("; ")}
- unblock rule: ${item.unblockRule}`)
  .join("\n\n")}

## Rule

A chart becomes \`production-review-ready\` when each required disposition is
accepted, fixed, or turned into an explicit variant blocker, and the result is
backed by rendered-digest-bound scan and live/e2e receipts. Production support
still requires a separate target-scoped support decision.
`;
}

function toNextActionsCsv(charts) {
  const workdown = externalScanWorkdownIndex();
  const rows = charts
    .map((chart) => {
      const accepted = chart.dispositions.filter((item) => item.state === "accepted");
      const open = chart.dispositions.filter((item) => item.state !== "accepted");
      const firstOpen = open[0] ?? {};
      const scan = workdown.get(chart.chart) ?? {};
      return {
        chart: chart.chart,
        version: chart.version,
        productionState: chart.status,
        acceptedCount: accepted.length,
        openCount: open.length,
        nextDisposition: firstOpen.name ?? "",
        nextDispositionReceipt: firstOpen.name ? nextDispositionReceiptPath(chart.chart, firstOpen.name) : "",
        owner: firstOpen.owner ?? "",
        requiredEvidence: (firstOpen.requiredEvidence ?? []).join(";"),
        scanPriority: scan.priority ?? "",
        externalScanFindings: scan.findingCount ?? "",
        externalScanNextAction: scan.nextAction ?? "",
        supportedVariants: chart.supportedLocalTestVariants.join(";"),
        liveE2EReceipts: chart.evidence.liveE2EReceipts.length,
        nextAction: productionNextAction(open, scan),
      };
    })
    .sort((left, right) => Number(left.openCount) - Number(right.openCount) || Number(right.acceptedCount) - Number(left.acceptedCount) || left.chart.localeCompare(right.chart));
  const headers = [
    "chart",
    "version",
    "productionState",
    "acceptedCount",
    "openCount",
    "nextDisposition",
    "nextDispositionReceipt",
    "owner",
    "requiredEvidence",
    "scanPriority",
    "externalScanFindings",
    "externalScanNextAction",
    "supportedVariants",
    "liveE2EReceipts",
    "nextAction",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function nextDispositionReceiptPath(chart, disposition) {
  return `data/production-disposition/receipts/${pathSlug(chart)}/${pathSlug(disposition)}.yaml`;
}

function pathSlug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function productionNextAction(open, scan) {
  const first = open[0];
  if (!first) return "refresh live/e2e receipts for the accepted production scope";
  if (first.name === "scan/gate warning disposition" && scan?.nextAction) {
    if (String(scan.topChecks ?? "").includes("latest-tag")) {
      return "resolve image digests or pin image tags in the installer base; record image override/proof receipt; then accept PDB behavior or add a reviewed patch where the chart supports it";
    }
    return scan.nextAction;
  }
  return `write or fix the receipt for ${first.name}`;
}

function externalScanWorkdownIndex() {
  const result = new Map();
  const path = join(repoRoot, "data", "external-scan-lane", "chart-workdown.csv");
  if (!existsSync(path)) return result;
  for (const row of parseCsv(readFileSync(path, "utf8"))) result.set(row.chart, row);
  return result;
}

function externalScanSummary(rows) {
  if (!rows.length) return "no external scan row";
  return rows
    .map((row) => `${row.variant}: ${row.result}, ${row.findingCount} finding(s)${row.topChecks ? ` (${row.topChecks})` : ""}`)
    .join("; ");
}

function writeReport(report) {
  write(detailsPath, report.yaml);
  write(summaryPath, report.markdown);
  write(nextActionsPath, report.nextActionsCsv);
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

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
