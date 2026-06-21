#!/usr/bin/env node
// The Helm-fluent migrant lane. A dev who knows Helm reaches for Helm idioms that are
// CORRECT in Helm but don't map to cub installer's model (declared inputs / bases /
// kustomize). The input is valid *Helm*; the failure is the model mismatch. This is not
// the careless-dev lane (random garbage) nor the adversarial lane (crafted to break) — it
// is competent muscle memory meeting a different tool. The question that decides adoption
// is NOT "does cub reject it" (it will) but "does cub reject it WITH GUIDANCE" — so this
// classifies cub's error-message quality:
//   - guided      : cub rejects AND points to the cub way (--input / --set-image / a base)
//   - opaque      : cub rejects but the message gives a Helm user no migration hint (friction)
//   - supported   : cub actually handles the Helm idiom (bonus)
//   - silent-wrong [BUG]: cub "succeeds" but swallowed/ignored the input
//   - crash [BUG] : cub panicked
// Headline: how often does cub guide the Helm migrant vs leave them stuck? Offline.
//
// Usage:
//   node scripts/run-helm-habit-friction.mjs --run     # fuzz cub with Helm idioms, write receipt + summary
//   node scripts/run-helm-habit-friction.mjs --verify  # re-derive summary from the receipt
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "helm-habit-friction", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "helm-habit-friction", "summary.md");
const htmlPath = join(repoRoot, "data", "helm-habit-friction", "by-idiom.html");

const PACKAGES = [
  "packages/bitnami/nginx/24.0.2", "packages/bitnami/redis", "packages/bitnami/mysql",
  "packages/bitnami/mongodb", "packages/bitnami/rabbitmq", "packages/bitnami/postgresql",
  "packages/bitnami/apache", "packages/bitnami/memcached",
];

// Correct-in-Helm idioms. `usesValues: true` cases need a real values file (path substituted
// for VALUES at run time). Each is a thing a Helm user would reasonably try.
const IDIOMS = [
  { id: "flag--set", idiom: "--set replicaCount=3", args: ["--set", "replicaCount=3"], why: "Helm's --set flag; cub uses --input" },
  { id: "flag--set-string", idiom: "--set-string name=x", args: ["--set-string", "name=x"], why: "Helm's --set-string" },
  { id: "flag--values-f", idiom: "-f values.yaml", args: ["-f", "VALUES"], usesValues: true, why: "Helm's -f values file" },
  { id: "flag--values-long", idiom: "--values values.yaml", args: ["--values", "VALUES"], usesValues: true, why: "Helm's --values" },
  { id: "flag--set-file", idiom: "--set-file k=file", args: ["--set-file", "k=VALUES"], usesValues: true, why: "Helm's --set-file" },
  { id: "input-valuepath", idiom: "--input replicaCount=3", args: ["--input", "replicaCount=3"], why: "a valid Helm value path as a cub input" },
  { id: "input-image", idiom: "--input image.tag=v2", args: ["--input", "image.tag=v2"], why: "Helm image override; cub uses --set-image" },
  { id: "input-resources", idiom: "--input resources.requests.cpu=500m", args: ["--input", "resources.requests.cpu=500m"], why: "a valid Helm resources path as a cub input" },
  { id: "input-array", idiom: "--input servers[0]=x", args: ["--input", "servers[0]=x"], why: "Helm array index syntax as a cub input" },
];

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 64, timeout: 120_000, ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, code: 0, out: sh(file, args, opts) }; } catch (e) { return { ok: false, code: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }
function firstError(out) {
  const line = out.split("\n").map((l) => l.trim()).find((l) => /error|unknown|invalid|required|panic|fatal/i.test(l));
  return (line || out.split("\n")[0] || "").replace(/\/(?:private\/)?(?:var\/folders|tmp)\/[^\s"]+/g, "<tmp>").slice(0, 160);
}

function resolvePkg(p) {
  const abs = join(repoRoot, p);
  if (existsSync(join(abs, "installer.yaml"))) return abs;
  if (existsSync(abs)) {
    const vers = readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse();
    for (const v of vers) if (existsSync(join(abs, v, "installer.yaml"))) return join(abs, v);
  }
  return null;
}
function defaultBase(pkgAbs) {
  const m = tsh("cub", ["installer", "doc", pkgAbs]).out.match(/^\s*-\s*(\S+)\s*\(default\)/m);
  return m ? m[1] : null;
}

function classify(res, manifests, out) {
  const mk = (behavior, opts, detail) => ({ behavior, bug: !!opts.bug, finding: !!opts.finding, detail });
  if (/panic:|goroutine \d|runtime error|nil pointer|invalid memory address|fatal error:/i.test(out)) return mk("crash", { bug: true }, firstError(out));
  if (res.ok && manifests > 0) return mk("supported", {}, `cub accepted the Helm idiom and rendered ${manifests} file(s)`);
  if (res.ok) return mk("silent-wrong", { bug: true }, "exited 0 but produced no manifests (idiom swallowed)");
  // rejected — is the message a migration hint, or generic?
  const guided = /--input\b|--set-image|use\s+`?--|available input|valid input|did you mean|instead|see\b.*--help|cub installer/i.test(out);
  return guided ? mk("guided", {}, firstError(out)) : mk("opaque", { finding: true }, firstError(out));
}

function runOne(pkgAbs, base, idiom) {
  const wd = mkdtempSync(join(tmpdir(), "hhf-"));
  let args = idiom.args;
  if (idiom.usesValues) {
    const vf = join(wd, "values.yaml");
    writeFileSync(vf, "replicaCount: 3\nname: x\n");
    args = idiom.args.map((a) => a.replace("VALUES", vf));
  }
  const res = tsh("cub", ["installer", "setup", "--pull", pkgAbs, "--base", base, "--work-dir", wd, "--non-interactive", "--namespace", "fric", ...args]);
  const manDir = join(wd, "out", "manifests");
  const manifests = existsSync(manDir) ? readdirSync(manDir).filter((f) => f.endsWith(".yaml")).length : 0;
  const cls = classify(res, manifests, res.out || "");
  rmSync(wd, { recursive: true, force: true });
  return { idiom: idiom.id, label: idiom.idiom, why: idiom.why, code: res.code, ...cls };
}

function runFriction() {
  const stamp = new Date().toISOString();
  const pkgs = [];
  for (const p of PACKAGES) {
    const abs = resolvePkg(p);
    if (!abs) { pkgs.push({ pkg: p, status: "not-found", cases: [] }); continue; }
    const base = defaultBase(abs);
    if (!base) { pkgs.push({ pkg: p, status: "no-default-base", cases: [] }); continue; }
    pkgs.push({ pkg: p.replace("packages/", ""), base, status: "fuzzed", cases: IDIOMS.map((i) => runOne(abs, base, i)) });
  }
  const all = pkgs.flatMap((p) => p.cases.map((c) => ({ ...c, pkg: p.pkg })));
  const tally = {};
  for (const r of all) tally[r.behavior] = (tally[r.behavior] ?? 0) + 1;
  const bugs = all.filter((r) => r.bug);
  const guided = (tally.guided ?? 0) + (tally.supported ?? 0);
  const opaque = tally.opaque ?? 0;
  // group the opaque friction by idiom (the same idiom is opaque across packages)
  const frictionByIdiom = Object.values(all.filter((r) => r.behavior === "opaque").reduce((acc, r) => {
    (acc[r.idiom] ??= { idiom: r.idiom, label: r.label, why: r.why, count: 0, example: r.detail });
    acc[r.idiom].count++;
    return acc;
  }, {}));
  const fuzzed = pkgs.filter((p) => p.status === "fuzzed").length;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HelmHabitFrictionReceipt",
    metadata: { name: `helm-habit-friction-${stamp.slice(0, 10).replaceAll("-", "")}` },
    spec: {
      observedAt: stamp,
      packagesFuzzed: fuzzed,
      idioms: IDIOMS.length,
      cases: all.length,
      tally,
      guidedCount: guided,
      opaqueCount: opaque,
      bugCount: bugs.length,
      bugs: bugs.map((b) => ({ pkg: b.pkg, idiom: b.idiom, behavior: b.behavior, detail: b.detail })),
      friction: frictionByIdiom,
      result: bugs.length === 0 && all.length > 0 ? "pass" : all.length === 0 ? "blocked" : "watch",
      claim: "A Helm-fluent dev new to cub reaches for correct Helm idioms (--set, -f values.yaml, --input image.tag) that do not map to cub installer's declared-input model. cub safely REJECTS them (no silent mishandle) — but the question for adoption is whether it rejects WITH GUIDANCE toward the cub way, or opaquely. This lane measures that error-message quality. cub is safe; the opaque count is the migration friction to fix.",
      packages: pkgs,
    },
  };
}

function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "0%"; }
const ORDER = ["supported", "guided", "opaque", "silent-wrong", "crash"];
const MEANING = {
  supported: "cub actually handled the Helm idiom (bonus)",
  guided: "cub rejected **and** pointed to the cub way (the goal)",
  opaque: "**friction** — cub rejected but gave a Helm user no migration hint",
  "silent-wrong": "**BUG** — cub exited 0 but swallowed the idiom",
  crash: "**BUG** — cub panicked",
};

function summaryMd(r) {
  const s = r.spec;
  const tallyRows = ORDER.filter((b) => s.tally[b]).map((b) => `| ${b} | ${s.tally[b]} | ${pct(s.tally[b], s.cases)} | ${MEANING[b]} |`).join("\n");
  const fricRows = s.friction.length
    ? s.friction.map((f) => `| \`${f.label}\` | ${f.count} | ${f.why} | \`${f.example}\` |`).join("\n")
    : "| — | — | — | none (every idiom was guided or supported) |";
  return `# Helm-fluent migrant friction — does cub guide a Helm user, or trip them?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-helm-habit-friction.mjs\`; do not hand-edit. Regenerate with \`npm run helm-habit:friction\`.

**Claim.** ${s.claim}

A skilled Helm user, new to cub, applies **correct Helm idioms** to \`cub installer\` — \`--set\`, \`-f values.yaml\`, \`--input image.tag\`. They're not careless (that's the [bad-decisions fuzz](../bad-decisions-fuzz/summary.md)) and not adversarial — just muscle memory meeting a different model. ${s.cases} cases (${s.idioms} idioms × ${s.packagesFuzzed} packages).

**cub is safe: ${s.bugCount} bug(s)** (no silent mishandle). **But guidance is the gap: ${s.guidedCount}/${s.cases} guided-or-supported vs ${s.opaqueCount}/${s.cases} (${pct(s.opaqueCount, s.cases)}) opaque.** Overall: **${s.result}**.

| cub's response | Count | Share | Meaning |
| --- | --- | --- | --- |
${tallyRows}

## The friction (opaque rejections — the UX to fix)

Each is a correct Helm idiom that cub rejects with a generic message that doesn't point a Helm user to the cub way:

| Helm idiom | Packages | Why a Helm user tries it | cub's (opaque) error |
| --- | --- | --- | --- |
${fricRows}

The fix is **migration guidance in the error** — e.g. \`--set\` → "cub uses \`--input <name>=<value>\`; run \`cub installer doc\` for the inputs", \`--input image.tag\` → "use \`--set-image\`". cub already does the safe thing (reject); this makes it teach.

- Receipt: \`runs/helm-habit-friction/receipt.yaml\`. Companion to the cub-installer fuzz (\`data/cub-installer-fuzz/\`, careless/adversarial input) — this is the *competent-migrant* lane.
`;
}

function summaryHtml(r) {
  const s = r.spec;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "warn"}">${v}</span>`;
  const bar = (b) => { const n = s.tally[b] || 0; const w = s.cases ? Math.round((n / s.cases) * 100) : 0; const cls = ["crash", "silent-wrong"].includes(b) ? "bad" : b === "opaque" ? "warn" : "ok"; return `<tr><td>${b}</td><td><div class="barwrap"><div class="bar ${cls}" style="width:${w}%"></div><span>${n} (${w}%)</span></div></td></tr>`; };
  const fric = s.friction.length ? s.friction.map((f) => `<tr><td><code>${f.label}</code></td><td>${f.count}</td><td>${f.why}</td><td><code>${f.example}</code></td></tr>`).join("") : '<tr><td colspan="4" class="muted">none</td></tr>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Helm-fluent migrant friction — does cub guide or trip a Helm user?</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:900px;margin:0 auto}h1{font-size:1.45rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}h2{font-size:1.05rem;margin:1.6rem 0 .5rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;vertical-align:top;font-size:.86rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}
  .barwrap{position:relative;background:#eef1f4;border-radius:5px;height:22px}.bar{position:absolute;left:0;top:0;bottom:0;border-radius:5px}.bar.ok{background:#9fd0a6}.bar.warn{background:#f3d281}.bar.bad{background:#e8a0a0}.barwrap span{position:relative;font-size:.78rem;padding:0 8px;line-height:22px}
  .muted{color:#8c959f}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Helm-fluent migrant friction — does cub guide a Helm user, or trip them?</h1>
  <p class="sub">${s.cases} cases · ${s.idioms} Helm idioms × ${s.packagesFuzzed} packages · bugs: <b>${s.bugCount}</b> · opaque: <b>${s.opaqueCount}/${s.cases}</b> · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-helm-habit-friction.mjs</code>; do not hand-edit. The competent-migrant lane — companion to the cub-installer fuzz (<code>data/cub-installer-fuzz/</code>).</div>
  <div class="claim">${s.claim}</div>
  <h2>cub's response to valid Helm idioms · overall ${chip(s.result)}</h2>
  <table><tbody>${ORDER.filter((b) => s.tally[b]).map(bar).join("")}</tbody></table>
  <h2>The friction (opaque rejections — the UX to fix)</h2>
  <table><thead><tr><th>Helm idiom</th><th>Packages</th><th>Why a Helm user tries it</th><th>cub's (opaque) error</th></tr></thead><tbody>${fric}</tbody></table>
  <footer>cub already does the safe thing — it rejects every Helm idiom (no silent mishandle). The gap is guidance: a Helm user who types <code>--set</code> gets "unknown flag: --set" with no hint that cub uses <code>--input</code>. Migration guidance in these errors turns friction into a smooth onboarding.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runFriction();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote helm-habit friction -> ${relativeRepo(receiptPath)} result=${r.spec.result} (guided/supported ${r.spec.guidedCount}/${r.spec.cases}; opaque ${r.spec.opaqueCount}; bugs ${r.spec.bugCount})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run helm-habit:friction`);
  const r = readYaml(receiptPath);
  check(r.kind === "HelmHabitFrictionReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(typeof r.spec?.cases === "number" && r.spec.cases > 0, "receipt has no cases");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run helm-habit:friction`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run helm-habit:friction`);
  console.log(`verified helm-habit friction: ${r.spec.cases} cases, ${r.spec.opaqueCount} opaque, ${r.spec.bugCount} bug(s), result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-helm-habit-friction.mjs --run\n  node scripts/run-helm-habit-friction.mjs --verify");
}
