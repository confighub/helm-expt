#!/usr/bin/env node
// Live proof of Helm lookup() render-mode behavior, the distinction that
// separates Argo CD (server-side `helm template`, no cluster read -> lookup
// empty) from Flux helm-controller (`helm upgrade --install`, live read ->
// lookup resolves). It renders the tests/fixtures/flux-lookup-probe chart three
// ways on a throwaway kind cluster and records, for each, whether lookup() found
// a pre-created Secret:
//   1. helm template      (Argo-style render)        -> expect secret-found=false
//   2. helm install       (install-time render)       -> expect secret-found=true
//   3. Flux helm-controller HelmRelease (best-effort) -> expect secret-found=true
// Leg 3 is best-effort: if Flux source wiring is unavailable it is recorded
// `watch` with the reason, and the proof still stands on legs 1+2 plus the
// committed HelmRelease manifest and helm-controller's documented behavior.
//
// Usage:
//   node scripts/run-flux-lookup-proof.mjs --run     # live; writes the receipt + summary
//   node scripts/run-flux-lookup-proof.mjs --verify  # validate committed receipt + summary
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const CHART = "tests/fixtures/flux-lookup-probe";
const NS = "lookup-probe";
const SECRET = "flux-lookup-probe";
const receiptPath = join(repoRoot, "runs", "flux-lookup-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "flux-lookup-proof", "summary.md");

function sh(file, args, opts = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

// Parse the secret-found field out of a rendered/queried ConfigMap (yaml-ish).
function secretFoundFrom(text) {
  const m = text.match(/secret-found:\s*"?(true|false)"?/);
  return m ? m[1] : "unknown";
}

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `flux-lookup-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const legs = {};
  const work = mkdtempSync(join(tmpdir(), "flux-lookup-"));
  let clusterUp = false;

  try {
    check(existsSync(join(repoRoot, CHART, "Chart.yaml")), `probe chart missing at ${CHART}`);

    // Leg 1: helm template (no cluster) -> lookup empty.
    const tpl = tsh("helm", ["template", "probe", join(repoRoot, CHART), "--namespace", NS]);
    const tplFound = tpl.ok ? secretFoundFrom(tpl.out) : "error";
    legs.helmTemplate = { mode: "helm template (Argo-style render; no cluster read)", secretFound: tplFound, result: tplFound === "false" ? "pass" : "watch", expected: "false" };

    // Bring up a throwaway cluster for the live legs.
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "60s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind cluster did not come up: ${up.out}`);
    const kctx = `kind-${rig}`;

    // Pre-stage namespace + the Secret that lookup() will look for.
    tsh("kubectl", ["--context", kctx, "create", "namespace", NS]);
    tsh("kubectl", ["--context", kctx, "-n", NS, "create", "secret", "generic", SECRET, "--from-literal=token=live-read-ok"]);

    // Leg 2: helm install (install-time live read) -> lookup resolves.
    const inst = tsh("helm", ["install", "probe", join(repoRoot, CHART), "--namespace", NS, "--kube-context", kctx, "--wait", "--timeout", "120s"]);
    const cm = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "configmap", "flux-lookup-probe-result", "-o", "yaml"]);
    const instFound = cm.ok ? secretFoundFrom(cm.out) : "error";
    legs.helmInstall = { mode: "helm install (install-time render; live cluster read)", secretFound: instFound, result: instFound === "true" ? "pass" : "watch", expected: "true", detail: inst.ok ? "" : inst.out.slice(0, 400) };
    tsh("helm", ["uninstall", "probe", "--namespace", NS, "--kube-context", kctx]);

    // Leg 3: Flux helm-controller (best-effort). Install flux; source the chart
    // from the public repo branch via GitRepository; HelmRelease into NS.
    const fluxLeg = runFluxLeg(kctx, work);
    legs.fluxHelmController = fluxLeg;
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }

  const corePass = legs.helmTemplate.result === "pass" && legs.helmInstall.result === "pass";
  const result = !corePass ? "watch" : (legs.fluxHelmController.result === "pass" ? "pass" : "watch");
  const receipt = {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "FluxLookupProofReceipt",
    metadata: { name: `${rig}` },
    spec: {
      chart: CHART,
      observedAt: stamp,
      result,
      claim: "Helm lookup() resolves under install-time render (helm install / Flux helm-controller `helm upgrade --install`) and returns empty under template-time render (helm template / Argo CD server-side render).",
      run: { rig, namespace: NS, secret: SECRET, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      legs,
      conclusion: corePass
        ? "Core distinction proven live: template-time render does not see the Secret (secret-found=false); install-time render does (secret-found=true). Flux helm-controller runs `helm upgrade --install`, so it inherits the install-time behavior; Argo CD renders with `helm template`, so it inherits the template-time behavior."
        : "Core legs did not produce the expected values; see leg details.",
    },
  };
  return receipt;
}

function runFluxLeg(kctx, work) {
  if (!tsh("which", ["flux"]).ok) return { mode: "Flux helm-controller", result: "watch", secretFound: "n/a", reason: "flux CLI not on PATH" };
  const install = tsh("flux", ["install", "--context", kctx, "--components", "source-controller,helm-controller"]);
  if (!install.ok) return { mode: "Flux helm-controller (helm upgrade --install)", result: "watch", secretFound: "n/a", reason: `flux install failed: ${install.out.slice(0, 300)}` };

  // Source the chart from the public repo branch (no local registry needed).
  const branch = (tsh("git", ["-C", repoRoot, "rev-parse", "--abbrev-ref", "HEAD"]).out || "main").trim();
  const manifest = `apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: flux-lookup-probe
  namespace: ${NS}
spec:
  interval: 1m
  url: https://github.com/confighub/helm-expt
  ref:
    branch: ${branch}
  ignore: |
    /*
    !/${CHART}
---
apiVersion: helm.toolkit.fluxcd.io/v2
kind: HelmRelease
metadata:
  name: flux-lookup-probe
  namespace: ${NS}
spec:
  interval: 1m
  releaseName: probe-flux
  targetNamespace: ${NS}
  chart:
    spec:
      chart: ${CHART}
      sourceRef:
        kind: GitRepository
        name: flux-lookup-probe
`;
  const mPath = join(work, "flux-lookup.yaml");
  writeFileSync(mPath, manifest);
  const apply = tsh("kubectl", ["--context", kctx, "apply", "-f", mPath]);
  if (!apply.ok) return { mode: "Flux helm-controller (helm upgrade --install)", result: "watch", secretFound: "n/a", reason: `apply failed: ${apply.out.slice(0, 200)}`, manifest };

  // Reconcile + wait (best-effort, bounded).
  tsh("flux", ["--context", kctx, "-n", NS, "reconcile", "source", "git", "flux-lookup-probe", "--timeout", "120s"]);
  tsh("flux", ["--context", kctx, "-n", NS, "reconcile", "helmrelease", "flux-lookup-probe", "--timeout", "180s"]);
  const cm = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "configmap", "flux-lookup-probe-result", "-o", "yaml"]);
  const found = cm.ok ? secretFoundFrom(cm.out) : "n/a";
  if (found === "true") return { mode: "Flux helm-controller (helm upgrade --install)", result: "pass", secretFound: "true", reason: "HelmRelease reconciled; lookup() resolved the live Secret" };
  const hr = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "helmrelease", "flux-lookup-probe", "-o", "yaml"]).out || "";
  return { mode: "Flux helm-controller (helm upgrade --install)", result: "watch", secretFound: found, reason: `HelmRelease did not converge to secret-found=true in time (live Flux source wiring); helm-install leg already proves the install-time behavior helm-controller uses`, hrStatusExcerpt: hr.slice(0, 400), manifest };
}

function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  const row = (l) => `| ${l.mode} | \`${l.secretFound}\` | ${l.expected ? `\`${l.expected}\`` : "—"} | ${l.result} |`;
  return `# Flux helm-controller lookup() proof

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-flux-lookup-proof.mjs\`; do not hand-edit. Regenerate with \`npm run flux-lookup:proof\`.

**Claim.** ${s.claim}

This is the live half of the Argo-vs-Flux distinction in the cub-scout comparison: a chart whose template calls \`lookup("v1","Secret",ns,"${SECRET}")\` reports \`secret-found\` differently depending on whether the render performed a live cluster read.

| Render path | secret-found | expected | result |
| --- | --- | --- | --- |
${row(L.helmTemplate)}
${row(L.helmInstall)}
${row(L.fluxHelmController)}

Overall: **${s.result}**. ${s.conclusion}

- **Argo CD** renders desired state with \`helm template\` (no cluster read) — it inherits the \`helm template\` row (lookup empty).
- **Flux helm-controller** reconciles a HelmRelease with \`helm upgrade --install\` (a live read) — it inherits the \`helm install\` row (lookup resolves).
- Receipt: \`runs/flux-lookup-proof/receipt.yaml\`. Probe chart + the Flux \`GitRepository\`/\`HelmRelease\` manifest: \`${CHART}\`.
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  console.log(`wrote flux-lookup proof -> ${relativeRepo(receiptPath)} result=${r.spec.result}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run flux-lookup:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "FluxLookupProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  for (const k of ["helmTemplate", "helmInstall", "fluxHelmController"]) check(r.spec?.legs?.[k], `receipt missing leg ${k}`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} missing`);
  check(readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run flux-lookup:proof`);
  console.log(`verified flux-lookup proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-flux-lookup-proof.mjs --run\n  node scripts/run-flux-lookup-proof.mjs --verify");
}
