#!/usr/bin/env node
// Per-VARIANT hook lifecycle routes — a contained, derived, verify-gated surface
// that answers, in plain words and per chart AND per base/variant: after you
// deploy, who runs each hook — you (by hand), your cluster, your Argo/Flux step,
// or nobody yet?
//
// It does NOT touch the canonical lifecycle-routes data or the master matrix
// feed (no regeneration cascade). It DERIVES the per-variant deltas from
// committed inputs only:
//   - data/lifecycle-route-actions/actions.csv  — the chart-level route set
//   - recipes/<chart>/<ver>/variants/<base>/variant.yaml — proves the per-base
//     delta: a no-crds base lists its requiredCRDs (delegated to the default
//     base), so it drops the CRD route and turns CRDs into a before-deploy fact.
//   - data/master-catalog-matrix/matrix.csv — per-base hook_disposition (e.g.
//     argo-workflows: minimal-crds=observed vs default=candidate-route).
// Nothing is hand-asserted; nothing runs automatically (automatic:false).
//
// Usage:
//   node scripts/generate-lifecycle-routes-by-variant.mjs --generate
//   node scripts/generate-lifecycle-routes-by-variant.mjs --verify
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const ACTIONS_CSV = "data/lifecycle-route-actions/actions.csv";
const MATRIX_CSV = "data/master-catalog-matrix/matrix.csv";
const outDir = "data/lifecycle-routes-by-variant";
const csvPath = join(repoRoot, outDir, "by-variant.csv");
const jsonPath = join(repoRoot, outDir, "by-variant.json");
const mdPath = join(repoRoot, outDir, "summary.md");
const htmlPath = join(repoRoot, outDir, "by-variant.html");

const CSV_HEADERS = [
  "chart", "recipe_version", "base", "quirk_class", "route_name", "lifecycle_phase",
  "action_kind", "execution_mode", "base_disposition", "automatic", "who_runs", "delta", "reason", "command",
];

// --- CSV (proven helpers, mirrored from generate-lifecycle-route-actions.mjs) ---
function parseCsv(text) {
  const rows = []; let field = ""; let row = []; let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; } }
      else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") { field += c; }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}
function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
function toCsv(headers, rows) {
  return `${[headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n")}\n`;
}
function readCsvObjects(rel) {
  const abs = join(repoRoot, rel);
  check(existsSync(abs), `missing source ${rel}`);
  const rows = parseCsv(readFileSync(abs, "utf8")).filter((r) => r.some((c) => c.trim() !== ""));
  const headers = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

// --- Plain-words classifier (the whole point — kept in the data, not the HTML) ---
function whoRuns(execMode, actionKind, disposition) {
  // CRD install depends on whether THIS base resolves it (observed) or delegates it.
  if (actionKind === "install-crd" || actionKind === "stage-target-facts") {
    if (actionKind === "install-crd") {
      return disposition === "observed"
        ? "Handled — this base installs the CRDs"
        : "You — before deploy (install the required CRDs first)";
    }
    return "You — before deploy (create the required facts)";
  }
  if (actionKind === "gitops-sync-hook") return "Your Argo/Flux step (only if you add it)";
  if (execMode === "user-executes") {
    if (actionKind === "run-test") return "You — by hand (the `helm test` equivalent)";
    if (actionKind === "verify-render") return "You — before deploy (verify the render)";
    if (actionKind === "run-preflight") return "You — by hand (run the preflight job)";
    if (actionKind === "run-check") return "You — by hand (run the check)";
    if (actionKind === "run-job") return "You — by hand (run the job)";
    return "You — by hand";
  }
  if (execMode === "target-owned") {
    if (actionKind === "preserve-ordering") return "Your applier (applies objects in the right order)";
    if (actionKind === "accept-target-policy") return "Your cluster (at uninstall / cleanup time)";
    if (actionKind === "observe-webhook") return "Your cluster (sets up the webhook certificate)";
    return "Your cluster (handles it for you)";
  }
  if (execMode === "not-yet-executable" || disposition === "blocked") return "Nobody yet — blocked (a precondition must be met first)";
  if (execMode === "product-executes") return "The product (automatically)";
  return "See the route";
}
function cleanCommand(cmd) {
  return (cmd ?? "").replace(/\s*#\s*placeholder\s*$/i, "").trim();
}
// matrix hook_disposition -> route disposition vocabulary
function matrixDispToRoute(hd) {
  if (!hd) return null;
  if (hd === "observed") return "observed";
  if (hd === "candidate-route" || hd === "todo" || hd === "routed") return "routed";
  if (hd === "per-target") return "per-target";
  if (hd === "blocked") return "blocked";
  if (hd === "refused") return "refused";
  return null;
}

// --- Variant facts from committed recipes -------------------------------------
function builtVariants(chart) {
  const base = join(repoRoot, "recipes", chart);
  if (!existsSync(base)) return [];
  const byBase = new Map();
  for (const ver of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    const vdir = join(base, ver, "variants");
    if (!existsSync(vdir)) continue;
    for (const b of readdirSync(vdir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
      const yp = join(vdir, b, "variant.yaml");
      if (!existsSync(yp)) continue;
      const yaml = readYaml(yp);
      // sorted-asc iteration → highest version wins per base
      byBase.set(b, { base: b, version: ver, yaml });
    }
  }
  return [...byBase.values()].sort((a, b) => a.base.localeCompare(b.base));
}
function requiredCrds(yaml) {
  const r = yaml?.spec?.targetFacts?.requiredCRDs;
  return Array.isArray(r) ? r.length : 0;
}

// --- Per-base route derivation ------------------------------------------------
function routesForBase(chartRoutes, variant, matrixDisp) {
  const crdCount = requiredCrds(variant.yaml);
  const delegatesCrds = crdCount > 0; // a base that lists requiredCRDs does not install them itself
  const perBase = matrixDispToRoute(matrixDisp);
  return chartRoutes.map((route) => {
    let delta = "kept";
    let reason = "";
    let disposition = perBase ?? route.disposition;
    const isCrdRoute = route.action_kind === "install-crd" || /crd/i.test(route.route_name);
    if (isCrdRoute) {
      if (disposition === "observed") {
        delta = "resolved";
        reason = "this base installs the required CRDs (observed live)";
      } else if (delegatesCrds) {
        delta = "prerequisite";
        reason = `this base does not install the ${crdCount} CRDs — supply them before deploy (e.g. via the default base or your platform)`;
      } else {
        delta = "prerequisite";
        reason = "the CRDs must be installed before this hook can run";
      }
    } else if (delegatesCrds) {
      if (route.action_kind === "preserve-ordering") {
        delta = "reduced";
        reason = "CRD-first ordering is not needed in a base that installs no CRDs";
      } else if (route.action_kind === "stage-target-facts") {
        delta = "strengthened";
        reason = `this base needs ${crdCount} CRDs supplied before deploy (the default base installs them for you)`;
      }
    }
    return {
      route_name: route.route_name,
      quirk_class: route.quirk_class,
      lifecycle_phase: route.lifecycle_phase,
      action_kind: route.action_kind,
      execution_mode: route.execution_mode,
      disposition,
      automatic: false,
      whoRuns: whoRuns(route.execution_mode, route.action_kind, disposition),
      command: cleanCommand(route.human_command),
      delta,
      reason,
    };
  });
}

function build() {
  const actions = readCsvObjects(ACTIONS_CSV);
  const routesByChart = new Map();
  for (const a of actions) {
    if (!routesByChart.has(a.chart)) routesByChart.set(a.chart, []);
    routesByChart.get(a.chart).push(a);
  }
  // per-base hook_disposition from the matrix (key chart|base; highest version wins)
  const matrixDisp = new Map();
  for (const row of readCsvObjects(MATRIX_CSV)) {
    if (row.row_kind !== "base") continue;
    if (row.hook_disposition) matrixDisp.set(`${row.chart}|${row.variant}`, row.hook_disposition);
  }

  const charts = [];
  const csvRows = [];
  for (const chart of [...routesByChart.keys()].sort()) {
    const chartRoutes = routesByChart.get(chart);
    const variants = builtVariants(chart);
    const entry = { chart, hasBuiltVariants: variants.length > 1, note: "", variants: [] };
    if (variants.length === 0) {
      entry.note = "No built recipe variants yet — routes shown are chart-level. Per-variant hook deltas are named in the chart's pain report but have no built base to attach to.";
      entry.variants.push(emit(chart, { base: "(chart-level)", version: "" }, chartRoutes, null, csvRows, 0));
    } else {
      if (variants.length === 1) entry.note = "One built base — its hook routes do not differ by variant.";
      for (const v of variants) {
        const md = matrixDisp.get(`${chart}|${v.base}`) ?? null;
        entry.variants.push(emit(chart, v, chartRoutes, md, csvRows, requiredCrds(v.yaml)));
      }
    }
    charts.push(entry);
  }
  return { charts, csvRows };
}

function emit(chart, variant, chartRoutes, matrixDispVal, csvRows, crdCount) {
  const routes = routesForBase(chartRoutes, variant, matrixDispVal);
  for (const r of routes) {
    csvRows.push({
      chart, recipe_version: variant.version, base: variant.base, quirk_class: r.quirk_class,
      route_name: r.route_name, lifecycle_phase: r.lifecycle_phase, action_kind: r.action_kind,
      execution_mode: r.execution_mode, base_disposition: r.disposition, automatic: "false",
      who_runs: r.whoRuns, delta: r.delta, reason: r.reason, command: r.command,
    });
  }
  return { base: variant.base, recipeVersion: variant.version, requiredCrdCount: crdCount, routes };
}

function summaryMd(model) {
  const withVariants = model.charts.filter((c) => c.hasBuiltVariants);
  const lines = [];
  lines.push("# Per-variant hook lifecycle routes");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by `scripts/generate-lifecycle-routes-by-variant.mjs`; do not hand-edit. Regenerate with `npm run lifecycle:routes-by-variant`.");
  lines.push("");
  lines.push("Plain-words answer to *\"after you deploy, who runs each hook?\"* per chart **and per built variant**. Derived from committed inputs only (the chart-level route set in `data/lifecycle-route-actions/`, each base's `variant.yaml`, and the matrix's per-base disposition). Nothing runs automatically (`automatic: false`).");
  lines.push("");
  lines.push(`Charts: ${model.charts.length} · with a real per-variant delta: ${withVariants.length} (${withVariants.map((c) => c.chart).join(", ") || "none"}).`);
  lines.push("");
  for (const c of model.charts) {
    if (!c.hasBuiltVariants) continue;
    lines.push(`## ${c.chart}`);
    lines.push("");
    lines.push("| Base | Hook (route) | After deploy, who runs it? | Per-base change |");
    lines.push("| --- | --- | --- | --- |");
    for (const v of c.variants) {
      for (const r of v.routes) {
        const change = r.delta === "kept" ? "—" : `${r.delta}${r.reason ? ` (${r.reason})` : ""}`;
        lines.push(`| ${v.base}${v.requiredCrdCount ? ` (needs ${v.requiredCrdCount} CRDs)` : ""} | ${r.quirk_class} → \`${r.route_name}\` | ${r.whoRuns} | ${change} |`);
      }
    }
    lines.push("");
  }
  const flat = model.charts.filter((c) => !c.hasBuiltVariants);
  if (flat.length) {
    lines.push("## Charts without a per-variant delta yet");
    lines.push("");
    lines.push("These charts have hook routes but no built variant set that changes the hook behavior (single base, or candidate/blocked with no built variants). Routes are chart-level.");
    lines.push("");
    for (const c of flat) lines.push(`- \`${c.chart}\` — ${c.note}`);
    lines.push("");
  }
  return `${lines.join("\n")}`;
}

function whoRunsClass(whoRunsText) {
  if (whoRunsText.startsWith("You")) return "amber";
  if (whoRunsText.startsWith("Nobody")) return "red";
  if (whoRunsText.startsWith("Your Argo")) return "blue";
  return "green"; // Your cluster / Your applier / Handled
}
function deltaClass(delta) {
  if (delta === "resolved") return "green";
  if (delta === "strengthened" || delta === "prerequisite") return "amber";
  return "gray"; // kept / reduced
}
function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function summaryHtml(model) {
  const withVariants = model.charts.filter((c) => c.hasBuiltVariants);
  const card = (chart, v) => {
    const rows = v.routes.map((r) => `        <tr>
          <td>${esc(r.quirk_class)} <span class="rt">${esc(r.route_name)}</span></td>
          <td><span class="chip ${whoRunsClass(r.whoRuns)}">${esc(r.whoRuns)}</span></td>
          <td>${r.delta === "kept" ? '<span class="muted">—</span>' : `<span class="chip ${deltaClass(r.delta)}">${esc(r.delta)}</span>${r.reason ? `<div class="reason">${esc(r.reason)}</div>` : ""}`}</td>
        </tr>`).join("\n");
    return `      <div class="base">
        <div class="base-h">${esc(v.base)}${v.requiredCrdCount ? ` <span class="muted">· needs ${v.requiredCrdCount} CRDs supplied first</span>` : ""}</div>
        <table>
          <thead><tr><th>Hook (route)</th><th>After deploy, who runs it?</th><th>Per-base change</th></tr></thead>
          <tbody>
${rows}
          </tbody>
        </table>
      </div>`;
  };
  const sections = withVariants.map((c) => `    <section>
      <h2>${esc(c.chart)}</h2>
${c.variants.map((v) => card(c.chart, v)).join("\n")}
    </section>`).join("\n");
  const flat = model.charts.filter((c) => !c.hasBuiltVariants)
    .map((c) => `      <li><code>${esc(c.chart)}</code> — ${esc(c.note)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Per-variant hook routes — who runs each after you deploy?</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:1000px;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 .25rem}
  h2{font-size:1.1rem;margin:1.6rem 0 .6rem}
  .sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .legend{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 1.2rem}
  .base{margin:0 0 1rem}
  .base-h{font-weight:600;font-size:.95rem;margin:.4rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;vertical-align:top;font-size:.88rem}
  th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;letter-spacing:.03em;color:#57606a}
  tr:last-child td{border-bottom:0}
  .rt{font-family:ui-monospace,Menlo,monospace;font-size:.8em;color:#57606a}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}
  .chip.amber{background:#fff1d6;color:#9a6700}.chip.green{background:#e6f4ea;color:#1a7f37}.chip.red{background:#ffebe9;color:#cf222e}.chip.blue{background:#ddf4ff;color:#0a5dc2}.chip.gray{background:#f1eff0;color:#57606a}
  .reason{font-size:.78rem;color:#57606a;margin-top:3px;max-width:34ch}
  .muted{color:#8c959f}
  footer{margin-top:2rem;color:#57606a;font-size:.85rem}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}
</style></head>
<body><main>
  <h1>Hooks &amp; lifecycle — who runs each after you deploy?</h1>
  <p class="sub">Per chart and per built variant. Derived from each base's <code>variant.yaml</code> + the chart-level route set. Nothing runs automatically.</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/generate-lifecycle-routes-by-variant.mjs</code>; do not hand-edit. Regenerate with <code>npm run lifecycle:routes-by-variant</code>.</div>
  <div class="legend">
    <span class="chip amber">You — by hand / before deploy</span>
    <span class="chip green">Your cluster handles it</span>
    <span class="chip blue">Your Argo/Flux step</span>
    <span class="chip red">Nobody yet — blocked</span>
  </div>
${sections}
    <section>
      <h2>Charts without a per-variant delta yet</h2>
      <ul>
${flat}
      </ul>
    </section>
  <footer>Nothing here runs automatically (<code>automatic: false</code>). Your Argo/Flux sync delivers the rendered objects but won't run these hooks unless you add them as a deliberate, audited step.</footer>
</main></body></html>
`;
}
function render() {
  const { charts, csvRows } = build();
  const model = { charts };
  return {
    csv: toCsv(CSV_HEADERS, csvRows),
    json: `${JSON.stringify({ charts }, null, 2)}\n`,
    md: summaryMd(model),
    html: summaryHtml(model),
  };
}

if (mode === "--generate") {
  const out = render();
  write(csvPath, out.csv);
  write(jsonPath, out.json);
  write(mdPath, out.md);
  write(htmlPath, out.html);
  const n = out.csv.trim().split("\n").length - 1;
  console.log(`wrote per-variant routes -> ${relativeRepo(csvPath)} (${n} rows)`);
} else if (mode === "--verify") {
  const out = render();
  check(existsSync(csvPath), `${relativeRepo(csvPath)} missing; run npm run lifecycle:routes-by-variant`);
  check(readFileSync(csvPath, "utf8") === out.csv, `${relativeRepo(csvPath)} is stale; run npm run lifecycle:routes-by-variant`);
  check(readFileSync(jsonPath, "utf8") === out.json, `${relativeRepo(jsonPath)} is stale; run npm run lifecycle:routes-by-variant`);
  check(readFileSync(mdPath, "utf8") === out.md, `${relativeRepo(mdPath)} is stale; run npm run lifecycle:routes-by-variant`);
  check(readFileSync(htmlPath, "utf8") === out.html, `${relativeRepo(htmlPath)} is stale; run npm run lifecycle:routes-by-variant`);
  console.log(`verified per-variant routes: ${out.csv.trim().split("\n").length - 1} rows`);
} else {
  console.log("Usage:\n  node scripts/generate-lifecycle-routes-by-variant.mjs --generate\n  node scripts/generate-lifecycle-routes-by-variant.mjs --verify");
}
