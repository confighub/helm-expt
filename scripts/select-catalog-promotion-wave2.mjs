import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  relativeRepo,
  repoRoot,
  toYaml,
  write,
} from "./lib/proof-common.mjs";

const outputRoot = join(repoRoot, "data", "catalog-promotion-wave2");
const planPath = join(outputRoot, "candidates.yaml");
const reviewCsvPath = join(outputRoot, "review.csv");
const summaryPath = join(outputRoot, "summary.md");
const matrixPath = join(repoRoot, "data", "top500-catalog-analysis", "raw.json");
const mode = process.argv[2] ?? "--generate";

const selectedCandidates = [
  {
    chart: "traefik/traefik",
    why: "Very high-rank ingress controller with CRDs, RBAC, webhooks, generated/source signals, and exposure choices.",
    variants: [
      "default",
      "external-crds",
      "internal-clusterip-dashboard-off",
      "cloud-loadbalancer",
    ],
    controlFocus: ["CRD ownership", "IngressClass ownership", "Service exposure", "webhook/readiness policy"],
  },
  {
    chart: "external-dns/external-dns",
    why: "Small, familiar controller where the useful variants are provider and credential choices, not YAML ceremony.",
    variants: [
      "route53-irsa",
      "cloudflare-existing-secret",
      "dry-run-txt-registry",
    ],
    controlFocus: ["provider selection", "credential target facts", "TXT registry ownership", "cluster RBAC"],
  },
  {
    chart: "vmware-tanzu/velero",
    why: "Backup/restore is a strong production story: provider credentials, object storage, CRDs, and restore safety are visible.",
    variants: [
      "aws-s3-existing-secret",
      "azure-blob-existing-secret",
      "filesystem-backup-node-agent",
    ],
    controlFocus: ["backup target facts", "cloud credentials", "CRD lifecycle", "restore/rollback policy"],
  },
  {
    chart: "istio-official/istiod",
    why: "Service mesh control plane proves ConfigHub can explain hard platform charts without pretending they are simple.",
    variants: [
      "revisioned-control-plane",
      "external-ca",
      "minimal-profile",
    ],
    controlFocus: ["webhook lifecycle", "cluster RBAC", "revision labels", "certificate authority boundary"],
  },
  {
    chart: "kyverno/kyverno",
    why: "Policy engine exercises hooks, lookup, generated facts, CRDs, admission webhooks, and controller sizing.",
    variants: [
      "default-admission",
      "external-crds",
      "ha-admission-reports",
    ],
    controlFocus: ["admission webhook safety", "CRD ownership", "hook policy", "controller HA and reports"],
  },
];

if (mode === "--generate") {
  const report = buildReport();
  writeReport(report);
  console.log(`wrote ${relativeRepo(planPath)}`);
  console.log(`wrote ${relativeRepo(reviewCsvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(planPath), "missing wave-2 candidates plan; run npm run catalog:wave2");
  check(existsSync(reviewCsvPath), "missing wave-2 candidates CSV; run npm run catalog:wave2");
  check(existsSync(summaryPath), "missing wave-2 summary; run npm run catalog:wave2");
  check(readFileSync(planPath, "utf8") === report.planYaml, "wave-2 candidates plan is stale");
  check(readFileSync(reviewCsvPath, "utf8") === report.csv, "wave-2 candidates CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "wave-2 summary is stale");
  console.log("verified catalog promotion wave-2 outputs");
} else {
  console.log(`Usage:
  node scripts/select-catalog-promotion-wave2.mjs --generate
  node scripts/select-catalog-promotion-wave2.mjs --verify`);
}

function buildReport() {
  check(existsSync(matrixPath), "missing top500 catalog analysis; run npm run top500:catalog first");
  const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
  check(Array.isArray(matrix.rows), "top500 catalog analysis raw JSON must contain rows");
  const rows = selectedCandidates.map((candidate) => rowFor(candidate, matrix.rows));
  const plan = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CatalogPromotionWave",
    metadata: {
      name: "wave-2-real-variants",
      generatedBy: "scripts/select-catalog-promotion-wave2.mjs",
    },
    spec: {
      sourceMatrix: relativeRepo(matrixPath),
      doctrine:
        "A chart is not catalog-supported merely because default Helm output is deterministic; it needs obvious user-shaped variants and production dispositions.",
      acceptance: [
        "Each selected chart must already have proof-grade package/proof artifacts.",
        "Each selected chart must still be machine-proof-only, with no catalog-supported variants yet.",
        "Each proposed user-shaped variant must become an actual recipe variant, package base, rendered revision, scan/gate receipt, and Helm-equivalence receipt before support is claimed.",
        "Production support remains unclaimed until dispositions, target scope, support policy, and live/e2e observation requirements are recorded.",
      ],
      candidates: rows.map((row) => ({
        rank: row.rank,
        chart: row.chart,
        currentVersion: row.current_recipe_version,
        recipePath: row.recipe_path,
        packagePath: row.package_path,
        why: row.why,
        proposedRealVariants: row.proposed_variants.split(";"),
        controlFocus: row.control_focus.split(";"),
      })),
      alternates: [
        "cloudnative-pg/cloudnative-pg",
        "argo/argo-workflows",
        "fluent/fluent-bit",
      ],
    },
  };
  return {
    rows,
    planYaml: `${toYaml(plan)}\n`,
    csv: toCsv(rows),
    summary: toSummary(rows),
  };
}

function rowFor(candidate, rows) {
  const row = rows.find((item) => item.chart === candidate.chart);
  check(row, `selected wave-2 candidate ${candidate.chart} is not present in top500 matrix`);
  check(row.recipe_status === "current-recipe-exact-version", `${candidate.chart} must have exact current recipe proof`);
  check(row.package_status === "package-proof-exists", `${candidate.chart} must have a package proof`);
  check(
    ["default-only", "multi-variant"].includes(row.variant_status),
    `${candidate.chart} must have default-only or machine-generated variants before wave-2 promotion`,
  );
  check(row.catalog_status === "proof-grade", `${candidate.chart} must be proof-grade, found ${row.catalog_status}`);
  check(row.support_level === "machine-proof-only", `${candidate.chart} must still be machine-proof-only`);
  check(row.supported_variants === "", `${candidate.chart} must not already have catalog-supported variants`);
  check(
    ["run catalog promotion review", "add user-shaped variants before catalog promotion"].includes(row.next_action),
    `${candidate.chart} has unexpected next action`,
  );
  return {
    rank: row.rank,
    chart: row.chart,
    current_recipe_version: row.current_recipe_version,
    source_features: row.source_features,
    recipe_path: row.recipe_path,
    package_path: row.package_path,
    proposed_variants: candidate.variants.join(";"),
    control_focus: candidate.controlFocus.join(";"),
    why: candidate.why,
    acceptance: "build actual variants, package bases, rendered revisions, receipts, and production dispositions before catalog support",
  };
}

function toCsv(rows) {
  const headers = [
    "rank",
    "chart",
    "current_recipe_version",
    "source_features",
    "proposed_variants",
    "control_focus",
    "acceptance",
    "recipe_path",
    "package_path",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function toSummary(rows) {
  return `# Catalog Promotion Wave 2

This is the next human/product promotion slice after the top-20 local-test
support pass.

The point is not to declare these charts supported yet. The point is to choose
five proof-grade/default charts where adding real user-shaped variants will
test whether the catalog is actually simpler and safer than plain Helm.
Some already have basic machine-generated variants such as default/no-crds.
Wave 2 is about promoting useful user-shaped variants, not merely counting
rendered bases.

## Selected Charts

| Rank | Chart | Version | Proposed real variants | Why |
| ---: | --- | --- | --- | --- |
${rows.map((row) => `| ${row.rank} | \`${row.chart}\` | ${row.current_recipe_version} | ${row.proposed_variants.replaceAll(";", ", ")} | ${row.why} |`).join("\n")}

## Acceptance

For each chart, promotion requires:

- actual \`variants/<name>/variant.yaml\` files;
- matching \`packages/.../bases/<name>\` package bases;
- rendered object inventory and immutable revision per variant;
- Helm-equivalence, render, scan, install-gate, and package receipts;
- explicit production dispositions for scan/gate warnings;
- live/e2e observation requirements before production support is claimed.

Until then these remain proof-grade candidates, not catalog-supported recipes.
`;
}

function writeReport(report) {
  write(planPath, report.planYaml);
  write(reviewCsvPath, report.csv);
  write(summaryPath, report.summary);
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
