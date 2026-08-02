#!/usr/bin/env node
// Gap proof (live): does the cub-direct (no-controller) delivery path prune resources that an
// upgrade REMOVES? config-as-data promises the cluster matches desired state. Argo and Flux
// can prune removed resources when their prune settings are enabled. But the doctrine's third delivery path
// — cub-direct = pull the OCI bundle + `kubectl apply` — uses plain `kubectl apply`, which
// only creates/updates the objects you hand it. So when v2 drops a resource v1 had, plain
// apply ORPHANS it: the cluster silently keeps a resource that is no longer in desired state.
// This proves it on a throwaway kind cluster: apply v1 (Deployment + extra ConfigMap), apply
// v2 (Deployment only), observe the ConfigMap orphaned, then show `--prune` removes it.
// Result is `watch` — a real rough edge on the cub-direct path, with the fix recorded.
//
// Usage:
//   node scripts/run-prune-gap-proof.mjs --run      # live on kind; writes receipt + summary
//   node scripts/run-prune-gap-proof.mjs --verify   # validate committed receipt + summary
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "prune-gap-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "prune-gap-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "prune-gap-proof", "summary.html");

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

const V1 = `apiVersion: apps/v1
kind: Deployment
metadata: {name: web, labels: {app: pruneproof}}
spec: {replicas: 1, selector: {matchLabels: {app: pruneproof}}, template: {metadata: {labels: {app: pruneproof}}, spec: {containers: [{name: c, image: nginx:stable}]}}}
---
apiVersion: v1
kind: ConfigMap
metadata: {name: extra-config, labels: {app: pruneproof}}
data: {note: "present in v1, removed in v2"}
`;
const V2 = `apiVersion: apps/v1
kind: Deployment
metadata: {name: web, labels: {app: pruneproof}}
spec: {replicas: 1, selector: {matchLabels: {app: pruneproof}}, template: {metadata: {labels: {app: pruneproof}}, spec: {containers: [{name: c, image: nginx:stable}]}}}
`;

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `prunegap-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const kctx = `kind-${rig}`;
  const work = mkdtempSync(join(tmpdir(), "prune-"));
  const v1 = join(work, "v1.yaml"); writeFileSync(v1, V1);
  const v2 = join(work, "v2.yaml"); writeFileSync(v2, V2);
  let clusterUp = false;
  let orphaned = null, prunedByFlag = null;
  const ns = "pruneproof";
  try {
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind cluster did not come up: ${up.out.slice(0, 200)}`);
    const k = (args) => tsh("kubectl", ["--context", kctx, ...args]);
    k(["create", "namespace", ns]);
    k(["apply", "-n", ns, "-f", v1]);
    // cub-direct "upgrade": apply v2 (the removed ConfigMap is simply absent from the set)
    k(["apply", "-n", ns, "-f", v2]);
    orphaned = k(["get", "configmap", "extra-config", "-n", ns, "-o", "name"]).ok; // still present => orphaned
    // the fix: kubectl apply --prune with a label selector
    k(["apply", "-n", ns, "--prune", "-l", "app=pruneproof", "-f", v2]);
    prunedByFlag = !k(["get", "configmap", "extra-config", "-n", ns, "-o", "name"]).ok; // gone => pruned
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "PruneGapProofReceipt",
    metadata: { name: rig },
    spec: {
      observedAt: stamp,
      result: orphaned ? "watch" : orphaned === false ? "pass" : "blocked",
      claim: "The cub-direct (no-controller) delivery path is `kubectl apply`, which does NOT prune resources removed between versions. An upgrade that drops a resource ORPHANS it — the cluster silently keeps an object no longer in desired state, breaking the config-as-data promise on this path. cub-direct must use `kubectl apply --prune` with a safe selector or allowlist, an explicit delete-set, or a controller with pruning enabled.",
      legs: {
        orphanOnPlainApply: { removedResource: "ConfigMap/extra-config", stillPresentAfterV2: orphaned, result: orphaned ? "orphaned (gap confirmed)" : "pruned" },
        pruneFlagFixes: { command: "kubectl apply --prune -l app=pruneproof", removed: prunedByFlag, result: prunedByFlag ? "pass" : "did-not-prune" },
      },
      run: { rig, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      conclusion: orphaned
        ? "Confirmed: the cub-direct path orphans removed resources on upgrade (plain kubectl apply does not prune). `--prune` removes them, so the no-controller upgrade path must require `--prune` or an explicit delete-set. Argo CD and Flux can remove omitted objects only when their pruning settings are enabled."
        : "Plain apply did not orphan the removed resource in this run; see leg details.",
    },
  };
}

function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  return `# Prune gap — does cub-direct prune removed resources on upgrade?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-prune-gap-proof.mjs\`; do not hand-edit. Regenerate with \`npm run prune-gap:proof\`.

**Claim.** ${s.claim}

config-as-data promises the cluster matches desired state. Argo CD and Flux can reconcile and prune when their pruning settings are enabled. The doctrine's third delivery path — **cub-direct** (pull the OCI bundle + \`kubectl apply\`) — uses plain apply, which only creates or updates the objects handed to it. Proven live on a throwaway kind cluster:

| Step | Observation | Result |
| --- | --- | --- |
| apply v1, then v2 (drops \`ConfigMap/extra-config\`) | removed ConfigMap still present? **${L.orphanOnPlainApply.stillPresentAfterV2}** | ${L.orphanOnPlainApply.result} |
| \`kubectl apply --prune -l app=pruneproof\` | removed? **${L.pruneFlagFixes.removed}** | ${L.pruneFlagFixes.result} |

Overall: **${s.result}**. ${s.conclusion}

- **Affected:** plain **cub-direct / no-controller** upgrades. Argo CD and Flux avoid the same problem only when pruning is enabled for that application or Kustomization.
- **The fix:** the no-controller upgrade path must use \`kubectl apply --prune\` (with a label selector / allowlist) or hand a delete-set — otherwise every upgrade that removes a resource leaves an orphan. The doctrine should say so.
- Receipt: \`runs/prune-gap-proof/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const yn = (v) => v ? '<span class="chip bad">yes</span>' : '<span class="chip ok">no</span>';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prune gap — cub-direct upgrade orphans</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:820px;margin:0 auto}h1{font-size:1.35rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #eaeef2;font-size:.88rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.bad{background:#ffebe9;color:#cf222e}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Prune gap — does cub-direct prune removed resources on upgrade?</h1>
  <p class="sub">live on kind · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-prune-gap-proof.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Step</th><th>Removed resource still present?</th></tr></thead><tbody>
  <tr><td>apply v1 → v2 (drops <code>ConfigMap/extra-config</code>), plain <code>kubectl apply</code></td><td>${yn(L.orphanOnPlainApply.stillPresentAfterV2)} (orphaned)</td></tr>
  <tr><td><code>kubectl apply --prune -l app=pruneproof</code></td><td>${yn(!L.pruneFlagFixes.removed)} (the fix)</td></tr>
  </tbody></table>
  <footer>Plain cub-direct upgrades need <code>--prune</code> or an explicit delete-set. Argo CD and Flux remove omitted objects only when their pruning settings are enabled.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote prune-gap proof -> ${relativeRepo(receiptPath)} result=${r.spec.result} (orphaned=${r.spec.legs.orphanOnPlainApply.stillPresentAfterV2}, prune-fixes=${r.spec.legs.pruneFlagFixes.removed})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run prune-gap:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "PruneGapProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.legs?.orphanOnPlainApply, "receipt missing orphan leg");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run prune-gap:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run prune-gap:proof`);
  console.log(`verified prune-gap proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-prune-gap-proof.mjs --run\n  node scripts/run-prune-gap-proof.mjs --verify");
}
