import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "top100-promotion-wave");
const wavePath = join(outDir, "wave.csv");
const baseOutcomesPath = join(repoRoot, "data", "outcome-coverage", "base-outcomes.csv");
const chartUsePath = join(repoRoot, "data", "chart-use-guide", "chart-use-guide.csv");
const csvPath = join(outDir, "fast-track.csv");
const summaryPath = join(outDir, "fast-track.md");

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  console.log(`wrote ${relativeRepo(csvPath)}`);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), "missing top100 fast-track CSV; run npm run top100:promotion-fast-track");
  check(existsSync(summaryPath), "missing top100 fast-track summary; run npm run top100:promotion-fast-track");
  check(readFileSync(csvPath, "utf8") === report.csv, "top100 fast-track CSV is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "top100 fast-track summary is stale");
  console.log(`verified top100 promotion fast-track for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-top100-promotion-fast-track.mjs --generate
  node scripts/generate-top100-promotion-fast-track.mjs --verify`);
}

function buildReport() {
  const waveRows = parseCsvFile(wavePath);
  const baseRows = parseCsvFile(baseOutcomesPath);
  const chartUseRows = parseCsvFile(chartUsePath);
  const baseByKey = new Map(baseRows.map((row) => [`${row.chart},${row.base}`, row]));
  const chartUseByRef = new Map(chartUseRows.map((row) => [row.chart_ref, row]));
  const rows = waveRows
    .filter(isFastTrackCandidate)
    .map((row) => fastTrackRow(row, baseByKey, chartUseByRef))
    .sort((left, right) => left.chart_ref.localeCompare(right.chart_ref));

  check(rows.length > 0, "expected at least one fast-track promotion row");
  check(rows.every((row) => row.scan_gate_state === "clean"), "fast-track rows must have clean scan/gate state");
  check(rows.every((row) => row.lifecycle_class === "ordinary-stateful-workload"), "fast-track rows must avoid hook/CRD/webhook lifecycle classes");
  check(rows.every((row) => row.two_cluster_kind_parity === "pass"), "fast-track rows must have two-cluster kind parity");

  return {
    rows,
    csv: rowsToCsv(rows),
    summary: summary(rows),
  };
}

function isFastTrackCandidate(row) {
  const features = new Set(splitList(row.source_features));
  return row.strongest_evidence === "two-cluster-kind-parity"
    && Number(row.scan_high) === 0
    && Number(row.scan_medium) === 0
    && splitList(row.gate_decisions).length === 1
    && splitList(row.gate_decisions)[0] === "allow"
    && !features.has("hooks")
    && !features.has("crds")
    && !features.has("webhooks")
    && !features.has("cluster-rbac");
}

function fastTrackRow(row, baseByKey, chartUseByRef) {
  const recommendedBase = firstListItem(row.variants) || "default";
  const base = baseByKey.get(`${row.chart_ref},${recommendedBase}`);
  check(base, `missing base outcome for ${row.chart_ref} ${recommendedBase}`);
  const chartUse = chartUseByRef.get(row.chart_ref);
  const missingLanes = [
    base.in_confighub === "pass" ? "" : "ConfigHub proof lane",
    base.local_live === "pass" ? "" : "local live observation",
    base.gitops_oci_live === "pass" ? "" : "GitOps/OCI live observation",
    base.live_helm_vs_confighub_parity === "pass" ? "" : "live Helm-vs-ConfigHub parity",
  ].filter(Boolean);
  const remaining = [
    "write storage and rollback policy",
    ...missingLanes.map((lane) => `complete ${lane}`),
    "record target-scoped support decision",
  ];
  return {
    chart: row.chart,
    version: row.version,
    chart_ref: row.chart_ref,
    recommended_base: recommendedBase,
    candidate_variants: row.variants,
    scan_gate_state: "clean",
    lifecycle_class: "ordinary-stateful-workload",
    two_cluster_kind_parity: base.two_cluster_kind_parity,
    missing_live_lanes: missingLanes.join(";"),
    remaining_required_work: remaining.join(";"),
    first_action: "write storage/rollback policy, then run selected live and ConfigHub lanes for the recommended base",
    not_a_claim: "not catalog-supported until support decision and selected live lanes exist",
    catalog_path: chartUse?.catalog_path || `${row.recipe_path}/CATALOG.md`,
    parity_receipt: receiptPathFromNotes(base.evidence_notes, "runs/live-kind-parity/"),
    recipe_path: row.recipe_path,
    package_path: row.package_path,
  };
}

function summary(rows) {
  return `# Top-100 Promotion Fast Track

This generated slice identifies the simplest rows in the first top-100
promotion wave. These charts already have two-cluster kind parity, multiple
variants, clean scan/gate state, and no hook/CRD/webhook lifecycle class in the
current source-feature model.

They are not catalog-supported. They are the first rows where the remaining
promotion work is narrow enough to be reviewed quickly.

## Summary

~~~text
fast-track rows: ${rows.length}
required next proof: ConfigHub/live lanes plus storage and rollback policy
~~~

## Rows

| Chart | Recommended base | Why this row is first | Remaining required work |
| --- | --- | --- | --- |
${rows.map((row) => `| \`${row.chart_ref}\` | \`${row.recommended_base}\` | clean scan/gate; two-cluster kind parity; no hook/CRD/webhook lifecycle class | ${escapePipes(formatList(row.remaining_required_work))} |`).join("\n")}

## How To Use This

1. Open the per-chart catalog page.
2. Confirm the recommended base is the user-facing base to promote.
3. Write the storage and rollback policy.
4. Run the missing ConfigHub, local live, GitOps/OCI, and live parity lanes for
   the selected base.
5. Record a target-scoped support decision.
6. Only then consider catalog status changes.

## Boundaries

- Fast-track means low promotion residue, not production support.
- Storage behavior still needs operator review.
- The \`ha\` variants remain candidates until they get their own selected live
  evidence.
- If populated extension slots change the object set, create a new reviewed
  base rather than treating the change as a derived variant.

## Files

| File | Use |
| --- | --- |
| [fast-track.csv](./fast-track.csv) | Spreadsheet row per fast-track candidate. |
| [wave.csv](./wave.csv) | Full first promotion wave. |
| [work-orders.md](./work-orders.md) | Full work-order list for the first promotion wave. |
`;
}

function rowsToCsv(rows) {
  const headers = [
    "chart",
    "version",
    "chart_ref",
    "recommended_base",
    "candidate_variants",
    "scan_gate_state",
    "lifecycle_class",
    "two_cluster_kind_parity",
    "missing_live_lanes",
    "remaining_required_work",
    "first_action",
    "not_a_claim",
    "catalog_path",
    "parity_receipt",
    "recipe_path",
    "package_path",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(path, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const result = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      result.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  result.push(cell);
  return result;
}

function firstListItem(value) {
  return splitList(value)[0] ?? "";
}

function receiptPathFromNotes(notes, prefix) {
  return String(notes ?? "").split(/\s*\|\s*/)
    .map((item) => item.trim())
    .find((item) => item.startsWith(prefix)) ?? "";
}

function splitList(value) {
  return String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
}

function formatList(value) {
  return splitList(value).join("<br>");
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}
