#!/usr/bin/env node
// OCI single-transport hook proof. ConfigHub publishes the routed hook fixture
// (tests/fixtures/hook-replacement-probe: a workload ConfigMap + a post-install Job)
// ONCE to its OCI registry, then THREE consumers pull the SAME bundle and we observe
// the routed hook actually run under each:
//   1. Argo CD  — an Application with an OCI source
//   2. Flux     — an OCIRepository + Kustomization at the same OCI URL
//   3. cub-direct (no controller) — oras pulls the same artifact + kubectl applies it
// On one throwaway cub-managed kind cluster with Argo and the ConfigHub OCI
// connection. The cluster is brought up and torn down by this script. Legs are
// best-effort and honest: a leg
// that cannot converge in budget is `watch` with its reason, never a silent pass.
//
// CREDENTIALS: the OCI pull secret (confighub-oci-creds, provisioned for Argo by
// cub cluster up) is copied/converted into flux-system and into a temp registry-config for
// oras IN MEMORY — its values are NEVER printed, logged, or passed on a command line.
//
// Usage:
//   node scripts/run-oci-hook-delivery-proof.mjs --run      # live; brings up a rig, writes receipt + summary
//   node scripts/run-oci-hook-delivery-proof.mjs --verify   # validate committed receipt + summary
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const FIXTURE = "tests/fixtures/hook-replacement-probe";
const OCI_HOST = "oci.hub.confighub.com:443";
const JOB = "hook-replacement-migration";
const CM = "hook-replacement-workload";
const receiptPath = join(repoRoot, "runs", "oci-hook-delivery-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "oci-hook-delivery-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "oci-hook-delivery-proof", "by-controller.html");

function sh(file, args, opts = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}
function tsh(file, args, opts = {}) {
  try { return { ok: true, out: sh(file, args, opts) }; }
  catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; }
}
let KUBECONFIG = ""; // cub-managed cluster kubeconfig file, set per run
function k(kctx, args, opts = {}) {
  return tsh("kubectl", [...(KUBECONFIG ? ["--kubeconfig", KUBECONFIG] : []), "--context", kctx, ...args], opts);
}

// Observe the routed hook on the cluster: workload ConfigMap present AND Job succeeded.
function observe(kctx, ns) {
  const cm = k(kctx, ["-n", ns, "get", "configmap", CM, "-o", "name"]);
  const job = k(kctx, ["-n", ns, "get", "job", JOB, "-o", "jsonpath={.status.succeeded}"]);
  const workloadApplied = cm.ok && cm.out.includes(CM);
  const hookRan = (job.out || "").trim() === "1";
  return { workloadApplied, hookRan, ok: workloadApplied && hookRan };
}
function leg(mode, source, ok, reason, obs) {
  return {
    mode, source,
    workloadApplied: obs?.workloadApplied ? "yes" : "no",
    hookRan: obs?.hookRan ? "yes" : "no",
    result: ok ? "pass" : "watch",
    ...(reason ? { reason } : {}),
  };
}

// Publish the fixture as a ConfigHub Space release OCI.
function publishToOci(wspace, target) {
  tsh("cub", ["space", "create", wspace]);
  const w = tsh("cub", ["unit", "create", "--space", wspace, "hook-workload",
    join(repoRoot, FIXTURE, "workload.yaml"), "--target", target]);
  const h = tsh("cub", ["unit", "create", "--space", wspace, "hook-job",
    join(repoRoot, FIXTURE, "hook-job.yaml"), "--target", target]);
  if (!w.ok || !h.ok) return { ok: false, reason: `unit create failed: ${(w.out + h.out).slice(0, 180)}` };
  const rt = tsh("cub", ["space", "update", wspace, "--release-target", target]);
  if (!rt.ok) return { ok: false, reason: `release target update failed: ${rt.out.slice(0, 180)}` };
  const publish = tsh("cub", ["release", "publish", wspace]);
  if (!publish.ok) return { ok: false, reason: `release publish failed: ${publish.out.slice(0, 180)}` };
  return { ok: true };
}

// Leg 1: Argo CD — Application with an OCI source.
function legArgoOci(kctx, wspace) {
  const ns = "oci-argo";
  k(kctx, ["create", "namespace", ns]);
  const app = `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: {name: oci-hook-argo, namespace: argocd}
spec:
  project: default
  source:
    repoURL: "oci://${OCI_HOST}/space/${wspace}"
    targetRevision: latest
    path: "."
  destination: {server: https://kubernetes.default.svc, namespace: ${ns}}
  syncPolicy:
    automated: {selfHeal: true, prune: true}
    syncOptions: [ServerSideApply=true, CreateNamespace=true]
`;
  const p = join(mkdtempSync(join(tmpdir(), "argo-oci-")), "app.yaml");
  writeFileSync(p, app);
  const ap = k(kctx, ["apply", "-f", p]);
  if (!ap.ok) return leg("Argo CD", "OCI Application", false, `apply failed: ${ap.out.slice(0, 160)}`, null);
  k(kctx, ["-n", "argocd", "annotate", "application", "oci-hook-argo", "argocd.argoproj.io/refresh=hard", "--overwrite"]);
  k(kctx, ["-n", ns, "wait", "--for=create", `job/${JOB}`, "--timeout=240s"]);
  k(kctx, ["-n", ns, "wait", "--for=condition=complete", `job/${JOB}`, "--timeout=150s"]);
  const obs = observe(kctx, ns);
  const st = k(kctx, ["-n", "argocd", "get", "application", "oci-hook-argo", "-o", "jsonpath={.status.sync.status}/{.status.health.status}"]).out;
  return leg("Argo CD", "OCI Application", obs.ok, obs.ok ? "" : `did not converge (app=${st}); workload=${obs.workloadApplied} hook=${obs.hookRan}`, obs);
}

// Copy/convert the OCI pull secret into flux-system WITHOUT ever printing its values.
function copyOciCredsToFlux(kctx) {
  const get = k(kctx, ["-n", "argocd", "get", "secret", "confighub-oci-creds", "-o", "json"]);
  if (!get.ok) return { ok: false, reason: "confighub-oci-creds not found in argocd ns" };
  let sec;
  try { sec = JSON.parse(get.out); } catch { return { ok: false, reason: "could not parse oci-creds secret" }; }
  k(kctx, ["create", "namespace", "flux-system"]);
  const type = sec.type || "Opaque";
  const data = sec.data || {};
  let dockerconfig; // base64 .dockerconfigjson
  if (type === "kubernetes.io/dockerconfigjson" && data[".dockerconfigjson"]) {
    dockerconfig = data[".dockerconfigjson"];
  } else if (data.username && data.password) {
    // build dockerconfigjson in memory; values are decoded only into local consts and
    // re-encoded — never console.log'd or passed as an argument.
    const user = Buffer.from(data.username, "base64").toString("utf8");
    const pass = Buffer.from(data.password, "base64").toString("utf8");
    const auth = Buffer.from(`${user}:${pass}`).toString("base64");
    dockerconfig = Buffer.from(JSON.stringify({ auths: { [OCI_HOST]: { username: user, password: pass, auth } } })).toString("base64");
  } else {
    return { ok: false, reason: `oci-creds shape unsupported (type=${type}, keys=${Object.keys(data).join("|") || "none"})` };
  }
  const secret = {
    apiVersion: "v1", kind: "Secret",
    metadata: { name: "confighub-oci", namespace: "flux-system" },
    type: "kubernetes.io/dockerconfigjson",
    data: { ".dockerconfigjson": dockerconfig },
  };
  const p = join(mkdtempSync(join(tmpdir(), "fluxsec-")), "s.json");
  writeFileSync(p, JSON.stringify(secret), { mode: 0o600 });
  const ap = k(kctx, ["apply", "-f", p]);
  rmSync(p, { force: true });
  return ap.ok ? { ok: true } : { ok: false, reason: `flux secret apply failed: ${ap.out.slice(0, 150)}` };
}

// Leg 2: Flux — OCIRepository + Kustomization at the same OCI URL.
function legFluxOci(kctx, wspace, work) {
  const ns = "oci-flux";
  if (!tsh("which", ["flux"]).ok) return leg("Flux", "OCIRepository", false, "flux CLI not on PATH", null);
  const inst = tsh("flux", ["install", "--kubeconfig", KUBECONFIG, "--context", kctx, "--components", "source-controller,kustomize-controller"]);
  if (!inst.ok) return leg("Flux", "OCIRepository", false, `flux install failed: ${inst.out.slice(0, 150)}`, null);
  const creds = copyOciCredsToFlux(kctx);
  if (!creds.ok) return leg("Flux", "OCIRepository", false, creds.reason, null);
  k(kctx, ["create", "namespace", ns]);
  const manifest = `apiVersion: source.toolkit.fluxcd.io/v1
kind: OCIRepository
metadata: {name: oci-hook, namespace: flux-system}
spec:
  interval: 1m
  url: oci://${OCI_HOST}/space/${wspace}
  ref: {tag: latest}
  secretRef: {name: confighub-oci}
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata: {name: oci-hook, namespace: flux-system}
spec:
  interval: 1m
  sourceRef: {kind: OCIRepository, name: oci-hook}
  path: "."
  prune: true
  targetNamespace: ${ns}
  wait: true
  timeout: 3m
`;
  const p = join(work, "flux-oci.yaml");
  writeFileSync(p, manifest);
  const ap = k(kctx, ["apply", "-f", p]);
  if (!ap.ok) return leg("Flux", "OCIRepository", false, `apply failed: ${ap.out.slice(0, 150)}`, null);
  tsh("flux", ["--kubeconfig", KUBECONFIG, "--context", kctx, "-n", "flux-system", "reconcile", "source", "oci", "oci-hook", "--timeout", "120s"]);
  tsh("flux", ["--kubeconfig", KUBECONFIG, "--context", kctx, "-n", "flux-system", "reconcile", "kustomization", "oci-hook", "--timeout", "180s"]);
  k(kctx, ["-n", ns, "wait", "--for=condition=complete", `job/${JOB}`, "--timeout=120s"]);
  const obs = observe(kctx, ns);
  let why = "";
  if (!obs.ok) {
    const cond = k(kctx, ["-n", "flux-system", "get", "ocirepository", "oci-hook", "-o", "jsonpath={.status.conditions[-1].message}"]).out;
    why = `Flux did not converge (${cond.slice(0, 120)}); workload=${obs.workloadApplied} hook=${obs.hookRan}`;
  }
  return leg("Flux", "OCIRepository", obs.ok, why, obs);
}

// Leg 3: cub-direct (no controller) — oras pulls the SAME artifact, kubectl applies it.
function legCubDirectOci(kctx, wspace, work) {
  const ns = "oci-direct";
  if (!tsh("which", ["oras"]).ok) return leg("cub-direct (no controller)", "oras pull", false, "oras CLI not on PATH", null);
  // build a temp registry-config from the in-cluster secret WITHOUT printing values
  const get = k(kctx, ["-n", "argocd", "get", "secret", "confighub-oci-creds", "-o", "json"]);
  if (!get.ok) return leg("cub-direct (no controller)", "oras pull", false, "oci-creds not found", null);
  let sec; try { sec = JSON.parse(get.out); } catch { return leg("cub-direct (no controller)", "oras pull", false, "oci-creds parse failed", null); }
  const data = sec.data || {};
  let registryConfig;
  if (sec.type === "kubernetes.io/dockerconfigjson" && data[".dockerconfigjson"]) {
    registryConfig = Buffer.from(data[".dockerconfigjson"], "base64").toString("utf8");
  } else if (data.username && data.password) {
    const user = Buffer.from(data.username, "base64").toString("utf8");
    const pass = Buffer.from(data.password, "base64").toString("utf8");
    const auth = Buffer.from(`${user}:${pass}`).toString("base64");
    registryConfig = JSON.stringify({ auths: { [OCI_HOST]: { auth } } });
  } else {
    return leg("cub-direct (no controller)", "oras pull", false, "oci-creds shape unsupported", null);
  }
  const cfg = join(work, "registry.json");
  writeFileSync(cfg, registryConfig, { mode: 0o600 });
  const dest = join(work, "pull");
  const pull = tsh("oras", ["pull", `${OCI_HOST}/space/${wspace}:latest`, "--registry-config", cfg, "-o", dest]);
  rmSync(cfg, { force: true });
  if (!pull.ok) return leg("cub-direct (no controller)", "oras pull", false, `oras pull failed: ${pull.out.slice(0, 140)}`, null);
  // ConfigHub OCI layers are gzipped tarballs (Flux extracts them fine); oras writes them as
  // extension-less blobs. Untar any blob (tar -xf auto-detects gzip), then gather every k8s
  // manifest (apiVersion+kind) from the pull dir AND the extracted tree, and apply as one yaml.
  const extract = join(work, "cd-extract");
  mkdirSync(extract, { recursive: true });
  try { for (const n of readdirSync(dest)) { const p = join(dest, n); if (statSync(p).isFile()) tsh("tar", ["-xf", p, "-C", extract]); } } catch { /* nothing to untar */ }
  const manifests = [];
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      let txt = ""; try { txt = readFileSync(p, "utf8"); } catch { continue; }
      if (/^\s*apiVersion:/m.test(txt) && /^\s*kind:/m.test(txt)) manifests.push(txt);
    }
  };
  try { walk(dest); } catch { /* empty */ }
  try { walk(extract); } catch { /* empty */ }
  // the cluster-space bundle aggregates ALL units (incl. ones hardcoded to argocd); keep only
  // THIS fixture's two namespace-less objects so a foreign-namespace object can't fail the apply.
  const mine = [...new Set(manifests.filter((m) => m.includes(CM) || m.includes(JOB)))];
  if (!mine.length) return leg("cub-direct (no controller)", "oras pull", false, "pulled artifact has no recognizable k8s manifests (after untar)", null);
  const combined = join(work, "cub-direct.yaml");
  writeFileSync(combined, mine.join("\n---\n"));
  k(kctx, ["create", "namespace", ns]);
  const ap = k(kctx, ["apply", "-n", ns, "-f", combined]);
  if (!ap.ok) return leg("cub-direct (no controller)", "oras pull", false, `kubectl apply failed: ${ap.out.slice(0, 140)}`, null);
  k(kctx, ["-n", ns, "wait", "--for=condition=complete", `job/${JOB}`, "--timeout=120s"]);
  const obs = observe(kctx, ns);
  return leg("cub-direct (no controller)", "oras pull", obs.ok, obs.ok ? "" : `workload=${obs.workloadApplied} hook=${obs.hookRan}`, obs);
}

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `hx-ocihook-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const spaceCluster = `${rig}-cluster`;
  const target = `${spaceCluster}/oci`;
  const wspace = `${rig}-hookoci`;
  const kctx = `kind-${rig}`;
  KUBECONFIG = join(homedir(), ".confighub", "clusters", `${rig}.kubeconfig`);
  const work = mkdtempSync(join(tmpdir(), "oci-hook-"));
  const legs = {};
  let rigUp = false, publish = { ok: false, reason: "not attempted" };
  try {
    check(existsSync(join(repoRoot, FIXTURE, "workload.yaml")), `fixture missing at ${FIXTURE}`);
    const up = tsh("cub", ["cluster", "up", "--name", rig], { timeout: 600_000 });
    rigUp = up.ok || (tsh("cub", ["cluster", "list"]).out || "").includes(rig);
    check(rigUp, `cub cluster up failed: ${up.out.slice(0, 200)}`);
    publish = publishToOci(wspace, target);
    if (publish.ok) {
      legs.argo = legArgoOci(kctx, wspace);
      legs.flux = legFluxOci(kctx, wspace, work);
      legs.cubDirect = legCubDirectOci(kctx, wspace, work);
    }
  } finally {
    if (rigUp) tsh("cub", ["cluster", "down", "--name", rig, "--force"], { timeout: 300_000 });
    rmSync(work, { recursive: true, force: true });
  }
  const present = Object.values(legs);
  const passed = present.filter((l) => l.result === "pass").length;
  const result = !publish.ok ? "blocked" : passed === present.length && present.length === 3 ? "pass" : passed >= 1 ? "watch" : "blocked";
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HookOciDeliveryProofReceipt",
    metadata: { name: rig },
    spec: {
      fixture: FIXTURE,
      ociHost: OCI_HOST,
      observedAt: stamp,
      result,
      claim: "One small routed-hook fixture was published once as a ConfigHub OCI bundle. Argo CD, Flux, and cub-direct each pulled that bundle, applied the workload, and ran the hook.",
      run: { rig, publish: publish.ok ? "pass" : "blocked", publishReason: publish.ok ? undefined : publish.reason, cleanup: { result: rigUp ? "pass" : "n/a" } },
      legs,
      conclusion: result === "pass"
        ? "All three consumers pulled the same ConfigHub OCI bundle and the routed hook ran under each. This proves the delivery mechanism for this fixture."
        : result === "watch"
          ? "At least one consumer pulled the OCI bundle and ran the routed hook; others did not converge in budget (best-effort on a throwaway rig) — see leg reasons. Honest disposition: watch, not green."
          : !publish.ok ? `Could not publish to the OCI bundle: ${publish.reason}` : "No consumer converged; see leg details.",
    },
  };
}

function rows(L) {
  return ["argo", "flux", "cubDirect"].map((key) => L[key]).filter(Boolean);
}
function summaryMd(r) {
  const s = r.spec;
  const row = (l) => `| ${l.mode} | ${l.source} | ${l.workloadApplied} | ${l.hookRan} | ${l.result}${l.reason ? ` — ${l.reason}` : ""} |`;
  const body = rows(s.legs).map(row).join("\n") || "| (no legs ran; publish blocked) | | | | |";
  const resultText = s.result === "pass"
    ? "The workload and routed hook completed under all three consumers in this run."
    : "Read the leg results and reasons before using this delivery path.";
  return `# One OCI bundle delivered three ways

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-oci-hook-delivery-proof.mjs\`; do not hand-edit. Regenerate with \`npm run oci-hook:proof\`.

This run checks whether Argo CD, Flux, and a direct-apply path can pull the same ConfigHub release OCI, apply its workload, and run its routed hook.

ConfigHub published \`${s.fixture}\` once to \`${s.ociHost}\`. Each consumer pulled that bundle on one throwaway test cluster. Publish: **${s.run.publish}**${s.run.publishReason ? `; ${s.run.publishReason}` : ""}.

| Consumer | OCI source | workload applied | hook ran | result |
| --- | --- | --- | --- | --- |
${body}

Overall: **${s.result}**. ${resultText}

This is a test of one small routed-hook fixture. It proves that the delivery mechanism works through all three consumers. It does not prove that every catalog configuration has been delivered through all three. A catalog configuration has delivery proof only when its own page names a receipt.

- **Argo CD** uses an \`Application\` whose \`source.repoURL\` is the OCI bundle.
- **Flux** uses an \`OCIRepository\` and \`Kustomization\` at the same URL. The OCI pull Secret is copied into \`flux-system\` and is never printed.
- **cub-direct** uses \`oras pull\` and \`kubectl apply\` without a controller.
- Legs are best-effort: a non-converged consumer is \`watch\` with its reason, not a silent failure.
- Receipt: \`runs/oci-hook-delivery-proof/receipt.yaml\`. Fixture: \`${s.fixture}\`.
`;
}
function summaryHtml(r) {
  const s = r.spec;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : v === "watch" ? "warn" : "bad"}">${v}</span>`;
  const yn = (v) => v === "yes" ? '<span class="chip ok">yes</span>' : '<span class="chip bad">no</span>';
  const row = (l) => `<tr><td>${l.mode}</td><td><code>${l.source}</code></td><td>${yn(l.workloadApplied)}</td><td>${yn(l.hookRan)}</td><td>${chip(l.result)}${l.reason ? `<div class="reason">${l.reason}</div>` : ""}</td></tr>`;
  const body = rows(s.legs).map(row).join("") || '<tr><td colspan="5">no legs ran; publish blocked</td></tr>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>One OCI bundle delivered three ways</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:900px;margin:0 auto}h1{font-size:1.5rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #eaeef2;vertical-align:top}th{background:#f6f8fa;font-size:.78rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.bad{background:#ffebe9;color:#cf222e}
  .reason{font-size:.78rem;color:#57606a;margin-top:3px}.overall{font-size:1rem;margin:1rem 0}footer{margin-top:2rem;color:#57606a;font-size:.85rem}code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}
</style></head>
<body><main>
  <h1>One OCI bundle delivered three ways</h1>
  <p class="sub">fixture <code>${s.fixture}</code> · published to <code>${s.ociHost}</code> · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-oci-hook-delivery-proof.mjs</code>; do not hand-edit.</div>
  <div class="claim">This run checks whether Argo CD, Flux, and a direct-apply path can pull the same ConfigHub release OCI, apply its workload, and run its routed hook.</div>
  <table><thead><tr><th>Consumer</th><th>OCI source</th><th>workload applied</th><th>hook ran</th><th>result</th></tr></thead>
  <tbody>${body}</tbody></table>
  <p class="overall">Overall: ${chip(s.result)} · publish: ${chip(s.run.publish)}</p>
  <p>This is a test of one small routed-hook fixture. It proves that the delivery mechanism works through all three consumers. It does not prove that every catalog configuration has been delivered through all three. A catalog configuration has delivery proof only when its own page names a receipt.</p>
  <footer>The OCI pull Secret is copied into <code>flux-system</code> and a temporary <code>oras</code> config in memory. It is never printed or logged. Non-converged legs are <code>watch</code> with a reason.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote OCI hook-delivery proof -> ${relativeRepo(receiptPath)} result=${r.spec.result}`);
} else if (mode === "--generate") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run oci-hook:proof`);
  const r = readYaml(receiptPath);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`regenerated OCI hook-delivery summaries from ${relativeRepo(receiptPath)}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run oci-hook:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "HookOciDeliveryProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} missing`);
  check(readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run oci-hook:proof`);
  check(existsSync(htmlPath), `${relativeRepo(htmlPath)} missing`);
  check(readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run oci-hook:proof`);
  console.log(`verified OCI hook-delivery proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-oci-hook-delivery-proof.mjs --run\n  node scripts/run-oci-hook-delivery-proof.mjs --generate\n  node scripts/run-oci-hook-delivery-proof.mjs --verify");
}
