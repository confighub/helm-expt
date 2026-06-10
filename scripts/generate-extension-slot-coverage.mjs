#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "extension-slots");
const outputs = {
  summary: join(outputRoot, "summary.md"),
  csv: join(outputRoot, "extension-slots.csv"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputRoot)}/`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run extension-slots`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run extension-slots`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run extension-slots`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run extension-slots`);
  console.log(`verified extension-slot coverage for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-extension-slot-coverage.mjs --generate
  node scripts/generate-extension-slot-coverage.mjs --verify`);
}

function buildReport() {
  const chartFacts = parseCsvFile("data/chart-facts/chart-facts.csv");
  const top20Rows = parseCsvFile("data/status-dashboard/top20-status.csv");
  const quirkRows = parseCsvFile("data/quirk-coverage/coverage.csv");
  const sourceRows = JSON.parse(readFileSync(join(repoRoot, "data/top500-catalog-analysis/source/source-feature-scan.raw.json"), "utf8"));
  const top20 = new Set(top20Rows.map((row) => chartKey(row.chart)));
  const sourceTpl = quirkRows.find((row) => row.axis === "tpl-extension-slots")?.source_top500_count ?? "unknown";
  const sourceRawExtra = sourceRows.filter((row) => hasCount(row.extraManifestValues)).length;
  const sourceTplOrRawExtra = sourceRows.filter((row) => hasCount(row.tpl) || hasCount(row.extraManifestValues)).length;
  const matchedTop500 = top500ProofExtensionSlotCount();

  const rows = chartFacts
    .filter((row) => hasExtensionSlot(row.extension_slots))
    .map((row) => {
      const key = `${row.chart}@${row.version}`;
      const control = extensionControlPoint(row.chart, row.version);
      return {
        chart: key,
        catalog_scope: top20.has(row.chart) ? "top20-catalog" : "top100-proof",
        built_variants: row.variants_built,
        extension_slot_status: row.extension_slots,
        control_point_status: control.status,
        surfaces: control.surfaces || inferredSurfaces(row.chart),
        current_route: "keep empty in supported bases, or make a reviewed installer base when populated",
        evidence: [
          `data/chart-facts/chart-facts.csv`,
          control.evidence,
          `recipes/${row.chart}/${row.version}/helm-pain-report.yaml`,
        ]
          .filter(Boolean)
          .join(";"),
      };
    })
    .sort((a, b) => scopeRank(a.catalog_scope) - scopeRank(b.catalog_scope) || a.chart.localeCompare(b.chart));

  const top100Count = rows.length;
  const top20WithExtension = rows.filter((row) => row.catalog_scope === "top20-catalog").length;
  const csv = toCsv(rows);
  const top20List = rows
    .filter((row) => row.catalog_scope === "top20-catalog")
    .map((row) => `| \`${row.chart}\` | ${row.built_variants} | ${escapePipes(row.surfaces)} | ${row.control_point_status} |`)
    .join("\n");
  const top20WithExtensionCharts = new Set(rows.filter((row) => row.catalog_scope === "top20-catalog").map((row) => row.chart));
  const top20WithoutExtensionList = top20Rows
    .filter((row) => !top20WithExtensionCharts.has(row.chart))
    .map((row) => `| \`${row.chart}\` | ${row.variants.replaceAll(";", "+")} | ${escapePipes(row.hard_gap || "-")} | use the supported base; route Helm-input changes through a reviewed \`cub installer\` base and post-render changes through \`cub variant create\` |`)
    .join("\n");

  const summary = `# Extension Slot Coverage

This generated report answers the NGINX-style question:

~~~text
Which charts expose powerful Helm inputs such as raw manifests, tpl snippets,
extra config blocks, sidecars, or chart-specific config file slots?
~~~

Extension slots are useful, but they are not ordinary safe defaults. If a user
populates one, the result should be treated as a reviewed install shape with
its own render parity, scans, gates, and receipts.

## Headline

~~~text
top-20 catalog charts with explicit extension-slot control points: ${top20WithExtension}/20
top-20 catalog charts without extension slots in chart facts:     ${20 - top20WithExtension}/20
top-100 chart facts with extension slots surfaced:                ${top100Count}/100
matched top-500 proof rows with extension-slot control points:    ${matchedTop500}
top-500 source rows using tpl:                                    ${sourceTpl}/500
top-500 source rows with raw/extra manifest values:               ${sourceRawExtra}/500
top-500 source rows using tpl or raw/extra manifest values:       ${sourceTplOrRawExtra}/500
~~~

The top-500 \`tpl\` and raw/extra manifest counts are broader than the explicit
control-point count. They are source-scan signals that a chart may have
template-powered or arbitrary object injection inputs. The explicit
control-point count is narrower: it only covers rows already matched to current
recipe/package proof artifacts.

## Top-20 Catalog Charts

| Chart | Built variants | Example surfaces | Control point |
| --- | --- | --- | --- |
${top20List}

## Top-20 Charts Without Extension Slots

These charts still have normal Helm choices and production review work. They do
not currently expose NGINX-like raw manifest, tpl snippet, config block,
sidecar, or add-on slots in the chart facts.

| Chart | Built variants | Current hard gap | Route |
| --- | --- | --- | --- |
${top20WithoutExtensionList}

## How To Use This

| User change | Route |
| --- | --- |
| Leave the extension slot empty or disabled. | Use the supported catalog base. |
| Fill \`serverBlock\`, \`extraDeploy\`, raw manifests, sidecars, scrape configs, or similar values. | Create a new reviewed \`cub installer\` base variant and rerun render parity, scans, gates, and receipts. |
| Change target, region, labels, approval policy, observation policy, or other ConfigHub metadata after render. | Use a derived ConfigHub variant with \`cub variant create\`. |

NGINX is the clearest concrete example. Its supported bases keep
\`serverBlock\`, \`streamServerBlock\`, \`extraDeploy\`,
\`cloneStaticSiteFromGit\`, metrics, and sidecar slots empty or disabled. See
[NGINX Configuration Files](../../docs/user/nginx-configuration-files.md).

## Files

| File | Purpose |
| --- | --- |
| \`data/extension-slots/extension-slots.csv\` | One row per top-100 chart where chart facts surface extension slots. |
| \`data/quirk-coverage/summary.md\` | Quirk-axis coverage summary, including broader top-500 counts. |
| \`data/outcome-coverage/feature-outcomes.csv\` | One row per chart feature, including extension-slot status. |

Regenerate:

~~~sh
npm run extension-slots
npm run extension-slots:verify
~~~
`;

  return { rows, csv, summary };
}

function extensionControlPoint(chart, version) {
  const path = join(repoRoot, "recipes", chart, version, "control-points.yaml");
  if (!existsSync(path)) return { status: "recorded in chart facts", surfaces: "", evidence: "" };
  const doc = readYaml(path);
  const points = doc?.spec?.points ?? [];
  const point = points.find((item) => /extension|tpl/.test(String(item.category ?? "")));
  if (!point) return { status: "recorded in chart facts", surfaces: "", evidence: relativeRepo(path) };
  const surfaces = [
    point.object,
    point.evidence,
    point.note,
    ...(Array.isArray(point.objects) ? point.objects : []),
  ]
    .filter(Boolean)
    .join(" ");
  return {
    status: `${point.category}:${point.status ?? "recorded"}`,
    surfaces: summarizeSurfaces(surfaces),
    evidence: relativeRepo(path),
  };
}

function summarizeSurfaces(text) {
  const lower = String(text).toLowerCase();
  const surfaces = [];
  const rules = [
    [/serverblock|streamserverblock|nginx/, "NGINX config blocks"],
    [/extradeploy|extraobjects|extra manifests|raw/, "raw/extra manifests"],
    [/sidecar|extra containers|extracontainers/, "sidecars"],
    [/scrape|servicemonitor|rules|datasource/, "monitoring config"],
    [/volume|mount|storage/, "volumes/mounts"],
    [/secret|environment|env/, "Secret/env injection"],
    [/gateway|injector|controller/, "controller/gateway config"],
    [/tpl|templating|template/, "tpl-powered values"],
  ];
  for (const [pattern, label] of rules) {
    if (pattern.test(lower) && !surfaces.includes(label)) surfaces.push(label);
  }
  return surfaces.join("; ") || "chart-specific tpl/raw/config slots";
}

function inferredSurfaces(chart) {
  if (chart === "bitnami/nginx") return "NGINX config blocks; raw/extra manifests; sidecars";
  if (chart.includes("prometheus")) return "monitoring config; raw/extra manifests; tpl-powered values";
  if (chart.includes("loki") || chart.includes("tempo")) return "config blocks; storage; volumes/mounts";
  if (chart.includes("vault")) return "Secret/env injection; volumes/mounts; sidecars";
  return "chart-specific tpl/raw/config slots";
}

function hasExtensionSlot(value) {
  const text = String(value ?? "").trim();
  return text && text !== "-" && text !== "—";
}

function hasCount(value) {
  if (typeof value === "number") return value > 0;
  if (value && typeof value === "object" && typeof value.count === "number") return value.count > 0;
  return false;
}

function top500ProofExtensionSlotCount() {
  const path = "data/top500-catalog-analysis/drilldown.csv";
  if (!existsSync(join(repoRoot, path))) return 0;
  return parseCsvFile(path).filter((row) => row.proof_has_extension_slots === "true").length;
}

function chartKey(value) {
  return String(value ?? "").split("@")[0];
}

function scopeRank(scope) {
  return scope === "top20-catalog" ? 0 : 1;
}

function parseCsvFile(path) {
  const full = join(repoRoot, path);
  const text = readFileSync(full, "utf8").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1).map((cols) => Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (quote) {
      if (ch === '"' && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quote = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}
