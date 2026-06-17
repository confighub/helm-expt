#!/usr/bin/env node

// Per-chart fact sheets: the user-facing "can I use this chart, and how?" view
// for ALL catalog charts (the public site renders pages only for the ~21
// catalog-supported charts; this is the complete legibility layer over the
// chart-evidence-router backbone). Realizes docs/planning/per-chart-fact-sheet-spec.md
// two-column principle: support level (the claim) NEXT TO evidence depth (the
// substantiation), plus prerequisites, quirks disposition, the applicable skill,
// the honest next action, and a cub-scout post-apply check ("created" != "working").
//
// Read-only projection over committed surfaces; runs nothing live.
//   node scripts/generate-chart-fact-sheets.mjs --generate
//   node scripts/generate-chart-fact-sheets.mjs --verify

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const ROUTER = "data/chart-evidence-router/router.csv";
const SKILLS = "data/chart-skills/skills.csv";
const outDir = join(repoRoot, "data", "chart-fact-sheets");
const outputs = {
  csv: join(outDir, "fact-sheets.csv"),
  summary: join(outDir, "summary.md"),
  html: join(outDir, "fact-sheets.html"),
};

const mode = process.argv[2] ?? "--generate";

function parseCsv(text) {
  const rows = []; let f = "", row = [], q = false;
  for (let i = 0; i < text.length; i += 1) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 1; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
    else if (c !== "\r") f += c; }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}
function readCsv(rel) {
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `missing source ${rel}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((c) => c.trim() !== ""));
  const headers = rows[0];
  return rows.slice(1).map((cells) => Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""])));
}
function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// honest support tier from the router's user_status
const STATUS_CLASS = {
  "ready-to-try": { label: "Ready to try", klass: "ok" },
  "works-with-target-prerequisites": { label: "Works with prerequisites", klass: "warn" },
  "needs-better-base-variant": { label: "Needs a better base", klass: "warn" },
  "not-ready-yet": { label: "Not ready yet", klass: "block" },
};
function statusOf(s) {
  return STATUS_CLASS[s] ?? { label: s || "unknown", klass: "unknown" };
}

// a status/prereq-aware cub-scout post-apply check line
function cubScoutCheck(prereqs, quirks) {
  const base = "After apply, confirm convergence with cub-scout (`object-set-matches`, `prerequisites-met`, `workloads-converged`) — \"created\" is not \"working\".";
  if (prereqs && prereqs.trim()) {
    return `${base} \`prerequisites-met\` will flag the missing prerequisite before you debug pods.`;
  }
  if (quirks && quirks.trim()) {
    return `${base} Watch \`workloads-converged\` for the hook/lifecycle step to finish.`;
  }
  return base;
}

function buildSheets() {
  const router = readCsv(ROUTER);
  const skills = new Map();
  for (const r of readCsv(SKILLS)) skills.set(`${r.chart}|${r.version}`, r);

  return router.map((r) => {
    const skill = skills.get(`${r.chart}|${r.version}`);
    const prereqs = (r.user_must_provide || "").trim();
    const quirks = (r.quirks || "").trim();
    return {
      chart: r.chart,
      version: r.version,
      user_status: r.user_status || "unknown",
      // two columns:
      support_claim: r.production_decisions
        ? `${r.chart_use_answer || r.user_status}; production decision: ${r.production_decisions}`
        : (r.chart_use_answer || r.user_status),
      evidence_depth: r.current_proof || "no proof recorded",
      recommended_base: r.first_base || "",
      proof_lanes: r.proof_lane_summary || "",
      prerequisites: prereqs || "none recorded",
      quirks_disposition: quirks ? `${quirks}${r.routed_or_absorbed ? ` — ${r.routed_or_absorbed}` : ""}` : "none recorded",
      skill: skill?.top_skill ? `${skill.top_skill} (${skill.skill_docs})` : "none",
      next_action: r.next_action || "",
      cub_scout_check: cubScoutCheck(prereqs, quirks),
      try_it: r.catalog_path || "",
    };
  });
}

const CSV_COLS = [
  "chart", "version", "user_status", "support_claim", "evidence_depth",
  "recommended_base", "prerequisites", "quirks_disposition", "skill",
  "cub_scout_check", "next_action", "try_it",
];

function toCsv(sheets) {
  const lines = [CSV_COLS.join(",")];
  for (const s of sheets) lines.push(CSV_COLS.map((c) => csvCell(s[c])).join(","));
  return lines.join("\n") + "\n";
}

function summaryMd(sheets) {
  const byStatus = {};
  for (const s of sheets) byStatus[s.user_status] = (byStatus[s.user_status] || 0) + 1;
  const L = [];
  L.push("# Per-Chart Fact Sheets");
  L.push("");
  L.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by");
  L.push("`scripts/generate-chart-fact-sheets.mjs`. Do not hand-edit. Regenerate with");
  L.push("`npm run chart-fact-sheets`.");
  L.push("");
  L.push("The user-facing **\"can I use this chart, and how?\"** view for every catalog");
  L.push("chart, realizing the two-column principle from");
  L.push("[per-chart-fact-sheet-spec](../../docs/planning/per-chart-fact-sheet-spec.md):");
  L.push("**support level (the claim)** beside **evidence depth (the substantiation)** —");
  L.push("never one without the other. Read-only projection over");
  L.push("[chart-evidence-router](../chart-evidence-router/router.csv) +");
  L.push("[chart-skills](../chart-skills/skills.csv). The browser board is");
  L.push("[fact-sheets.html](fact-sheets.html).");
  L.push("");
  L.push(`Covers **${sheets.length} charts**. By support status: ` +
    Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") + ".");
  L.push("");
  L.push("After any apply, the honest check is **cub-scout** — `object-set-matches`,");
  L.push("`prerequisites-met`, `workloads-converged` — because \"created\" is not \"working\".");
  L.push("");
  for (const s of sheets) {
    L.push(`## ${s.chart}@${s.version}`);
    L.push("");
    L.push(`- **Status:** ${statusOf(s.user_status).label} (\`${s.user_status}\`)`);
    L.push(`- **Support (claim):** ${s.support_claim}`);
    L.push(`- **Evidence depth:** ${s.evidence_depth}`);
    L.push(`- **Recommended base:** \`${s.recommended_base || "(see variants)"}\``);
    L.push(`- **You must provide/decide:** ${s.prerequisites}`);
    L.push(`- **Quirks & disposition:** ${s.quirks_disposition}`);
    L.push(`- **Skill:** ${s.skill}`);
    L.push(`- **Post-apply check:** ${s.cub_scout_check}`);
    if (s.next_action) L.push(`- **Next action:** ${s.next_action}`);
    L.push("");
  }
  return L.join("\n") + "\n";
}

function html(sheets) {
  const order = ["ready-to-try", "works-with-target-prerequisites", "needs-better-base-variant", "not-ready-yet"];
  const sorted = [...sheets].sort((a, b) => {
    const d = (order.indexOf(a.user_status) + 99 * (order.indexOf(a.user_status) < 0)) -
      (order.indexOf(b.user_status) + 99 * (order.indexOf(b.user_status) < 0));
    return d !== 0 ? d : a.chart.localeCompare(b.chart);
  });
  const rows = sorted.map((s) => {
    const st = statusOf(s.user_status);
    return `<tr class="${st.klass}">
<td><b>${esc(s.chart)}</b><br><span class="v">${esc(s.version)}</span></td>
<td><span class="pill ${st.klass}">${esc(st.label)}</span></td>
<td>${esc(s.support_claim)}</td>
<td class="ev">${esc(s.evidence_depth)}</td>
<td><code>${esc(s.recommended_base || "—")}</code></td>
<td>${esc(s.prerequisites)}</td>
<td>${esc(s.quirks_disposition)}</td>
<td>${esc(s.skill)}</td>
<td class="cs">${esc(s.cub_scout_check)}</td>
</tr>`;
  }).join("\n");
  const counts = {};
  for (const s of sheets) counts[statusOf(s.user_status).klass] = (counts[statusOf(s.user_status).klass] || 0) + 1;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Per-Chart Fact Sheets — Can I use this chart?</title>
<style>
:root{color-scheme:light dark}
body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:1.2rem;background:#0d1117;color:#e6edf3}
h1{font-size:1.4rem;margin:.2rem 0}
.sub{color:#9da7b3;margin:.2rem 0 1rem}
.legend span{display:inline-block;margin-right:1rem}
.dot{display:inline-block;width:.7rem;height:.7rem;border-radius:50%;vertical-align:middle;margin-right:.3rem}
.ok .dot,.dot.ok{background:#2ea043}.warn .dot,.dot.warn{background:#d29922}.block .dot,.dot.block{background:#cf222e}.unknown .dot,.dot.unknown{background:#6e7681}
table{border-collapse:collapse;width:100%;font-size:12.5px}
th,td{border:1px solid #30363d;padding:.4rem .5rem;vertical-align:top;text-align:left}
th{position:sticky;top:0;background:#161b22;z-index:1}
tr.ok{background:rgba(46,160,67,.07)}tr.warn{background:rgba(210,153,34,.07)}tr.block{background:rgba(207,34,46,.08)}
.v{color:#9da7b3;font-size:11px}
.pill{padding:.1rem .45rem;border-radius:1rem;font-size:11px;white-space:nowrap}
.pill.ok{background:#1b3a23;color:#7ee2a0}.pill.warn{background:#3a2f12;color:#e8c878}.pill.block{background:#3a1417;color:#f0a0a8}.pill.unknown{background:#21262d;color:#9da7b3}
.ev{color:#c9d4e0}.cs{color:#9da7b3;font-size:11.5px}
code{background:#161b22;padding:.05rem .3rem;border-radius:.3rem}
</style></head><body>
<h1>Can I use this chart, and how?</h1>
<p class="sub">Per-chart fact sheets over ${sheets.length} catalog charts — <b>support level</b> beside <b>evidence depth</b>, with prerequisites, quirks, the applicable skill, and the cub-scout post-apply check. Generated; do not hand-edit.</p>
<p class="legend"><span><span class="dot ok"></span>ready to try (${counts.ok || 0})</span><span><span class="dot warn"></span>needs prerequisites / better base (${(counts.warn || 0)})</span><span><span class="dot block"></span>not ready yet (${counts.block || 0})</span></p>
<table>
<thead><tr><th>Chart</th><th>Status</th><th>Support (claim)</th><th>Evidence depth</th><th>Base</th><th>You provide/decide</th><th>Quirks &amp; disposition</th><th>Skill</th><th>Post-apply check (cub-scout)</th></tr></thead>
<tbody>
${rows}
</tbody></table>
</body></html>
`;
}

function build() {
  const sheets = buildSheets();
  return { sheets, csv: toCsv(sheets), summary: summaryMd(sheets), html: html(sheets) };
}

if (mode === "--generate") {
  const r = build();
  write(outputs.csv, r.csv);
  write(outputs.summary, r.summary);
  write(outputs.html, r.html);
  // invariants
  check(r.sheets.length >= 90, `expected >=90 fact sheets, got ${r.sheets.length}`);
  for (const s of r.sheets) {
    check(s.chart && s.version, "every sheet needs chart+version");
    check(s.support_claim && s.evidence_depth, `${s.chart}@${s.version}: needs both support_claim and evidence_depth (two-column rule)`);
    check(s.cub_scout_check.includes("cub-scout"), `${s.chart}@${s.version}: missing cub-scout post-apply check`);
  }
  console.log(`wrote chart fact sheets -> ${relativeRepo(outDir)}/ (${r.sheets.length} charts)`);
} else if (mode === "--verify") {
  const r = build();
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run chart-fact-sheets`);
    check(readFileSync(path, "utf8") === r[name], `${relativeRepo(path)} is stale; run npm run chart-fact-sheets`);
  }
  console.log(`verified chart fact sheets for ${r.sheets.length} charts (support+evidence two-column, cub-scout check present)`);
} else {
  console.log("Usage: node scripts/generate-chart-fact-sheets.mjs --generate|--verify");
}
