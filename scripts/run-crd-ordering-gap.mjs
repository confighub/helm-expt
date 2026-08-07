#!/usr/bin/env node
// Gap proof (live): does the cub-direct (no-controller) delivery path apply a bundle's CRDs
// before the custom resources that depend on them? The doctrine's third path is "pull the OCI
// bundle + kubectl apply". But plain `kubectl apply -f <bundle>` applies objects in file order
// with no dependency ordering or wait — so on a FIRST install of a chart that ships both a CRD
// and a CR of that CRD, the CR fails ("no matches for kind ... ensure CRDs are installed
// first") and is never created. Helm installs CRDs first; Argo (sync waves) and Flux (retry/
// health) handle ordering; cub-direct does not. Proven on a throwaway kind cluster, with the
// CRD-first+wait fix shown. Companion to the prune gap — the other apply-only limitation of
// the no-controller path. Result `watch`.
//
// Usage:
//   node scripts/run-crd-ordering-gap.mjs --run      # live on kind; writes receipt + summary
//   node scripts/run-crd-ordering-gap.mjs --verify
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, normalizeTempPaths, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const receiptPath = join(repoRoot, "runs", "crd-ordering-gap", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "crd-ordering-gap", "summary.md");
const htmlPath = join(repoRoot, "data", "crd-ordering-gap", "summary.html");

function sh(file, args, opts = {}) { return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts }); }
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: normalizeTempPaths(`${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e)) }; } }

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
metadata: {name: my-widget, namespace: default}
spec: {size: large}
`;

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `crdgap-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const kctx = `kind-${rig}`;
  const work = mkdtempSync(join(tmpdir(), "crdgap-"));
  const bundle = join(work, "bundle"); execFileSync("mkdir", ["-p", bundle]);
  writeFileSync(join(bundle, "01-crd.yaml"), CRD);
  writeFileSync(join(bundle, "02-cr.yaml"), CR);
  const kubeconfig = join(work, "kubeconfig");
  let clusterUp = false;
  let crCreatedByBundleApply = null, bundleApplyError = "", crCreatedByOrderedFix = null;
  try {
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "90s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind did not come up: ${up.out.slice(0, 150)}`);
    writeFileSync(kubeconfig, tsh("kind", ["get", "kubeconfig", "--name", rig]).out);
    const k = (args) => tsh("kubectl", ["--context", kctx, ...args], { env: { ...process.env, KUBECONFIG: kubeconfig } });
    // cub-direct first install: apply the whole bundle at once
    const apply = k(["apply", "-f", bundle]);
    bundleApplyError = (apply.out.split("\n").find((l) => /no matches for kind|ensure CRDs|resource mapping/i.test(l)) || "").slice(0, 140);
    crCreatedByBundleApply = k(["get", "widget", "my-widget", "-o", "name"]).ok;
    // the fix: CRD first, wait for established, then the CR
    k(["apply", "-f", join(bundle, "01-crd.yaml")]);
    k(["wait", "--for=condition=established", "crd/widgets.demo.confighub.io", "--timeout=60s"]);
    k(["apply", "-f", join(bundle, "02-cr.yaml")]);
    crCreatedByOrderedFix = k(["get", "widget", "my-widget", "-o", "name"]).ok;
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }
  const gap = crCreatedByBundleApply === false;
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "CrdOrderingGapProofReceipt",
    metadata: { name: rig },
    spec: {
      observedAt: stamp,
      result: gap ? "watch" : crCreatedByBundleApply ? "pass" : "blocked",
      claim: "The cub-direct (no-controller) path applies the OCI bundle with plain `kubectl apply`, which has no dependency ordering or wait. On a FIRST install of a chart that ships a CRD plus a CR of that CRD, the CR fails ('no matches for kind ... ensure CRDs are installed first') and is never created. Helm installs CRDs first; Argo (sync waves) and Flux (retry/health) order it; cub-direct does not.",
      legs: {
        bundleApply: { action: "kubectl apply -f <bundle> (CRD + CR together)", crCreated: crCreatedByBundleApply, error: bundleApplyError || undefined, result: crCreatedByBundleApply ? "created" : "CR failed (gap)" },
        orderedFix: { action: "apply CRD, wait --for=condition=established, then apply CR", crCreated: crCreatedByOrderedFix, result: crCreatedByOrderedFix ? "created" : "still failed" },
      },
      run: { rig, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      conclusion: gap
        ? "Confirmed: the cub-direct first install of a CRD-bearing bundle fails — the CR applies before the CRD is established. Ordering CRD-first + waiting fixes it. So the no-controller path must install CRDs first (or wait/retry), or use a controller. Same theme as the prune gap: cub-direct is apply-only."
        : "The CR was created by the single bundle apply; no ordering gap observed in this run.",
    },
  };
}

function tf(v) { return v === true ? "yes" : v === false ? "no" : "?"; }
function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  return `# CRD ordering gap — does cub-direct install CRDs before the resources that need them?

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-crd-ordering-gap.mjs\`; do not hand-edit. Regenerate with \`npm run crd-ordering:proof\`.

**Claim.** ${s.claim}

The doctrine's third delivery path — **cub-direct** (pull the OCI bundle + \`kubectl apply\`) — applies objects in file order with no dependency ordering or wait. Proven live on a throwaway kind cluster with a bundle that ships a CRD + a CR of it:

| Action | Custom resource created? |
| --- | --- |
| \`kubectl apply -f <bundle>\` (CRD + CR together) | **${tf(L.bundleApply.crCreated)}**${L.bundleApply.error ? ` — \`${L.bundleApply.error}\`` : ""} |
| apply CRD → \`wait --for=condition=established\` → apply CR | ${tf(L.orderedFix.crCreated)} (the fix) |

Overall: **${s.result}**. ${s.conclusion}

- **Affected:** cub-direct / no-controller first install of CRD-bearing charts. **Not affected:** Helm (installs CRDs first), Argo CD (sync waves), Flux (retry/health).
- **The fix:** the no-controller applier must install CRDs first and wait for them to be established (or apply-retry), or hand off to a controller. The doctrine should say so.
- Companion to the prune gap — both are apply-only limitations of the cub-direct path. Receipt: \`runs/crd-ordering-gap/receipt.yaml\`.
`;
}
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const yn = (v, good) => `<span class="chip ${v === good ? "ok" : "bad"}">${tf(v)}</span>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>CRD ordering gap — cub-direct first install</title>
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
  <h1>CRD ordering gap — does cub-direct install CRDs before the resources that need them?</h1>
  <p class="sub">live on kind · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-crd-ordering-gap.mjs</code>; do not hand-edit.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Action</th><th>Custom resource created?</th></tr></thead><tbody>
  <tr><td><code>kubectl apply -f &lt;bundle&gt;</code> (CRD + CR together)</td><td>${yn(L.bundleApply.crCreated, true)}</td></tr>
  <tr><td>apply CRD → wait established → apply CR</td><td>${yn(L.orderedFix.crCreated, true)} (the fix)</td></tr>
  </tbody></table>
  <footer>Affected: cub-direct / no-controller first install of CRD-bearing charts. Helm installs CRDs first; Argo (sync waves) and Flux handle ordering. The no-controller applier must install CRDs first + wait, or use a controller. Same theme as the prune gap: cub-direct is apply-only.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote crd-ordering-gap proof -> ${relativeRepo(receiptPath)} result=${r.spec.result} (bundle-apply CR created=${tf(r.spec.legs.bundleApply.crCreated)}, ordered-fix=${tf(r.spec.legs.orderedFix.crCreated)})`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run crd-ordering:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "CrdOrderingGapProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  check(!!r.spec?.legs?.bundleApply, "receipt missing bundleApply leg");
  check(existsSync(summaryPath) && readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run crd-ordering:proof`);
  check(existsSync(htmlPath) && readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run crd-ordering:proof`);
  console.log(`verified crd-ordering-gap proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-crd-ordering-gap.mjs --run\n  node scripts/run-crd-ordering-gap.mjs --verify");
}
