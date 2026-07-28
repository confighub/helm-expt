#!/usr/bin/env node
// Phase 2 of the hook-route execution plan: GitOps-NATIVE emission. For each hook
// lifecycle route, derive the equivalent step your EXISTING controller runs — an
// Argo CD PreSync/PostSync hook (with sync-wave / sync-options) and the Flux
// equivalent — so the route is executed visibly by your delivery pipeline, no new
// product runtime. Pure, derived from data/lifecycle-routes-by-variant/by-variant.json;
// verify-gated. Routes the cluster already handles (ordering/cleanup/webhook) and
// inputs you supply (target facts) emit nothing, stated honestly.
//
// Usage:
//   node scripts/generate-gitops-route-emission.mjs --generate
//   node scripts/generate-gitops-route-emission.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const BY_VARIANT = "data/lifecycle-routes-by-variant/by-variant.json";
const outDir = "data/gitops-route-emission";
const csvPath = join(repoRoot, outDir, "emission.csv");
const jsonPath = join(repoRoot, outDir, "emission.json");
const mdPath = join(repoRoot, outDir, "summary.md");
const htmlPath = join(repoRoot, outDir, "emission.html");
const CSV_HEADERS = ["chart", "recipe_version", "base", "route_name", "action_kind", "emit", "argo", "flux"];

function csvCell(v) { const t = v === undefined || v === null ? "" : String(v); return /[",\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t; }
function toCsv(headers, rows) { return `${[headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n")}\n`; }
function esc(s) { return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function argoSnippet(hook, wave, syncOptions) {
  const ann = [`    argocd.argoproj.io/hook: ${hook}`, "    argocd.argoproj.io/hook-delete-policy: HookSucceeded"];
  if (wave) ann.push(`    argocd.argoproj.io/sync-wave: "${wave}"`);
  if (syncOptions) ann.push(`    argocd.argoproj.io/sync-options: ${syncOptions}`);
  return `metadata:\n  annotations:\n${ann.join("\n")}`;
}

// Derive the controller-native step for one route.
function emissionFor(route) {
  const kind = route.action_kind;
  const phase = route.lifecycle_phase;
  if (kind === "preserve-ordering") {
    return {
      emit: false,
      argo: "no extra hook — keep CRDs before dependent objects",
      flux: "no extra hook — make sure CRDs are applied before workloads",
      snippet: "",
    };
  }
  if (kind === "observe-webhook") {
    return {
      emit: false,
      argo: "wait for the certificate handoff, then observe webhook and workload health after sync",
      flux: "wait for the certificate handoff, then run post-apply webhook and workload health checks",
      snippet: "",
    };
  }
  if (kind === "accept-target-policy") {
    return { emit: false, argo: "none — your cluster handles it", flux: "none — your cluster handles it", snippet: "" };
  }
  if (kind === "stage-target-facts") {
    return { emit: false, argo: "none — supply the inputs before sync", flux: "none — supply the inputs before sync", snippet: "" };
  }
  if (kind === "install-crd") {
    return {
      emit: true, argo: "PreSync · sync-wave -2 · ServerSideApply",
      flux: "HelmRelease .spec.install.crds=Create (or apply CRDs first)",
      snippet: argoSnippet("PreSync", "-2", "ServerSideApply=true"),
    };
  }
  if (kind === "run-test") {
    return {
      emit: true, argo: "PostSync test Job (Argo has no native helm test)",
      flux: "HelmRelease .spec.test.enable=true",
      snippet: argoSnippet("PostSync", null, null),
    };
  }
  if (kind === "gitops-sync-hook") {
    return { emit: true, argo: "native sync hook — this is already the GitOps path", flux: "native sync hook", snippet: "" };
  }
  // run-job / run-preflight / run-check
  const hook = phase === "preflight" || phase === "pre-apply" ? "PreSync" : "PostSync";
  const wave = phase === "preflight" ? "-1" : "";
  return {
    emit: true, argo: `${hook}${wave ? ` · sync-wave ${wave}` : ""}`,
    flux: hook === "PreSync" ? "apply before the release (Kustomization dependsOn)" : "post-apply Job / follow-on Kustomization",
    snippet: argoSnippet(hook, wave || null, null),
  };
}

function build() {
  const abs = join(repoRoot, BY_VARIANT);
  check(existsSync(abs), `missing source ${BY_VARIANT}; run npm run lifecycle:routes-by-variant`);
  const charts = JSON.parse(readFileSync(abs, "utf8")).charts;
  const csvRows = [];
  const outCharts = charts.map((c) => ({
    chart: c.chart,
    hasBuiltVariants: c.hasBuiltVariants,
    variants: c.variants.map((v) => ({
      base: v.base,
      recipeVersion: v.recipeVersion,
      routes: v.routes.map((r) => {
        const e = emissionFor(r);
        csvRows.push({ chart: c.chart, recipe_version: v.recipeVersion, base: v.base, route_name: r.route_name, action_kind: r.action_kind, emit: e.emit ? "yes" : "no", argo: e.argo, flux: e.flux });
        return { route_name: r.route_name, action_kind: r.action_kind, quirk_class: r.quirk_class, ...e };
      }),
    })),
  }));
  return { charts: outCharts, csvRows };
}

function summaryMd(model) {
  const lines = [];
  lines.push("# GitOps-native route emission");
  lines.push("");
  lines.push("**UNOFFICIAL/EXPERIMENTAL.** Generated by `scripts/generate-gitops-route-emission.mjs`; do not hand-edit. Regenerate with `npm run gitops:route-emission`.");
  lines.push("");
  lines.push("Phase 2 of [hook-route-execution-plan.md](../../docs/planning/hook-route-execution-plan.md): for each hook route, the step your **existing** Argo CD or Flux controller runs — so the route is executed visibly, with no new product runtime. Derived from `data/lifecycle-routes-by-variant/`. Routes your cluster already handles (ordering/cleanup/webhook) and inputs you supply (target facts) emit nothing, stated honestly.");
  lines.push("");
  for (const c of model.charts) {
    if (!c.hasBuiltVariants) continue;
    lines.push(`## ${c.chart}`);
    lines.push("");
    lines.push("| Base | Route | Argo CD | Flux |");
    lines.push("| --- | --- | --- | --- |");
    for (const v of c.variants) {
      for (const r of v.routes) lines.push(`| ${v.base}@${v.recipeVersion} | ${r.quirk_class} → \`${r.route_name}\` | ${r.argo} | ${r.flux} |`);
    }
    lines.push("");
  }
  lines.push("## Argo CD hook snippet (for an emitted route)");
  lines.push("");
  lines.push("Add to the route's rendered hook object, e.g. a PostSync run-job:");
  lines.push("");
  lines.push("```yaml");
  lines.push(argoSnippet("PostSync", null, null));
  lines.push("```");
  lines.push("");
  return `${lines.join("\n")}`;
}

function summaryHtml(model) {
  const withV = model.charts.filter((c) => c.hasBuiltVariants);
  const section = (c) => `    <section><h2>${esc(c.chart)}</h2>${c.variants.map((v) => `
      <h4>${esc(v.base)}@${esc(v.recipeVersion)}</h4>
      <table><thead><tr><th>Route</th><th>Argo CD</th><th>Flux</th></tr></thead><tbody>
${v.routes.map((r) => `        <tr><td>${esc(r.quirk_class)} <span class="rt">${esc(r.route_name)}</span></td><td>${r.emit ? `<span class="chip ok">${esc(r.argo)}</span>` : `<span class="chip muted">${esc(r.argo)}</span>`}</td><td>${esc(r.flux)}</td></tr>`).join("\n")}
      </tbody></table>`).join("\n")}
    </section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>GitOps-native route emission</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:960px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .25rem}h2{font-size:1.1rem;margin:1.4rem 0 .5rem}h4{margin:.6rem 0 .3rem;font-size:.95rem}
  .sub{color:#57606a;margin:0 0 1rem}.banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;font-size:.88rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .rt{font-family:ui-monospace,Menlo,monospace;font-size:.8em;color:#57606a}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.muted{background:#f1eff0;color:#57606a}
  pre{background:#fff;border:1px solid #d0d7de;border-radius:6px;padding:.7rem;font-size:.8rem;overflow:auto}
  footer{margin-top:2rem;color:#57606a;font-size:.85rem}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}
</style></head>
<body><main>
  <h1>GitOps-native route emission</h1>
  <p class="sub">For each hook route, the step your existing Argo CD or Flux controller runs — executed visibly, no new product runtime.</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/generate-gitops-route-emission.mjs</code>; do not hand-edit.</div>
${withV.map(section).join("\n")}
  <h2>Argo CD hook snippet</h2>
  <p class="sub">Add to the route's rendered hook object (example: a PostSync run-job):</p>
  <pre>${esc(argoSnippet("PostSync", null, null))}</pre>
  <footer>Routes your cluster already handles (ordering, cleanup, webhook cert) and inputs you supply (target facts) emit nothing — shown as <span class="chip muted">none</span>. Emitting a route as your controller's native hook keeps it visible and audited, with no new runtime — the bridge to product-direct execution (<a href="https://github.com/confighub/helm-expt/issues/688">#688</a>).</footer>
</main></body></html>
`;
}

function render() {
  const { charts, csvRows } = build();
  return { csv: toCsv(CSV_HEADERS, csvRows), json: `${JSON.stringify({ charts }, null, 2)}\n`, md: summaryMd({ charts }), html: summaryHtml({ charts }) };
}

if (mode === "--generate") {
  const out = render();
  write(csvPath, out.csv); write(jsonPath, out.json); write(mdPath, out.md); write(htmlPath, out.html);
  console.log(`wrote gitops route emission -> ${relativeRepo(csvPath)} (${out.csv.trim().split("\n").length - 1} rows)`);
} else if (mode === "--verify") {
  const out = render();
  for (const [p, c] of [[csvPath, out.csv], [jsonPath, out.json], [mdPath, out.md], [htmlPath, out.html]]) {
    check(existsSync(p), `${relativeRepo(p)} missing; run npm run gitops:route-emission`);
    check(readFileSync(p, "utf8") === c, `${relativeRepo(p)} is stale; run npm run gitops:route-emission`);
  }
  console.log(`verified gitops route emission: ${out.csv.trim().split("\n").length - 1} rows`);
} else {
  console.log("Usage:\n  node scripts/generate-gitops-route-emission.mjs --generate\n  node scripts/generate-gitops-route-emission.mjs --verify");
}
