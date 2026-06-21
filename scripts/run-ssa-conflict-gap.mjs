#!/usr/bin/env node
// Gap proof (live), under the adoption lens (worse-than / more-confusing-than Helm, managed?):
// cub's managed delivery uses SERVER-SIDE APPLY (the OCI/Argo path sets ServerSideApply=true).
// When a user has manually edited a field (e.g. `kubectl scale`), a server-side re-apply
// FAILS with a field-manager CONFLICT — a wall of Kubernetes SSA text — whereas Helm's
// client-side apply silently OVERWRITES and "just works". cub's behavior is arguably SAFER
// (it refuses to silently clobber your manual change), but it is DIFFERENT and CONFUSING for a
// Helm user, who expects the overwrite. Under "people avoid different/confusing", that has to
// be MANAGED (a plain-words message + a clear reconcile/force path), not surfaced raw.
// Proven on a throwaway kind cluster, with Helm's client-side overwrite shown for contrast.
// Result `watch` — not a bug (it's defensible), but an unmanaged confusing-vs-Helm edge.
//
// Usage:
//   node scripts/run-ssa-conflict-gap.mjs --run      # live on kind; writes receipt + summary
//   node scripts/run-ssa-conflict-gap.mjs --verify
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "ssa-conflict-gap", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "ssa-conflict-gap", "summary.md");
const htmlPath = join(repoRoot, "data", "ssa-conflict-gap", "summary.html");

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

const DEPLOY = `apiVersion: apps/v1
kind: Deployment
metadata: {name: web, namespace: ssans}
spec: {replicas: 1, selector: {matchLabels: {app: web}}, template: {metadata: {labels: {app: web}}, spec: {containers: [{name: c, image: nginx:1.27}]}}}
`;

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `ssagap-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const kctx = `kind-${rig}`;
  const work = mkdtempSync(join(tmpdir(), "ssagap-"));
  const file = join(work, "deploy.yaml"); writeFileSync(file, DEPLOY);
  const kubeconfig = join(work, "kubeconfig");
  let clusterUp = false;
  let cubReapplyConflict = null, conflictField = "", helmStyleOverwrote = null;
  try {
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind did not come up: ${up.out.slice(0, 150)}`);
    writeFileSync(kubeconfig, tsh("kind", ["get", "kubeconfig", "--name", rig]).out);
    const k = (args) => tsh("kubectl", ["--context", kctx, ...args], { env: { ...process.env, KUBECONFIG: kubeconfig } });
    k(["create", "namespace", "ssans"]);
    // cub-style delivery: server-side apply with a cub field manager
    k(["apply", "--server-side", "--field-manager=cub", "-f", file]);
    // user manually edits a field (kubectl owns spec.replicas)
    k(["-n", "ssans", "scale", "deploy/web", "--replicas=3"]);
    // cub re-delivers via server-side apply -> conflict?
    const reapply = k(["apply", "--server-side", "--field-manager=cub", "-f", file]);
    cubReapplyConflict = !reapply.ok && /conflict/i.test(reapply.out);
    conflictField = (reapply.out.match(/\.spec\.\S+/) || [""])[0];
    // Helm's way: client-side apply silently overwrites
    const cs = k(["apply", "-f", file]);
    const replicasAfter = (k(["-n", "ssans", "get", "deploy", "web", "-o", "jsonpath={.spec.replicas}"]).out || "").trim();
    helmStyleOverwrote = cs.ok && replicasAfter === "1";
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  const gap = cubReapplyConflict === true && helmStyleOverwrote === true;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "SsaConflictGapProofReceipt",
    metadata: { name: rig },
    spec: {
      observedAt: stamp,
      result: gap ? "watch" : "pass",
      claim: "cub's managed delivery uses server-side apply. When a user has manually edited a field (kubectl scale), a server-side re-apply FAILS with a field-manager conflict (a wall of Kubernetes SSA text); Helm's client-side apply silently OVERWRITES and 'just works'. cub's behavior is arguably safer (no silent clobber) but is different and confusing for a Helm user — and under 'people avoid different/confusing' it must be MANAGED with a plain-words message and a clear reconcile/force path, not surfaced raw.",
      legs: {
        cubServerSideReapply: { afterManualEdit: "kubectl scale replicas 1->3", conflicted: cubReapplyConflict, field: conflictField || ".spec.replicas", result: cubReapplyConflict ? "CONFLICT (confusing for a Helm user)" : "no conflict" },
        helmClientSideReapply: { overwroteSilently: helmStyleOverwrote, result: helmStyleOverwrote ? "overwrote silently, replicas->1 (Helm's behavior)" : "did not overwrite" },
      },
      run: { rig, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      conclusion: gap
        ? "Confirmed: cub's server-side-apply delivery conflicts on a manually-edited field where Helm silently overwrites. Defensible (safer) but different + confusing. Manage it: detect the conflict, explain in plain words ('spec.replicas was changed outside cub — reconcile, or re-apply with --force-conflicts'), and offer the choice — don't surface raw k8s SSA text."
        : "No conflict observed (cub may be using client-side apply, or force-conflicts); see legs.",
    },
  };
}

function tf(v) { return v === true ? "yes" : v === false ? "no" : "?"; }
function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  return `# SSA conflict — cub server-side apply vs Helm's silent overwrite on a manual edit

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-ssa-conflict-gap.mjs\`; do not hand-edit. Regenerate with \`npm run ssa-conflict:proof\`.

**Claim.** ${s.claim}

Under the adoption lens (worse-than / more-confusing-than Helm, and managed?): cub's managed delivery uses **server-side apply**. Proven live on a throwaway kind cluster — a deployment is delivered, a user manually \`kubectl scale\`s it, then it is re-delivered:

| Re-delivery | Outcome on the manually-edited field (\`${L.cubServerSideReapply.field}\`) |
| --- | --- |
| **cub** (server-side apply) | ${tf(L.cubServerSideReapply.conflicted)} → **${L.cubServerSideReapply.result}** |
| **Helm** (client-side apply) | ${L.helmClientSideReapply.result} |

Overall: **${s.result}**. ${s.conclusion}

- **Not a bug — a trade-off.** cub's conflict is arguably *safer*: it refuses to silently clobber a human's manual change. Helm's silent overwrite is convenient but can erase a hotfix.
- **But it is different + confusing.** A Helm user who manually tweaks one field and re-delivers gets a wall of SSA conflict text where Helm just worked — exactly the kind of surprise people bounce off of.
- **Manage it:** detect the conflict and say, in plain words, "\`${L.cubServerSideReapply.field}\` was changed outside cub — reconcile it, or re-apply with \`--force-conflicts\`", and offer the choice. Don't surface raw Kubernetes server-side-apply output.
- Receipt: \`runs/ssa-conflict-gap/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : "warn"}">${v}</span>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>SSA conflict vs Helm overwrite</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:860px;margin:0 auto}h1{font-size:1.3rem;margin:0 0 .25rem}.sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #eaeef2;font-size:.88rem}th{background:#f6f8fa;font-size:.74rem;text-transform:uppercase;color:#57606a}tr:last-child td{border-bottom:0}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}.chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>SSA conflict — cub server-side apply vs Helm's silent overwrite</h1>
  <p class="sub">live on kind · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-ssa-conflict-gap.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Re-delivery after a manual <code>kubectl scale</code></th><th>Outcome</th></tr></thead><tbody>
  <tr><td><b>cub</b> (server-side apply)</td><td>${L.cubServerSideReapply.conflicted ? '<span class="chip warn">conflict</span>' : "no conflict"} — ${L.cubServerSideReapply.result}</td></tr>
  <tr><td><b>Helm</b> (client-side apply)</td><td>${L.helmClientSideReapply.result}</td></tr>
  </tbody></table>
  <p>Overall: ${chip(s.result)}</p>
  <footer>Not a bug — a trade-off. cub's conflict is safer (no silent clobber of a manual fix); Helm's overwrite is convenient but can erase a hotfix. The adoption risk is that it's different + confusing: manage it with a plain-words conflict message and a reconcile/force choice, not raw k8s SSA text.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote ssa-conflict-gap proof -> ${relativeRepo(receiptPath)} result=${r.spec.result} (cub conflicted=${tf(r.spec.legs.cubServerSideReapply.conflicted)}, helm overwrote=${tf(r.spec.legs.helmClientSideReapply.overwroteSilently)})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run ssa-conflict:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "SsaConflictGapProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.legs?.cubServerSideReapply, "receipt missing ssa leg");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run ssa-conflict:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run ssa-conflict:proof`);
  console.log(`verified ssa-conflict-gap proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-ssa-conflict-gap.mjs --run\n  node scripts/run-ssa-conflict-gap.mjs --verify");
}
