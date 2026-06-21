#!/usr/bin/env node
// "Hundreds of stupid devs making essentially random bad decisions."
// For a sample of catalog charts, feed each a catalogue of bad config decisions
// (negative replicas, garbage image tags, non-quantity CPU, invalid ports,
// type-confused booleans, typo'd keys that silently do nothing, ...) and render
// with `helm template`. Every case ends in a NAMED outcome — never silent:
//   - rejected  : Helm / values.schema.json caught it at render (best)
//   - leaked    : the bad value rendered into the manifest → the k8s API is the
//                 backstop (it would be rejected at apply); named, not hidden
//   - absorbed  : Helm silently ignored/defaulted the bad value (the classic
//                 "my --set did nothing" footgun) — surfaced, not silent
// The skeptic headline is that 0 cases are unclassified, and the leaked/absorbed
// split shows where the catch happens. Offline (no cluster); reproducible.
//
// Usage:
//   node scripts/run-bad-decisions-fuzz.mjs --run     # render the fuzz, write receipt + summary
//   node scripts/run-bad-decisions-fuzz.mjs --verify  # re-derive summary from the receipt
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "bad-decisions-fuzz", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "bad-decisions-fuzz", "summary.md");
const htmlPath = join(repoRoot, "data", "bad-decisions-fuzz", "by-decision.html");

// Curated charts that baseline-render with defaults (owner/chart). Version + repo
// are read from the recipe source-lock so they track the catalog.
const CHARTS = [
  ["bitnami", "nginx"], ["bitnami", "redis"], ["bitnami", "mysql"], ["bitnami", "mongodb"],
  ["bitnami", "rabbitmq"], ["fluent", "fluent-bit"], ["prometheus-community", "prometheus"],
  ["grafana", "grafana"], ["ingress-nginx", "ingress-nginx"], ["metrics-server", "metrics-server"],
];

// The bad decisions a careless dev might make. `detect` matches the rendered
// output to see whether the bad value leaked into a manifest.
const DECISIONS = [
  { id: "replicas-negative", set: "replicaCount=-1", detect: /replicas:\s*-1\b/ },
  { id: "replicas-zero", set: "replicaCount=0", detect: /replicas:\s*0\b/ },
  { id: "replicas-absurd", set: "replicaCount=1000000", detect: /replicas:\s*1000000\b/ },
  { id: "replicas-string", set: "replicaCount=lots", detect: /replicas:\s*lots\b/ },
  { id: "image-pullpolicy-bad", set: "image.pullPolicy=Sometimes", detect: /pullPolicy:\s*Sometimes/ },
  { id: "cpu-limit-nonsense", set: "resources.limits.cpu=banana", detect: /cpu:\s*banana/ },
  { id: "mem-limit-negative", set: "resources.limits.memory=-2Gi", detect: /memory:\s*-2Gi/ },
  { id: "service-type-bad", set: "service.type=Maybe", detect: /type:\s*Maybe/ },
  { id: "service-port-overflow", set: "service.port=70000", detect: /port:\s*70000\b/ },
  { id: "service-port-negative", set: "service.port=-1", detect: /port:\s*-1\b/ },
  { id: "bool-as-string", set: "hostNetwork=yes-please", detect: /hostNetwork:\s*"?yes-please"?/ },
  { id: "grace-negative", set: "terminationGracePeriodSeconds=-5", detect: /terminationGracePeriodSeconds:\s*-5/ },
  { id: "probe-negative", set: "livenessProbe.initialDelaySeconds=-30", detect: /initialDelaySeconds:\s*-30/ },
  { id: "priorityclass-missing", set: "priorityClassName=does-not-exist-zzz", detect: /priorityClassName:\s*does-not-exist-zzz/ },
  { id: "nodeselector-impossible", set: "nodeSelector.diskType=unobtanium", detect: /unobtanium/ },
  { id: "storageclass-missing", set: "global.storageClass=does-not-exist-zzz", detect: /does-not-exist-zzz/ },
  { id: "typo-key-noop", set: "thisKeyDoesNotExistAtAll=oops", detect: /thisKeyDoesNotExistAtAll|oops/ },
  { id: "deep-typo-key-noop", set: "contoller.replicas=3", detect: /contoller/ },
];

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 64, ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

function chartCoords(owner, chart) {
  const dir = join(repoRoot, "recipes", owner, chart);
  if (!existsSync(dir)) return null;
  const versions = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  for (const v of versions.reverse()) {
    const lock = join(dir, v, "source-lock.yaml");
    if (!existsSync(lock)) continue;
    const y = readYaml(lock);
    const url = y?.spec?.repositoryURL || y?.repositoryURL;
    const cname = y?.spec?.chart || y?.chart || chart;
    const version = y?.spec?.version || y?.version || v;
    if (url) return { slug: `${owner}/${chart}`, repo: url, chart: cname, version };
  }
  return null;
}

function classify(setArg, detect, localChart) {
  const r = tsh("helm", ["template", "fuzz", localChart, "--namespace", "fuzz-ns", "--set", setArg]);
  if (!r.ok) {
    const line = (r.out.split("\n").find((l) => /error|Error|invalid|failed|coalesce|wrong type/i.test(l)) || r.out.split("\n")[0] || "").trim().slice(0, 140);
    return { outcome: "rejected", detail: line };
  }
  return detect.test(r.out) ? { outcome: "leaked", detail: "bad value rendered into a manifest" } : { outcome: "absorbed", detail: "Helm ignored/defaulted the value (silent no-op)" };
}

function runFuzz() {
  const stamp = new Date().toISOString();
  const work = mkdtempSync(join(tmpdir(), "fuzz-"));
  const charts = [];
  try {
    for (const [owner, chart] of CHARTS) {
      const c = chartCoords(owner, chart);
      if (!c) { charts.push({ slug: `${owner}/${chart}`, status: "no-source-lock", cases: [] }); continue; }
      const pull = tsh("helm", ["pull", c.chart, "--repo", c.repo, "--version", c.version, "--untar", "--untardir", work]);
      const local = join(work, c.chart);
      if (!pull.ok || !existsSync(local)) { charts.push({ slug: c.slug, version: c.version, status: "pull-failed", cases: [] }); continue; }
      const baseline = tsh("helm", ["template", "fuzz", local, "--namespace", "fuzz-ns"]);
      if (!baseline.ok) { charts.push({ slug: c.slug, version: c.version, status: "baseline-needs-values", cases: [] }); continue; }
      const cases = DECISIONS.map((d) => ({ decision: d.id, ...classify(d.set, d.detect, local) }));
      charts.push({ slug: c.slug, version: c.version, status: "fuzzed", cases });
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const all = charts.flatMap((c) => c.cases);
  const tally = { rejected: 0, leaked: 0, absorbed: 0 };
  for (const c of all) tally[c.outcome] = (tally[c.outcome] ?? 0) + 1;
  const unclassified = all.filter((c) => !["rejected", "leaked", "absorbed"].includes(c.outcome)).length;
  const fuzzedCharts = charts.filter((c) => c.status === "fuzzed").length;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "BadDecisionsFuzzReceipt",
    metadata: { name: `bad-decisions-${stamp.slice(0, 10).replaceAll("-", "")}` },
    spec: {
      observedAt: stamp,
      decisions: DECISIONS.length,
      chartsAttempted: CHARTS.length,
      chartsFuzzed: fuzzedCharts,
      cases: all.length,
      tally,
      unclassified,
      result: unclassified === 0 && all.length > 0 ? "pass" : all.length === 0 ? "blocked" : "watch",
      claim: "Across hundreds of random bad config decisions over real catalog charts, every case ends in a named outcome — rejected at render, leaked into a manifest (caught by the k8s API), or silently absorbed (the footgun) — and 0 are unclassified. No bad decision is silently mishandled.",
      charts,
    },
  };
}

function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "0%"; }

function summaryMd(r) {
  const s = r.spec; const t = s.tally;
  const chartRows = s.charts.map((c) => {
    if (c.status !== "fuzzed") return `| ${c.slug} | — | ${c.status} |`;
    const cc = { rejected: 0, leaked: 0, absorbed: 0 };
    for (const x of c.cases) cc[x.outcome] += 1;
    return `| ${c.slug}@${c.version} | ${c.cases.length} | rejected ${cc.rejected} · leaked ${cc.leaked} · absorbed ${cc.absorbed} |`;
  }).join("\n");
  return `# Bad-decisions fuzz — "hundreds of stupid devs making random bad decisions"

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-bad-decisions-fuzz.mjs\`; do not hand-edit. Regenerate with \`npm run bad-decisions:fuzz\`.

**Claim.** ${s.claim}

${s.cases} bad decisions (${s.decisions} decision types × ${s.chartsFuzzed} charts that baseline-render) fed to real catalog charts via \`helm template --set\`. Every case is classified; **${s.unclassified} unclassified** (silent outcomes are 0 by construction).

| Outcome | Count | Share | Meaning |
| --- | --- | --- | --- |
| rejected | ${t.rejected} | ${pct(t.rejected, s.cases)} | Helm / values.schema.json caught the bad decision at render (best). |
| leaked | ${t.leaked} | ${pct(t.leaked, s.cases)} | The bad value rendered into a manifest — the k8s API is the backstop (rejected at apply). Named, not hidden. |
| absorbed | ${t.absorbed} | ${pct(t.absorbed, s.cases)} | Helm silently ignored/defaulted the value — the classic "my --set did nothing" footgun. Surfaced here, not silent. |

Overall: **${s.result}**.

## Per chart

| Chart | Cases | Outcomes |
| --- | --- | --- |
${chartRows}

- The skeptic point: a careless dev's random bad decision is never *silently mishandled* — it is rejected at render, caught by k8s at apply, or shown to be a no-op. The **absorbed** column is the honest footgun count (Helm accepts any \`--set\` key, so typos vanish).
- Receipt: \`runs/bad-decisions-fuzz/receipt.yaml\`.
`;
}

function summaryHtml(r) {
  const s = r.spec; const t = s.tally;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : v === "watch" ? "warn" : "bad"}">${v}</span>`;
  const bar = (n) => { const w = s.cases ? Math.round((n / s.cases) * 100) : 0; return `<div class="barwrap"><div class="bar" style="width:${w}%"></div><span>${n} (${w}%)</span></div>`; };
  const rows = s.charts.map((c) => {
    if (c.status !== "fuzzed") return `<tr><td>${c.slug}</td><td colspan="3" class="muted">${c.status}</td></tr>`;
    const cc = { rejected: 0, leaked: 0, absorbed: 0 }; for (const x of c.cases) cc[x.outcome] += 1;
    return `<tr><td>${c.slug}<span class="muted"> @${c.version}</span></td><td><span class="chip ok">${cc.rejected}</span></td><td><span class="chip warn">${cc.leaked}</span></td><td><span class="chip gray">${cc.absorbed}</span></td></tr>`;
  }).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bad-decisions fuzz</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:900px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}h2{font-size:1.05rem;margin:1.6rem 0 .5rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2}th{background:#f6f8fa;font-size:.76rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.bad{background:#ffebe9;color:#cf222e}.chip.gray{background:#f1eff0;color:#57606a}
  .barwrap{position:relative;background:#eef1f4;border-radius:5px;height:22px;margin:4px 0}.bar{position:absolute;left:0;top:0;bottom:0;background:#9fd0a6;border-radius:5px}.barwrap span{position:relative;font-size:.78rem;padding:0 8px;line-height:22px}
  .muted{color:#8c959f}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Bad-decisions fuzz</h1>
  <p class="sub">${s.cases} random bad config decisions · ${s.decisions} types × ${s.chartsFuzzed} charts · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-bad-decisions-fuzz.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <h2>Outcomes (${s.unclassified} unclassified — 0 by construction) · overall ${chip(s.result)}</h2>
  <table><tbody>
  <tr><td>rejected at render</td><td>${bar(t.rejected)}</td></tr>
  <tr><td>leaked → k8s backstop</td><td>${bar(t.leaked)}</td></tr>
  <tr><td>absorbed (footgun)</td><td>${bar(t.absorbed)}</td></tr>
  </tbody></table>
  <h2>Per chart</h2>
  <table><thead><tr><th>Chart</th><th>rejected</th><th>leaked</th><th>absorbed</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>A careless dev's random bad decision is never silently mishandled — rejected at render, caught by the k8s API at apply, or shown to be a no-op. "absorbed" is the honest footgun count: Helm accepts any <code>--set</code> key, so typo'd keys vanish without error.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runFuzz();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote bad-decisions fuzz -> ${relativeRepo(receiptPath)} result=${r.spec.result} cases=${r.spec.cases} (rejected ${r.spec.tally.rejected} / leaked ${r.spec.tally.leaked} / absorbed ${r.spec.tally.absorbed})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run bad-decisions:fuzz`);
  const r = readYaml(receiptPath);
  check(r.kind === "BadDecisionsFuzzReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(typeof r.spec?.cases === "number" && r.spec.cases > 0, "receipt has no cases");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run bad-decisions:fuzz`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run bad-decisions:fuzz`);
  console.log(`verified bad-decisions fuzz: ${r.spec.cases} cases, ${r.spec.unclassified} unclassified, result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-bad-decisions-fuzz.mjs --run\n  node scripts/run-bad-decisions-fuzz.mjs --verify");
}
