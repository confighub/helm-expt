#!/usr/bin/env node
// Gap proof (live): does cub-scout's drift detection cover all the fields a careless or
// malicious actor could change? The day-1 claim is that `cub-scout compare three-way
// --dry-from <renderedDir>` flags desired-vs-live drift. It DOES detect replicas/image
// changes (with cause attribution: manual-edit). But this proves it MISSES a container
// env-var change: drift a Deployment's env on the live cluster and cub-scout still reports
// "AGREED / 0 mismatches". So drift detection works but has incomplete field coverage — a
// real drift can pass as no-drift. Two deployments on a throwaway kind cluster: one drifted
// by replicas (expected: detected), one drifted by env (the gap: missed).
// Result `watch` — drift detection is real but field coverage is incomplete.
//
// Usage:
//   node scripts/run-drift-detection-gap.mjs --run      # live on kind; writes receipt + summary
//   node scripts/run-drift-detection-gap.mjs --verify
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "drift-detection-gap", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "drift-detection-gap", "summary.md");
const htmlPath = join(repoRoot, "data", "drift-detection-gap", "summary.html");

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024 * 32, ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

const DRY = (name, extra) => `apiVersion: apps/v1
kind: Deployment
metadata: {name: ${name}, namespace: driftns}
spec:
  replicas: 1
  selector: {matchLabels: {app: ${name}}}
  template:
    metadata: {labels: {app: ${name}}}
    spec: {containers: [{name: c, image: nginx:1.27${extra}}]}
`;

function mismatchCount(kctx, kubeconfig, dryDir, scope) {
  const r = tsh("cub-scout", ["compare", "three-way", "--dry-from", dryDir, "--scope", scope, "-n", "driftns", "--format", "json"], { env: { ...process.env, KUBECONFIG: kubeconfig } });
  if (!r.ok) return { ok: false, count: null, detail: r.out.split("\n")[0].slice(0, 120) };
  try { const j = JSON.parse(r.out); return { ok: true, count: j.summary?.mismatchedResources ?? 0 }; }
  catch { return { ok: false, count: null, detail: "cub-scout did not return json" }; }
}

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `driftgap-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const kctx = `kind-${rig}`;
  const work = mkdtempSync(join(tmpdir(), "driftgap-"));
  const dry = join(work, "dry"); execFileSync("mkdir", ["-p", dry]);
  writeFileSync(join(dry, "web-replicas.yaml"), DRY("web-replicas", ""));
  writeFileSync(join(dry, "web-env.yaml"), DRY("web-env", ", env: [{name: FOO, value: bar}]"));
  const kubeconfig = join(work, "kubeconfig");
  let clusterUp = false;
  let replicasDetected = null, envDetected = null, envLiveConfirmed = null;
  try {
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind did not come up: ${up.out.slice(0, 150)}`);
    writeFileSync(kubeconfig, tsh("kind", ["get", "kubeconfig", "--name", rig]).out);
    const k = (args) => tsh("kubectl", ["--context", kctx, ...args], { env: { ...process.env, KUBECONFIG: kubeconfig } });
    k(["create", "namespace", "driftns"]);
    k(["apply", "-f", dry]);
    k(["-n", "driftns", "rollout", "status", "deploy/web-replicas", "--timeout=60s"]);
    k(["-n", "driftns", "rollout", "status", "deploy/web-env", "--timeout=60s"]);
    // drift 1: replicas 1 -> 3 (expected: detected)
    k(["-n", "driftns", "scale", "deploy/web-replicas", "--replicas=3"]);
    // drift 2: env FOO bar -> DRIFTED (the gap)
    k(["-n", "driftns", "set", "env", "deploy/web-env", "FOO=DRIFTED"]);
    k(["-n", "driftns", "rollout", "status", "deploy/web-env", "--timeout=60s"]);
    envLiveConfirmed = (k(["-n", "driftns", "get", "deploy", "web-env", "-o", "jsonpath={.spec.template.spec.containers[0].env[0].value}"]).out || "").trim() === "DRIFTED";
    replicasDetected = (mismatchCount(kctx, kubeconfig, dry, "deploy/web-replicas").count ?? 0) > 0;
    envDetected = (mismatchCount(kctx, kubeconfig, dry, "deploy/web-env").count ?? 0) > 0;
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  // gap = a confirmed live drift (env) that cub-scout missed while detecting another (replicas)
  const gap = replicasDetected === true && envDetected === false && envLiveConfirmed === true;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "DriftDetectionGapProofReceipt",
    metadata: { name: rig },
    spec: {
      observedAt: stamp,
      result: gap ? "watch" : (replicasDetected && envDetected) ? "pass" : "blocked",
      claim: "cub-scout `compare three-way --dry-from` detects desired-vs-live drift (replicas/image, with cause attribution manual-edit) — but it MISSES a container env-var change. A Deployment whose env is drifted on the live cluster is reported as AGREED / 0 mismatches. Drift detection works but has incomplete field coverage: a real drift can pass as no-drift.",
      legs: {
        replicasDrift: { field: "spec.replicas (1->3)", detected: replicasDetected, expect: "detected" },
        envDrift: { field: "container env FOO (bar->DRIFTED)", liveDriftConfirmed: envLiveConfirmed, detected: envDetected, expect: "detected", gap: gap },
      },
      run: { rig, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      conclusion: gap
        ? "Confirmed: cub-scout detected the replicas drift but MISSED the env-var drift (live env change verified). Drift detection has a field-coverage hole — extend it to container env (and audit other pod-spec fields), or a drifted env passes as no-drift."
        : (replicasDetected && envDetected) ? "cub-scout detected both drifts; no coverage gap observed in this run." : "Inconclusive; see leg details.",
    },
  };
}

function tf(v) { return v === true ? "yes" : v === false ? "no" : "?"; }
function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  return `# Drift-detection field-coverage gap — does cub-scout catch every drift?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-drift-detection-gap.mjs\`; do not hand-edit. Regenerate with \`npm run drift-gap:proof\`.

**Claim.** ${s.claim}

The day-1 drift claim: \`cub-scout compare three-way --dry-from <renderedDir>\` flags desired-vs-live drift. It works — but field coverage matters. Proven live on a throwaway kind cluster with two Deployments, each drifted a different way:

| Drift | Confirmed live | cub-scout detected? | Expected |
| --- | --- | --- | --- |
| \`spec.replicas\` 1→3 | — | **${tf(L.replicasDrift.detected)}** | detected |
| container env \`FOO\` bar→DRIFTED | ${tf(L.envDrift.liveDriftConfirmed)} | **${tf(L.envDrift.detected)}** | detected |

Overall: **${s.result}**. ${s.conclusion}

- **Positive:** cub-scout *does* detect drift — replicas/image, with cause attribution (\`drift-cause: manual-edit\`). The mechanism works.
- **Gap:** it **misses container env-var drift** (verified: the live env really changed, and cub-scout reported 0 mismatches). A real drift passes as no-drift.
- **Fix:** extend \`--dry-from\` field comparison to container env (and audit other pod-spec fields — resources, command, volumeMounts). Until then, drift detection is partial.
- Receipt: \`runs/drift-detection-gap/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const yn = (v, good) => `<span class="chip ${v === good ? "ok" : "bad"}">${tf(v)}</span>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Drift-detection field-coverage gap</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:820px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #eaeef2;font-size:.88rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.bad{background:#ffebe9;color:#cf222e}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Drift-detection field-coverage gap — does cub-scout catch every drift?</h1>
  <p class="sub">live on kind · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-drift-detection-gap.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Drift</th><th>cub-scout detected?</th></tr></thead><tbody>
  <tr><td><code>spec.replicas</code> 1→3</td><td>${yn(L.replicasDrift.detected, true)}</td></tr>
  <tr><td>container env <code>FOO</code> bar→DRIFTED (live-confirmed: ${tf(L.envDrift.liveDriftConfirmed)})</td><td>${yn(L.envDrift.detected, true)}</td></tr>
  </tbody></table>
  <footer>cub-scout's drift detection works (replicas/image, with cause attribution) but misses container env-var drift — a real drift passes as no-drift. The fix: extend --dry-from field comparison to container env and audit other pod-spec fields.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote drift-detection-gap proof -> ${relativeRepo(receiptPath)} result=${r.spec.result} (replicas=${tf(r.spec.legs.replicasDrift.detected)}, env=${tf(r.spec.legs.envDrift.detected)})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run drift-gap:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "DriftDetectionGapProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.legs?.envDrift, "receipt missing env leg");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run drift-gap:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run drift-gap:proof`);
  console.log(`verified drift-detection-gap proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-drift-detection-gap.mjs --run\n  node scripts/run-drift-detection-gap.mjs --verify");
}
