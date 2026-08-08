#!/usr/bin/env node
// Turns the committed flattening witnesses into one catalog-wide view: per
// chart version, which constructs a flattened bundle would have to account for,
// and across the catalog, how common each one is.
//
// This is evidence, not a verdict. A row here says what the packaged chart
// contains; whether that chart may ship as flattened YAML is decided by a
// flattening-safety verdict, which weighs values gating, available routes, and
// the audited base. Charts with a decided lane carry it in the last column so
// the two surfaces stay legible together, and the rest read "not yet decided"
// rather than reading as safe by omission.
//
// Output is a pure function of the committed witnesses and verdicts. The
// witnesses themselves need the chart tarball and are recorded separately by
// scripts/scan-flattening-witnesses-all.mjs.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const OUT_DIR = join(repoRoot, "data", "flattening-safety");
const WITNESS_DIR = join(OUT_DIR, "witnesses");

const CLASSES = [
  { key: "helm-hooks", label: "hooks", question: "Hook Jobs never fire, or fire under a different hook dialect" },
  { key: "resource-policy-keep", label: "keep-policy", question: "a reconciler prunes what Helm promised to keep" },
  { key: "lookup", label: "lookup", question: "renders valid but wrong, because it read a cluster that was not there" },
  { key: "webhook-config", label: "webhooks", question: "an empty caBundle makes admission fail closed" },
  { key: "capabilities", label: "capabilities", question: "the wrong apiVersion for the target cluster" },
  { key: "generated-secrets", label: "generated-secrets", question: "one credential draw frozen into a shared artifact" },
  { key: "test-hooks", label: "test-hooks", question: "stray test resources shipped to a cluster" },
  { key: "namespace-creation", label: "namespace", question: "the namespace ships, or must exist first" },
];

function witnessRows() {
  check(existsSync(WITNESS_DIR), "no witnesses recorded; run npm run flattening-witnesses");
  const rows = [];
  for (const name of readdirSync(WITNESS_DIR).sort()) {
    if (!name.endsWith(".yaml")) continue;
    const spec = readYaml(join(WITNESS_DIR, name)).spec;
    // A witness carrying a package note describes bytes this catalog does not
    // lock, recorded so a republished artifact stays inspectable. Counting it
    // here would report one catalog entry twice. See data/upstream-drift.
    if (spec.package.note) continue;
    const findings = spec.findings;
    rows.push({
      repository: spec.chart.repository,
      chart: spec.chart.name,
      version: spec.chart.version,
      counts: Object.fromEntries(CLASSES.map((cls) => [cls.key, findings[cls.key]?.count ?? 0])),
      crds: spec.crds.documents,
      gatedSubcharts: spec.subcharts.conditions.length,
      scannedFiles: spec.scannedFiles,
    });
  }
  return rows;
}

// A decided lane, where one exists, keyed by repository, chart, and version.
function decidedLanes() {
  const lanes = new Map();
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.startsWith("flattening-safety-verdict") && entry.name.endsWith(".yaml")) {
        const spec = readYaml(full).spec;
        const key = `${spec.chart.repository}/${spec.chart.name}/${spec.chart.version}`;
        const existing = lanes.get(key) ?? [];
        existing.push(`${spec.auditedBase}:${spec.verdict.lane}`);
        lanes.set(key, existing);
      }
    }
  };
  walk(join(repoRoot, "recipes"));
  return lanes;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, lanes) {
  const header = [
    "repository",
    "chart",
    "version",
    ...CLASSES.map((cls) => cls.label.replaceAll("-", "_")),
    "crd_documents",
    "gated_subcharts",
    "scanned_files",
    "decided_lanes",
  ].join(",");
  const lines = rows.map((row) => {
    const key = `${row.repository}/${row.chart}/${row.version}`;
    return [
      row.repository,
      row.chart,
      row.version,
      ...CLASSES.map((cls) => row.counts[cls.key]),
      row.crds,
      row.gatedSubcharts,
      row.scannedFiles,
      (lanes.get(key) ?? []).sort().join("; "),
    ]
      .map(csvCell)
      .join(",");
  });
  return `${[header, ...lines].join("\n")}\n`;
}

function summaryMd(rows, lanes) {
  const total = rows.length;
  const present = (key) => rows.filter((row) => row.counts[key] > 0).length;
  const pct = (count) => Math.round((count / total) * 100);
  const decidedCount = new Set(
    rows
      .filter((row) => lanes.has(`${row.repository}/${row.chart}/${row.version}`))
      .map((row) => `${row.repository}/${row.chart}/${row.version}`),
  ).size;

  const lines = [];
  lines.push("# What the catalog's charts actually contain");
  lines.push("");
  lines.push(
    `Every catalog entry with a recorded witness is scanned for the constructs that render-time flattening loses. This view reports what ${total} packaged charts contain. It does not decide whether any of them may ship as flattened YAML: that is a flattening-safety verdict, which weighs values gating, the audited base, and the routes available to discharge each construct. ${decidedCount} of these chart versions have a decided lane today; the rest read "not yet decided" rather than reading as safe by omission.`,
  );
  lines.push("");
  lines.push("| construct | charts | share | what it costs a flattened bundle |");
  lines.push("| --- | --- | --- | --- |");
  const crdCount = rows.filter((row) => row.crds > 0).length;
  const gatedCount = rows.filter((row) => row.gatedSubcharts > 0).length;
  const table = [
    ...CLASSES.map((cls) => ({ label: cls.label, count: present(cls.key), question: cls.question })),
    { label: "crds", count: crdCount, question: "per-file Units race the CRDs they depend on" },
    {
      label: "gated-subcharts",
      count: gatedCount,
      question: "the flatten step must render with the audited base's condition set",
    },
  ].sort((left, right) => right.count - left.count);
  for (const entry of table) {
    lines.push(`| ${entry.label} | ${entry.count} | ${pct(entry.count)}% | ${entry.question} |`);
  }
  lines.push("");
  lines.push(
    "Two readings are worth keeping in view. A construct being present does not mean a chart is unflattenable: most are values-gated, and a verdict records which ones the audited base actually reaches. And a construct being absent from the packaged chart is a real finding, because it is exactly what makes a chart cheap to certify.",
  );
  lines.push("");
  lines.push(
    "This lane also answers the keep-policy axis that `data/quirk-coverage/coverage.csv` records as unscanned. It is scanned here, from chart source, for every entry with a witness.",
  );
  lines.push("");
  lines.push(
    "Per-chart rows are in `evidence.csv`. Scan status per catalog entry, including charts whose upstream bytes moved under a fixed version, is in `witness-coverage.md`. Regenerate with `npm run flattening-evidence`; verify with `npm run flattening-evidence:verify`.",
  );
  lines.push("");
  return lines.join("\n");
}

function buildAll() {
  const rows = witnessRows();
  const lanes = decidedLanes();
  return [
    { path: join(OUT_DIR, "evidence.csv"), contents: toCsv(rows, lanes) },
    { path: join(OUT_DIR, "evidence.md"), contents: summaryMd(rows, lanes) },
  ];
}

const outputs = buildAll();
if (mode === "--generate") {
  for (const output of outputs) write(output.path, output.contents);
  console.log(`wrote ${outputs.length} flattening-evidence file(s)`);
} else if (mode === "--verify") {
  for (const output of outputs) {
    const rel = relativeRepo(output.path);
    check(existsSync(output.path), `${rel} is missing; run npm run flattening-evidence`);
    check(
      readFileSync(output.path, "utf8") === output.contents,
      `${rel} is stale; run npm run flattening-evidence`,
    );
  }
  console.log(`verified ${outputs.length} flattening-evidence file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-flattening-evidence.mjs --generate
  node scripts/generate-flattening-evidence.mjs --verify`);
}
