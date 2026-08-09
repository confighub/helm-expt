#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import {
  check,
  listFiles,
  listTrackedFiles,
  readYaml,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "variant-path-coverage");
const outputs = {
  csv: join(outputRoot, "coverage-matrix.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote variant-path coverage -> ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run variant-paths:generate`);
    check(readFileSync(path, "utf8") === report[name], `${relativeRepo(path)} is stale; run npm run variant-paths:generate`);
  }
  console.log(`verified variant-path coverage for ${report.rows.length} row(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-variant-path-coverage.mjs --generate
  node scripts/generate-variant-path-coverage.mjs --verify`);
}

function buildReport() {
  const outcomeRows = parseCsvFile("data/outcome-coverage/base-outcomes.csv");
  const baseRows = outcomeRows.map((row) => ({
    chart: row.chart,
    base_variant: row.base,
    variant_path: row.base,
    path_type: "base-variant",
    quirk_origin: "chart-or-base",
    render_proof_status: row.render_parity,
    installer_proof_status: row.in_confighub,
    scan_status: scanStatus(row),
    gitops_status: row.gitops_oci_live,
    live_status: liveStatus(row),
    remaining_gap: row.missing_or_non_pass_lanes,
    evidence_path: row.variant_revision,
    notes: row.evidence_notes,
  }));

  const diffRows = listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.includes("/diffs/") && file.endsWith(".yaml"))
    .map((file) => {
      const doc = readYaml(file);
      const recipePath = relativeRepo(dirname(dirname(file)));
      const { chart, version } = chartFromRecipePath(recipePath);
      const name = doc.metadata?.name ?? basename(file, ".yaml");
      const from = doc.spec?.from?.variantRevision?.split("/")[1] ?? "";
      const to = doc.spec?.to?.variantRevision?.split("/")[1] ?? "";
      const summary = doc.spec?.summary ?? {};
      return {
        chart: `${chart}@${version}`,
        base_variant: from,
        variant_path: name,
        path_type: "base-to-base-diff",
        quirk_origin: "variant-introduced",
        render_proof_status: "derived-from-rendered-revisions",
        installer_proof_status: "not-applicable",
        scan_status: "inherits-base-scan-status",
        gitops_status: "not-tested-by-diff",
        live_status: "not-tested-by-diff",
        remaining_gap: diffGap(summary),
        evidence_path: relativeRepo(file),
        notes: `from=${from};to=${to};added=${summary.addedObjects ?? 0};removed=${summary.removedObjects ?? 0};changed=${summary.changedObjects ?? 0};targetFacts=${summary.addedTargetFacts ?? 0}`,
      };
    });

  const operationRows = listFiles(join(repoRoot, "recipes"))
    .filter((file) => file.includes("/operations/") && file.endsWith("receipt.yaml"))
    .map((file) => {
      const doc = readYaml(file);
      const recipePath = relativeRepo(file).split("/operations/")[0];
      const { chart, version } = chartFromRecipePath(recipePath);
      const operation = relativeRepo(file).split("/operations/")[1].split("/")[0];
      return {
        chart: `${chart}@${version}`,
        base_variant: operation.split("-to-")[0],
        variant_path: operation,
        path_type: operation.includes("rollback") ? "rollback-simulation" : "upgrade-simulation",
        quirk_origin: "path-introduced",
        render_proof_status: "simulation",
        installer_proof_status: "not-applied",
        scan_status: "not-applicable",
        gitops_status: "not-tested",
        live_status: "not-tested",
        remaining_gap: doc.result === "pass" ? "none" : "live operation not proven",
        evidence_path: relativeRepo(file),
        notes: `kind=${doc.kind ?? ""};result=${doc.result ?? doc.spec?.result ?? "unknown"}`,
      };
    });

  const derivedRows = listTrackedFiles(join(repoRoot, "runs", "derived-variant-execution"))
    .filter((file) => file.endsWith("/variant-create-receipt.yaml"))
    .map((file) => {
      const doc = readYaml(file);
      const spec = doc.spec ?? {};
      const source = spec.source ?? {};
      const create = spec.create ?? {};
      return {
        chart: `${source.chart}@${source.chartVersion}`,
        base_variant: source.base ?? "",
        variant_path: create.variant ?? "",
        path_type: "derived-confighub-variant",
        quirk_origin: "post-render-path",
        render_proof_status: "inherits-base-render",
        installer_proof_status: "post-upload-clone",
        scan_status: "check-receipt-required",
        gitops_status: spec.liveApply?.controller ?? "not-target-bound",
        live_status: spec.liveApply?.result ?? "not-target-bound",
        remaining_gap: spec.result === "pass" ? "target/live evidence may be separate" : "derived variant receipt is non-pass",
        evidence_path: relativeRepo(file),
        notes: `sourceSpace=${source.sourceSpace ?? ""};downstreamSpace=${create.downstreamSpace ?? ""}`,
      };
    });

  const rows = [...baseRows, ...diffRows, ...operationRows, ...derivedRows]
    .sort((a, b) => `${a.chart}|${a.base_variant}|${a.path_type}|${a.variant_path}`.localeCompare(`${b.chart}|${b.base_variant}|${b.path_type}|${b.variant_path}`));
  return {
    rows,
    csv: toCsv(rows),
    summary: summary(rows),
  };
}

function scanStatus(row) {
  if (row.in_confighub === "pass") return "pass";
  if (row.in_confighub === "missing") return "missing";
  return row.in_confighub;
}

function liveStatus(row) {
  const statuses = [row.local_live, row.gitops_oci_live, row.live_helm_vs_confighub_parity];
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.includes("watch")) return "watch";
  if (statuses.includes("pass")) return "pass";
  return "missing";
}

function diffGap(summary) {
  const targetFacts = Number(summary.addedTargetFacts ?? 0);
  if (targetFacts > 0) return "target facts must be satisfied before delivery";
  return "live apply not implied by diff";
}

function chartFromRecipePath(recipePath) {
  const parts = recipePath.split("/");
  return { chart: `${parts[1]}/${parts[2]}`, version: parts[3] };
}

function summary(rows) {
  const byType = counts(rows, (row) => row.path_type);
  const live = counts(rows, (row) => row.live_status);
  const typeLines = [...byType.entries()].sort().map(([type, count]) => `- ${type}: ${count}`).join("\n");
  const liveLines = [...live.entries()].sort().map(([status, count]) => `- ${status}: ${count}`).join("\n");
  const nonPassRows = rows.filter((row) => !["pass", "missing"].includes(row.live_status));
  return `# Variant Path Coverage

This generated report tracks proof status at the chart, base-variant, and
variant-path level. It exists because Helm quirks do not always belong to the
whole chart. Some appear only in a base variant, a diff between bases, a derived
ConfigHub variant, or an upgrade/customization path.

## Rows By Path Type

${typeLines}

## Path Type Meanings

| Path type | Meaning |
| --- | --- |
| \`base-variant\` | A render-time \`cub installer\` base. This is where Helm values, CRDs, topology, storage, generated-vs-existing Secret choices, and other object-shape changes belong. |
| \`base-to-base-diff\` | A comparison between two rendered bases. Use it to see what a variant changes before treating it as a deployable choice. |
| \`derived-confighub-variant\` | A post-render ConfigHub variant created from an uploaded base. It should not hide a Helm rerender. |
| \`upgrade-simulation\` | A simulated change path. It records expected consequences but is not live operation proof. |

## Rows By Live Status

${liveLines}

## Live Status Meanings

| Live status | Meaning |
| --- | --- |
| \`pass\` | At least one live lane for this exact path passed. Check the row to see which lane and receipt. |
| \`missing\` | No committed live receipt exists for this exact path yet. This is backlog, not failure. |
| \`blocked\` | A committed receipt exists and recorded a prerequisite, runtime, or infrastructure block. Inspect the receipt before changing the recipe. |
| \`watch\` | A committed receipt exists and object parity or sync was not the problem, but readiness or target behavior still needs review. |
| \`not-attempted\` | The row is an intended derived-variant path without target-bound live evidence in this matrix. |
| \`not-tested\` | The row is a simulated operation path, not a live operation run. |
| \`not-tested-by-diff\` | The row is a diff; live evidence belongs to the base variants, not the diff artifact. |

## First Non-Pass Rows With Receipts Or Explicit Scope

| Chart | Path | Type | Live status | Remaining gap |
| --- | --- | --- | --- | --- |
${nonPassRows.slice(0, 12).map((row) => `| \`${row.chart}\` | \`${row.variant_path}\` | ${row.path_type} | ${row.live_status} | ${escapePipes(row.remaining_gap)} |`).join("\n")}

## How To Use This Matrix

Open [coverage-matrix.csv](./coverage-matrix.csv) when asking:

- which base variants have render and installer proof;
- which diffs introduce target facts or object-shape changes;
- which derived variants are post-render ConfigHub changes;
- which upgrade or rollback paths are simulated rather than live-proven;
- which rows still need GitOps or live evidence.

This matrix does not replace per-chart receipts. It points to them.

## Regenerate

~~~sh
npm run variant-paths:generate
npm run variant-paths:verify
~~~
`;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function counts(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row) || "";
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...body] = rows.filter((item) => item.length > 1 || item[0] !== "");
  return body.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function toCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
