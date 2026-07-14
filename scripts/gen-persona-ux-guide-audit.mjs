#!/usr/bin/env node
// Persona UX audit — MENU GUIDES focus (2026-06-22). Structured re-run of the persona UX
// strategy (tests/persona-ux-strategy.md), scoped to the 8 guide pages reachable from the top
// menu (Upgrade->/private/ excluded as commercial, per the strategy's scope rule).
//
// 480 graded tests = 8 guide pages x 10 personas x 6 UX checks. Each cell graded by a per-page
// audit agent that read the page's actual content: P=pass(1) / p=partial(0.5) / F=fail(0).
// Grounded grades are embedded below verbatim; this script only aggregates + renders.
//
// Emits (data/persona-ux-guide-audit-2026-06-22/): tests.csv, matrix.html, summary.md.
//   node scripts/gen-persona-ux-guide-audit.mjs
import { join } from "node:path";
import { repoRoot, write } from "./lib/proof-common.mjs";

const OUT = join(repoRoot, "data", "persona-ux-guide-audit-2026-06-22");
const DATE = "2026-06-22";

const PERSONAS = ["Novice", "LowHelm", "HelmExpert", "GitOps", "SRE", "Maintainer", "AILead", "Skeptic", "ExistingApp", "Security"];
const CHECKS = [
  ["C1", "CoreQ", "answers this persona's core need"],
  ["C2", "Action", "runnable command/action on the page"],
  ["C3", "Output", "expected output/result shown"],
  ["C4", "Prereq", "prerequisites clear (account/cluster/tools)"],
  ["C5", "Next", "next step clear"],
  ["C6", "Scan", "findable fast (not buried/jargon-walled)"],
];
const PAGES = [
  ["Home", "site/index.html"],
  ["Get Started", "site/try.html"],
  ["Helm Catalog", "site/charts/index.html"],
  ["Variants", "site/variants.html"],
  ["Apps", "site/journey.html"],
  ["Ops", "site/operations.html"],
  ["Docs", "site/docs.html"],
  ["FAQ", "site/hard-questions.html"],
];

// page -> [ [persona, "C1C2C3C4C5C6" as P/p/F, gap] x10 ]
const GRADES = {
  "Home": [
    ["Novice", "PpFpPP", "no expected-output; signup-safe but unstated"],
    ["LowHelm", "PPFpPP", "commands present, zero pass/fail output"],
    ["HelmExpert", "PpFFPp", "forking/custom-values only linked"],
    ["GitOps", "PpFFPp", "OCI/Argo in prose; no runnable publish"],
    ["SRE", "pFFFPp", "rollback/live only linked to ops"],
    ["Maintainer", "PpFpPp", "hooks honest but no per-chart proof here"],
    ["AILead", "pFFFpp", "'AI with guardrails' prose only, dead-end card"],
    ["Skeptic", "PppPPP", "admits limits well; counts unverifiable on-page"],
    ["ExistingApp", "pFFFpF", "no read-only adopt-running-stack path"],
    ["Security", "pFFFpF", "secrets/OCI provenance barely mentioned"],
  ],
  "Get Started": [
    ["Novice", "PPPPPp", "'no signup' buried in table, not headline"],
    ["LowHelm", "PPPPPP", "near-ideal copy/paste + PASS output"],
    ["HelmExpert", "pPpPPp", "fork/customize/values overrides not shown"],
    ["GitOps", "PpFPPp", "OCI named, no Argo/Flux apply command/output"],
    ["SRE", "pFFPpp", "no rollback/working-not-synced command"],
    ["Maintainer", "PPPPPp", "CRDs/webhooks named, no honesty-check command"],
    ["AILead", "FFFpFF", "page never mentions AI/agent at all"],
    ["Skeptic", "PpPPPP", "gaps admitted; no proven-vs-not index here"],
    ["ExistingApp", "PPpPPp", "read-only adopt path implied, not explicit"],
    ["Security", "pFFPpF", "Secret-separation noted; no provenance command"],
  ],
  "Helm Catalog": [
    ["Novice", "PFFFpP", "no on-page safe try; signup unstated"],
    ["LowHelm", "PFFFPP", "no copy/paste command or pass/fail here"],
    ["HelmExpert", "PFFpPP", "fork/customize only via chart-page link"],
    ["GitOps", "pFFFpP", "no Argo/Flux/OCI command on page"],
    ["SRE", "pFFFpp", "no operate/rollback/working-not-synced here"],
    ["Maintainer", "PpFpPP", "honest dispositions, but per-chart only"],
    ["AILead", "pFFFpP", "no what-AI-changes+safety surfaced"],
    ["Skeptic", "PpFpPP", "proven/not split great; admits no command"],
    ["ExistingApp", "PFFFPP", "no read-only adopt path on page"],
    ["Security", "FFFFFp", "no secrets/OCI provenance content at all"],
  ],
  "Variants": [
    ["Novice", "pFFFpP", "no try-safe path, no signup/prereq note"],
    ["LowHelm", "PPpFpP", "commands present, output faux, no prereqs"],
    ["HelmExpert", "PPppPP", "golden path good; output illustrative not captured"],
    ["GitOps", "FFFFpP", "no Argo/Flux/OCI on this page"],
    ["SRE", "pFFFFP", "no live-ops, no rollback/working-not-synced"],
    ["Maintainer", "pFFFpP", "no hooks/CRD honesty for variants"],
    ["AILead", "pFFFpP", "'agents' named, no AI-change/safety mechanics"],
    ["Skeptic", "PppFPP", "receipts linked, on-page output unproven"],
    ["ExistingApp", "ppFFpP", "no read-only adopt-my-stack framing"],
    ["Security", "FFFFFP", "no secrets, no OCI provenance"],
  ],
  "Apps": [
    ["Novice", "PFFpPP", "no try-it command; all prose"],
    ["LowHelm", "PFFpPP", "nothing to copy/paste; no pass/fail"],
    ["HelmExpert", "PFFFPP", "no render/fork command; concepts only"],
    ["GitOps", "PFFFPP", "Argo/Flux/OCI named, no manifest/command"],
    ["SRE", "pFFFPP", "no live-operate/rollback; punts to Ops"],
    ["Maintainer", "pFFFpP", "hooks/CRDs mentioned, no honest proof"],
    ["AILead", "FFFFFP", "no AI-change or safety story at all"],
    ["Skeptic", "pFFFpP", "claims paths exist, shows no proof"],
    ["ExistingApp", "PFFFPP", "read-only promised, no discover command"],
    ["Security", "FFFpFP", "secrets/provenance unaddressed on page"],
  ],
  "Ops": [
    ["Novice", "pFFpPP", "'free tier' labels but no try-safe command"],
    ["LowHelm", "pFFFPP", "nothing to copy/paste, no pass/fail result"],
    ["HelmExpert", "pFFpPP", "no fork/customize command; diff described"],
    ["GitOps", "PpFpPP", "OCI+Argo/Flux prose, no manifest/command shown"],
    ["SRE", "FpFppP", "rollback/working-not-synced named, never shown"],
    ["Maintainer", "pFFppP", "hooks/CRDs not addressed; scan prose only"],
    ["AILead", "FFFFFP", "no AI-change or safety surface at all"],
    ["Skeptic", "PpFPPP", "watch/available honest, claims lack receipts inline"],
    ["ExistingApp", "pFFpPP", "adoption punted to Apps; no read-only command"],
    ["Security", "PpFpPP", "signing/secrets/provenance prose, no command/output"],
  ],
  "Docs": [
    ["Novice", "PPFFpP", "no try-safe/no-signup framing"],
    ["LowHelm", "PPFFFP", "links how-to, no copy/paste-or-pass/fail preview"],
    ["HelmExpert", "PPFFpP", "variants/overlays/coming-from-helm present"],
    ["GitOps", "PPpFpP", "dedicated GitOps adopter guide row"],
    ["SRE", "PPpFpP", "day-2 upgrade & rollback; not previewed"],
    ["Maintainer", "PPpFFP", "hook lifecycle strategy present"],
    ["AILead", "PPpFFP", "AI-assisted changes named"],
    ["Skeptic", "PPpFpP", "known gaps + claims register first-class"],
    ["ExistingApp", "PPFFFP", "no read-only adopt-stack guide called out"],
    ["Security", "PPpFpP", "security end-to-end named"],
  ],
  "FAQ": [
    ["Novice", "PFFpPP", "no try-safe command; only prose+links"],
    ["LowHelm", "PFFFPP", "zero copy/paste command or pass/fail step"],
    ["HelmExpert", "PFppPP", "BYO values answered but no fork command"],
    ["GitOps", "PFpPPP", "Argo/Flux/OCI explained, no manifest/command"],
    ["SRE", "PFppPP", "rollback=prose ('config revert'), no command"],
    ["Maintainer", "PpppPP", "honest hooks/CRD stance, no per-chart drill"],
    ["AILead", "PFFpPP", "AI-safety prose only, no concrete guardrail step"],
    ["Skeptic", "PpppPP", "strong gaps named; output summarized, no receipt"],
    ["ExistingApp", "PFFpPP", "read-only adopt prose, no discover command"],
    ["Security", "PFppPP", "secrets/OCI prose; no provenance command/output"],
  ],
};

const val = (c) => (c === "P" ? 1 : c === "p" ? 0.5 : 0);
const pct = (n, d) => Math.round((n / d) * 100);

// ---- aggregate ----
const rows = []; // {page,persona,cells:[6],score,gap}
for (const [page] of PAGES) for (const [persona, g, gap] of GRADES[page]) {
  const cells = g.split("").map(val);
  rows.push({ page, persona, grade: g, cells, score: cells.reduce((a, b) => a + b, 0), gap });
}
const pageScore = Object.fromEntries(PAGES.map(([p]) => [p, rows.filter((r) => r.page === p).reduce((a, r) => a + r.score, 0)]));
const personaScore = Object.fromEntries(PERSONAS.map((p) => [p, rows.filter((r) => r.persona === p).reduce((a, r) => a + r.score, 0)]));
const checkScore = CHECKS.map((_, i) => rows.reduce((a, r) => a + r.cells[i], 0));
const TOTAL = rows.reduce((a, r) => a + r.score, 0);
const NTESTS = rows.length * CHECKS.length;

// ---- CSV (one row per page x persona; 6 graded cells each => 480 tests) ----
function csv() {
  const head = ["page", "persona", ...CHECKS.map((c) => c[1]), "score_of_6", "pct", "gap"];
  const lines = [head.join(",")];
  for (const r of rows) {
    lines.push([r.page, r.persona, ...r.grade.split(""), r.score, pct(r.score, 6),
      `"${r.gap.replaceAll('"', '""')}"`].join(","));
  }
  return lines.join("\n") + "\n";
}

// ---- HTML colored matrix ----
const color = (frac) => frac >= 0.75 ? "#1a7f37" : frac >= 0.55 ? "#3fb950" : frac >= 0.40 ? "#d4a72c" : frac >= 0.20 ? "#e08c3b" : "#cf222e";
const cellBg = (frac) => frac >= 0.75 ? "#e6f4ea" : frac >= 0.55 ? "#eaffea" : frac >= 0.40 ? "#fff8c5" : frac >= 0.20 ? "#ffe9d6" : "#ffebe9";
function bar(frac, label) {
  return `<div class="bar"><div class="fill" style="width:${Math.round(frac * 100)}%;background:${color(frac)}"></div><span>${label}</span></div>`;
}
function html() {
  const personaRank = [...PERSONAS].sort((a, b) => personaScore[b] - personaScore[a]);
  const head = `<tr><th>guide \\ persona</th>${PERSONAS.map((p) => `<th>${p}</th>`).join("")}<th>page</th></tr>`;
  const body = PAGES.map(([p, f]) => {
    const tds = PERSONAS.map((persona) => {
      const r = rows.find((x) => x.page === p && x.persona === persona);
      const frac = r.score / 6;
      return `<td class="c" style="background:${cellBg(frac)};color:${color(frac)}" title="${persona}: ${r.grade} — ${r.gap}">${r.score}</td>`;
    }).join("");
    const pf = pageScore[p] / 60;
    return `<tr><th class="rh">${p}<br><small>${f.replace("site/", "")}</small></th>${tds}<td class="c" style="background:${cellBg(pf)};color:${color(pf)}"><b>${pct(pageScore[p], 60)}%</b></td></tr>`;
  }).join("");
  const foot = `<tr><th class="rh">persona %</th>${PERSONAS.map((p) => `<td class="c" style="background:${cellBg(personaScore[p] / 48)};color:${color(personaScore[p] / 48)}"><b>${pct(personaScore[p], 48)}</b></td>`).join("")}<td class="c"><b>${pct(TOTAL, NTESTS)}%</b></td></tr>`;
  const checkBars = CHECKS.map((c, i) => `<tr><td><b>${c[0]} ${c[1]}</b> <small>${c[2]}</small></td><td style="width:55%">${bar(checkScore[i] / 80, pct(checkScore[i], 80) + "%")}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Persona UX audit — menu guides (${DATE})</title><style>
  body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:1.6rem;background:#f6f8fa;color:#1f2328}
  main{max-width:1040px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 .2rem}h2{font-size:1rem;margin:1.6rem 0 .5rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.82rem;color:#6b5900;margin-bottom:1rem}
  .kpis{display:flex;gap:.8rem;flex-wrap:wrap;margin:.6rem 0}.kpi{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:.6rem .9rem;min-width:120px}.kpi b{font-size:1.5rem;display:block}.kpi small{color:#57606a}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden;font-size:.82rem}
  th,td{border-bottom:1px solid #eaeef2;border-right:1px solid #eaeef2;padding:.4rem .3rem;text-align:center}
  th{background:#f6f8fa;font-size:.72rem}.rh{text-align:left;font-size:.78rem;white-space:nowrap}.rh small{color:#8b949e;font-weight:400}
  td.c{font-weight:700;font-variant-numeric:tabular-nums}
  .bar{position:relative;background:#eef1f4;border-radius:5px;height:20px;overflow:hidden}.bar .fill{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.bar span{position:relative;padding-left:.4rem;font-size:.72rem;line-height:20px;font-weight:700;color:#1f2328}
  .legend{font-size:.74rem;color:#57606a;margin:.5rem 0}.sw{display:inline-block;width:.8rem;height:.8rem;border-radius:3px;vertical-align:middle;margin:0 .15rem 0 .6rem}
  footer{margin-top:1.5rem;color:#57606a;font-size:.82rem}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px}
</style></head><body><main>
  <h1>Persona UX audit — menu guides</h1>
  <p class="sub">${NTESTS} graded tests · 8 guide pages × ${PERSONAS.length} personas × ${CHECKS.length} checks · ${DATE} · scored P=1 / p=0.5 / F=0</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Manual product-comprehension audit per <code>tests/persona-ux-strategy.md</code>, scoped to the top-menu guide pages (Upgrade→/private/ excluded as commercial). Cells reflect what each page actually delivers; hover a cell for the gap.</div>
  <div class="kpis">
    <div class="kpi"><b>${pct(TOTAL, NTESTS)}%</b><small>overall guide score</small></div>
    <div class="kpi"><b>${pct(checkScore[5], 80)}%</b><small>orient (C6 scan) — best</small></div>
    <div class="kpi"><b>${pct(checkScore[2], 80)}%</b><small>deliver (C3 output) — worst</small></div>
    <div class="kpi"><b>${pct(personaScore.Skeptic, 48)}%</b><small>Skeptic — best-served</small></div>
    <div class="kpi"><b>${pct(personaScore.AILead, 48)}%</b><small>AI lead — worst-served</small></div>
  </div>
  <h2>The matrix — guide × persona (cell = /6)</h2>
  <table>${head}${body}${foot}</table>
  <p class="legend">cell = checks passed of 6:
    <span class="sw" style="background:#cf222e"></span>0–1
    <span class="sw" style="background:#e08c3b"></span>1.5
    <span class="sw" style="background:#d4a72c"></span>2.5–3
    <span class="sw" style="background:#3fb950"></span>3.5
    <span class="sw" style="background:#1a7f37"></span>4.5–6</p>
  <h2>Where the guides fail — by check (across all 80 page×persona pairs)</h2>
  <table><tbody>${checkBars}</tbody></table>
  <footer>The shape: guides <b>orient</b> well (scan ${pct(checkScore[5], 80)}%, core-question ${pct(checkScore[0], 80)}%, next-step ${pct(checkScore[4], 80)}%) but <b>don't let you act</b> (command ${pct(checkScore[1], 80)}%, prerequisites ${pct(checkScore[3], 80)}%, expected-output ${pct(checkScore[2], 80)}%). Full data: tests.csv. Method: persona-ux-strategy.md.</footer>
</main></body></html>
`;
}

// ---- Markdown synthesis ----
function md() {
  const pr = [...PAGES.map(([p]) => p)].sort((a, b) => pageScore[b] - pageScore[a]);
  const personaRank = [...PERSONAS].sort((a, b) => personaScore[b] - personaScore[a]);
  const pageRows = pr.map((p) => `| ${p} | ${pct(pageScore[p], 60)}% | ${(pageScore[p] / 12).toFixed(1)}/5 |`).join("\n");
  const personaRows = personaRank.map((p) => `| ${p} | ${pct(personaScore[p], 48)}% |`).join("\n");
  const checkRows = CHECKS.map((c, i) => `| ${c[0]} ${c[1]} — ${c[2]} | ${pct(checkScore[i], 80)}% |`).join("\n");
  const worst = [...rows].sort((a, b) => a.score - b.score).slice(0, 8)
    .map((r) => `| ${r.page} × ${r.persona} | ${r.score}/6 | ${r.gap} |`).join("\n");
  return `# Persona UX audit — menu guides (${DATE})

**UNOFFICIAL/EXPERIMENTAL.** Structured re-run of the [persona UX strategy](../../tests/persona-ux-strategy.md), scoped to the **${PAGES.length} guide pages reachable from the top menu** (Upgrade→\`/private/\` excluded as commercial, per the strategy's scope rule). **${NTESTS} graded tests** = ${PAGES.length} pages × ${PERSONAS.length} personas × ${CHECKS.length} checks, each scored P=1 / p=0.5 / F=0 by a per-page audit that read the page's actual content. Colored matrix: [matrix.html](./matrix.html) · raw data: [tests.csv](./tests.csv).

## Headline: **${pct(TOTAL, NTESTS)}%** overall — the guides *orient* but don't *deliver*

The clearest signal is per-check. The guides are strong at getting you oriented and weak at letting you act:

| Check | Score |
| --- | --- |
${checkRows}

**Orient (scan ${pct(checkScore[5], 80)}%, core-question ${pct(checkScore[0], 80)}%, next-step ${pct(checkScore[4], 80)}%) ≫ deliver (command ${pct(checkScore[1], 80)}%, prerequisites ${pct(checkScore[3], 80)}%, expected-output ${pct(checkScore[2], 80)}%).** A visitor can find the right guide and knows where to go next, but the guide rarely shows a runnable command, its prerequisites, or what they'll see — they have to leave for a doc to actually do anything. Expected-output (**${pct(checkScore[2], 80)}%**) is the single weakest dimension of the whole site.

## By guide page (best → worst)

| Guide | Score | /5 |
| --- | --- | --- |
${pageRows}

**Get Started** is the model page (real commands + "you should see" blocks). **Apps, Variants, Helm Catalog** are orientation pages with almost no runnable action. **Docs/FAQ** route well but answer in prose+links.

## By persona (best → worst served)

| Persona | Score |
| --- | --- |
${personaRows}

The site is **built for the Skeptic** (${pct(personaScore.Skeptic, 48)}% — gaps, refusals, and proof are first-class) and **underserves the doers**: the **AI-curious lead (${pct(personaScore.AILead, 48)}%)** is nearly invisible across the guides (no AI content on Get Started, Apps, or Ops), and **Security (${pct(personaScore.Security, 48)}%)** and **SRE (${pct(personaScore.SRE, 48)}%)** have no menu guide that lets them act on their core task.

## Worst-scoring cells

| Guide × persona | Score | Gap |
| --- | --- | --- |
${worst}

## Ranked fixes (the output)

1. **[technical voice] Add an expected-output block to every command on every guide** — the weakest dimension site-wide (C3 ${pct(checkScore[2], 80)}%). "You should see …" under each \`cub\`/\`npm\`/\`kubectl\` line.
2. **[technical voice] Put a runnable command on the orientation guides** (Apps, Variants, Catalog) — at least one copy-paste action + result, instead of prose that routes to a doc (C2 ${pct(checkScore[1], 80)}%).
3. **[technical voice] State prerequisites inline per guide** — account / cluster / \`cub\` install / inputs, near the first command (C4 ${pct(checkScore[3], 80)}%; only Get Started + FAQ do this).
4. **[marketing voice] Give the AI lead, Security, and Existing-app personas a home** — AI content on Home/Get Started (not just a dead-end card), a security/provenance section, and a read-only "adopt my stack" command on Apps.
5. **[marketing voice] Complete the Ops guide** — it names rollback/observe/patch but ships none; add those cards so SRE can act.

Re-run after Codex lands changes and diff the matrix.
`;
}

write(join(OUT, "tests.csv"), csv());
write(join(OUT, "matrix.html"), html());
write(join(OUT, "summary.md"), md());
console.log(`wrote persona-ux-guide-audit: ${NTESTS} tests, overall ${pct(TOTAL, NTESTS)}% -> ${OUT.replace(repoRoot + "/", "")}`);
console.log(`  pages: ${PAGES.map(([p]) => `${p} ${pct(pageScore[p], 60)}%`).join(" · ")}`);
console.log(`  worst persona: AILead ${pct(personaScore.AILead, 48)}% · best: Skeptic ${pct(personaScore.Skeptic, 48)}%`);
console.log(`  checks: ${CHECKS.map((c, i) => `${c[1]} ${pct(checkScore[i], 80)}%`).join(" · ")}`);
