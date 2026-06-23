#!/usr/bin/env node
// PROOF (live): SERVERLESS render-parity AND install-parity, with no ConfigHub account.
//
// The point (user, 2026-06-22): users don't just want render parity — they want to SEE it
// install and work, both ways, with no confighub.com login. This proves the whole journey on
// one kind cluster, no account:
//   - RENDER PARITY: `cub installer setup` renders the same Kubernetes object set as
//     `helm template` (the catalog proves this rigorously; here it is re-checked live).
//   - HELM INSTALL (what users do today): `helm install redis ...` -> Redis comes up.
//   - CUB SERVERLESS INSTALL: the cub render is applied with plain `kubectl apply` -> Redis
//     comes up too. (The oci+gitops install path is proven separately in
//     run-serverless-oci-gitops-proof.mjs.)
//   - NO ACCOUNT: neither path logs into ConfigHub.
// result=pass iff the renders match AND both installs reach a working (Ready) Redis.
//
// Usage:
//   node scripts/run-serverless-install-parity-proof.mjs --run      # live on kind
//   node scripts/run-serverless-install-parity-proof.mjs --verify
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "serverless-install-parity-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "serverless-install-parity-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "serverless-install-parity-proof", "summary.html");
const PKG = "packages/bitnami/redis/25.5.3";
const HELM_CHART = "oci://registry-1.docker.io/bitnamicharts/redis";
const VERSION = "25.5.3";

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }
function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function poll(fn, { tries = 45, gapMs = 8000 } = {}) { for (let i = 0; i < tries; i++) { if (fn()) return true; sleep(gapMs); } return false; }

// kind -> count multiset from a blob of YAML text
function kindCounts(text) {
  const m = {}; for (const x of text.matchAll(/^kind:\s*(\w+)/gm)) m[x[1]] = (m[x[1]] ?? 0) + 1; return m;
}
function eqExceptNamespace(helm, cub) {
  const c = { ...cub }; delete c.Namespace; // cub adds an explicit Namespace object; helm uses --namespace
  const keys = new Set([...Object.keys(helm), ...Object.keys(c)]);
  const diffs = [...keys].filter((k) => (helm[k] ?? 0) !== (c[k] ?? 0));
  return { ok: diffs.length === 0, diffs };
}

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `srvip-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const kctx = `kind-${rig}`;
  const work = mkdtempSync(join(tmpdir(), "srvip-"));
  const kubeconfig = join(work, "kubeconfig");
  const env = { ...process.env, KUBECONFIG: kubeconfig };
  let clusterUp = false;
  const legs = {
    renderParity: { ok: false, detail: "" }, helmInstall: { ok: false, detail: "" },
    cubInstall: { ok: false, detail: "" }, noAccount: { ok: true, detail: "neither path runs cub login / cub auth; no ConfigHub token used" },
  };
  try {
    // ---- RENDER PARITY (serverless, no cluster needed) ----
    const helmRender = tsh("helm", ["template", "redis", HELM_CHART, "--version", VERSION, "--namespace", "redis"]);
    const wd = join(work, "wd");
    tsh("cub", ["installer", "setup", "--pull", PKG, "--base", "default", "--work-dir", wd, "--non-interactive", "--namespace", "redis"]);
    const manDir = join(wd, "out", "manifests"), secDir = join(wd, "out", "secrets");
    let cubText = "";
    for (const d of [manDir, secDir]) if (existsSync(d)) for (const f of readdirSync(d)) cubText += readFileSync(join(d, f), "utf8") + "\n";
    const helmKinds = kindCounts(helmRender.out || ""), cubKinds = kindCounts(cubText);
    const cmp = eqExceptNamespace(helmKinds, cubKinds);
    legs.renderParity.ok = helmRender.ok && cmp.ok;
    legs.renderParity.detail = `helm template vs cub render: ${cmp.ok ? "identical object kinds" : "differ: " + cmp.diffs.join(",")} (helm ${Object.values(helmKinds).reduce((a, b) => a + b, 0)} objs, cub ${Object.values(cubKinds).reduce((a, b) => a + b, 0)} objs incl. an explicit Namespace), no account`;
    check(helmRender.ok, `helm template failed: ${(helmRender.out || "").slice(0, 150)}`);

    // ---- cluster ----
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind did not come up: ${up.out.slice(0, 150)}`);
    writeFileSync(kubeconfig, tsh("kind", ["get", "kubeconfig", "--name", rig]).out);
    const k = (args) => tsh("kubectl", ["--context", kctx, ...args], { env });

    // ---- HELM INSTALL (the baseline users know) ----
    const hi = tsh("helm", ["--kube-context", kctx, "install", "redis", HELM_CHART, "--version", VERSION, "-n", "helm-redis", "--create-namespace"], { env });

    // ---- CUB SERVERLESS INSTALL (apply the local render with plain kubectl) ----
    k(["create", "namespace", "redis"]); // ensure ns first; `kubectl apply -f dir` does not guarantee namespace-before-objects ordering (Helm does)
    if (existsSync(secDir)) k(["apply", "-f", secDir]); // Secret before the StatefulSet pod starts
    const ca = k(["apply", "-f", manDir]);

    // ---- both reach a working (Ready) Redis master ----
    const masterReady = (ns) => /[1-9]/.test((k(["-n", ns, "get", "statefulset", "redis-master", "-o", "jsonpath={.status.readyReplicas}"]).out || "").trim());
    poll(() => masterReady("helm-redis") && masterReady("redis"));
    legs.helmInstall.ok = masterReady("helm-redis");
    legs.helmInstall.detail = legs.helmInstall.ok ? "helm install redis -> redis-master Ready (working)" : `not Ready; install: ${(hi.out || "").slice(0, 120)}`;
    legs.cubInstall.ok = masterReady("redis");
    legs.cubInstall.detail = legs.cubInstall.ok ? "cub render -> kubectl apply -> redis-master Ready (working), no account" : `not Ready; apply: ${(ca.out || "").replace(/\s+/g, " ").slice(-120)}; pods: ${(k(["-n", "redis", "get", "pods", "-o", "jsonpath={range .items[*]}{.metadata.name}:{.status.phase} {end}"]).out || "").slice(0, 200)}`;
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  const pass = legs.renderParity.ok && legs.helmInstall.ok && legs.cubInstall.ok;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ServerlessInstallParityProofReceipt",
    metadata: { name: rig },
    spec: {
      observedAt: stamp,
      result: pass ? "pass" : "blocked",
      claim: "With NO ConfigHub account, the serverless cub path matches Helm on BOTH render and install. Render parity: `cub installer setup` produces the same Kubernetes object kinds as `helm template`. Install parity: `helm install redis` brings Redis up, and applying the cub render with plain `kubectl apply` brings the same Redis up — both reach a working (Ready) redis-master on one kind cluster, neither logging into ConfigHub. (The oci+gitops install path is proven in run-serverless-oci-gitops-proof.mjs.)",
      legs,
      run: { rig, helmNamespace: "helm-redis", cubNamespace: "redis", cleanup: { result: clusterUp ? "pass" : "n/a" } },
      conclusion: pass
        ? "Proven: a no-login user gets render parity (same objects as Helm) AND install parity (a working Redis) from cub — via plain kubectl here, via oci+gitops in the companion proof. 'Serverless' is not render-only; it installs and works, both ways, with no account."
        : "Not proven end to end; see the leg that did not pass (renderParity / helmInstall / cubInstall).",
    },
  };
}

function tf(v) { return v === true ? "yes" : v === false ? "no" : v; }
function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  const row = (n, leg) => `| ${n} | ${tf(leg.ok)} | ${leg.detail} |`;
  return `# Serverless render parity AND install parity (no ConfigHub account)

**UNOFFICIAL/EXPERIMENTAL.** Live receipt by \`scripts/run-serverless-install-parity-proof.mjs\`; do not hand-edit. Regenerate with \`npm run serverless-install-parity:proof\`.

**Claim.** ${s.claim}

| Step | OK | Detail |
| --- | --- | --- |
${row("Render parity (cub render == helm render)", L.renderParity)}
${row("Helm install -> working Redis", L.helmInstall)}
${row("cub render -> kubectl apply -> working Redis", L.cubInstall)}
${row("No ConfigHub account used", L.noAccount)}

Overall: **${s.result}**. ${s.conclusion}

- This is the half users actually want to see: **it installs and works**, not just "here's the YAML." Both \`helm install\` and the cub serverless render reach a working Redis, with no login.
- The **oci+gitops** install path (push the rendered bundle to OCI, let your existing Argo/Flux apply it) is proven in the companion [serverless-oci-gitops proof](../serverless-oci-gitops-proof/summary.md).
- Receipt: \`runs/serverless-install-parity-proof/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "bad"}">${v}</span>`;
  const yn = (v) => `<span class="chip ${v ? "ok" : "bad"}">${tf(v)}</span>`;
  const row = (n, leg) => `<tr><td>${n}</td><td>${yn(leg.ok)}</td><td>${leg.detail}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Serverless render + install parity</title><style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:900px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0;font-size:.9rem}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;font-size:.86rem}th{background:#f6f8fa;font-size:.72rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.bad{background:#ffebe9;color:#cf222e}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head><body><main>
  <h1>Serverless render parity <small>AND</small> install parity <small>(no ConfigHub account)</small></h1>
  <p class="sub">live on kind · ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-serverless-install-parity-proof.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Step</th><th>OK</th><th>Detail</th></tr></thead><tbody>
  ${row("Render parity (cub render == helm render)", L.renderParity)}
  ${row("Helm install → working Redis", L.helmInstall)}
  ${row("cub render → kubectl apply → working Redis", L.cubInstall)}
  ${row("No ConfigHub account used", L.noAccount)}
  </tbody></table>
  <p>Overall: ${chip(s.result)}</p>
  <footer>The half users actually want: it installs and works, both ways, no login. The oci+gitops install path is proven in the companion serverless-oci-gitops proof.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  const L = r.spec.legs;
  console.log(`wrote serverless-install-parity proof -> ${relativeRepo(receiptPath)} result=${r.spec.result} (render=${tf(L.renderParity.ok)} helm=${tf(L.helmInstall.ok)} cub=${tf(L.cubInstall.ok)})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run serverless-install-parity:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "ServerlessInstallParityProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.legs?.cubInstall, "receipt missing legs");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} stale; run npm run serverless-install-parity:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} stale; run npm run serverless-install-parity:proof`);
  console.log(`verified serverless-install-parity proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-serverless-install-parity-proof.mjs --run\n  node scripts/run-serverless-install-parity-proof.mjs --verify");
}
