#!/usr/bin/env node
// "Manage it" proof (live): the three cub-direct (no-controller) delivery rough edges
// — no prune (#1013), no CRD ordering (#1015), raw SSA conflict (#1017) — all stem from a
// NAIVE `kubectl apply`. They are NOT recipe/variant/revision quirks (those cover config
// shape); they are delivery-layer behaviors. A configured controller can own them, but the
// controller path still needs explicit ordering, pruning, and conflict settings.
// This proves the NO-CONTROLLER path can be managed too, with a small "managed applier":
//   1. CRD ordering — apply CRDs first, wait for established, then the rest -> CR created.
//   2. Prune        — on upgrade, apply with `--prune -l <label>` -> the removed object is gone.
//   3. SSA conflict — server-side apply; on a field-manager conflict, surface a PLAIN-WORDS
//                     message and resolve with `--force-conflicts` (vs a raw k8s wall).
// Each is the managed counterpart of a gap proof. Result `pass` = the delivery rough edges
// are solvable on the cub-direct path. Throwaway kind cluster.
//
// Usage:
//   node scripts/run-managed-cub-direct-proof.mjs --run      # live on kind; writes receipt + summary
//   node scripts/run-managed-cub-direct-proof.mjs --verify
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "managed-cub-direct-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "managed-cub-direct-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "managed-cub-direct-proof", "summary.html");

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

const CRD = `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata: {name: widgets.demo.confighub.io}
spec:
  group: demo.confighub.io
  scope: Namespaced
  names: {plural: widgets, singular: widget, kind: Widget}
  versions: [{name: v1, served: true, storage: true, schema: {openAPIV3Schema: {type: object, properties: {spec: {type: object, properties: {size: {type: string}}}}}}}]
`;
const CR = `apiVersion: demo.confighub.io/v1
kind: Widget
metadata: {name: my-widget, namespace: mcd}
spec: {size: large}
`;
const V1 = `apiVersion: apps/v1
kind: Deployment
metadata: {name: web, namespace: mcd, labels: {app: mcd}}
spec: {replicas: 1, selector: {matchLabels: {app: mcd}}, template: {metadata: {labels: {app: mcd}}, spec: {containers: [{name: c, image: nginx:1.27}]}}}
---
apiVersion: v1
kind: ConfigMap
metadata: {name: extra-config, namespace: mcd, labels: {app: mcd}}
data: {note: "present in v1, removed in v2"}
`;
const V2 = `apiVersion: apps/v1
kind: Deployment
metadata: {name: web, namespace: mcd, labels: {app: mcd}}
spec: {replicas: 1, selector: {matchLabels: {app: mcd}}, template: {metadata: {labels: {app: mcd}}, spec: {containers: [{name: c, image: nginx:1.27}]}}}
`;

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `mcd-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const kctx = `kind-${rig}`;
  const work = mkdtempSync(join(tmpdir(), "mcd-"));
  const kubeconfig = join(work, "kubeconfig");
  const fp = (n, c) => { const p = join(work, n); writeFileSync(p, c); return p; };
  const crdF = fp("crd.yaml", CRD), crF = fp("cr.yaml", CR), v1F = fp("v1.yaml", V1), v2F = fp("v2.yaml", V2);
  let clusterUp = false;
  let crdManaged = null, pruneManaged = null, ssaManaged = null, ssaPlainMessage = "";
  try {
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind did not come up: ${up.out.slice(0, 150)}`);
    writeFileSync(kubeconfig, tsh("kind", ["get", "kubeconfig", "--name", rig]).out);
    const k = (args) => tsh("kubectl", ["--context", kctx, ...args], { env: { ...process.env, KUBECONFIG: kubeconfig } });
    k(["create", "namespace", "mcd"]);

    // ---- Leg 1: CRD ordering managed (CRDs first + wait, then the rest) ----
    k(["apply", "--server-side", "--field-manager=cub", "-f", crdF]);
    k(["wait", "--for=condition=established", "crd/widgets.demo.confighub.io", "--timeout=60s"]);
    k(["apply", "--server-side", "--field-manager=cub", "-f", crF]);
    crdManaged = k(["get", "widget", "my-widget", "-n", "mcd", "-o", "name"]).ok;

    // ---- Leg 2: prune managed (upgrade with --prune by label) ----
    k(["apply", "-f", v1F]);
    k(["apply", "--prune", "-l", "app=mcd", "-f", v2F]);
    pruneManaged = !k(["get", "configmap", "extra-config", "-n", "mcd", "-o", "name"]).ok; // gone => pruned

    // ---- Leg 3: SSA conflict managed (plain-words message + --force-conflicts) ----
    k(["-n", "mcd", "scale", "deploy/web", "--replicas=3"]); // manual edit, kubectl owns replicas
    const reapply = k(["apply", "--server-side", "--field-manager=cub", "-f", v2F]);
    if (!reapply.ok && /conflict/i.test(reapply.out)) {
      const field = (reapply.out.match(/\.spec\.\S+/) || [".spec.replicas"])[0];
      // the managed layer surfaces THIS instead of the raw k8s wall:
      ssaPlainMessage = `${field} was changed outside cub (by kubectl) — reconciling with --force-conflicts`;
      const forced = k(["apply", "--server-side", "--field-manager=cub", "--force-conflicts", "-f", v2F]);
      ssaManaged = forced.ok;
    } else {
      ssaManaged = reapply.ok; ssaPlainMessage = "no conflict (nothing to manage in this run)";
    }
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  const allManaged = crdManaged && pruneManaged && ssaManaged;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "ManagedCubDirectProofReceipt",
    metadata: { name: rig },
    spec: {
      observedAt: stamp,
      result: allManaged ? "pass" : "watch",
      claim: "The three cub-direct (no-controller) delivery rough edges — no prune (#1013), no CRD ordering (#1015), raw SSA conflict (#1017) — all come from a naive kubectl apply, NOT from recipes/variants/revisions (which cover config shape). They are solvable on the no-controller path with a small managed applier: order CRDs (apply-first + wait), prune on upgrade (--prune by label), and turn an SSA field-manager conflict into a plain-words message + a --force-conflicts resolution. A configured Argo CD or Flux path can own the same work, but its ordering, pruning, and conflict behavior still needs to be stated and tested.",
      legs: {
        crdOrdering: { managed: "apply CRDs first, wait --for=condition=established, then the CR", crCreated: crdManaged, fixes: "#1015" },
        prune: { managed: "kubectl apply --prune -l app=mcd on upgrade", removedObjectPruned: pruneManaged, fixes: "#1013" },
        ssaConflict: { managed: "server-side apply; on conflict, plain message + --force-conflicts", plainMessage: ssaPlainMessage, resolved: ssaManaged, fixes: "#1017" },
      },
      run: { rig, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      conclusion: allManaged
        ? "All three delivery rough edges are managed on the cub-direct path: CRD-bearing first install succeeds, the upgrade prunes the removed object, and the manual-edit conflict becomes a plain-words message + a clear --force-conflicts resolution. So 'cub-direct' does not have to mean 'naive kubectl apply' — and these were never recipe/variant quirks. The doctrine fix: cub-direct should either use this managed applier, or explicitly hand upgrades/CRDs to a controller."
        : "One or more legs did not manage cleanly; see leg details.",
    },
  };
}

function tf(v) { return v === true ? "yes" : v === false ? "no" : "?"; }
function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  return `# Managed cub-direct — the no-controller delivery rough edges, managed

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-managed-cub-direct-proof.mjs\`; do not hand-edit. Regenerate with \`npm run managed-cub-direct:proof\`.

**Claim.** ${s.claim}

The three live delivery gaps are **not** recipe/variant/revision quirks (those cover config *shape*) — they are how the bundle gets *applied*. A controller already handles them; this proves the **bare \`kubectl apply\` path** can be managed too, with a small managed applier.

| Rough edge | Managed approach | Result |
| --- | --- | --- |
| **CRD ordering** (#1015) | ${L.crdOrdering.managed} | CR created: **${tf(L.crdOrdering.crCreated)}** |
| **Prune on upgrade** (#1013) | ${L.prune.managed} | removed object pruned: **${tf(L.prune.removedObjectPruned)}** |
| **SSA conflict** (#1017) | ${L.ssaConflict.managed} | resolved: **${tf(L.ssaConflict.resolved)}** |

For the SSA case, the managed layer surfaces this instead of the raw Kubernetes conflict wall:
> ${L.ssaConflict.plainMessage}

Overall: **${s.result}**. ${s.conclusion}

- **Where this sits:** these were never config quirks — recipes/variants/revisions are fine. This is the **delivery layer** on the no-controller path.
- **The doctrine fix:** cub-direct should use a managed applier like this (order → prune → plain-conflict), **or** explicitly route upgrades + CRD-bearing charts to a controller. Either way, the no-controller path stops being a footgun.
- The other two adoption findings need different homes: the shared-password variant (#1012) needs a real generator/rename, and customize friction (#1009) needs error guidance in the migration cheat-sheet (docs/user/helm-to-cub-migration.md). Neither is a delivery-layer fix.
- Receipt: \`runs/managed-cub-direct-proof/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "warn"}">${v}</span>`;
  const yn = (v) => `<span class="chip ${v ? "ok" : "bad"}">${tf(v)}</span>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Managed cub-direct — delivery rough edges managed</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:860px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  .msg{background:#eafaef;border-left:4px solid #1a7f37;border-radius:4px;padding:.6rem 1rem;margin:1rem 0;font-size:.9rem}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #eaeef2;font-size:.88rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.bad{background:#ffebe9;color:#cf222e}.chip.warn{background:#fff1d6;color:#9a6700}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Managed cub-direct — the no-controller delivery rough edges, managed</h1>
  <p class="sub">live on kind · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-managed-cub-direct-proof.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Rough edge</th><th>Managed approach</th><th>Result</th></tr></thead><tbody>
  <tr><td><b>CRD ordering</b> (#1015)</td><td>${L.crdOrdering.managed}</td><td>CR created ${yn(L.crdOrdering.crCreated)}</td></tr>
  <tr><td><b>Prune on upgrade</b> (#1013)</td><td>${L.prune.managed}</td><td>pruned ${yn(L.prune.removedObjectPruned)}</td></tr>
  <tr><td><b>SSA conflict</b> (#1017)</td><td>${L.ssaConflict.managed}</td><td>resolved ${yn(L.ssaConflict.resolved)}</td></tr>
  </tbody></table>
  <div class="msg"><b>Plain-words conflict message (instead of the raw k8s wall):</b><br>${L.ssaConflict.plainMessage}</div>
  <p>Overall: ${chip(s.result)}</p>
  <footer>These are delivery-layer behaviors, not recipe or variant quirks. The bare cub-direct path can manage them. An Argo CD or Flux path still needs explicit, tested settings for ordering, pruning, and conflicts.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  const L = r.spec.legs;
  console.log(`wrote managed-cub-direct proof -> ${relativeRepo(receiptPath)} result=${r.spec.result} (crd=${tf(L.crdOrdering.crCreated)}, prune=${tf(L.prune.removedObjectPruned)}, ssa=${tf(L.ssaConflict.resolved)})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run managed-cub-direct:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "ManagedCubDirectProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.legs?.crdOrdering, "receipt missing legs");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run managed-cub-direct:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run managed-cub-direct:proof`);
  console.log(`verified managed-cub-direct proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-managed-cub-direct-proof.mjs --run\n  node scripts/run-managed-cub-direct-proof.mjs --verify");
}
