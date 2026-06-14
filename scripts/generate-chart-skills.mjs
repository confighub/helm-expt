#!/usr/bin/env node

// Chart -> skills mapping.
//
// Answers "is there a skill for this chart?" — which of the thematic operating
// playbooks under docs/skills/ apply to a given chart, and why.
//
// Skills are thematic (not per-chart); applicability is declared by
// characteristic in docs/skills/README.md. This generator derives, per chart,
// which playbooks apply from the chart's facts in the master catalog matrix.
//
// This is ADVISORY ("which playbook helps"), derived by documented rules — not a
// proof. Determinism: a pure function of the committed master matrix CSV. No
// timestamps, no network, no cluster. --verify regenerates and byte-compares.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";

const SOURCE = "data/master-catalog-matrix/matrix.csv";

const outDir = join(repoRoot, "data", "chart-skills");
const csvPath = join(outDir, "skills.csv");
const jsonPath = join(outDir, "skills.json");
const summaryPath = join(outDir, "summary.md");
const contractPath = join(outDir, "contract.md");

// Named hard charts called out in docs/skills/README.md (serious-chart-playbooks).
const NAMED_SERIOUS = new Set([
  "prometheus-community/kube-prometheus-stack",
  "hashicorp/consul",
  "jetstack/cert-manager",
  "external-secrets/external-secrets",
  "grafana/loki",
]);

// The skill catalog. `applies(f)` reads the aggregated chart facts:
//   f.features  -> Set of quirk_features tokens (union across variants)
//   f.hookCount -> max hook_count across variants
//   f.serious   -> named hard chart, or crds + webhooks
//   f.live      -> has live / GitOps / two-cluster evidence, or catalog-supported
const SKILLS = [
  {
    slug: "serious-chart-playbooks",
    title: "Serious Chart Playbooks",
    doc: "docs/skills/serious-chart-playbooks.md",
    rule: "named hard chart (kube-prometheus-stack, consul, cert-manager, external-secrets, loki) OR quirk_features has both crds and webhooks",
    why: "a named hard chart, or one that combines CRDs and admission webhooks",
    applies: (f) => f.serious,
  },
  {
    slug: "hook-and-secret-lifecycle",
    title: "Hook And Secret Lifecycle",
    doc: "docs/skills/hook-and-secret-lifecycle.md",
    rule: "hook_count > 0 OR quirk_features has hooks, generated-facts, or webhooks",
    why: "uses Helm hooks, generated Secret material, or webhook certificates",
    applies: (f) => f.hookCount > 0 || hasAny(f.features, ["hooks", "generated-facts", "webhooks"]),
  },
  {
    slug: "target-facts-and-lifecycle",
    title: "Target Facts And Lifecycle",
    doc: "docs/skills/target-facts-and-lifecycle.md",
    rule: "quirk_features has crds, webhooks, lookup, generated-facts, stateful-storage, or required",
    why: "needs Secrets, CRDs, APIService readiness, storage, or generated runtime state before apply",
    applies: (f) => hasAny(f.features, ["crds", "webhooks", "lookup", "generated-facts", "stateful-storage", "required"]),
  },
  {
    slug: "large-app-evidence-funnel",
    title: "Large App Evidence Funnel",
    doc: "docs/skills/large-app-evidence-funnel.md",
    rule: "quirk_features has crds OR the chart is serious (proxy for many-Unit charts, pending a per-chart object count)",
    why: "renders many Units, so a single pass/fail can hide where an operation is stuck",
    applies: (f) => f.features.has("crds") || f.serious,
  },
  {
    slug: "live-parity",
    title: "Live Parity",
    doc: "docs/skills/live-parity.md",
    rule: "outcome_level shows local-live / live-parity / two-cluster, OR catalog_tier is catalog-supported",
    why: "has live, GitOps/OCI, or two-cluster parity work",
    applies: (f) => f.live,
  },
];

function hasAny(set, tokens) {
  return tokens.some((t) => set.has(t));
}

// --- CSV parsing (quoted fields with embedded commas/newlines) -------------

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function readMatrix() {
  const abs = join(repoRoot, SOURCE);
  check(existsSync(abs), `missing source ${SOURCE}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((cell) => cell.trim() !== ""));
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, idx) => [h, cells[idx] ?? ""])));
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvCell(row[h])).join(","));
  return `${lines.join("\n")}\n`;
}

// --- Aggregation + derivation ---------------------------------------------

function tokenize(value) {
  return (value ?? "").split(";").map((t) => t.trim()).filter(Boolean);
}

function isLive(catalogTier, outcomeLevel) {
  if (/catalog-supported/.test(catalogTier ?? "")) return true;
  return /local-live|live-parity|two-cluster/.test(outcomeLevel ?? "");
}

function buildChartFacts() {
  const matrix = readMatrix();
  const byChart = new Map();
  for (const r of matrix) {
    const key = `${r.chart}@${r.version}`;
    if (!byChart.has(key)) {
      byChart.set(key, { chart: r.chart, version: r.version, features: new Set(), hookCount: 0, live: false });
    }
    const agg = byChart.get(key);
    for (const t of tokenize(r.quirk_features)) agg.features.add(t);
    const hc = Number.parseInt(r.hook_count, 10);
    if (Number.isFinite(hc)) agg.hookCount = Math.max(agg.hookCount, hc);
    if (isLive(r.catalog_tier, r.outcome_level)) agg.live = true;
  }
  for (const agg of byChart.values()) {
    agg.serious = NAMED_SERIOUS.has(agg.chart) || (agg.features.has("crds") && agg.features.has("webhooks"));
  }
  return [...byChart.values()].sort((a, b) => `${a.chart}@${a.version}`.localeCompare(`${b.chart}@${b.version}`));
}

function applicableSkills(facts) {
  return SKILLS.filter((s) => s.applies(facts));
}

// Signals that explain the mapping, for transparency.
function matchedSignals(facts) {
  const signals = [];
  if (facts.serious) signals.push(NAMED_SERIOUS.has(facts.chart) ? "named-serious" : "crds+webhooks");
  if (facts.hookCount > 0) signals.push(`hooks:${facts.hookCount}`);
  for (const t of ["hooks", "generated-facts", "webhooks", "crds", "lookup", "stateful-storage", "required"]) {
    if (facts.features.has(t) && !(t === "hooks" && facts.hookCount > 0)) signals.push(t);
  }
  if (facts.live) signals.push("live");
  return [...new Set(signals)];
}

function buildRows() {
  return buildChartFacts().map((facts) => {
    const skills = applicableSkills(facts);
    return {
      facts,
      chart: facts.chart,
      version: facts.version,
      applicable_skills: skills.map((s) => s.slug).join("; "),
      skill_count: skills.length,
      top_skill: skills[0]?.slug ?? "none",
      matched_signals: matchedSignals(facts).join("; "),
      skill_docs: skills.map((s) => s.doc).join("; "),
      _skills: skills,
    };
  });
}

// --- Output builders ------------------------------------------------------

const CSV_HEADERS = ["chart", "version", "applicable_skills", "skill_count", "top_skill", "matched_signals", "skill_docs"];

function buildJson(rows) {
  return `${JSON.stringify(
    {
      kind: "ChartSkillsMapping",
      unofficial: true,
      advisory: true,
      description:
        "Which docs/skills/ operating playbooks apply to each chart, derived from the master matrix by documented rules. Advisory, not a proof. Generated by scripts/generate-chart-skills.mjs; do not hand-edit.",
      source: SOURCE,
      skills_catalog: SKILLS.map((s) => ({ slug: s.slug, title: s.title, doc: s.doc, rule: s.rule })),
      charts: rows.map((row) => ({
        chart: row.chart,
        version: row.version,
        top_skill: row.top_skill,
        matched_signals: matchedSignals(row.facts),
        applicable: row._skills.map((s) => ({ slug: s.slug, title: s.title, doc: s.doc, why: s.why })),
      })),
    },
    null,
    2,
  )}\n`;
}

function countBy(rows, fn) {
  const counts = new Map();
  for (const row of rows) {
    for (const value of fn(row)) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
}

function buildSummary(rows) {
  const withSkill = rows.filter((r) => r.skill_count > 0).length;
  const perSkill = countBy(rows, (r) => r._skills.map((s) => s.slug));
  const perSkillTable = [
    "| Skill | Charts |",
    "| --- | ---: |",
    ...perSkill.map(([slug, n]) => {
      const s = SKILLS.find((x) => x.slug === slug);
      return `| [${s.title}](../../${s.doc}) | ${n} |`;
    }),
  ].join("\n");

  return `# Chart Skills

**UNOFFICIAL/EXPERIMENTAL — advisory.** Generated by
\`scripts/generate-chart-skills.mjs\`. Do not hand-edit. Regenerate with
\`npm run chart-skills\`.

Answers **"is there a skill for this chart?"** — which of the thematic operating
playbooks under [docs/skills/](../../docs/skills/README.md) apply to each chart,
and why. Skills are thematic, not per-chart; this derives applicability from each
chart's facts in the master matrix by documented rules (see
[contract.md](./contract.md)). It is advisory help ("which playbook applies"),
not a proof.

Two forms: [skills.csv](./skills.csv) (spreadsheet) and
[skills.json](./skills.json) (stable interface for agents).

## Coverage

${withSkill} of ${rows.length} charts have at least one applicable skill. A chart
with none is a plain chart that needs no special playbook.

${perSkillTable}

## How To Read One Row

\`applicable_skills\` lists the playbook slugs that apply; \`top_skill\` is the
most specific; \`matched_signals\` is the feature evidence that triggered them
(e.g. \`named-serious; hooks:8; crds; webhooks\`); \`skill_docs\` links the
playbooks. A chart almost always also keeps its lifecycle-route facts in
[../lifecycle-routes/](../lifecycle-routes/summary.md).

## Charts

| Chart | Skills | Top | Signals |
| --- | --- | --- | --- |
${rows.map((r) => `| ${r.chart}@${r.version} | ${r.skill_count} | ${r.top_skill} | ${r.matched_signals || "—"} |`).join("\n")}

## Boundaries

- Static derivation from the committed master matrix. No cluster, no ConfigHub,
  no \`runs/\` edits.
- Advisory: applicability is a documented heuristic over chart facts, not proof
  that a chart was operated with the skill.
- \`large-app-evidence-funnel\` is proxied by CRD/operator shape until a
  per-chart object count exists.
`;
}

function buildContract() {
  const skillRows = SKILLS.map((s) => `| \`${s.slug}\` | [${s.title}](../../${s.doc}) | ${s.rule} |`).join("\n");
  return `# Chart Skills Contract

**UNOFFICIAL/EXPERIMENTAL.** Schema and derivation rules for
[skills.csv](./skills.csv) and [skills.json](./skills.json), generated by
\`scripts/generate-chart-skills.mjs\`. Data and contract are generated from the
same constants, so they cannot drift.

## Purpose

Make "is there a skill for this chart?" answerable as data: per chart, which
[docs/skills/](../../docs/skills/README.md) playbook(s) apply and why. Advisory,
derived from the master matrix — not a proof.

## Columns (skills.csv)

| Column | Meaning |
| --- | --- |
| \`chart\` / \`version\` | Source chart and version. |
| \`applicable_skills\` | Slugs of the playbooks that apply, in catalog order. |
| \`skill_count\` | Number of applicable skills (0 = plain chart). |
| \`top_skill\` | The most specific applicable skill, or \`none\`. |
| \`matched_signals\` | The chart-fact tokens that triggered the mapping. |
| \`skill_docs\` | Playbook doc paths. |

\`skills.json\` adds, per applicable skill, its title, doc, and the \`why\`, plus
a \`skills_catalog\` block documenting every skill and its rule.

## Derivation rules

Facts are aggregated per chart from the master matrix (union of
\`quirk_features\` tokens across variants, max \`hook_count\`, and a live flag
from \`outcome_level\`/\`catalog_tier\`). A chart is **serious** if it is a named
hard chart or its \`quirk_features\` has both \`crds\` and \`webhooks\`.

| Skill | Playbook | Applies when |
| --- | --- | --- |
${skillRows}

## Named serious charts

${[...NAMED_SERIOUS].sort().map((c) => `- \`${c}\``).join("\n")}

## Determinism

A pure function of \`${SOURCE}\`. No timestamps, no network, no cluster.
Regenerate with \`npm run chart-skills\`; verify byte-for-byte with
\`npm run chart-skills:verify\`.
`;
}

// --- Main -----------------------------------------------------------------

function buildAll() {
  const rows = buildRows();
  return {
    rows,
    csv: toCsv(CSV_HEADERS, rows),
    json: buildJson(rows),
    summary: buildSummary(rows),
    contract: buildContract(),
  };
}

if (mode === "--generate") {
  const out = buildAll();
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(summaryPath, out.summary);
  write(contractPath, out.contract);
  console.log(`wrote chart skills -> ${relativeRepo(outDir)}/ (${out.rows.length} charts)`);
} else if (mode === "--verify") {
  const out = buildAll();
  for (const [path, expected] of [
    [csvPath, out.csv],
    [jsonPath, out.json],
    [summaryPath, out.summary],
    [contractPath, out.contract],
  ]) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run chart-skills`);
    check(readFileSync(path, "utf8") === expected, `${relativeRepo(path)} is stale; run npm run chart-skills`);
  }
  console.log(`verified chart skills for ${out.rows.length} charts`);
} else {
  console.log(`Usage:
  node scripts/generate-chart-skills.mjs --generate
  node scripts/generate-chart-skills.mjs --verify`);
}
