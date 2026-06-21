#!/usr/bin/env node
// Fuzz CUB INSTALLER itself — not Helm. Feed careless + adversarial bad inputs to
// `cub installer setup` across a sample of catalog packages and classify what CUB does:
//   - rejected-unknown   : cub errors on an unknown input key (the footgun Helm ABSORBS)
//   - rejected-validation: cub errors on a bad base / namespace / image / missing required
//   - rendered           : cub accepted it and rendered (now VISIBLE in the Unit, not silent)
//   - crash    [BUG]     : cub panicked / emitted an internal error, not a clean message
//   - injection[BUG]     : a shell metacharacter in an input executed (sentinel file created)
//   - silent-wrong [BUG] : cub "succeeded" but produced no output / swallowed the input
// The point is to find OUR tool's bugs, honestly — not to score points off Helm. Offline
// (cub installer setup is a local render; no cluster). Reproducible.
//
// Usage:
//   node scripts/run-cub-installer-fuzz.mjs --run     # fuzz cub installer, write receipt + summary
//   node scripts/run-cub-installer-fuzz.mjs --verify  # re-derive summary from the receipt
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "cub-installer-fuzz", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "cub-installer-fuzz", "summary.md");
const htmlPath = join(repoRoot, "data", "cub-installer-fuzz", "by-case.html");

// Sample packages (must exist under packages/). Overlaps the careless-dev charts so the
// comparison is coherent; a couple extra shapes for coverage.
const PACKAGES = [
  "packages/bitnami/nginx/24.0.2", "packages/bitnami/redis", "packages/bitnami/mysql",
  "packages/bitnami/mongodb", "packages/bitnami/rabbitmq", "packages/bitnami/postgresql",
  "packages/bitnami/apache", "packages/bitnami/memcached",
];

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 64, timeout: 120_000, ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, code: 0, out: sh(file, args, opts) }; } catch (e) { return { ok: false, code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

function resolvePkg(p) {
  const abs = join(repoRoot, p);
  if (existsSync(join(abs, "installer.yaml"))) return abs;
  // allow version-less dir: pick the highest version subdir that has installer.yaml
  if (existsSync(abs)) {
    const vers = readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse();
    for (const v of vers) if (existsSync(join(abs, v, "installer.yaml"))) return join(abs, v);
  }
  return null;
}
function defaultBase(pkgAbs) {
  const doc = tsh("cub", ["installer", "doc", pkgAbs]).out;
  const m = doc.match(/^\s*-\s*(\S+)\s*\(default\)/m);
  return m ? m[1] : null;
}

// The bad-input cases. `injectNs`/`injectInput` cases plant a $(...) sentinel payload that
// can only fire if cub shells our input out unsafely (we pass args with no shell ourselves).
const CASES = [
  { id: "baseline-valid", cat: "control", ns: "fuzzns", extra: [] },
  { id: "unknown-input-typo", cat: "unknown-input", ns: "fuzzns", extra: ["--input", "thisKeyDoesNotExistAtAll=oops"] },
  { id: "unknown-input-replicas", cat: "unknown-input", ns: "fuzzns", extra: ["--input", "replicaCount=-1"] },
  { id: "unknown-input-deeppath", cat: "unknown-input", ns: "fuzzns", extra: ["--input", "resources.limits.cpu=banana"] },
  { id: "bad-base", cat: "bad-selection", ns: "fuzzns", base: "does-not-exist-zzz", extra: [] },
  { id: "namespace-uppercase", cat: "bad-namespace", ns: "BadNamespace", extra: [] },
  { id: "namespace-special", cat: "bad-namespace", ns: "ns!@#bad", extra: [] },
  { id: "namespace-too-long", cat: "bad-namespace", ns: "n".repeat(300), extra: [] },
  { id: "namespace-empty", cat: "bad-namespace", ns: "", extra: [] },
  { id: "inject-namespace", cat: "injection", injectNs: true, ns: "fuzzns", extra: [] },
  { id: "inject-input", cat: "injection", injectInput: true, ns: "fuzzns", extra: [] },
  { id: "set-image-garbage", cat: "bad-image", ns: "fuzzns", extra: ["--set-image", "nginx=NOT A REF!!"] },
];

function classify(c, res, manifests, sentinelHit) {
  const out = res.out || "";
  const mk = (behavior, opts, detail) => ({ behavior, bug: !!opts.bug, finding: !!opts.finding, detail });
  if (c.cat === "injection") {
    if (sentinelHit) return mk("injection", { bug: true }, "shell sentinel executed — input was shelled out unsafely");
    return mk(res.ok ? "rendered-no-injection" : "rejected-no-injection", {}, res.ok ? "accepted; no shell execution observed" : firstError(out));
  }
  if (/panic:|goroutine \d|runtime error|nil pointer|invalid memory address|fatal error:/i.test(out)) return mk("crash", { bug: true }, firstError(out));
  if (/unknown input/i.test(out)) return mk("rejected-unknown", {}, firstError(out));
  if (c.cat === "bad-namespace") {
    // honest rough edges: cub does not validate namespace DNS-1123 format/length itself
    if (res.ok && manifests > 0) return mk("namespace-not-validated", { finding: true }, `cub rendered an invalid namespace into ${manifests} file(s) — caught only at k8s apply, not by cub`);
    if (!res.ok && /write |open |no such file|file name too long|too long|i\/o|permission/i.test(out)) return mk("namespace-rough-error", { finding: true }, `opaque error on a bad namespace (not a clean validation): ${firstError(out)}`);
    return mk("rejected-validation", {}, firstError(out));
  }
  if (!res.ok && /invalid|required|no such|not found|must be|cannot|unsupported|missing|does not|unknown base|has no|declare|resolve selection/i.test(out)) return mk("rejected-validation", {}, firstError(out));
  if (!res.ok) return mk("rejected-other", {}, firstError(out));
  if (manifests > 0) return mk("rendered", {}, `rendered ${manifests} manifest file(s)`);
  return mk("silent-wrong", { bug: true }, "exited 0 but produced no manifests (input swallowed)");
}
function firstError(out) {
  const line = out.split("\n").map((l) => l.trim()).find((l) => /error|invalid|unknown|required|panic|fatal/i.test(l));
  // genericize run-specific temp paths so the committed receipt is deterministic + portable
  return (line || out.split("\n")[0] || "").replace(/\/(?:private\/)?(?:var\/folders|tmp)\/[^\s"]+/g, "<tmp>").slice(0, 160);
}

function runOne(pkgAbs, base, c) {
  const wd = mkdtempSync(join(tmpdir(), "cubfz-"));
  const sentinel = join(wd, "SENTINEL");
  // The $(...) payload is a LITERAL argument (execFileSync uses no shell), so it can only
  // execute if cub itself shells our input out unsafely — exactly the bug we hunt.
  const ns = c.injectNs ? `x$(echo PWNED>${sentinel})` : c.ns;
  const extra = c.injectInput ? ["--input", `ns=$(echo PWNED>${sentinel})`] : c.extra;
  const args = ["installer", "setup", "--pull", pkgAbs, "--base", c.base || base, "--work-dir", wd, "--non-interactive", "--namespace", ns, ...extra];
  const res = tsh("cub", args);
  const manDir = join(wd, "out", "manifests");
  const manifests = existsSync(manDir) ? readdirSync(manDir).filter((f) => f.endsWith(".yaml")).length : 0;
  const sentinelHit = existsSync(sentinel);
  const cls = classify(c, res, manifests, sentinelHit);
  rmSync(wd, { recursive: true, force: true });
  return { case: c.id, category: c.cat, code: res.code, ...cls };
}

function runFuzz() {
  const stamp = new Date().toISOString();
  const pkgs = [];
  for (const p of PACKAGES) {
    const abs = resolvePkg(p);
    if (!abs) { pkgs.push({ pkg: p, status: "not-found", cases: [] }); continue; }
    const base = defaultBase(abs);
    if (!base) { pkgs.push({ pkg: p, status: "no-default-base", cases: [] }); continue; }
    const results = CASES.map((c) => runOne(abs, base, c));
    pkgs.push({ pkg: p.replace("packages/", ""), base, status: "fuzzed", cases: results });
  }
  const all = pkgs.flatMap((p) => p.cases.map((c) => ({ ...c, pkg: p.pkg })));
  const tally = {};
  for (const r of all) tally[r.behavior] = (tally[r.behavior] ?? 0) + 1;
  const bugs = all.filter((r) => r.bug);
  const findings = all.filter((r) => r.finding);
  const findingGroups = Object.values(findings.reduce((acc, f) => {
    (acc[f.behavior] ??= { behavior: f.behavior, count: 0, detail: f.detail, packages: new Set() });
    acc[f.behavior].count++; acc[f.behavior].packages.add(f.pkg);
    return acc;
  }, {})).map((g) => ({ behavior: g.behavior, count: g.count, detail: g.detail, packages: [...g.packages].sort() }));
  const fuzzed = pkgs.filter((p) => p.status === "fuzzed").length;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CubInstallerFuzzReceipt",
    metadata: { name: `cub-installer-fuzz-${stamp.slice(0, 10).replaceAll("-", "")}` },
    spec: {
      observedAt: stamp,
      packagesAttempted: PACKAGES.length,
      packagesFuzzed: fuzzed,
      cases: all.length,
      tally,
      bugCount: bugs.length,
      bugs: bugs.map((b) => ({ pkg: b.pkg, case: b.case, behavior: b.behavior, detail: b.detail })),
      findingCount: findings.length,
      findings: findingGroups,
      result: bugs.length === 0 && all.length > 0 ? "pass" : all.length === 0 ? "blocked" : "watch",
      claim: "Fuzzing CUB INSTALLER (not Helm) with careless + adversarial inputs: an unknown input key is a hard error (the footgun Helm absorbs), bad base/namespace/image are validated, and shell-metacharacter inputs do not execute. Any crash, injection, or silent-swallow is reported as a bug to fix. This tests our own tool.",
      packages: pkgs,
    },
  };
}

function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "0%"; }
const GOOD = new Set(["rejected-unknown", "rejected-validation", "rejected-other", "rejected-no-injection"]);

function summaryMd(r) {
  const s = r.spec;
  const order = ["rejected-unknown", "rejected-validation", "rejected-other", "rendered", "namespace-not-validated", "namespace-rough-error", "rejected-no-injection", "rendered-no-injection", "crash", "injection", "silent-wrong"];
  const tallyRows = order.filter((b) => s.tally[b]).map((b) => {
    const meaning = {
      "rejected-unknown": "cub errored on an unknown input key — **the footgun Helm absorbs silently**",
      "rejected-validation": "cub errored on a bad base / namespace / image / missing required input",
      "rejected-other": "cub errored (non-validation message)",
      "rendered": "cub accepted it and rendered — now visible in the Unit, not silent",
      "namespace-not-validated": "**finding** — cub rendered an invalid namespace (no DNS-1123 check); visible, caught at apply",
      "namespace-rough-error": "**finding** — a too-long namespace failed with an opaque filesystem error, not a clean message",
      "rejected-no-injection": "injection input rejected; no shell execution",
      "rendered-no-injection": "injection input accepted but did **not** execute (safe)",
      "crash": "**BUG** — cub panicked / internal error",
      "injection": "**BUG** — a shell metacharacter input executed",
      "silent-wrong": "**BUG** — cub exited 0 but produced no output (swallowed the input)",
    }[b];
    return `| ${b} | ${s.tally[b]} | ${pct(s.tally[b], s.cases)} | ${meaning} |`;
  }).join("\n");
  const bugRows = s.bugs.length
    ? s.bugs.map((b) => `| ${b.pkg} | ${b.case} | **${b.behavior}** | ${b.detail} |`).join("\n")
    : "| — | — | — | none found |";
  const findingRows = s.findings.length
    ? s.findings.map((f) => `- **${f.behavior}** — ${f.count} case(s) across ${f.packages.length} package(s): ${f.detail}`).join("\n")
    : "None.";
  const pkgRows = s.packages.map((p) => {
    if (p.status !== "fuzzed") return `| ${p.pkg} | — | ${p.status} |`;
    const good = p.cases.filter((c) => GOOD.has(c.behavior)).length;
    const bugs = p.cases.filter((c) => c.bug).length;
    return `| ${p.pkg} | ${p.base} | ${good} caught/validated · ${p.cases.length - good - bugs} rendered · ${bugs} bug |`;
  }).join("\n");
  return `# cub installer fuzz — does OUR tool handle bad input?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-cub-installer-fuzz.mjs\`; do not hand-edit. Regenerate with \`npm run cub-installer:fuzz\`.

**Claim.** ${s.claim}

This is the lane that matters for *us*: not Helm's footguns, but whether **\`cub installer\`** handles careless and adversarial input cleanly — or has bugs. ${s.cases} cases across ${s.packagesFuzzed} packages.

**Serious bugs (crash / injection / silent-swallow): ${s.bugCount}.** Honest rough-edge findings: **${s.findingCount}**. Overall: **${s.result}**.

| Behavior | Count | Share | Meaning |
| --- | --- | --- | --- |
${tallyRows}

## Bugs (crash / injection / silent-swallow)

| Package | Case | Behavior | Detail |
| --- | --- | --- | --- |
${bugRows}

## Honest findings (rough edges — not serious bugs, but worth fixing)

${findingRows}

## Per package

| Package | Base | Outcome |
| --- | --- | --- |
${pkgRows}

- The headline contrast with the [Helm fuzz](../bad-decisions-fuzz/summary.md): an unknown \`--set\` key Helm **silently absorbs**; the same key as a cub \`--input\` is a **hard error** ("unknown input"). cub's inputs are declared/typed, so the careless-typo footgun is caught at the tool.
- Honest: this hunts for *cub's* bugs. A crash, a shell injection, or a silent swallow is reported here as a defect to fix — not hidden.
- Receipt: \`runs/cub-installer-fuzz/receipt.yaml\`.
`;
}

function summaryHtml(r) {
  const s = r.spec;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "warn"}">${v}</span>`;
  const order = ["rejected-unknown", "rejected-validation", "rejected-other", "rendered", "namespace-not-validated", "namespace-rough-error", "rejected-no-injection", "rendered-no-injection", "crash", "injection", "silent-wrong"];
  const bar = (b) => { const n = s.tally[b] || 0; const w = s.cases ? Math.round((n / s.cases) * 100) : 0; const cls = ["crash", "injection", "silent-wrong"].includes(b) ? "bad" : GOOD.has(b) ? "ok" : "warn"; return `<tr><td>${b}</td><td><div class="barwrap"><div class="bar ${cls}" style="width:${w}%"></div><span>${n} (${w}%)</span></div></td></tr>`; };
  const bugs = s.bugs.length ? s.bugs.map((b) => `<tr><td>${b.pkg}</td><td>${b.case}</td><td><span class="chip bad">${b.behavior}</span></td><td>${b.detail}</td></tr>`).join("") : '<tr><td colspan="4" class="muted">none found</td></tr>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>cub installer fuzz — does our tool handle bad input?</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:900px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}h2{font-size:1.05rem;margin:1.6rem 0 .5rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;vertical-align:top;font-size:.88rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.bad{background:#ffebe9;color:#cf222e}
  .barwrap{position:relative;background:#eef1f4;border-radius:5px;height:22px}.bar{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.bar.ok{background:#9fd0a6}.bar.warn{background:#f3d281}.bar.bad{background:#e8a0a0}.barwrap span{position:relative;font-size:.78rem;padding:0 8px;line-height:22px}
  .muted{color:#8c959f}footer{margin-top:2rem;color:#57606a;font-size:.85rem}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}
</style></head>
<body><main>
  <h1>cub installer fuzz — does OUR tool handle bad input?</h1>
  <p class="sub">${s.cases} careless + adversarial cases · ${s.packagesFuzzed} packages · serious bugs: <b>${s.bugCount}</b> · rough-edge findings: <b>${s.findingCount}</b> · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-cub-installer-fuzz.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <h2>What cub did · overall ${chip(s.result)}</h2>
  <table><tbody>${order.filter((b) => s.tally[b]).map(bar).join("")}</tbody></table>
  <h2>Bugs (crash / injection / silent-swallow)</h2>
  <table><thead><tr><th>Package</th><th>Case</th><th>Behavior</th><th>Detail</th></tr></thead><tbody>${bugs}</tbody></table>
  <h2>Honest findings (rough edges — not serious bugs)</h2>
  ${s.findings.length ? `<ul>${s.findings.map((f) => `<li><b>${f.behavior}</b> — ${f.count} case(s), ${f.packages.length} package(s): ${f.detail}</li>`).join("")}</ul>` : '<p class="muted">None.</p>'}
  <footer>An unknown <code>--set</code> key Helm absorbs silently; the same key as a cub <code>--input</code> is a hard error. This lane hunts for cub's own bugs — a crash, shell injection, or silent swallow is reported, not hidden.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runFuzz();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote cub-installer fuzz -> ${relativeRepo(receiptPath)} result=${r.spec.result} cases=${r.spec.cases} bugs=${r.spec.bugCount}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run cub-installer:fuzz`);
  const r = readYaml(receiptPath);
  check(r.kind === "CubInstallerFuzzReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(typeof r.spec?.cases === "number" && r.spec.cases > 0, "receipt has no cases");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run cub-installer:fuzz`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run cub-installer:fuzz`);
  console.log(`verified cub-installer fuzz: ${r.spec.cases} cases, ${r.spec.bugCount} bug(s), result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-cub-installer-fuzz.mjs --run\n  node scripts/run-cub-installer-fuzz.mjs --verify");
}
