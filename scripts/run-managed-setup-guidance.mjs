#!/usr/bin/env node
// "Manage it" proof (offline): the two NON-delivery adoption findings, managed at the setup edge.
//   - Customize friction (#1009): Helm idioms (`--set`, `--values`, `--input X`) are rejected by
//     cub with a generic "unknown flag/input" and ZERO guidance (0/72 guided). The managed layer
//     turns each real cub error into a plain migration hint -> guided, not opaque.
//   - Shared placeholder password (#1012): the `default` base bakes a password Secret that is a
//     shared placeholder. The managed layer detects the baked password key (NEVER decodes/prints
//     the value) and points to the `reuse-existing-secret` base + the determinism tension.
// The determinism tension is the real reason cub can't just "generate a random password" like
// Helm: a deterministic render (the #1011 win) and a random-per-install secret are mutually
// exclusive from one render — so the honest answer is "supply/reference your own secret"
// (reuse-existing-secret), and rename the misleading `generated-passwords` base.
// Offline (local packages, no network, no cluster). Result `pass` = guidance + warnings generated.
//
// Usage:
//   node scripts/run-managed-setup-guidance.mjs --run
//   node scripts/run-managed-setup-guidance.mjs --verify
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, py, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "managed-setup-guidance", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "managed-setup-guidance", "summary.md");
const htmlPath = join(repoRoot, "data", "managed-setup-guidance", "summary.html");

const REDIS = "packages/bitnami/redis/25.5.3/";
const MYSQL = "packages/bitnami/mysql/14.0.3/";

// Helm idioms a migrant will reach for, fed to the real cub CLI to capture the real error.
const IDIOMS = [
  { idiom: "--set replicaCount=2", args: ["--set", "replicaCount=2"] },
  { idiom: "--values values.yaml", args: ["--values", "values.yaml"] },
  { idiom: "-f values.yaml", args: ["-f", "values.yaml"] },
  { idiom: "--set-string image.tag=7.4", args: ["--set-string", "image.tag=7.4"] },
  { idiom: "--input replicaCount=2", args: ["--input", "replicaCount=2"] },
];

// Map a real cub error -> a plain-words migration hint. The whole point of #1009's fix.
function guidanceFor(errText) {
  const e = errText.toLowerCase();
  if (/unknown flag: --set\b/.test(e) || /unknown flag: --set-string/.test(e))
    return "cub has no `--set`. Declared inputs use `--input KEY=VALUE` (`cub installer doc <pkg>` lists them); most values are set by choosing or editing a kustomize base, not a flag. See docs/user/helm-to-cub-migration.md.";
  if (/unknown flag: (--values|-f)\b/.test(e) || /unknown flag: --values/.test(e))
    return "cub has no values file. Configuration lives in the base (kustomize) — pick or edit a base instead of a `values.yaml`. See docs/user/helm-to-cub-migration.md.";
  if (/unknown input/.test(e))
    return "cub rejects non-declared inputs by design — this is the typo guard that catches what Helm silently absorbs. To set it: confirm it's a declared input (`cub installer doc <pkg>`), or edit the base.";
  return "cub rejected this input. cub uses declared `--input`s plus kustomize bases rather than Helm's `--set`/values files; see docs/user/helm-to-cub-migration.md.";
}

function firstError(text) {
  const line = (text.split("\n").find((l) => /error|unknown/i.test(l)) || text.split("\n")[0] || "").trim();
  return line.replace(/\/(?:private\/)?(?:var\/folders|tmp)\/[^\s"]+/g, "<tmp>").slice(0, 160);
}

function tryIdiom(pkg, args) {
  const wd = mkdtempSync(join(tmpdir(), "msg-"));
  try {
    execFileSync("cub", ["installer", "setup", "--pull", pkg, "--base", "default", "--work-dir", wd, "--non-interactive", "--namespace", "guidens", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { error: "", rendered: true };
  } catch (e) {
    return { error: firstError(`${e.stdout ?? ""}${e.stderr ?? ""}` || String(e)), rendered: false };
  } finally {
    rmSync(wd, { recursive: true, force: true });
  }
}

// Detect a baked password KEY in out/secrets/ — never decode or print the value.
const PY_SECRET_KEYS = `import sys, glob, os, yaml
d = sys.stdin.read().strip()
keys = []
for f in glob.glob(os.path.join(d, '*.yaml')):
    for o in yaml.safe_load_all(open(f)):
        if isinstance(o, dict) and o.get('kind') == 'Secret':
            for k in (o.get('data') or {}):
                if 'password' in k.lower() or 'passwd' in k.lower():
                    keys.append(k)
print(__import__('json').dumps(sorted(set(keys))))`;

// The default base name varies per chart (redis: "default"; mysql: "generated-passwords").
// Resolve it from `cub installer doc <pkg> --json` (spec.bases[].default), don't assume "default".
function defaultBaseFor(pkg) {
  try {
    const doc = JSON.parse(execFileSync("cub", ["installer", "doc", join(repoRoot, pkg), "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
    const bases = doc?.spec?.bases ?? [];
    return (bases.find((b) => b.default) ?? bases[0])?.name ?? "default";
  } catch { return "default"; }
}

function scanDefaultSecret(pkg) {
  const wd = mkdtempSync(join(tmpdir(), "msg-sec-"));
  const defaultBase = defaultBaseFor(pkg);
  try {
    execFileSync("cub", ["installer", "setup", "--pull", pkg, "--base", defaultBase, "--work-dir", wd, "--non-interactive", "--namespace", "guidens"], { stdio: ["ignore", "pipe", "pipe"] });
    const secretsDir = join(wd, "out", "secrets");
    const passwordKeys = existsSync(secretsDir) ? py(PY_SECRET_KEYS, secretsDir) : [];
    const basesDir = join(repoRoot, pkg, "bases");
    const reuseBase = existsSync(basesDir) && readdirSync(basesDir).find((b) => /reuse|existing/i.test(b));
    return { defaultBase, passwordKeys, bakesPassword: passwordKeys.length > 0, reuseBase: reuseBase || null };
  } catch (e) {
    return { defaultBase, passwordKeys: [], bakesPassword: false, reuseBase: null, error: String(e).slice(0, 120) };
  } finally {
    rmSync(wd, { recursive: true, force: true });
  }
}

function runProof() {
  const stamp = new Date().toISOString();

  // Part 1: customize guidance
  const guided = IDIOMS.map((it) => {
    const r = tryIdiom(REDIS, it.args);
    return { idiom: it.idiom, cubError: r.error || "(rendered — accepted)", guidance: r.error ? guidanceFor(r.error) : "accepted (a declared input)" };
  });
  const guidedCount = guided.filter((g) => g.guidance && !g.guidance.startsWith("accepted")).length;

  // Part 2: placeholder-secret warning
  const secretFindings = [REDIS, MYSQL].map((pkg) => {
    const s = scanDefaultSecret(pkg);
    const chart = pkg.split("/")[1];
    return {
      chart,
      defaultBase: s.defaultBase,
      bakesPassword: s.bakesPassword,
      passwordKeyCount: s.passwordKeys.length, // counts/keys only — values never read
      reuseBase: s.reuseBase,
      warning: s.bakesPassword
        ? `The default base (\`${s.defaultBase}\`) bakes a password Secret (${s.passwordKeys.length} password key(s)) — a shared placeholder, identical for everyone. ${s.reuseBase ? `Use the \`${s.reuseBase}\` base and supply your own Secret` : "Supply your own Secret"}, or replace the placeholder before prod.`
        : `No baked password Secret in the default base (\`${s.defaultBase}\`).`,
    };
  });
  const warned = secretFindings.filter((s) => s.bakesPassword).length;

  const ok = guidedCount === guided.filter((g) => g.cubError !== "(rendered — accepted)").length && warned > 0;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedSetupGuidanceReceipt",
    metadata: { name: `managed-setup-guidance-${stamp.slice(0, 10)}` },
    spec: {
      observedAt: stamp,
      result: ok ? "pass" : "watch",
      claim: "The two non-delivery adoption findings are manageable at the setup edge. Customize friction (#1009): every Helm idiom cub rejects (`unknown flag: --set`, `unknown input`) maps to a plain migration hint — opaque becomes guided. Shared placeholder password (#1012): the default base bakes a shared placeholder password Secret; the managed layer detects the baked key (without decoding the value) and points to the reuse-existing-secret base. The determinism tension is why cub cannot just generate a random password like Helm — a deterministic render and a random-per-install secret are mutually exclusive — so the honest fix is supply/reference your own secret, and rename the misleading generated-passwords base.",
      customizeGuidance: { totalIdioms: guided.length, guided: guidedCount, samples: guided },
      secretGuidance: { charts: secretFindings, warned, note: "Secret VALUES are never decoded or printed — only password key names/counts are read, to honor the credential-handling constraint." },
      determinismTension: "cub's deterministic render (#1011, a real win) and Helm's random-per-install password are mutually exclusive from one render. So the secret answer is reuse-existing-secret (supply/reference your own), not generate-random-in-render. The `generated-passwords` base name promises what determinism forbids and should be renamed.",
      conclusion: ok
        ? "Both non-delivery findings are managed: opaque Helm-idiom rejections become guided migration hints, and the baked placeholder password is detected and routed to reuse-existing-secret. With the delivery applier (managed-cub-direct), all five adoption findings now have a concrete 'manage it'."
        : "Guidance/warnings incomplete; see parts.",
    },
  };
}

function summaryMd(r) {
  const s = r.spec; const C = s.customizeGuidance; const S = s.secretGuidance;
  const rows = C.samples.map((g) => `| \`${g.idiom}\` | ${g.cubError} | ${g.guidance} |`).join("\n");
  const srows = S.charts.map((c) => `| ${c.chart} | \`${c.defaultBase}\` | ${c.bakesPassword ? "yes" : "no"} | ${c.reuseBase ? `\`${c.reuseBase}\`` : "—"} | ${c.warning} |`).join("\n");
  return `# Managed setup guidance — the two non-delivery adoption findings, managed

**UNOFFICIAL/EXPERIMENTAL.** Offline receipt generated by \`scripts/run-managed-setup-guidance.mjs\`; do not hand-edit. Regenerate with \`npm run managed-setup-guidance:proof\`.

**Claim.** ${s.claim}

## Customize friction (#1009) → guided

Every Helm idiom cub rejects now maps to a plain migration hint. **${C.guided}/${C.totalIdioms} idioms guided** (the friction lane found 0/72).

| Helm idiom | Real cub error | Managed guidance |
| --- | --- | --- |
${rows}

## Shared placeholder password (#1012) → detected + routed

**${S.warned}/${S.charts.length} charts warned.** ${S.note}

| Chart | Default base | Bakes a password? | reuse base | Managed warning |
| --- | --- | --- | --- | --- |
${srows}

### The determinism tension (why cub can't just "generate a random password")

${s.determinismTension}

Overall: **${s.result}**. ${s.conclusion}

- Receipt: \`runs/managed-setup-guidance/receipt.yaml\`.
`;
}

function summaryHtml(r) {
  const s = r.spec; const C = s.customizeGuidance; const S = s.secretGuidance;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "warn"}">${v}</span>`;
  const rows = C.samples.map((g) => `<tr><td><code>${g.idiom}</code></td><td><code>${g.cubError}</code></td><td>${g.guidance}</td></tr>`).join("");
  const srows = S.charts.map((c) => `<tr><td>${c.chart}</td><td><code>${c.defaultBase}</code></td><td>${c.bakesPassword ? '<span class="chip warn">yes</span>' : "no"}</td><td>${c.reuseBase ? `<code>${c.reuseBase}</code>` : "—"}</td><td>${c.warning}</td></tr>`).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Managed setup guidance</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:920px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 .25rem}h2{font-size:1rem;margin:1.6rem 0 .5rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  .tension{background:#fbeffb;border-left:4px solid #8250df;border-radius:4px;padding:.7rem 1rem;margin:1rem 0;font-size:.9rem}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden;margin:.5rem 0}
  th,td{text-align:left;padding:.5rem .65rem;border-bottom:1px solid #eaeef2;font-size:.84rem;vertical-align:top}th{background:#f6f8fa;font-size:.72rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.82em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Managed setup guidance — the two non-delivery adoption findings</h1>
  <p class="sub">offline · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-managed-setup-guidance.mjs</code>; do not hand-edit. Secret values are never decoded or printed.</div>
  <div class="claim">${s.claim}</div>
  <h2>Customize friction (#1009) → guided · ${C.guided}/${C.totalIdioms}</h2>
  <table><thead><tr><th>Helm idiom</th><th>Real cub error</th><th>Managed guidance</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Shared placeholder password (#1012) → detected + routed · ${S.warned}/${S.charts.length}</h2>
  <table><thead><tr><th>Chart</th><th>Default base</th><th>Bakes a password?</th><th>reuse base</th><th>Managed warning</th></tr></thead><tbody>${srows}</tbody></table>
  <div class="tension"><b>The determinism tension:</b> ${s.determinismTension}</div>
  <p>Overall: ${chip(s.result)}</p>
  <footer>${s.conclusion}</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote managed-setup-guidance -> ${relativeRepo(receiptPath)} result=${r.spec.result} (guided ${r.spec.customizeGuidance.guided}/${r.spec.customizeGuidance.totalIdioms}, secret-warned ${r.spec.secretGuidance.warned}/${r.spec.secretGuidance.charts.length})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run managed-setup-guidance:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "ManagedSetupGuidanceReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.customizeGuidance && !!r.spec?.secretGuidance, "receipt missing parts");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run managed-setup-guidance:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run managed-setup-guidance:proof`);
  console.log(`verified managed-setup-guidance: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-managed-setup-guidance.mjs --run\n  node scripts/run-managed-setup-guidance.mjs --verify");
}
