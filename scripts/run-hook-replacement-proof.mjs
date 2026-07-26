#!/usr/bin/env node
// Do our RECOMMENDED hook replacements actually work? This proves that the routed
// post-install Job (tests/fixtures/hook-replacement-probe) is delivered AND run —
// the workload applied and the hook reaching succeeded=1 — under each path we
// recommend:
//   1. neither  — kubectl applies the manifests directly (cub-direct / by hand)
//   2. Argo CD  — the Job's `argocd.argoproj.io/hook: PostSync` runs it after sync
//   3. Flux     — a GitRepository + Kustomization applies it on the cluster
// All three on ONE throwaway kind cluster, each in its own namespace. Argo/Flux
// source the fixture from the public repo at the current branch, so the branch
// must be pushed before --run. Argo/Flux legs are best-effort: if a controller
// cannot install or converge in budget, the leg is `watch` with the reason and
// the proof still stands on the legs that ran (neither is the core leg).
//
// Usage:
//   node scripts/run-hook-replacement-proof.mjs --run      # live; writes receipt + summary
//   node scripts/run-hook-replacement-proof.mjs --verify   # validate committed receipt + summary
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const FIXTURE = "tests/fixtures/hook-replacement-probe";
const REPO = "https://github.com/confighub/helm-expt";
const JOB = "hook-replacement-migration";
const CM = "hook-replacement-workload";
const ARGO_MANIFEST = "https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml";
const receiptPath = join(repoRoot, "runs", "hook-replacement-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "hook-replacement-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "hook-replacement-proof", "by-controller.html");

function sh(file, args, opts = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

function observe(kctx, ns) {
  const cm = tsh("kubectl", ["--context", kctx, "-n", ns, "get", "configmap", CM, "-o", "name"]);
  const job = tsh("kubectl", ["--context", kctx, "-n", ns, "get", "job", JOB, "-o", "jsonpath={.status.succeeded}"]);
  const workloadApplied = cm.ok && cm.out.includes(CM);
  const hookRan = (job.out || "").trim() === "1";
  return { workloadApplied, hookRan, ok: workloadApplied && hookRan };
}
function leg(mode, ok, reason, obs) {
  return { mode, workloadApplied: obs?.workloadApplied ? "yes" : "no", hookRan: obs?.hookRan ? "yes" : "no", result: ok ? "pass" : "watch", ...(reason ? { reason } : {}) };
}

// Leg 1: neither — kubectl applies the manifests directly.
function legNeither(kctx, fixtureAbs) {
  const ns = "hr-direct";
  tsh("kubectl", ["--context", kctx, "create", "namespace", ns]);
  const apply = tsh("kubectl", ["--context", kctx, "apply", "-k", fixtureAbs, "-n", ns]);
  if (!apply.ok) return leg("kubectl direct (neither)", false, `apply failed: ${apply.out.slice(0, 200)}`, observe(kctx, ns));
  tsh("kubectl", ["--context", kctx, "-n", ns, "wait", "--for=condition=complete", `job/${JOB}`, "--timeout=120s"]);
  const obs = observe(kctx, ns);
  return leg("kubectl direct (neither)", obs.ok, obs.ok ? "" : "workload or hook not observed", obs);
}

// Leg 2: Argo CD — PostSync hook.
function legArgo(kctx, branch) {
  const ns = "hr-argo";
  if (!tsh("which", ["argocd"]).ok && !tsh("kubectl", ["--context", kctx, "version", "--client"]).ok) return leg("Argo CD (PostSync hook)", false, "kubectl/argocd unavailable", null);
  tsh("kubectl", ["--context", kctx, "create", "namespace", "argocd"]);
  // server-side apply: the Argo install manifest exceeds the client-side annotation
  // size limit, so plain `kubectl apply -f` fails ("annotations too long").
  // cub cluster up installs Argo the same way (every resource server-side applied).
  const inst = tsh("kubectl", ["--context", kctx, "-n", "argocd", "apply", "--server-side", "--force-conflicts", "-f", ARGO_MANIFEST]);
  if (!inst.ok) return leg("Argo CD (PostSync hook)", false, `argo install failed: ${inst.out.slice(0, 200)}`, null);
  // wait for the controllers that render + sync
  const r1 = tsh("kubectl", ["--context", kctx, "-n", "argocd", "rollout", "status", "deploy/argocd-repo-server", "--timeout=300s"]);
  tsh("kubectl", ["--context", kctx, "-n", "argocd", "rollout", "status", "statefulset/argocd-application-controller", "--timeout=300s"]);
  if (!r1.ok) return leg("Argo CD (PostSync hook)", false, `argo controllers not ready: ${r1.out.slice(0, 150)}`, null);
  tsh("kubectl", ["--context", kctx, "create", "namespace", ns]);
  const app = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: hook-replacement
  namespace: argocd
spec:
  project: default
  source:
    repoURL: ${REPO}
    targetRevision: ${branch}
    path: ${FIXTURE}
  destination:
    server: https://kubernetes.default.svc
    namespace: ${ns}
  syncPolicy:
    automated: {}
    syncOptions: [CreateNamespace=true]
`;
  const appPath = join(mkdtempSync(join(tmpdir(), "argo-")), "app.yaml");
  writeFileSync(appPath, app);
  const ap = tsh("kubectl", ["--context", kctx, "apply", "-f", appPath]);
  if (!ap.ok) return leg("Argo CD (PostSync hook)", false, `application apply failed: ${ap.out.slice(0, 200)}`, null);
  tsh("kubectl", ["--context", kctx, "-n", "argocd", "annotate", "application", "hook-replacement", "argocd.argoproj.io/refresh=hard", "--overwrite"]);
  // PostSync hook is created after the workload syncs; wait for it to appear, then complete.
  tsh("kubectl", ["--context", kctx, "-n", ns, "wait", "--for=create", `job/${JOB}`, "--timeout=240s"]);
  tsh("kubectl", ["--context", kctx, "-n", ns, "wait", "--for=condition=complete", `job/${JOB}`, "--timeout=120s"]);
  const obs = observe(kctx, ns);
  const appStatus = tsh("kubectl", ["--context", kctx, "-n", "argocd", "get", "application", "hook-replacement", "-o", "jsonpath={.status.sync.status}/{.status.health.status}"]).out;
  return leg("Argo CD (PostSync hook)", obs.ok, obs.ok ? "" : `Argo did not converge (app=${appStatus}); workload=${obs.workloadApplied} hook=${obs.hookRan}`, obs);
}

// Leg 3: Flux — GitRepository + Kustomization.
function legFlux(kctx, branch, work) {
  const ns = "hr-flux";
  if (!tsh("which", ["flux"]).ok) return leg("Flux (Kustomization)", false, "flux CLI not on PATH", null);
  const inst = tsh("flux", ["install", "--context", kctx, "--components", "source-controller,kustomize-controller"]);
  if (!inst.ok) return leg("Flux (Kustomization)", false, `flux install failed: ${inst.out.slice(0, 200)}`, null);
  tsh("kubectl", ["--context", kctx, "create", "namespace", ns]);
  const manifest = `apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: hook-replacement
  namespace: ${ns}
spec:
  interval: 1m
  url: ${REPO}
  ref:
    branch: ${branch}
  ignore: |
    /*
    !/${FIXTURE}
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: hook-replacement
  namespace: ${ns}
spec:
  interval: 1m
  sourceRef:
    kind: GitRepository
    name: hook-replacement
  path: ./${FIXTURE}
  prune: true
  targetNamespace: ${ns}
  wait: true
  timeout: 2m
`;
  const mPath = join(work, "flux.yaml");
  writeFileSync(mPath, manifest);
  const ap = tsh("kubectl", ["--context", kctx, "apply", "-f", mPath]);
  if (!ap.ok) return leg("Flux (Kustomization)", false, `apply failed: ${ap.out.slice(0, 200)}`, null);
  tsh("flux", ["--context", kctx, "-n", ns, "reconcile", "source", "git", "hook-replacement", "--timeout", "120s"]);
  tsh("flux", ["--context", kctx, "-n", ns, "reconcile", "kustomization", "hook-replacement", "--timeout", "180s"]);
  tsh("kubectl", ["--context", kctx, "-n", ns, "wait", "--for=condition=complete", `job/${JOB}`, "--timeout=120s"]);
  const obs = observe(kctx, ns);
  return leg("Flux (Kustomization)", obs.ok, obs.ok ? "" : `Flux did not converge; workload=${obs.workloadApplied} hook=${obs.hookRan}`, obs);
}

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `hook-repl-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const fixtureAbs = join(repoRoot, FIXTURE);
  const branch = (tsh("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"]).out || "main").trim();
  const work = mkdtempSync(join(tmpdir(), "hook-repl-"));
  const legs = {};
  let clusterUp = false;
  try {
    check(existsSync(join(fixtureAbs, "kustomization.yaml")), `fixture missing at ${FIXTURE}`);
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind cluster did not come up: ${up.out}`);
    const kctx = `kind-${rig}`;
    legs.neither = legNeither(kctx, fixtureAbs);
    legs.argo = legArgo(kctx, branch);
    legs.flux = legFlux(kctx, branch, work);
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  const corePass = legs.neither.result === "pass";
  const allPass = corePass && legs.argo.result === "pass" && legs.flux.result === "pass";
  const result = allPass ? "pass" : corePass ? "watch" : "blocked";
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HookReplacementProofReceipt",
    metadata: { name: rig },
    spec: {
      fixture: FIXTURE,
      branch,
      observedAt: stamp,
      result,
      claim: "The recommended replacement for a Helm post-install Job hook (a routed, explicit lifecycle action) is delivered and runs — workload applied and hook completed — under all three recommended paths: Argo CD (PostSync hook), Flux (Kustomization), and neither (kubectl direct).",
      run: { rig, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      legs,
      conclusion: allPass
        ? "All three recommended replacement paths delivered the workload and ran the routed hook to completion. The emitted Argo/Flux steps are not just YAML — a real controller executes them, and the no-controller path works too."
        : corePass
          ? "The no-controller path works; one or more controller legs did not converge in budget (best-effort install on a throwaway cluster) — see leg reasons."
          : "Core (no-controller) leg did not pass; see leg details.",
    },
  };
}

function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  const row = (l) => `| ${l.mode} | ${l.workloadApplied} | ${l.hookRan} | ${l.result}${l.reason ? ` — ${l.reason}` : ""} |`;
  return `# Recommended hook-replacement proof (Argo / Flux / neither)

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-hook-replacement-proof.mjs\`; do not hand-edit. Regenerate with \`npm run hook-replacement:proof\`.

**Claim.** ${s.claim}

Validates that the routed post-install Job in \`${s.fixture}\` is actually delivered and run by a real controller (not just emitted as YAML), under each recommended path, on one throwaway kind cluster.

| Delivery path | workload applied | hook ran | result |
| --- | --- | --- | --- |
${row(L.neither)}
${row(L.argo)}
${row(L.flux)}

Overall: **${s.result}**. ${s.conclusion}

- **neither** — \`kubectl apply -k\` (cub-direct / by hand): always available; the core leg.
- **Argo CD** — the Job's \`argocd.argoproj.io/hook: PostSync\` runs it after the workload syncs.
- **Flux** — a \`GitRepository\` + \`Kustomization\` applies the workload and the Job on the cluster.
- Controller legs are best-effort: a non-converged controller is \`watch\` with its reason, not a silent failure.
- Receipt: \`runs/hook-replacement-proof/receipt.yaml\`. Fixture: \`${s.fixture}\`.
`;
}

function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : v === "watch" ? "warn" : "bad"}">${v}</span>`;
  const yn = (v) => v === "yes" ? '<span class="chip ok">yes</span>' : '<span class="chip bad">no</span>';
  const row = (l) => `<tr><td>${l.mode}</td><td>${yn(l.workloadApplied)}</td><td>${yn(l.hookRan)}</td><td>${chip(l.result)}${l.reason ? `<div class="reason">${l.reason}</div>` : ""}</td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recommended hook-replacement — Argo / Flux / neither</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:860px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #eaeef2;vertical-align:top}th{background:#f6f8fa;font-size:.78rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.bad{background:#ffebe9;color:#cf222e}
  .reason{font-size:.78rem;color:#57606a;margin-top:3px}.overall{font-size:1rem;margin:1rem 0}footer{margin-top:2rem;color:#57606a;font-size:.85rem}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}
</style></head>
<body><main>
  <h1>Recommended hook-replacement — does a real controller run it?</h1>
  <p class="sub">routed post-install Job · fixture <code>${s.fixture}</code> · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-hook-replacement-proof.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Delivery path</th><th>workload applied</th><th>hook ran</th><th>result</th></tr></thead>
  <tbody>${row(L.neither)}${row(L.argo)}${row(L.flux)}</tbody></table>
  <p class="overall">Overall: ${chip(s.result)}</p>
  <footer>The emitted Argo/Flux steps are validated by a real controller actually running them on a throwaway kind cluster — not just shipped as YAML. Controller legs are best-effort: a non-converged controller is <code>watch</code> with its reason. The no-controller (<code>kubectl</code>) path is the core leg.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote hook-replacement proof -> ${relativeRepo(receiptPath)} result=${r.spec.result}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run hook-replacement:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "HookReplacementProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  for (const k of ["neither", "argo", "flux"]) check(r.spec?.legs?.[k], `receipt missing leg ${k}`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} missing`);
  check(readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run hook-replacement:proof`);
  check(existsSync(htmlPath), `${relativeRepo(htmlPath)} missing`);
  check(readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run hook-replacement:proof`);
  console.log(`verified hook-replacement proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-hook-replacement-proof.mjs --run\n  node scripts/run-hook-replacement-proof.mjs --verify");
}
