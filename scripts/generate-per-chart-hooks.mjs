#!/usr/bin/env node
// Per-chart hook handling: "what happens to THIS chart's hooks?" Turns the lifecycle
// route-actions (data/lifecycle-route-actions/actions.csv) into a per-chart surface — each
// chart that has a hook (or hook-like behavior), its named lifecycle routes, the honest
// disposition (observed / routed / per-target / blocked), the automatic flag (always false),
// and whether there is a skill for the chart (data/chart-skills/skills.csv). Render parity
// proves every NON-hook object; this covers the part render parity is not allowed to claim.
// Deterministic surface (no timestamp) so --verify byte-compares.
//
// Usage:
//   node scripts/generate-per-chart-hooks.mjs --generate
//   node scripts/generate-per-chart-hooks.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const actionsPath = join(repoRoot, "data", "lifecycle-route-actions", "actions.csv");
const skillsPath = join(repoRoot, "data", "chart-skills", "skills.csv");
const summaryPath = join(repoRoot, "data", "per-chart-hooks", "summary.md");
const htmlPath = join(repoRoot, "data", "per-chart-hooks", "by-chart.html");
const csvPath = join(repoRoot, "data", "per-chart-hooks", "cards.csv");

// minimal RFC-4180-ish CSV parser (quoted fields, embedded commas, "" escapes)
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function toObjects(text) {
  const rows = parseCsv(text).filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ""));
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}
function csvCell(v) { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }

const DISP_ORDER = ["observed", "routed", "per-target", "blocked", "refused", "n-a"];
function headlineDisposition(dispositions) {
  for (const d of DISP_ORDER) if (dispositions.includes(d)) return d;
  return dispositions[0] ?? "todo";
}
const DISP_MEANING = {
  observed: "a live receipt exists — the hook ran and was recorded",
  routed: "the hook is named and has a route, not yet observed live",
  "per-target": "the route depends on the target — it runs only where the precondition holds",
  blocked: "the route is known but a precondition (images / CRDs / deps) blocks live observation",
  refused: "we will not claim this route without evidence we do not have",
};

function build() {
  check(existsSync(actionsPath), `${relativeRepo(actionsPath)} missing`);
  const actions = toObjects(readFileSync(actionsPath, "utf8"));
  const skills = existsSync(skillsPath) ? toObjects(readFileSync(skillsPath, "utf8")) : [];
  const skillByChart = new Map(skills.map((s) => [s.chart, s]));

  const byChart = new Map();
  for (const a of actions) {
    if (!byChart.has(a.chart)) byChart.set(a.chart, []);
    byChart.get(a.chart).push(a);
  }
  const cards = [...byChart.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([chart, routes]) => {
    const dispositions = [...new Set(routes.map((r) => r.disposition))].sort();
    const automaticTrue = routes.filter((r) => String(r.automatic).toLowerCase() === "true").length;
    const skill = skillByChart.get(chart);
    return {
      chart,
      version: routes[0].version || "",
      dispositions,
      headline: headlineDisposition(dispositions),
      routeCount: routes.length,
      automaticTrue,
      skills: skill?.applicable_skills || "",
      topSkill: skill?.top_skill || "",
      routes: routes.map((r) => ({
        route_name: r.route_name, quirk_class: r.quirk_class, lifecycle_phase: r.lifecycle_phase,
        action_kind: r.action_kind, execution_mode: r.execution_mode, automatic: r.automatic,
        disposition: r.disposition, human_command: r.human_command, next_action: r.evidence_or_next_action,
      })),
    };
  });
  const totalRoutes = cards.reduce((n, c) => n + c.routeCount, 0);
  const totalAutomatic = cards.reduce((n, c) => n + c.automaticTrue, 0);
  return { cards, totalRoutes, totalAutomatic };
}

function summaryMd(b) {
  const rows = b.cards.map((c) =>
    `| ${c.chart}${c.version ? `@${c.version}` : ""} | ${c.headline} | ${c.routeCount} | ${c.automaticTrue}/${c.routeCount} | ${c.skills || "—"} |`).join("\n");
  const usedDisp = [...new Set(b.cards.map((c) => c.headline))].filter((d) => DISP_MEANING[d]);
  const meaning = usedDisp.map((d) => `- **${d}** — ${DISP_MEANING[d]}.`).join("\n");
  return `# Per-chart hook handling — what happens to THIS chart's hooks?

**UNOFFICIAL/EXPERIMENTAL.** Generated by \`scripts/generate-per-chart-hooks.mjs\`; do not hand-edit. Regenerate with \`npm run per-chart-hooks\`.

Render parity proves every **non-hook** object in a chart. A hook (a Job, a test, a delete-policy cleanup) is the one thing render parity is *not* allowed to claim — so each is re-expressed as an explicit, named **lifecycle route**: visible, runnable, and **never automatic**. This page is the per-chart view of those routes.

**${b.cards.length} catalog charts have lifecycle routes**, ${b.totalRoutes} routes in total — and **${b.totalAutomatic} of ${b.totalRoutes} are automatic**. Nothing claims the product silently runs a hook for you. (Charts not listed here have no lifecycle hooks; render parity covers their full object set.)

| Chart | Disposition | Routes | Automatic | Skill for this chart |
| --- | --- | --- | --- | --- |
${rows}

## What each disposition means
${meaning}

- Per-chart detail (colored cards): \`data/per-chart-hooks/by-chart.html\`.
- Flat data (one row per route): \`data/per-chart-hooks/cards.csv\`.
- Source: \`data/lifecycle-route-actions/actions.csv\` + \`data/chart-skills/skills.csv\`.
`;
}

function cardsHtml(b) {
  const chip = (d) => `<span class="chip ${d === "observed" ? "ok" : d === "blocked" ? "bad" : "warn"}">${d}</span>`;
  const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const card = (c) => `<section class="card">
    <h2>${esc(c.chart)}<span class="muted"> ${c.version ? `@${esc(c.version)}` : ""}</span> ${chip(c.headline)}</h2>
    <p class="meta"><b>${c.routeCount}</b> route(s) · <b>automatic: ${c.automaticTrue}/${c.routeCount}</b> · skill: ${c.skills ? `<code>${esc(c.skills)}</code>` : "<span class=muted>—</span>"}</p>
    <table><thead><tr><th>Route</th><th>Phase</th><th>Action</th><th>Auto</th><th>Disposition</th><th>How it runs / next</th></tr></thead><tbody>
    ${c.routes.map((r) => `<tr><td>${esc(r.route_name)}<div class="muted">${esc(r.quirk_class)}</div></td><td>${esc(r.lifecycle_phase)}</td><td><code>${esc(r.action_kind)}</code></td><td><span class="chip ${String(r.automatic).toLowerCase() === "true" ? "bad" : "ok"}">${esc(r.automatic)}</span></td><td>${chip(r.disposition)}</td><td>${r.human_command ? `<code>${esc(r.human_command)}</code>` : `<span class="muted">${esc(r.next_action).slice(0, 160)}</span>`}</td></tr>`).join("")}
    </tbody></table>
  </section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Per-chart hook handling</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:1000px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .card{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:1rem 1.1rem;margin:1rem 0}
  .card h2{font-size:1.1rem;margin:0 0 .3rem}.meta{color:#57606a;font-size:.85rem;margin:.2rem 0 .7rem}
  table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:.4rem .55rem;border-bottom:1px solid #eaeef2;vertical-align:top;font-size:.85rem}th{background:#f6f8fa;font-size:.72rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.05rem .5rem;border-radius:999px;font-size:.74rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.bad{background:#ffebe9;color:#cf222e}
  .muted{color:#8c959f}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.92em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Per-chart hook handling — what happens to THIS chart's hooks?</h1>
  <p class="sub">${b.cards.length} charts with lifecycle routes · ${b.totalAutomatic}/${b.totalRoutes} automatic · render parity covers every non-hook object</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/generate-per-chart-hooks.mjs</code>; do not hand-edit.</div>
  ${b.cards.map(card).join("\n")}
  <footer>A hook is the one thing render parity cannot claim, so each is an explicit, named lifecycle route — never automatic. "Skill for this chart" links the relevant cub-scout skill where one applies.</footer>
</main></body></html>
`;
}

function cardsCsv(b) {
  const header = ["chart", "version", "route_name", "quirk_class", "disposition", "lifecycle_phase", "action_kind", "execution_mode", "automatic", "top_skill", "human_command", "next_action"];
  const lines = [header.join(",")];
  for (const c of b.cards) {
    for (const r of c.routes) {
      lines.push([c.chart, c.version, r.route_name, r.quirk_class, r.disposition, r.lifecycle_phase, r.action_kind, r.execution_mode, r.automatic, c.topSkill, r.human_command, r.next_action].map(csvCell).join(","));
    }
  }
  return lines.join("\n") + "\n";
}

if (mode === "--generate") {
  const b = build();
  write(summaryPath, summaryMd(b));
  write(htmlPath, cardsHtml(b));
  write(csvPath, cardsCsv(b));
  console.log(`wrote per-chart hooks -> ${relativeRepo(summaryPath).replace("/summary.md", "")}/ (${b.cards.length} charts, ${b.totalRoutes} routes, ${b.totalAutomatic} automatic)`);
} else if (mode === "--verify") {
  const b = build();
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(b), `${relativeRepo(summaryPath)} is stale; run npm run per-chart-hooks`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === cardsHtml(b), `${relativeRepo(htmlPath)} is stale; run npm run per-chart-hooks`);
  check(existsSync(csvPath) && readFileSync(csvPath, "utf8") === cardsCsv(b), `${relativeRepo(csvPath)} is stale; run npm run per-chart-hooks`);
  console.log(`verified per-chart hooks: ${b.cards.length} charts, ${b.totalAutomatic}/${b.totalRoutes} automatic`);
} else {
  console.log("Usage:\n  node scripts/generate-per-chart-hooks.mjs --generate\n  node scripts/generate-per-chart-hooks.mjs --verify");
}
