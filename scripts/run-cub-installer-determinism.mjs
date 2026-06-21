#!/usr/bin/env node
// Does cub installer render DETERMINISTICALLY? The whole config-as-data premise — that you
// review a meaningful DIFF before anything reaches a cluster — only holds if rendering the
// same package + base + inputs twice produces byte-identical manifests. If a render carried
// a timestamp, a random ordering, or a generated id, the diff would be noise. This runs
// `cub installer setup` TWICE per package (fresh work-dirs, identical inputs) and byte-
// compares the rendered manifests. Offline; reproducible.
//   - deterministic     : two runs byte-identical (the property we need)
//   - non-deterministic [finding] : the renders differ — diffs would be noisy
//
// Usage:
//   node scripts/run-cub-installer-determinism.mjs --run     # render twice per pkg, write receipt + summary
//   node scripts/run-cub-installer-determinism.mjs --verify  # re-derive summary from the receipt
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "cub-installer-determinism", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "cub-installer-determinism", "summary.md");
const htmlPath = join(repoRoot, "data", "cub-installer-determinism", "by-package.html");

const PACKAGES = [
  "packages/bitnami/nginx/24.0.2", "packages/bitnami/redis", "packages/bitnami/mysql",
  "packages/bitnami/mongodb", "packages/bitnami/rabbitmq", "packages/bitnami/postgresql",
  "packages/bitnami/apache", "packages/bitnami/memcached", "packages/bitnami/zookeeper",
  "packages/bitnami/contour", "packages/bitnami/opensearch", "packages/bitnami/phpmyadmin",
];

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 64, timeout: 120_000, ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

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
function renderInto(pkgAbs, base) {
  const wd = mkdtempSync(join(tmpdir(), "det-"));
  const res = tsh("cub", ["installer", "setup", "--pull", pkgAbs, "--base", base, "--work-dir", wd, "--non-interactive", "--namespace", "det"]);
  const md = join(wd, "out", "manifests");
  let files = null;
  if (res.ok && existsSync(md)) {
    files = {};
    for (const f of readdirSync(md).filter((x) => x.endsWith(".yaml"))) files[f] = readFileSync(join(md, f), "utf8");
  }
  rmSync(wd, { recursive: true, force: true });
  return { ok: res.ok, files, err: res.ok ? "" : (res.out.split("\n").find((l) => /error|required/i.test(l)) || "").slice(0, 120) };
}
function compare(a, b) {
  const fa = Object.keys(a).sort(), fb = Object.keys(b).sort();
  if (fa.join("|") !== fb.join("|")) return { deterministic: false, detail: `file set differs (${fa.length} vs ${fb.length})` };
  for (const f of fa) {
    if (a[f] !== b[f]) {
      const la = a[f].split("\n"), lb = b[f].split("\n");
      const i = la.findIndex((x, idx) => x !== lb[idx]);
      return { deterministic: false, detail: `${f} differs at line ${i + 1}: "${(la[i] || "").trim().slice(0, 50)}" vs "${(lb[i] || "").trim().slice(0, 50)}"` };
    }
  }
  return { deterministic: true, detail: `${fa.length} file(s) byte-identical across two runs` };
}

function runOne(pkgAbs, base) {
  const r1 = renderInto(pkgAbs, base);
  if (!r1.ok || !r1.files) return { status: "needs-inputs", detail: r1.err || "did not baseline-render", files: 0 };
  const r2 = renderInto(pkgAbs, base);
  if (!r2.ok || !r2.files) return { status: "needs-inputs", detail: r2.err || "second render failed", files: 0 };
  const cmp = compare(r1.files, r2.files);
  return { status: cmp.deterministic ? "deterministic" : "non-deterministic", detail: cmp.detail, files: Object.keys(r1.files).length };
}

function runDeterminism() {
  const stamp = new Date().toISOString();
  const pkgs = [];
  for (const p of PACKAGES) {
    const abs = resolvePkg(p);
    if (!abs) { pkgs.push({ pkg: p.replace("packages/", ""), status: "not-found", detail: "", files: 0 }); continue; }
    const base = defaultBase(abs);
    if (!base) { pkgs.push({ pkg: p.replace("packages/", ""), status: "no-default-base", detail: "", files: 0 }); continue; }
    pkgs.push({ pkg: p.replace("packages/", ""), base, ...runOne(abs, base) });
  }
  const rendered = pkgs.filter((p) => ["deterministic", "non-deterministic"].includes(p.status));
  const det = rendered.filter((p) => p.status === "deterministic").length;
  const nondet = rendered.filter((p) => p.status === "non-deterministic");
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CubInstallerDeterminismReceipt",
    metadata: { name: `cub-installer-determinism-${stamp.slice(0, 10).replaceAll("-", "")}` },
    spec: {
      observedAt: stamp,
      packagesAttempted: PACKAGES.length,
      packagesRendered: rendered.length,
      deterministic: det,
      nonDeterministicCount: nondet.length,
      nonDeterministic: nondet.map((p) => ({ pkg: p.pkg, detail: p.detail })),
      result: nondet.length === 0 && rendered.length > 0 ? "pass" : rendered.length === 0 ? "blocked" : "watch",
      claim: "cub installer renders deterministically: rendering the same package + base + inputs twice produces byte-identical manifests. This is the property the config-as-data premise depends on — a reviewable diff is only meaningful if the render is stable; any non-determinism would make diffs noisy.",
      packages: pkgs,
    },
  };
}

function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "0%"; }
function summaryMd(r) {
  const s = r.spec;
  const rows = s.packages.map((p) => `| ${p.pkg}${p.base ? `@${p.base}` : ""} | ${p.status} | ${p.files || "—"} | ${p.detail || ""} |`).join("\n");
  const nd = s.nonDeterministic.length ? s.nonDeterministic.map((p) => `- **${p.pkg}** — ${p.detail}`).join("\n") : "None — every rendered package was byte-identical across two runs.";
  return `# cub installer determinism — does the same input render the same twice?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-cub-installer-determinism.mjs\`; do not hand-edit. Regenerate with \`npm run cub-installer:determinism\`.

**Claim.** ${s.claim}

The config-as-data premise — review a meaningful **diff** before anything reaches a cluster — only holds if rendering is **deterministic**. This renders ${s.packagesRendered} packages **twice** (fresh work-dirs, identical inputs) and byte-compares.

**Deterministic: ${s.deterministic}/${s.packagesRendered} rendered packages. Non-deterministic: ${s.nonDeterministicCount}.** Overall: **${s.result}**.

## Non-deterministic packages (would make diffs noisy)

${nd}

## Per package

| Package | Status | Files | Detail |
| --- | --- | --- | --- |
${rows}

- \`needs-inputs\` packages require declared inputs to baseline-render and are not part of the determinism check.
- Receipt: \`runs/cub-installer-determinism/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "warn"}">${v}</span>`;
  const sc = (st) => st === "deterministic" ? "ok" : st === "non-deterministic" ? "bad" : "muted";
  const rows = s.packages.map((p) => `<tr><td>${p.pkg}${p.base ? `<span class="muted"> @${p.base}</span>` : ""}</td><td><span class="chip ${sc(p.status)}">${p.status}</span></td><td>${p.files || "—"}</td><td class="muted">${p.detail || ""}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>cub installer determinism</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:880px;margin:0 auto}h1{font-size:1.4rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;font-size:.86rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.bad{background:#ffebe9;color:#cf222e}.chip.muted{background:#f1eff0;color:#57606a}
  .muted{color:#8c959f}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>cub installer determinism — same input, same render twice?</h1>
  <p class="sub">${s.deterministic}/${s.packagesRendered} deterministic · ${s.nonDeterministicCount} non-deterministic · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-cub-installer-determinism.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <p>Overall: ${chip(s.result)} — config-as-data diffs are only meaningful if rendering is stable.</p>
  <table><thead><tr><th>Package</th><th>Status</th><th>Files</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>Each package is rendered twice with identical inputs and byte-compared. A diff you review before apply is only trustworthy if the render itself is deterministic.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runDeterminism();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote cub-installer determinism -> ${relativeRepo(receiptPath)} result=${r.spec.result} (${r.spec.deterministic}/${r.spec.packagesRendered} deterministic, ${r.spec.nonDeterministicCount} non-det)`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run cub-installer:determinism`);
  const r = readYaml(receiptPath);
  check(r.kind === "CubInstallerDeterminismReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run cub-installer:determinism`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run cub-installer:determinism`);
  console.log(`verified cub-installer determinism: ${r.spec.deterministic}/${r.spec.packagesRendered} deterministic, result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-cub-installer-determinism.mjs --run\n  node scripts/run-cub-installer-determinism.mjs --verify");
}
