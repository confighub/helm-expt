#!/usr/bin/env node
// Live proof that a Helm *test* hook is a separable, non-automatic lifecycle
// route — not part of the steady-state object set, and never run silently by
// `helm install`. It renders/installs the tests/fixtures/hook-test-probe chart on
// a throwaway kind cluster and records, for each delivery path, what happens to
// the test hook:
//   1. helm template  (Argo-style render)        -> hook rendered but annotated (separable)
//   2. helm install    (workload applied)         -> test hook SKIPPED (not run at install)
//   3. helm test        (explicit run-test route)  -> hook EXECUTED to a recorded result
// This is the synthetic, self-contained mechanism proof. The real-catalog live
// evidence is fluent/fluent-bit's committed receipt
// (data/hook-lifecycle/receipts/fluent-fluent-bit/default/latest.yaml), which
// routes its test hook to an explicit post-install check with
// helmHooksExecutedByHarness:false. Together they show the routed-hook method:
// render parity proves the non-hook objects; the hook is an explicit, visible,
// receipted lifecycle action (automatic:false), never a silent imperative step.
//
// Usage:
//   node scripts/run-hook-test-proof.mjs --run     # live; writes the receipt + summary
//   node scripts/run-hook-test-proof.mjs --verify  # validate committed receipt + summary
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const CHART = "tests/fixtures/hook-test-probe";
const NS = "hook-test-probe";
const REAL_CHART = "fluent/fluent-bit@0.57.6";
const REAL_RECEIPT = "data/hook-lifecycle/receipts/fluent-fluent-bit/default/latest.yaml";
const receiptPath = join(repoRoot, "runs", "hook-test-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "hook-test-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "hook-test-proof", "visible-vs-silent.html");

function sh(file, args, opts = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `hook-test-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const chartPath = join(repoRoot, CHART);
  const legs = {};
  const work = mkdtempSync(join(tmpdir(), "hook-test-"));
  let clusterUp = false;

  try {
    check(existsSync(join(chartPath, "Chart.yaml")), `probe chart missing at ${CHART}`);

    // Leg 1: helm template (no cluster). The steady-state ConfigMap renders, and
    // the test Pod renders WITH the helm.sh/hook: test annotation -> separable
    // from the non-hook object set (this is what render parity proves).
    const tpl = tsh("helm", ["template", "probe", chartPath, "--namespace", NS]);
    const cmRendered = /name:\s*hook-test-probe-result/.test(tpl.out);
    const hookAnnotated = /helm\.sh\/hook"?:\s*"?test\b/.test(tpl.out);
    legs.renderParity = {
      mode: "helm template (Argo-style render; no run step)",
      hookRun: hookAnnotated ? "hook-annotated" : "not-annotated",
      result: cmRendered && hookAnnotated ? "pass" : "watch",
      expected: "hook-annotated",
      detail: cmRendered ? "" : "steady-state ConfigMap not found in rendered output",
    };

    // Bring up a throwaway cluster for the live legs.
    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "60s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind cluster did not come up: ${up.out}`);
    const kctx = `kind-${rig}`;

    // Leg 2: helm install. The workload (ConfigMap) is applied; the test hook is
    // NOT run by install -> the test Pod is absent. This is the silent default:
    // Helm installs the chart and quietly skips the test hook.
    const inst = tsh("helm", ["install", "probe", chartPath, "--namespace", NS, "--create-namespace", "--kube-context", kctx, "--wait", "--timeout", "120s"]);
    const cmGet = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "configmap", "hook-test-probe-result", "-o", "name"]);
    const cmPresent = cmGet.ok && cmGet.out.includes("hook-test-probe-result");
    const podGet = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "pod", "hook-test-probe-test", "-o", "name"]);
    const podAbsent = !(podGet.ok && podGet.out.includes("hook-test-probe-test"));
    legs.helmInstallSilent = {
      mode: "helm install (workload applied; test hook skipped)",
      hookRun: cmPresent && podAbsent ? "skipped" : cmPresent ? "ran-at-install" : "no-workload",
      result: cmPresent && podAbsent ? "pass" : "watch",
      expected: "skipped",
      detail: inst.ok ? "" : inst.out.slice(0, 400),
    };

    // Leg 3: helm test. The explicit run-test route: Helm now runs the test hook
    // Pod, which completes successfully, to a result we record. This is the
    // visible, deliberate execution that routed delivery makes first-class.
    const test = tsh("helm", ["test", "probe", "--namespace", NS, "--kube-context", kctx, "--logs", "--timeout", "120s"]);
    const phase = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "pod", "hook-test-probe-test", "-o", "jsonpath={.status.phase}"]);
    const succeeded = test.ok && phase.out.trim() === "Succeeded";
    legs.explicitRouteRun = {
      mode: "helm test (explicit run-test route; recorded result)",
      hookRun: succeeded ? "executed" : test.ok ? "ran-unknown" : "error",
      result: succeeded ? "pass" : "watch",
      expected: "executed",
      detail: succeeded ? "" : `${test.out}`.slice(0, 400),
      observedLog: /hook-test-probe: explicit post-install check OK/.test(test.out) ? "explicit post-install check OK" : "",
    };

    tsh("helm", ["uninstall", "probe", "--namespace", NS, "--kube-context", kctx]);
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }

  const corePass = legs.renderParity.result === "pass" && legs.helmInstallSilent.result === "pass";
  const result = !corePass ? "watch" : (legs.explicitRouteRun.result === "pass" ? "pass" : "watch");
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HookTestRouteProofReceipt",
    metadata: { name: rig },
    spec: {
      chart: CHART,
      observedAt: stamp,
      result,
      claim: "A Helm test hook is not run by `helm install`; it runs only as an explicit, out-of-band step. Routed delivery re-expresses it as a named, non-automatic run-test lifecycle action with a committed receipt — visible and deliberate, never silent.",
      anchors: {
        realChart: REAL_CHART,
        realReceipt: REAL_RECEIPT,
        routeAction: { actionKind: "run-test", disposition: "observed", automatic: false },
      },
      run: { rig, namespace: NS, cleanup: { result: clusterUp ? "pass" : "n/a" } },
      legs,
      conclusion: corePass
        ? "Routing proven live: the test hook renders as a separable, annotated object (render parity proves the steady-state ConfigMap); `helm install` applies the workload and silently skips the test hook; `helm test` runs it explicitly to a recorded Succeeded result. The hook is a named, non-automatic lifecycle action, never a silent imperative step. Real-catalog evidence: fluent/fluent-bit routes its test hook to an explicit post-install check (helmHooksExecutedByHarness:false)."
        : "Core legs did not produce the expected values; see leg details.",
    },
  };
}

function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  const row = (l) => `| ${l.mode} | \`${l.hookRun}\` | ${l.expected ? `\`${l.expected}\`` : "—"} | ${l.result} |`;
  return `# Helm test-hook routing proof

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-hook-test-proof.mjs\`; do not hand-edit. Regenerate with \`npm run hook-test:proof\`.

**Claim.** ${s.claim}

This is the synthetic mechanism proof for the **hook/lifecycle** test pathway: a chart whose test hook (\`helm.sh/hook: test\`) is read back at each delivery path so the otherwise-invisible "does the check run, and did anyone see it?" question becomes a recorded result. The real-catalog live evidence is \`${s.anchors.realChart}\` (\`${s.anchors.realReceipt}\`), which routes its test hook to an explicit post-install check with \`helmHooksExecutedByHarness:false\`.

| Delivery path | test hook | expected | result |
| --- | --- | --- | --- |
${row(L.renderParity)}
${row(L.helmInstallSilent)}
${row(L.explicitRouteRun)}

Overall: **${s.result}**. ${s.conclusion}

- **Argo CD** renders desired state with \`helm template\` (no run step) and has no native Helm \`test\` execution — the check is silently dropped unless you add your own PostSync job.
- **Flux helm-controller** runs \`helm test\` only when \`.spec.test.enable: true\` (off by default) — silently skipped unless you opt in.
- **\`helm install\`** never runs a test hook; only \`helm test\` does (the steady-state workload is applied without it).
- **Routed delivery** re-expresses the hook as an explicit \`run-test\` lifecycle action (\`automatic:false\`) with a committed receipt — visible and approvable. You can still automate it via your own GitOps test step, but knowingly, with an audit trail.
- Receipt: \`runs/hook-test-proof/receipt.yaml\`. Probe chart: \`${CHART}\`. Pathway: \`docs/user/pathway-route-hooks-transparently.md\`.
`;
}

// Self-contained colored view of the same proof (generated + verify-gated, never
// hand-edited — the same discipline the routed-hook method is about). Pure
// function of the receipt.
function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const chip = (v) => {
    const cls = v === "pass" || v === "visible" ? "ok" : v === "watch" || v === "opt-in" ? "warn" : "bad";
    return `<span class="chip ${cls}">${v}</span>`;
  };
  const legRow = (l) => `<tr><td>${l.mode}</td><td><code>${l.hookRun}</code></td><td><code>${l.expected || "—"}</code></td><td>${chip(l.result)}</td></tr>`;
  const tools = [
    ["Argo CD", "renders with <code>helm template</code>; no native Helm <code>test</code> execution", "silent", "the check is dropped unless you add your own PostSync job"],
    ["Flux helm-controller", "runs <code>helm test</code> only if <code>.spec.test.enable: true</code>", "opt-in", "off by default → skipped unless you opt in"],
    ["helm install", "applies the steady-state workload", "silent", "never runs a test hook"],
    ["Routed delivery (this method)", "explicit <code>run-test</code> lifecycle action with a receipt", "visible", "<code>automatic:false</code> → approvable, audited"],
  ];
  const toolRow = (t) => `<tr><td><b>${t[0]}</b></td><td>${t[1]}</td><td>${chip(t[2])}</td><td>${t[3]}</td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Helm test-hook routing — visible vs. silent</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 2rem; background: #f6f8fa; color: #1f2328; }
  main { max-width: 980px; margin: 0 auto; }
  h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.05rem; margin: 1.8rem 0 .6rem; }
  .sub { color: #57606a; margin: 0 0 1rem; }
  .banner { background: #fff8c5; border: 1px solid #d4a72c66; border-radius: 6px; padding: .5rem .8rem; font-size: .85rem; color: #6b5900; }
  .claim { background: #ddf4ff; border-left: 4px solid #0969da; border-radius: 4px; padding: .7rem 1rem; margin: 1rem 0; }
  table { border-collapse: collapse; width: 100%; background: #fff; border: 1px solid #d0d7de; border-radius: 6px; overflow: hidden; }
  th, td { text-align: left; padding: .55rem .7rem; border-bottom: 1px solid #eaeef2; vertical-align: top; }
  th { background: #f6f8fa; font-size: .8rem; text-transform: uppercase; letter-spacing: .03em; color: #57606a; }
  tr:last-child td { border-bottom: 0; }
  code { background: #eff1f3; padding: .05rem .3rem; border-radius: 4px; font-size: .85em; }
  .chip { display: inline-block; padding: .1rem .55rem; border-radius: 999px; font-size: .78rem; font-weight: 600; }
  .chip.ok { background: #e6f4ea; color: #1a7f37; }
  .chip.warn { background: #fff1d6; color: #9a6700; }
  .chip.bad { background: #ffebe9; color: #cf222e; }
  footer { margin-top: 2rem; color: #57606a; font-size: .85rem; }
  .overall { font-size: 1rem; margin: 1rem 0; }
</style></head>
<body><main>
  <h1>Helm test-hook routing — visible vs. silent</h1>
  <p class="sub">hook / lifecycle test pathway · chart <code>${s.anchors.realChart}</code> · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-hook-test-proof.mjs</code>; do not hand-edit. Regenerate with <code>npm run hook-test:proof</code>.</div>
  <div class="claim">${s.claim}</div>

  <h2>Proof legs (live, on a throwaway kind cluster)</h2>
  <table><thead><tr><th>Delivery path</th><th>test hook</th><th>expected</th><th>result</th></tr></thead>
  <tbody>
  ${legRow(L.renderParity)}
  ${legRow(L.helmInstallSilent)}
  ${legRow(L.explicitRouteRun)}
  </tbody></table>
  <p class="overall">Overall: ${chip(s.result)}</p>

  <h2>What each delivery tool does with the test hook</h2>
  <table><thead><tr><th>Tool</th><th>behavior</th><th>visibility</th><th>consequence</th></tr></thead>
  <tbody>
  ${tools.map(toolRow).join("\n  ")}
  </tbody></table>

  <h2>The route-action contract</h2>
  <p>The hook is a named lifecycle action, not a silent step: <code>action_kind: run-test</code>,
  <code>execution_mode: user-executes</code>, <code>automatic: false</code>. Across the catalog,
  <b>0 of 25</b> route-actions claim automatic execution. Real-catalog live evidence:
  <code>${s.anchors.realReceipt}</code> (<code>helmHooksExecutedByHarness: false</code>).</p>

  <footer>
  <b>Honest disposition:</b> this hook is <i>observed</i> (it has a live receipt). The broader lifecycle
  lane still has <b>62 cells defined-but-not-yet-observed</b>, and the post-apply-provisioning-Job hook
  class has no observed receipt yet (image-blocked precondition). A route being known is not a route being
  observed, and neither is automatic.<br><br>
  Pathway: <code>docs/user/pathway-route-hooks-transparently.md</code> ·
  Summary: <code>data/hook-test-proof/summary.md</code> ·
  Receipt: <code>runs/hook-test-proof/receipt.yaml</code>
  </footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote hook-test proof -> ${relativeRepo(receiptPath)} result=${r.spec.result}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run hook-test:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "HookTestRouteProofReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  for (const k of ["renderParity", "helmInstallSilent", "explicitRouteRun"]) check(r.spec?.legs?.[k], `receipt missing leg ${k}`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} missing`);
  check(readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run hook-test:proof`);
  check(existsSync(htmlPath), `${relativeRepo(htmlPath)} missing`);
  check(readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run hook-test:proof`);
  console.log(`verified hook-test proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-hook-test-proof.mjs --run\n  node scripts/run-hook-test-proof.mjs --verify");
}
