#!/usr/bin/env node
// HELM's footgun timing profile, over the SAME 180 bad decisions as the careless-dev fuzz
// (run-bad-decisions-fuzz.mjs, which showed the OUTCOMES). This asks WHEN Helm surfaces a
// bad `--set`:
//   - Raw Helm (`--set` -> `helm install` / Argo-helm): only a render-REJECTED decision is
//     caught before the cluster. A LEAKED value reaches the live k8s API (caught at apply,
//     in the cluster). An ABSORBED value silently succeeds — you never learn.
//
// This measures HELM, not cub. It is deliberately NOT a "config-as-data is better" claim:
// cub renders via the same engine, so the rejected/leaked/absorbed split is identical, and
// "config-as-data surfaces it at review" is a model property, not a measurement. Whether OUR
// tool does better is MEASURED in the cub-installer fuzz (run-cub-installer-fuzz.mjs), where
// an unknown input is a hard error and cub's own rough edges are surfaced. We test our own
// tool rather than score points off Helm's. Same corpus (scripts/lib/bad-decisions.mjs);
// offline; reproducible.
//
// Usage:
//   node scripts/run-bad-decisions-comparison.mjs --run     # render + diff, write receipt + summary
//   node scripts/run-bad-decisions-comparison.mjs --verify  # re-derive summary from the receipt
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CHARTS, DECISIONS, chartCoords, tsh } from "./lib/bad-decisions.mjs";
import { check, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "bad-decisions-comparison", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "bad-decisions-comparison", "summary.md");
const htmlPath = join(repoRoot, "data", "bad-decisions-comparison", "helm-vs-confighub.html");
const CLAIM = "HELM's footgun timing profile (measured): where a careless --set value gets caught — at render, only at the live k8s API at apply, or never (silent). This measures HELM, not cub; whether OUR tool does better with the same kind of input is measured by the cub-installer fuzz (data/cub-installer-fuzz/), where an unknown input is a hard error and cub's own rough edges are surfaced.";

function render(localChart, setArg) {
  const args = ["template", "fuzz", localChart, "--namespace", "fuzz-ns"];
  if (setArg) args.push("--set", setArg);
  return tsh("helm", args);
}
// For one decision, classify the Helm outcome (same detection method as the fuzz — does the
// bad value render into a manifest?) and the config-as-data visibility/timing derived from
// it. We classify by DETECTION, not a re-render diff: some charts emit non-deterministic
// output (generated passwords, config checksums) that would make a naive diff report a no-op
// as a change. Detection keeps this lane consistent with the fuzz and honest.
function classifyCase(decision, localChart) {
  const r = render(localChart, decision.set);
  if (!r.ok) {
    return { decision: decision.id, helm: "rejected", helmWhen: "render (before cluster)" };
  }
  if (decision.detect.test(r.out)) {
    return { decision: decision.id, helm: "leaked", helmWhen: "live k8s API (at apply, in cluster)" };
  }
  return { decision: decision.id, helm: "absorbed", helmWhen: "never (silent success)" };
}

function runComparison() {
  const stamp = new Date().toISOString();
  const work = mkdtempSync(join(tmpdir(), "cmp-"));
  const charts = [];
  try {
    for (const [owner, chart] of CHARTS) {
      const c = chartCoords(owner, chart);
      if (!c) { charts.push({ slug: `${owner}/${chart}`, status: "no-source-lock", cases: [] }); continue; }
      const pull = tsh("helm", ["pull", c.chart, "--repo", c.repo, "--version", c.version, "--untar", "--untardir", work]);
      const local = join(work, c.chart);
      if (!pull.ok || !existsSync(local)) { charts.push({ slug: c.slug, version: c.version, status: "pull-failed", cases: [] }); continue; }
      const base = render(local, null); // gate: only compare charts that baseline-render with defaults
      if (!base.ok) { charts.push({ slug: c.slug, version: c.version, status: "baseline-needs-values", cases: [] }); continue; }
      const cases = DECISIONS.map((d) => classifyCase(d, local));
      charts.push({ slug: c.slug, version: c.version, status: "compared", cases });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const all = charts.flatMap((c) => c.cases);
  const helm = { rejected: 0, leaked: 0, absorbed: 0 };
  for (const x of all) helm[x.helm] = (helm[x.helm] ?? 0) + 1;
  // comparative timing: when is each surfaced?
  const helmBeforeCluster = helm.rejected;        // only render-rejected is caught pre-cluster
  const helmAtApiOnly = helm.leaked;              // reaches the live API at apply
  const helmNever = helm.absorbed;                // silent success
  const cubAtReview = all.length;                 // every case is a reviewable diff/error pre-apply
  const unclassified = all.filter((x) => !["rejected", "leaked", "absorbed"].includes(x.helm)).length;
  const comparedCharts = charts.filter((c) => c.status === "compared").length;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "BadDecisionsComparisonReceipt",
    metadata: { name: `bad-decisions-cmp-${stamp.slice(0, 10).replaceAll("-", "")}` },
    spec: {
      observedAt: stamp,
      decisions: DECISIONS.length,
      chartsCompared: comparedCharts,
      cases: all.length,
      helm,
      timing: { helmBeforeCluster, helmAtApiOnly, helmNever, cubAtReview },
      unclassified,
      result: unclassified === 0 && all.length > 0 ? "pass" : all.length === 0 ? "blocked" : "watch",
      claim: CLAIM,
      charts,
    },
  };
}

function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "0%"; }

function summaryMd(r) {
  const s = r.spec; const t = s.timing; const h = s.helm;
  const chartRows = s.charts.map((c) => {
    if (c.status !== "compared") return `| ${c.slug} | — | ${c.status} |`;
    const cc = { rejected: 0, leaked: 0, absorbed: 0 };
    for (const x of c.cases) cc[x.helm] += 1;
    return `| ${c.slug}@${c.version} | ${c.cases.length} | ${cc.rejected} rejected · ${cc.leaked} leaked · ${cc.absorbed} absorbed |`;
  }).join("\n");
  return `# Helm's footgun profile — when does a bad \`--set\` get caught?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-bad-decisions-comparison.mjs\`; do not hand-edit. Regenerate with \`npm run bad-decisions:comparison\`.

**Claim.** ${s.claim}

> **This page measures HELM, not cub.** Whether *our* tool does better with the same kind of
> input is measured separately — see the **[cub-installer fuzz](../cub-installer-fuzz/summary.md)**,
> where an unknown input is a hard error (the footgun Helm absorbs) and cub's own rough edges
> are surfaced. We test our own tool rather than score points off Helm's.

The [careless-dev fuzz](../bad-decisions-fuzz/summary.md) showed Helm's *outcomes*. This runs the **same ${s.cases} decisions** (${s.decisions} types × ${s.chartsCompared} charts, one corpus in \`scripts/lib/bad-decisions.mjs\`) and asks **when Helm surfaces each** — before the cluster, only at the live API, or never.

| When does Helm surface the bad decision? | Raw Helm (\`--set\` → install / Argo-helm) |
| --- | --- |
| **Before the cluster** (at render) | render-rejected only — **${t.helmBeforeCluster} (${pct(t.helmBeforeCluster, s.cases)})** |
| **Only at the live k8s API** (at apply) | leaked — **${t.helmAtApiOnly} (${pct(t.helmAtApiOnly, s.cases)})** |
| **Never** — silent success | absorbed — **${t.helmNever} (${pct(t.helmNever, s.cases)})** |

Overall: **${s.result}** (${s.unclassified} unclassified). **Headline:** for these ${s.cases} careless decisions, raw Helm catches only **${pct(t.helmBeforeCluster, s.cases)}** before the cluster — the rest reach the live k8s API (${pct(t.helmAtApiOnly, s.cases)}) or vanish silently (${pct(t.helmNever, s.cases)}).

## On the config-as-data claim (honest)

It is tempting to say "config-as-data surfaces all of these at review." That is a **model property, not a measurement** — an earlier draft of this page overstated it as a cub result. cub renders with the same engine, so the rejected/leaked/absorbed split (${h.rejected}/${h.leaked}/${h.absorbed}) is identical to Helm's. The *measured* difference is in the [cub-installer fuzz](../cub-installer-fuzz/summary.md): cub's inputs are declared, so the unknown-key footgun is a hard error — and cub has its own rough edges (it does not validate namespace format or length). Measured, not asserted.

## Per chart

| Chart | Cases | Helm outcome |
| --- | --- | --- |
${chartRows}

- Receipt: \`runs/bad-decisions-comparison/receipt.yaml\`. Corpus: \`scripts/lib/bad-decisions.mjs\` (shared with the fuzz).
`;
}

function summaryHtml(r) {
  const s = r.spec; const t = s.timing;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : v === "watch" ? "warn" : "bad"}">${v}</span>`;
  const bar = (n, cls) => { const w = s.cases ? Math.round((n / s.cases) * 100) : 0; return `<div class="barwrap"><div class="bar ${cls}" style="width:${w}%"></div><span>${n} (${w}%)</span></div>`; };
  const rows = s.charts.map((c) => {
    if (c.status !== "compared") return `<tr><td>${c.slug}</td><td class="muted">${c.status}</td></tr>`;
    const cc = { rejected: 0, leaked: 0, absorbed: 0 }; for (const x of c.cases) cc[x.helm] += 1;
    return `<tr><td>${c.slug}<span class="muted"> @${c.version}</span></td><td><span class="chip ok">${cc.rejected} rejected</span> <span class="chip warn">${cc.leaked} leaked</span> <span class="chip gray">${cc.absorbed} absorbed</span></td></tr>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Helm's footgun profile — when does a bad --set get caught?</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:920px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}h2{font-size:1.05rem;margin:1.6rem 0 .5rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;vertical-align:top}th{background:#f6f8fa;font-size:.76rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.gray{background:#f1eff0;color:#57606a}
  .barwrap{position:relative;background:#eef1f4;border-radius:5px;height:22px;margin:4px 0}.bar{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.bar.before{background:#9fd0a6}.bar.api{background:#f3d281}.bar.never{background:#e8a0a0}.bar.review{background:#9fd0a6}.barwrap span{position:relative;font-size:.78rem;padding:0 8px;line-height:22px}
  .muted{color:#8c959f}.cols{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.col h3{font-size:.95rem;margin:.4rem 0}footer{margin-top:2rem;color:#57606a;font-size:.85rem}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}
</style></head>
<body><main>
  <h1>Helm's footgun profile — when does a bad <code>--set</code> get caught?</h1>
  <p class="sub">${s.cases} random bad decisions · ${s.decisions} types × ${s.chartsCompared} charts · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-bad-decisions-comparison.mjs</code>; do not hand-edit. This measures <b>Helm</b>, not cub — our tool is measured in the <a href="../cub-installer-fuzz/by-case.html">cub-installer fuzz</a>.</div>
  <div class="claim">${s.claim}</div>
  <h2>When does Helm surface the bad decision? · overall ${chip(s.result)}</h2>
  <table><tbody>
  <tr><td>before the cluster (at render)</td><td>${bar(t.helmBeforeCluster, "before")}</td></tr>
  <tr><td>only at the live k8s API (at apply)</td><td>${bar(t.helmAtApiOnly, "api")}</td></tr>
  <tr><td>never — silent success</td><td>${bar(t.helmNever, "never")}</td></tr>
  </tbody></table>
  <p style="margin-top:1rem">Whether <b>cub installer</b> does better with the same kind of input is measured — not asserted — in the <a href="../cub-installer-fuzz/by-case.html">cub-installer fuzz</a>: an unknown input is a hard error (the footgun Helm absorbs), with cub's own rough edges surfaced honestly.</p>
  <h2>Per chart (Helm outcomes)</h2>
  <table><thead><tr><th>Chart</th><th>Helm outcome</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>cub renders with the same engine, so the rejected/leaked/absorbed split is identical to Helm's — "config-as-data surfaces it at review" is a model property, not a measurement. The measured cub test is the cub-installer fuzz. We test our own tool rather than score points off Helm's.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runComparison();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  const t = r.spec.timing;
  console.log(`wrote Helm footgun profile -> ${relativeRepo(receiptPath)} result=${r.spec.result} (Helm before-cluster ${t.helmBeforeCluster}/${r.spec.cases})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run bad-decisions:comparison`);
  const r = readYaml(receiptPath);
  check(r.kind === "BadDecisionsComparisonReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(typeof r.spec?.cases === "number" && r.spec.cases > 0, "receipt has no cases");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run bad-decisions:comparison`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run bad-decisions:comparison`);
  console.log(`verified Helm footgun profile: ${r.spec.cases} cases, result=${r.spec.result}`);
} else if (mode === "--regenerate") {
  // rebuild summary/html from the existing receipt — no re-pull/re-render (same 180 decisions);
  // useful when only the presentation changed.
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run bad-decisions:comparison`);
  const r = readYaml(receiptPath);
  // migrate the receipt to the current schema: refresh the claim + drop legacy per-case cub fields
  r.spec.claim = CLAIM;
  for (const c of r.spec.charts || []) for (const x of c.cases || []) { delete x.cub; delete x.cubWhen; }
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`regenerated Helm footgun profile from existing receipt (${r.spec.cases} cases)`);
} else {
  console.log("Usage:\n  node scripts/run-bad-decisions-comparison.mjs --run\n  node scripts/run-bad-decisions-comparison.mjs --verify\n  node scripts/run-bad-decisions-comparison.mjs --regenerate");
}
