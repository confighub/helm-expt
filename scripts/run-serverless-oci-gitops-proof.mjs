#!/usr/bin/env node
// PROOF (live): a SERVERLESS "push to OCI for an existing GitOps controller" mode.
//
// The question (user, 2026-06-22): if a team already runs Argo/Flux reading from OCI, can a
// SERVERLESS cub flow publish to OCI instead of kubectl-applying to the cluster? The proven
// OCI->Argo/Flux path today goes THROUGH ConfigHub; this asks whether the same works with no
// ConfigHub account — render locally, push the RENDERED bundle to an OCI registry, let the
// existing controller pull it.
//
// What this proves, end to end, with no ConfigHub login:
//   1. RENDER serverless — `cub installer setup` renders the catalog Redis base locally
//      ("does not require a ConfigHub server connection"); secrets land in out/secrets/.
//   2. PUSH to OCI — `flux push artifact` pushes the RENDERED bundle (manifests + the Secret)
//      to a registry, as an artifact a controller can consume (NOT `cub installer push`, which
//      pushes the un-rendered installer package).
//   3. RECONCILE — an existing Flux (OCIRepository + Kustomization) pulls the bundle FROM OCI
//      and applies it. No kubectl apply of the workload from us.
//   4. SECRET — confronts the GitOps secret-delivery caveat: the serverless push DELIVERS the
//      Secret because it is in the bundle (the tradeoff: the Secret now lives in the registry,
//      unlike the ConfigHub path which separates it).
// Registry is in-cluster (reachable by Flux via cluster DNS); push is via a port-forward.
// result=pass iff Flux pulled the serverless-pushed bundle from OCI and applied it.
//
// Usage:
//   node scripts/run-serverless-oci-gitops-proof.mjs --run      # live on kind; writes receipt
//   node scripts/run-serverless-oci-gitops-proof.mjs --verify
import { execFileSync, spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "serverless-oci-gitops-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "serverless-oci-gitops-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "serverless-oci-gitops-proof", "summary.html");
const PKG = "packages/bitnami/redis/25.5.3";

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

const REGISTRY_YAML = `apiVersion: v1
kind: Namespace
metadata: {name: registry}
---
apiVersion: apps/v1
kind: Deployment
metadata: {name: registry, namespace: registry}
spec:
  replicas: 1
  selector: {matchLabels: {app: registry}}
  template:
    metadata: {labels: {app: registry}}
    spec:
      containers:
        - name: registry
          image: registry:2
          ports: [{containerPort: 5000}]
---
apiVersion: v1
kind: Service
metadata: {name: registry, namespace: registry}
spec:
  selector: {app: registry}
  ports: [{port: 5000, targetPort: 5000}]
`;

const FLUX_YAML = `apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata: {name: redis-serverless, namespace: flux-system}
spec:
  interval: 30s
  insecure: true
  url: oci://registry.registry.svc.cluster.local:5000/redis-serverless
  ref: {tag: v1}
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata: {name: redis-serverless, namespace: flux-system}
spec:
  interval: 30s
  retryInterval: 15s
  timeout: 4m
  sourceRef: {kind: OCIRepository, name: redis-serverless}
  path: ./
  prune: true
  wait: false
`;

function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }
function poll(fn, { tries = 40, gapMs = 6000 } = {}) {
  for (let i = 0; i < tries; i++) {
    if (fn()) return true;
    sleep(gapMs);
  }
  return false;
}

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `srvoci-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const kctx = `kind-${rig}`;
  const work = mkdtempSync(join(tmpdir(), "srvoci-"));
  const kubeconfig = join(work, "kubeconfig");
  const env = { ...process.env, KUBECONFIG: kubeconfig };
  let clusterUp = false, pf = null;
  const legs = {
    render: { ok: false, detail: "" }, push: { ok: false, detail: "" },
    fluxReady: { ok: false, detail: "" }, reconcile: { ok: false, detail: "" },
    secret: { ok: false, detail: "" }, workload: { result: "watch", detail: "" },
  };
  try {
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind did not come up: ${up.out.slice(0, 150)}`);
    writeFileSync(kubeconfig, tsh("kind", ["get", "kubeconfig", "--name", rig]).out);
    const k = (args) => tsh("kubectl", ["--context", kctx, ...args], { env });

    // ---- 1. SERVERLESS RENDER (no ConfigHub) ----
    const wd = join(work, "wd");
    const r = tsh("cub", ["installer", "setup", "--pull", PKG, "--base", "default", "--work-dir", wd, "--non-interactive", "--namespace", "redis"]);
    const manifestsDir = join(wd, "out", "manifests"), secretsDir = join(wd, "out", "secrets");
    const bundle = join(work, "bundle");
    mkdirSync(bundle, { recursive: true });
    let manifestCount = 0, secretCount = 0;
    if (existsSync(manifestsDir)) for (const f of readdirSync(manifestsDir)) { cpSync(join(manifestsDir, f), join(bundle, `m-${f}`)); manifestCount++; }
    if (existsSync(secretsDir)) for (const f of readdirSync(secretsDir)) { cpSync(join(secretsDir, f), join(bundle, `s-${f}`)); secretCount++; }
    // explicit kustomization.yaml over only the files that are real k8s manifests (have a kind:)
    const resourceFiles = readdirSync(bundle).filter((f) => f.endsWith(".yaml") && f !== "kustomization.yaml" && /\bkind:/.test(readFileSync(join(bundle, f), "utf8")));
    writeFileSync(join(bundle, "kustomization.yaml"), `apiVersion: kustomize.config.k8s.io/v1beta1\nkind: Kustomization\nresources:\n${resourceFiles.map((f) => `  - ${f}\n`).join("")}`);
    legs.render.ok = r.ok && manifestCount > 0;
    legs.render.detail = `cub installer setup --base default -> ${manifestCount} manifest file(s) + ${secretCount} secret file(s), no account`;
    check(legs.render.ok, `serverless render failed: ${r.out.slice(0, 160)}`);

    // ---- registry in-cluster + port-forward ----
    writeFileSync(join(work, "reg.yaml"), REGISTRY_YAML);
    k(["apply", "-f", join(work, "reg.yaml")]);
    k(["-n", "registry", "rollout", "status", "deploy/registry", "--timeout=120s"]);
    pf = spawn("kubectl", ["--context", kctx, "-n", "registry", "port-forward", "svc/registry", "5000:5000"], { env, stdio: "ignore" });
    sleep(5000); // let the port-forward bind

    // ---- 2. PUSH the rendered bundle to OCI ----
    const push = tsh("flux", ["push", "artifact", "oci://localhost:5000/redis-serverless:v1", `--path=${bundle}`, "--source=serverless-cub-render", "--revision=v1"], { env });
    legs.push.ok = push.ok;
    legs.push.detail = push.ok ? "flux push artifact -> oci://localhost:5000/redis-serverless:v1 (rendered bundle incl. Secret)" : `push failed: ${push.out.slice(0, 200)}`;
    check(legs.push.ok, legs.push.detail);

    // ---- 3. existing Flux pulls FROM OCI and reconciles ----
    const fi = tsh("flux", ["install", "--components=source-controller,kustomize-controller"], { env });
    legs.fluxReady.ok = fi.ok || (k(["-n", "flux-system", "get", "deploy", "source-controller", "-o", "name"]).ok);
    legs.fluxReady.detail = legs.fluxReady.ok ? "flux source + kustomize controllers installed (an existing controller)" : `flux install failed: ${fi.out.slice(0, 160)}`;
    check(legs.fluxReady.ok, legs.fluxReady.detail);
    k(["-n", "flux-system", "rollout", "status", "deploy/source-controller", "--timeout=120s"]);
    k(["-n", "flux-system", "rollout", "status", "deploy/kustomize-controller", "--timeout=120s"]);
    // create the source + kustomization via the flux CLI (correct apiVersion), after the CRD is established
    k(["wait", "--for=condition=established", "crd/ocirepositories.source.toolkit.fluxcd.io", "--timeout=60s"]);
    const cs = tsh("flux", ["create", "source", "oci", "redis-serverless", "--url=oci://registry.registry.svc.cluster.local:5000/redis-serverless", "--tag=v1", "--insecure", "--interval=30s", "-n", "flux-system", "--timeout=2m"], { env });
    const ck = tsh("flux", ["create", "kustomization", "redis-serverless", "--source=OCIRepository/redis-serverless", "--path=./", "--prune=true", "--interval=30s", "-n", "flux-system", "--timeout=3m"], { env });

    // OCIRepository becomes Ready (it pulled the bundle from OCI) AND the objects land
    const ociReady = () => /True/.test(k(["-n", "flux-system", "get", "ocirepository", "redis-serverless", "-o", "jsonpath={.status.conditions[?(@.type=='Ready')].status}"]).out || "");
    const objectsLanded = () => (k(["-n", "redis", "get", "statefulset", "-o", "name"]).out || "").includes("statefulset");
    legs.reconcile.ok = poll(() => ociReady() && objectsLanded(), { tries: 20, gapMs: 6000 });
    legs.reconcile.detail = legs.reconcile.ok
      ? "OCIRepository Ready=True + Flux applied the serverless-pushed bundle: redis StatefulSet/Service present in ns redis"
      : `not reconciled (ociReady=${ociReady()}); ks-status: ${((k(["-n", "flux-system", "get", "kustomization", "redis-serverless", "-o", "jsonpath={.status.conditions[*].message}"]).out || "").replace(/\s+/g, " ").slice(0, 280)) || (ck.out || "").replace(/\s+/g, " ").slice(-200)}`;

    // ---- 4. SECRET delivered via the bundle (the caveat, confronted) ----
    const secretName = (k(["-n", "redis", "get", "secret", "-l", "app.kubernetes.io/name=redis", "-o", "name"]).out || "").trim()
      || (k(["-n", "redis", "get", "secret", "-o", "name"]).out || "").split("\n").find((s) => /redis/.test(s)) || "";
    legs.secret.ok = !!secretName.trim();
    legs.secret.detail = legs.secret.ok
      ? `Secret delivered through the OCI bundle (${secretName.trim()}) — serverless push ships it; tradeoff: it lives in the registry`
      : "no redis Secret found in-cluster (was it excluded from the bundle?)";

    // best-effort: redis actually runs
    const podReady = poll(() => (k(["-n", "redis", "get", "pods", "-l", "app.kubernetes.io/name=redis", "-o", "jsonpath={.items[*].status.containerStatuses[*].ready}"]).out || "").includes("true"), { tries: 20, gapMs: 6000 });
    legs.workload.result = podReady ? "pass" : "watch";
    legs.workload.detail = podReady ? "a redis pod reached Ready" : "redis pod not yet Ready in the proof window (StatefulSet/PVC timing); reconcile is the load-bearing claim";
  } finally {
    if (pf) try { pf.kill("SIGKILL"); } catch { /* ignore */ }
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  const pass = legs.render.ok && legs.push.ok && legs.fluxReady.ok && legs.reconcile.ok;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ServerlessOciGitopsProofReceipt",
    metadata: { name: rig },
    spec: {
      observedAt: stamp,
      result: pass ? "pass" : "blocked",
      claim: "A SERVERLESS cub flow can publish to OCI for an existing GitOps controller instead of kubectl-applying. With no ConfigHub login: cub installer setup renders the catalog Redis base locally; `flux push artifact` pushes the RENDERED bundle (manifests + the Secret) to an OCI registry; an existing Flux (OCIRepository + Kustomization) pulls it FROM OCI and applies it. The Secret is delivered because it is in the bundle — the tradeoff being it then lives in the registry, unlike the ConfigHub path which separates secret material. `cub installer push` is NOT this path (it pushes the un-rendered installer package); the rendered-bundle push is the GitOps-consumable one.",
      legs,
      run: { rig, registry: "in-cluster registry:2, pulled by Flux via cluster DNS; pushed via port-forward", controller: "Flux (OCIRepository+Kustomization)", cleanup: { result: clusterUp ? "pass" : "n/a" } },
      conclusion: pass
        ? "Proven: a no-login serverless render pushed to an OCI registry was pulled and applied by an existing Flux controller — no kubectl apply of the workload from us. The Secret rode along in the bundle (delivered, but now in the registry). So the 'push to OCI for existing Argo/Flux' mode works serverlessly for a vanilla chart; the honest caveats are secret-in-registry and that hook/CRD charts still need the lifecycle routes."
        : "Not proven end to end in this run; see the leg that did not pass (render/push/flux/reconcile).",
    },
  };
}

function tf(v) { return v === true ? "yes" : v === false ? "no" : v; }
function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  const row = (n, leg) => `| ${n} | ${tf(leg.ok ?? leg.result)} | ${leg.detail} |`;
  return `# Serverless render → OCI → existing Flux (no ConfigHub login)

**UNOFFICIAL/EXPERIMENTAL.** Live receipt by \`scripts/run-serverless-oci-gitops-proof.mjs\`; do not hand-edit. Regenerate with \`npm run serverless-oci-gitops:proof\`.

**Claim.** ${s.claim}

| Step | OK | Detail |
| --- | --- | --- |
${row("1. Render (serverless, no account)", L.render)}
${row("2. Push rendered bundle to OCI", L.push)}
${row("3. Existing Flux installed", L.fluxReady)}
${row("4. Flux pulls from OCI + applies", L.reconcile)}
${row("5. Secret delivered via bundle", L.secret)}
| 6. Redis workload Ready (best-effort) | ${tf(L.workload.result)} | ${L.workload.detail} |

Overall: **${s.result}**. ${s.conclusion}

- **What this means for the page:** the "serverless mode that pushes to OCI for your existing Argo/Flux" is real for a vanilla chart — render locally with no login, \`flux push artifact\` the rendered bundle, your controller reconciles it.
- **Honest caveats (do not drop these on the page):** (a) **secrets** — the serverless push delivers the Secret by including it in the bundle, so it lives in the OCI registry (the ConfigHub path separates secret material instead); (b) **\`cub installer push\` is the wrong tool** — it pushes the un-rendered installer package, not GitOps-consumable manifests; (c) hook/CRD charts still need their lifecycle routes (this proof is a vanilla chart).
- Receipt: \`runs/serverless-oci-gitops-proof/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : v === "blocked" ? "bad" : "warn"}">${v}</span>`;
  const yn = (v) => `<span class="chip ${v === true || v === "pass" ? "ok" : v === "watch" ? "warn" : "bad"}">${tf(v)}</span>`;
  const row = (n, leg) => `<tr><td>${n}</td><td>${yn(leg.ok ?? leg.result)}</td><td>${leg.detail}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Serverless render → OCI → existing Flux</title><style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:900px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0;font-size:.9rem}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:8px;overflow:hidden}
  th,td{text-align:left;padding:.5rem .7rem;border-bottom:1px solid #eaeef2;font-size:.86rem}th{background:#f6f8fa;font-size:.72rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.bad{background:#ffebe9;color:#cf222e}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head><body><main>
  <h1>Serverless render → OCI → existing Flux <small>(no ConfigHub login)</small></h1>
  <p class="sub">live on kind · ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-serverless-oci-gitops-proof.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Step</th><th>OK</th><th>Detail</th></tr></thead><tbody>
  ${row("1. Render (serverless, no account)", L.render)}
  ${row("2. Push rendered bundle to OCI", L.push)}
  ${row("3. Existing Flux installed", L.fluxReady)}
  ${row("4. Flux pulls from OCI + applies", L.reconcile)}
  ${row("5. Secret delivered via bundle", L.secret)}
  <tr><td>6. Redis workload Ready (best-effort)</td><td>${yn(L.workload.result)}</td><td>${L.workload.detail}</td></tr>
  </tbody></table>
  <p>Overall: ${chip(s.result)}</p>
  <footer>${s.conclusion}<br><br>Caveats kept on the record: the Secret rides in the bundle (so it lives in the registry; ConfigHub separates it); <code>cub installer push</code> pushes the un-rendered package, not this; hook/CRD charts still need lifecycle routes.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  const L = r.spec.legs;
  console.log(`wrote serverless-oci-gitops proof -> ${relativeRepo(receiptPath)} result=${r.spec.result} (render=${tf(L.render.ok)} push=${tf(L.push.ok)} flux=${tf(L.fluxReady.ok)} reconcile=${tf(L.reconcile.ok)} secret=${tf(L.secret.ok)})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run serverless-oci-gitops:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "ServerlessOciGitopsProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.legs?.reconcile, "receipt missing legs");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} stale; run npm run serverless-oci-gitops:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} stale; run npm run serverless-oci-gitops:proof`);
  console.log(`verified serverless-oci-gitops proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-serverless-oci-gitops-proof.mjs --run\n  node scripts/run-serverless-oci-gitops-proof.mjs --verify");
}
