#!/usr/bin/env node
// Gap hunt (think like Brian): does a chart's DEFAULT cub base ship a FIXED default
// credential? Helm generates a RANDOM password per install (non-deterministic). cub renders
// deterministically and DOES include an auth Secret in out/secrets/ — but if that Secret's
// value is the SAME for every install (namespace-independent, committed in the package),
// then it is a shared, well-known default credential, not a generated one. e.g. bitnami/redis
// default base ships `confighub-redis-password` (committed in bases/default/upstream.yaml),
// identical across namespaces. That works out of the box, but is a footgun if deployed
// unchanged — and bases literally named `generated-passwords` are misleading when the value
// is fixed. This renders each default base with TWO namespaces and flags Secrets whose value
// is identical across both. Offline (local cub installer setup). Decoded values shown only
// when they look like committed placeholders.
//
// Usage:
//   node scripts/run-default-credential-check.mjs --run
//   node scripts/run-default-credential-check.mjs --verify
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, py, readYaml, relativeRepo, repoRoot, write, writeYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "default-credential-check", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "default-credential-check", "summary.md");
const htmlPath = join(repoRoot, "data", "default-credential-check", "by-chart.html");

const PACKAGES = [
  "packages/bitnami/nginx/24.0.2", "packages/bitnami/redis", "packages/bitnami/mysql",
  "packages/bitnami/mongodb", "packages/bitnami/rabbitmq", "packages/bitnami/postgresql",
  "packages/bitnami/apache", "packages/bitnami/memcached", "packages/bitnami/zookeeper",
  "packages/bitnami/contour", "packages/bitnami/opensearch", "packages/bitnami/phpmyadmin",
];
const PLACEHOLDER = /confighub|changeme|change-me|placeholder|example|password123|admin123|secretpassword/i;

const PYSECRETS = `
import sys, json, yaml
out={}
for doc in yaml.safe_load_all(sys.stdin.read()):
    if isinstance(doc,dict) and doc.get('kind')=='Secret':
        name=(doc.get('metadata') or {}).get('name')
        data=doc.get('data') or {}
        if name and isinstance(data,dict):
            out[name]={k:v for k,v in data.items() if isinstance(v,str)}
print(json.dumps(out))
`;

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 64, timeout: 120_000, ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }
function resolvePkg(p) {
  const abs = join(repoRoot, p);
  if (existsSync(join(abs, "installer.yaml"))) return abs;
  if (existsSync(abs)) { const vers = readdirSync(abs, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort().reverse(); for (const v of vers) if (existsSync(join(abs, v, "installer.yaml"))) return join(abs, v); }
  return null;
}
function docText(pkgAbs) { return tsh("cub", ["installer", "doc", pkgAbs]).out; }
function defaultBase(doc) { const m = doc.match(/^\s*-\s*(\S+)\s*\(default\)/m); return m ? m[1] : "default"; }

function secretsFor(pkgAbs, base, ns) {
  const wd = mkdtempSync(join(tmpdir(), "cred-"));
  const res = tsh("cub", ["installer", "setup", "--pull", pkgAbs, "--base", base, "--work-dir", wd, "--non-interactive", "--namespace", ns]);
  const sd = join(wd, "out", "secrets");
  let secrets = null, err = "";
  if (res.ok && existsSync(sd)) {
    const text = readdirSync(sd).filter((f) => f.endsWith(".yaml")).map((f) => readFileSync(join(sd, f), "utf8")).join("\n---\n");
    try { secrets = py(PYSECRETS, text); } catch { secrets = {}; }
  } else if (!res.ok) err = (res.out.split("\n").find((l) => /error|required/i.test(l)) || "").slice(0, 120);
  rmSync(wd, { recursive: true, force: true });
  return { ok: res.ok, secrets, err };
}

function decodeIfPlaceholder(b64) {
  try { const d = Buffer.from(b64, "base64").toString("utf8"); return PLACEHOLDER.test(d) ? d : null; } catch { return null; }
}

function analyze(pkgAbs, base) {
  const a = secretsFor(pkgAbs, base, "credalpha");
  if (!a.ok || a.secrets === null) return { status: a.ok ? "no-secret" : "needs-inputs", detail: a.err };
  if (Object.keys(a.secrets).length === 0) return { status: "no-secret" };
  const b = secretsFor(pkgAbs, base, "credbeta");
  const fixed = [], varies = [];
  for (const [sname, data] of Object.entries(a.secrets)) {
    for (const [k, v] of Object.entries(data)) {
      if (!/password|passwd/i.test(k)) continue; // focus on password credentials, not config/cert blobs
      const bv = b.secrets?.[sname]?.[k];
      if (bv === undefined) continue;
      if (bv === v) { const ph = decodeIfPlaceholder(v); fixed.push({ secret: sname, key: k, ...(ph ? { placeholder: ph } : {}) }); }
      else varies.push({ secret: sname, key: k });
    }
  }
  const status = fixed.length ? "fixed-credential" : varies.length ? "varies-by-install" : "no-secret-data";
  return { status, fixed, varies };
}

function runCheck() {
  const stamp = new Date().toISOString();
  const pkgs = [];
  for (const p of PACKAGES) {
    const abs = resolvePkg(p);
    if (!abs) { pkgs.push({ pkg: p.replace("packages/", ""), status: "not-found" }); continue; }
    const base = defaultBase(docText(abs));
    const a = analyze(abs, base);
    const misleadingName = a.status === "fixed-credential" && /generat/i.test(base);
    pkgs.push({ pkg: p.replace("packages/", ""), base, misleadingName, ...a });
  }
  const checked = pkgs.filter((p) => ["fixed-credential", "varies-by-install", "no-secret", "no-secret-data"].includes(p.status));
  const fixedPkgs = pkgs.filter((p) => p.status === "fixed-credential");
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DefaultCredentialCheckReceipt",
    metadata: { name: `default-credential-check-${stamp.slice(0, 10).replaceAll("-", "")}` },
    spec: {
      observedAt: stamp,
      packagesChecked: checked.length,
      fixedCredentialCount: fixedPkgs.length,
      misleadingNameCount: pkgs.filter((p) => p.misleadingName).length,
      fixedCredentials: fixedPkgs.map((p) => ({ pkg: p.pkg, base: p.base, misleadingName: p.misleadingName, secrets: p.fixed })),
      result: fixedPkgs.length === 0 && checked.length > 0 ? "pass" : checked.length === 0 ? "blocked" : "watch",
      claim: "Helm generates a RANDOM password per install. cub renders deterministically and ships an auth Secret in out/secrets/ — but for these default bases the value is FIXED (identical across namespaces, committed in the package, e.g. `confighub-redis-password`). That is a shared, well-known default credential, not a generated one — convenient for demos, a footgun deployed unchanged. Bases named `generated-passwords` that ship a fixed value are misleadingly named.",
      packages: pkgs,
    },
  };
}

function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : "0%"; }
function summaryMd(r) {
  const s = r.spec;
  const fixRows = s.fixedCredentials.length
    ? s.fixedCredentials.map((p) => `| ${p.pkg} | ${p.base}${p.misleadingName ? " ⚠️ misleading" : ""} | ${p.secrets.map((x) => `\`${x.secret}/${x.key}\`${x.placeholder ? ` = \`${x.placeholder}\`` : ""}`).join("; ")} |`).join("\n")
    : "| — | — | none — no fixed default credentials |";
  const allRows = s.packages.map((p) => `| ${p.pkg}${p.base ? `@${p.base}` : ""} | ${p.status}${p.misleadingName ? " (misleading name)" : ""} |`).join("\n");
  return `# Default-credential check — does a chart's default base ship a fixed shared password?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-default-credential-check.mjs\`; do not hand-edit. Regenerate with \`npm run default-credential:check\`.

**Claim.** ${s.claim}

Helm generates a **random** password per install. cub renders **deterministically** (good for config-as-data) and ships the auth Secret in \`out/secrets/\` — but where that value is **identical for every install** (same across namespaces, committed in the package), it is a **shared default credential**. Found by rendering each default base with two namespaces and comparing the Secret values.

**Default bases shipping a FIXED credential: ${s.fixedCredentialCount}/${s.packagesChecked} (${pct(s.fixedCredentialCount, s.packagesChecked)}). Misleadingly-named (\`generated-passwords\` yet fixed): ${s.misleadingNameCount}.** Overall: **${s.result}**.

## The fixed default credentials

| Chart | Default base | Fixed Secret(s) — placeholder shown where committed |
| --- | --- | --- |
${fixRows}

This is a footgun, not a vulnerability per se: the values are committed placeholders meant for render-parity/demos, and a \`reuse-existing-secret\` base exists for production. The honest fixes: (1) **don't name a fixed-value base \`generated-passwords\`** — it implies generation; (2) surface, at install time, that the default base ships a known placeholder credential that must be replaced before production; (3) consider per-install entropy for the default base so two installs don't share a password.

## Per chart

| Chart | Status |
| --- | --- |
${allRows}

- Companion to the cub-installer fuzz's namespace findings — this is the **secret** rough edge. Receipt: \`runs/default-credential-check/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "warn"}">${v}</span>`;
  const sc = (st) => st === "fixed-credential" ? "bad" : st === "varies-by-install" ? "ok" : "muted";
  const rows = s.packages.map((p) => `<tr><td>${p.pkg}${p.base ? `<span class="muted"> @${p.base}</span>` : ""}</td><td><span class="chip ${sc(p.status)}">${p.status}</span></td><td>${(p.fixed || []).map((x) => `<code>${x.secret}/${x.key}</code>${x.placeholder ? ` = <code>${x.placeholder}</code>` : ""}`).join("; ") || ""}${p.misleadingName ? ' <span class="chip warn">misleading name</span>' : ""}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Default-credential check</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:920px;margin:0 auto}h1{font-size:1.35rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;font-size:.86rem;vertical-align:top}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.bad{background:#ffebe9;color:#cf222e}.chip.warn{background:#fff1d6;color:#9a6700}.chip.muted{background:#f1eff0;color:#57606a}
  .muted{color:#8c959f}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Default-credential check — does the default base ship a fixed shared password?</h1>
  <p class="sub">${s.fixedCredentialCount}/${s.packagesChecked} default bases ship a fixed credential · ${s.misleadingNameCount} misleadingly named · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-default-credential-check.mjs</code>; do not hand-edit. Placeholder values shown are committed repo placeholders.</div>
  <div class="claim">${s.claim}</div>
  <p>Overall: ${chip(s.result)} — cub renders deterministically (good), but a fixed default password is shared across all installs (footgun).</p>
  <table><thead><tr><th>Chart</th><th>Status</th><th>Fixed Secret(s)</th></tr></thead><tbody>${rows}</tbody></table>
  <footer>Deterministic generated secrets must still carry per-install entropy; a value that is identical for everyone (and committed) is a shared default credential. "generated-passwords" bases that ship a fixed value are misleadingly named.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runCheck();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote default-credential check -> ${relativeRepo(receiptPath)} result=${r.spec.result} (${r.spec.fixedCredentialCount}/${r.spec.packagesChecked} fixed; ${r.spec.misleadingNameCount} misleadingly named)`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run default-credential:check`);
  const r = readYaml(receiptPath);
  check(r.kind === "DefaultCredentialCheckReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run default-credential:check`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run default-credential:check`);
  console.log(`verified default-credential check: ${r.spec.fixedCredentialCount}/${r.spec.packagesChecked} fixed, result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-default-credential-check.mjs --run\n  node scripts/run-default-credential-check.mjs --verify");
}
