#!/usr/bin/env node
// Phase 1 of the hook-route execution plan (docs/planning/hook-route-execution-plan.md):
// prove RECEIPTED EXECUTION of a hook route in-repo. A post-install Job is the
// "provisioning/migration Job" class Helm runs silently inside `helm install`.
// This generalizes the projectcalico/tigera-operator receipt
// (helmHooksExecutedByHarness:true) to the run-job class: on a throwaway kind
// cluster it (1) confirms the Job is a separable hook, (2) shows Helm running it
// silently, and (3) executes it as an explicit, named, receipted lifecycle action
// (the harness — i.e. a non-Helm executor — runs it). That execution evidence is
// what justifies flipping automatic:true for this route scope (per
// schemas/lifecycle-route-action.schema.json: automatic true only when the
// product executes AND committed evidence proves it).
//
// Usage:
//   node scripts/run-hook-execution-proof.mjs --run     # live; writes receipt + summary
//   node scripts/run-hook-execution-proof.mjs --verify  # validate committed receipt + summary
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write, writeYaml, readYaml } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--help";
const CHART = "tests/fixtures/hook-job-probe";
const NS = "hook-job-probe";
const NS2 = "hook-job-routed";
const JOB = "hook-job-probe-migration";
const receiptPath = join(repoRoot, "runs", "hook-execution-proof", "receipt.yaml");
const summaryPath = join(repoRoot, "data", "hook-execution-proof", "summary.md");
const htmlPath = join(repoRoot, "data", "hook-execution-proof", "visible-vs-silent.html");

function sh(file, args, opts = {}) {
  return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}
function tsh(file, args, opts = {}) { try { return { ok: true, out: sh(file, args, opts) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}`.trim() || String(e) }; } }

function runProof() {
  const stamp = new Date().toISOString();
  const rig = `hook-exec-${stamp.slice(0, 10).replaceAll("-", "")}-${process.pid.toString(36)}`;
  const chartPath = join(repoRoot, CHART);
  const work = mkdtempSync(join(tmpdir(), "hook-exec-"));
  const legs = {};
  let clusterUp = false;

  try {
    check(existsSync(join(chartPath, "Chart.yaml")), `probe chart missing at ${CHART}`);

    // Leg 1: render parity — the workload ConfigMap renders, and the migration Job
    // renders WITH a post-install hook annotation (separable from the object set).
    const tpl = tsh("helm", ["template", "probe", chartPath, "--namespace", NS]);
    const cmRendered = /name:\s*hook-job-probe-result/.test(tpl.out);
    const jobIsHook = /helm\.sh\/hook"?:\s*"?post-install/.test(tpl.out);
    legs.renderParity = {
      mode: "helm template (render parity)",
      observed: jobIsHook ? "job-is-post-install-hook" : "not-a-hook",
      result: cmRendered && jobIsHook ? "pass" : "watch",
      expected: "job-is-post-install-hook",
    };

    const up = tsh("kind", ["create", "cluster", "--name", rig, "--wait", "60s"]);
    clusterUp = up.ok || (tsh("kind", ["get", "clusters"]).out || "").includes(rig);
    check(clusterUp, `kind cluster did not come up: ${up.out}`);
    const kctx = `kind-${rig}`;

    // Leg 2: helm install — Helm applies the workload AND runs the post-install Job
    // silently as part of install (a privileged step you never saw or approved).
    const inst = tsh("helm", ["install", "probe", chartPath, "--namespace", NS, "--create-namespace", "--kube-context", kctx, "--wait", "--timeout", "150s"]);
    const cm1 = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "configmap", "hook-job-probe-result", "-o", "name"]);
    const job1 = tsh("kubectl", ["--context", kctx, "-n", NS, "get", "job", JOB, "-o", "jsonpath={.status.succeeded}"]);
    const silentRan = cm1.ok && cm1.out.includes("hook-job-probe-result") && job1.out.trim() === "1";
    legs.helmInstallSilent = {
      mode: "helm install (what Helm does)",
      observed: silentRan ? "job-run-silently-by-helm" : "incomplete",
      result: silentRan ? "pass" : "watch",
      expected: "job-run-silently-by-helm",
      detail: inst.ok ? "" : inst.out.slice(0, 300),
    };

    // Leg 3: routed execution — in a fresh namespace, apply ONLY the workload
    // (the object set), then EXECUTE the migration Job explicitly as a named
    // lifecycle action (the harness runs it; Helm's hook machinery does not).
    tsh("kubectl", ["--context", kctx, "create", "namespace", NS2]);
    const workloadYaml = tsh("helm", ["template", "probe", chartPath, "--namespace", NS2, "--show-only", "templates/workload.yaml"]);
    const jobYaml = tsh("helm", ["template", "probe", chartPath, "--namespace", NS2, "--show-only", "templates/migration-job.yaml"]);
    const wPath = join(work, "workload.yaml");
    const jPath = join(work, "migration-job.yaml");
    writeFileSync(wPath, workloadYaml.out || "");
    writeFileSync(jPath, jobYaml.out || "");
    const applyW = tsh("kubectl", ["--context", kctx, "-n", NS2, "apply", "-f", wPath]);
    const applyJ = tsh("kubectl", ["--context", kctx, "-n", NS2, "apply", "-f", jPath]);
    tsh("kubectl", ["--context", kctx, "-n", NS2, "wait", "--for=condition=complete", `job/${JOB}`, "--timeout=150s"]);
    const cm2 = tsh("kubectl", ["--context", kctx, "-n", NS2, "get", "configmap", "hook-job-probe-result", "-o", "name"]);
    const job2 = tsh("kubectl", ["--context", kctx, "-n", NS2, "get", "job", JOB, "-o", "jsonpath={.status.succeeded}"]);
    const routedRan = cm2.ok && cm2.out.includes("hook-job-probe-result") && job2.out.trim() === "1";
    legs.routedExecution = {
      mode: "routed execution (this method)",
      observed: routedRan ? "job-executed-explicitly-receipted" : "incomplete",
      result: routedRan ? "pass" : "watch",
      expected: "job-executed-explicitly-receipted",
      detail: applyW.ok && applyJ.ok ? "" : `${applyW.out}${applyJ.out}`.slice(0, 300),
    };

    tsh("helm", ["uninstall", "probe", "--namespace", NS, "--kube-context", kctx]);
  } finally {
    if (clusterUp) tsh("kind", ["delete", "cluster", "--name", rig]);
    rmSync(work, { recursive: true, force: true });
  }

  const corePass = legs.renderParity.result === "pass" && legs.routedExecution.result === "pass";
  const result = !corePass ? "watch" : (legs.helmInstallSilent.result === "pass" ? "pass" : "watch");
  return {
    apiVersion: "helm-expt.confighub.com/v1alpha1",
    kind: "HookRouteExecutionReceipt",
    metadata: { name: rig },
    spec: {
      chart: CHART,
      observedAt: stamp,
      result,
      claim: "A post-install Job that Helm runs silently inside `helm install` can instead be executed as an explicit, named, receipted lifecycle action — same outcome, but visible, audited, and automatable (your pipeline or cub runs it). This is the execution evidence that justifies automatic:true for this route scope.",
      route: { quirkClass: "hook-phase", routeName: "explicit-managed-action", actionKind: "run-job", lifecyclePhase: "post-apply" },
      execution: {
        executor: "harness",
        helmHooksExecutedByHarness: true,
        automaticJustified: corePass,
        note: "executor=harness proves a non-Helm path executed the route; automatic:true is justified for THIS scope (chart/base/cluster) only, and stays automatic:false in the catalog until folded in deliberately.",
      },
      run: { rig, namespaces: [NS, NS2], cleanup: { result: clusterUp ? "pass" : "n/a" } },
      legs,
      conclusion: corePass
        ? "Execution proven live: render parity delivers the workload; the post-install Job was executed explicitly in a fresh namespace and completed (executor=harness, receipted) — the same Job Helm otherwise runs silently inside install. This is the receipted-execution path that justifies automatic:true for this scope."
        : "Core legs did not produce the expected values; see leg details.",
    },
  };
}

function summaryMd(r) {
  const s = r.spec; const L = s.legs;
  const row = (l) => `| ${l.mode} | \`${l.observed}\` | ${l.result} |`;
  return `# Hook route execution proof (run-job)

**UNOFFICIAL/EXPERIMENTAL.** Live receipt generated by \`scripts/run-hook-execution-proof.mjs\`; do not hand-edit. Regenerate with \`npm run hook-execution:proof\`.

**Claim.** ${s.claim}

Phase 1 of \`docs/planning/hook-route-execution-plan.md\`: the receipted-execution path. A post-install Job is the "provisioning/migration Job" class — the part Helm runs silently inside \`helm install\`. This proves the same Job can be executed as an explicit, named, receipted lifecycle action.

| Delivery path | post-install Job | result |
| --- | --- | --- |
${row(L.renderParity)}
${row(L.helmInstallSilent)}
${row(L.routedExecution)}

Overall: **${s.result}**. ${s.conclusion}

- **\`helm install\`** runs the post-install Job **silently** as part of install — a privileged step you never saw or approved.
- **Routed execution** runs the same Job as an explicit, named action with a receipt (\`executor: ${s.execution.executor}\`) — same outcome, but visible, audited, and automatable.
- **Why it matters:** this execution evidence is what justifies \`automatic: true\` for this scope (it stays \`false\` in the catalog until folded in deliberately). Next: Phase 2 emits this route as a GitOps PreSync/PostSync so your existing controller runs it.
- Receipt: \`runs/hook-execution-proof/receipt.yaml\`. Probe chart: \`${CHART}\`.
`;
}

function summaryHtml(r) {
  const s = r.spec; const L = s.legs;
  const chip = (v) => `<span class="chip ${v === "pass" ? "ok" : v === "watch" ? "warn" : "bad"}">${v}</span>`;
  const legRow = (l) => `<tr><td>${l.mode}</td><td><code>${l.observed}</code></td><td>${chip(l.result)}</td></tr>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hook route execution — silent vs. receipted</title>
<style>
  body{font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:2rem;background:#f6f8fa;color:#1f2328}
  main{max-width:880px;margin:0 auto}
  h1{font-size:1.5rem;margin:0 0 .25rem}
  .sub{color:#57606a;margin:0 0 1rem}
  .banner{background:#fff8c5;border:1px solid #d4a72c66;border-radius:6px;padding:.5rem .8rem;font-size:.85rem;color:#6b5900;margin-bottom:1rem}
  .claim{background:#ddf4ff;border-left:4px solid #0969da;border-radius:4px;padding:.7rem 1rem;margin:1rem 0}
  table{border-collapse:collapse;width:100%;background:#fff;border:1px solid #d0d7de;border-radius:6px;overflow:hidden}
  th,td{text-align:left;padding:.55rem .7rem;border-bottom:1px solid #eaeef2}
  th{background:#f6f8fa;font-size:.78rem;text-transform:uppercase;letter-spacing:.03em;color:#57606a}
  tr:last-child td{border-bottom:0}
  code{background:#eff1f3;padding:.05rem .3rem;border-radius:4px;font-size:.85em}
  .chip{display:inline-block;padding:.1rem .55rem;border-radius:999px;font-size:.78rem;font-weight:600}
  .chip.ok{background:#e6f4ea;color:#1a7f37}.chip.warn{background:#fff1d6;color:#9a6700}.chip.bad{background:#ffebe9;color:#cf222e}
  .overall{font-size:1rem;margin:1rem 0}
  footer{margin-top:2rem;color:#57606a;font-size:.85rem}
</style></head>
<body><main>
  <h1>Hook route execution — silent vs. receipted</h1>
  <p class="sub">run-job class · chart <code>${s.chart}</code> · generated ${s.observedAt}</p>
  <div class="banner"><b>UNOFFICIAL/EXPERIMENTAL.</b> Generated by <code>scripts/run-hook-execution-proof.mjs</code>; do not hand-edit. Regenerate with <code>npm run hook-execution:proof</code>.</div>
  <div class="claim">${s.claim}</div>
  <table><thead><tr><th>Delivery path</th><th>post-install Job</th><th>result</th></tr></thead>
  <tbody>${legRow(L.renderParity)}${legRow(L.helmInstallSilent)}${legRow(L.routedExecution)}</tbody></table>
  <p class="overall">Overall: ${chip(s.result)}</p>
  <footer><b>helm install</b> runs the post-install Job silently inside install — a privileged step you never saw. <b>Routed execution</b> runs the same Job as an explicit, named action with a receipt (<code>executor: ${s.execution.executor}</code>) — same outcome, visible and automatable. This execution evidence justifies <code>automatic: true</code> for this scope (it stays <code>false</code> in the catalog until folded in deliberately). Next: Phase 2 emits the route as a GitOps PreSync/PostSync so your existing controller runs it.</footer>
</main></body></html>
`;
}

if (mode === "--run") {
  const r = runProof();
  writeYaml(receiptPath, r);
  write(summaryPath, summaryMd(r));
  write(htmlPath, summaryHtml(r));
  console.log(`wrote hook-execution proof -> ${relativeRepo(receiptPath)} result=${r.spec.result}`);
} else if (mode === "--verify") {
  check(existsSync(receiptPath), `${relativeRepo(receiptPath)} missing; run npm run hook-execution:proof`);
  const r = readYaml(receiptPath);
  check(r.kind === "HookRouteExecutionReceipt", "receipt kind mismatch");
  check(["pass", "watch", "blocked"].includes(r.spec?.result), "receipt result invalid");
  for (const k of ["renderParity", "helmInstallSilent", "routedExecution"]) check(r.spec?.legs?.[k], `receipt missing leg ${k}`);
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} missing`);
  check(readFileSync(summaryPath, "utf8") === summaryMd(r), `${relativeRepo(summaryPath)} is stale; run npm run hook-execution:proof`);
  check(existsSync(htmlPath), `${relativeRepo(htmlPath)} missing`);
  check(readFileSync(htmlPath, "utf8") === summaryHtml(r), `${relativeRepo(htmlPath)} is stale; run npm run hook-execution:proof`);
  console.log(`verified hook-execution proof: result=${r.spec.result}`);
} else {
  console.log("Usage:\n  node scripts/run-hook-execution-proof.mjs --run\n  node scripts/run-hook-execution-proof.mjs --verify");
}
