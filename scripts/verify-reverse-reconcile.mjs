#!/usr/bin/env node
// Reverse-reconcile receipts (move 2 design). Each ReverseReconcileReceipt must be
// AUTHORIZED (per the default-deny ReverseReconcilePolicy), BOUNDED (only
// authorized fields changed), ROUND-TRIP CLOSED (desired-after == observed live
// value, no residual drift), ATTRIBUTED (who/when/operation/authority/intent),
// and HONESTLY SCOPED (status + notClaimed + write-back method match). Every
// property is checked here so the design cannot silently become an overclaim.
//
//   node scripts/verify-reverse-reconcile.mjs --generate   # write the rollup summary
//   node scripts/verify-reverse-reconcile.mjs --verify     # check receipts + summary
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--verify";
const root = join(repoRoot, "data", "reverse-reconcile");
const policyPath = join(root, "authority-policy.yaml");
const summaryPath = join(root, "summary.md");

const KNOWN_STATUS = new Set(["design-example", "proven"]);
const METHOD_FOR_STATUS = { "design-example": "manual-fixture", proven: "cub-reverse-reconcile" };

function exampleFiles() {
  const dir = join(root, "examples");
  if (!existsSync(dir)) return [];
  return listFiles(dir).filter((f) => f.endsWith(".yaml")).sort();
}

function authorizedRules(policy, role) {
  const rule = (policy.spec?.rules ?? []).find((r) => r.role === role);
  return rule ? rule.mayAccept ?? [] : [];
}

function isAuthorized(allowed, env, field) {
  return allowed.some(
    (a) =>
      a.valuePath === field.valuePath &&
      a.field === field.field &&
      (a.objects ?? []).includes(field.object) &&
      (a.environments ?? []).includes(env),
  );
}

function evaluate() {
  check(existsSync(policyPath), `${relativeRepo(policyPath)} is missing`);
  const policy = readYaml(policyPath);
  check(policy.kind === "ReverseReconcilePolicy", `${relativeRepo(policyPath)}: not a ReverseReconcilePolicy`);
  const rows = [];
  for (const file of exampleFiles()) {
    const rel = relativeRepo(file);
    const doc = readYaml(file);
    check(doc.kind === "ReverseReconcileReceipt", `${rel}: not a ReverseReconcileReceipt`);
    const s = doc.spec ?? {};
    check(KNOWN_STATUS.has(s.status), `${rel}: unknown status "${s.status}"`);
    check(Array.isArray(s.notClaimed) && s.notClaimed.length > 0, `${rel}: missing notClaimed honesty markers`);
    const role = s.trigger?.role;
    check(role, `${rel}: missing trigger.role`);
    const allowed = authorizedRules(policy, role);
    const changed = s.bounds?.changedFields ?? [];
    check(changed.length > 0, `${rel}: bounds.changedFields is empty`);

    // bounds: which changed fields are NOT authorized by the policy
    const unauthorized = changed.filter((f) => !isAuthorized(allowed, s.environment, f)).map((f) => `${f.object} ${f.field}`).sort();
    const declared = [...(s.bounds?.unauthorizedFieldsChanged ?? [])].sort();
    check(JSON.stringify(unauthorized) === JSON.stringify(declared),
      `${rel}: bounds.unauthorizedFieldsChanged ${JSON.stringify(declared)} disagrees with the policy ${JSON.stringify(unauthorized)}`);
    const withinScope = unauthorized.length === 0;
    check(s.bounds?.withinAuthorizedScope === withinScope, `${rel}: bounds.withinAuthorizedScope must be ${withinScope}`);
    check(s.authority?.decision === (withinScope ? "allow" : "deny"), `${rel}: authority.decision must be "${withinScope ? "allow" : "deny"}"`);

    // round-trip: desired was set to the observed live value, no residual drift
    check(s.writeBack?.desiredValueAfter === s.observation?.liveValue,
      `${rel}: writeBack.desiredValueAfter (${s.writeBack?.desiredValueAfter}) != observed liveValue (${s.observation?.liveValue})`);
    check((s.roundTrip?.residualDrift ?? []).length === 0, `${rel}: roundTrip.residualDrift is not empty`);
    check(s.roundTrip?.desiredAfterMatchesObserved === true && s.roundTrip?.result === "closed", `${rel}: round-trip is not closed`);

    // attribution + honesty
    const prov = s.writeBack?.provenance ?? {};
    for (const k of ["who", "when", "operation", "authority", "intent"]) check(prov[k], `${rel}: writeBack.provenance.${k} is missing`);
    check(s.writeBack?.method === METHOD_FOR_STATUS[s.status], `${rel}: status "${s.status}" requires writeBack.method "${METHOD_FOR_STATUS[s.status]}"`);

    rows.push({
      name: doc.metadata?.name ?? rel,
      chart: `${s.chart}@${String(s.version)}`,
      env: s.environment,
      change: changed.map((f) => `${f.valuePath}: ${f.from} -> ${f.to}`).join("; "),
      decision: s.authority?.decision,
      bounded: withinScope,
      roundTrip: s.roundTrip?.result,
      status: s.status,
    });
  }
  return { rows };
}

function summaryMd({ rows }) {
  const out = [];
  out.push("# Reverse-Reconcile Receipts (move 2, design)", "");
  out.push("Generated rollup of `ReverseReconcileReceipt` design examples. Each row is machine-checked by `scripts/verify-reverse-reconcile.mjs`: **authorized** (default-deny policy), **bounded** (only authorized fields changed), **round-trip closed** (desired-after == observed live value, no residual drift), attributed, and honestly scoped.", "");
  out.push("This is a **design** for move 2 in [#974](https://github.com/confighub/helm-expt/issues/974) — the reverse live-to-desired direction. The live observation is a fixture and the write-back is manual; the named frontier is the gated `cub` reverse-reconcile command. See [the design doc](../../docs/user/reverse-reconcile-design.md) and [the authority policy](authority-policy.yaml).", "");
  out.push("| Receipt | Chart | Env | Accepted change | Authority | Bounded | Round-trip | Status |");
  out.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const r of rows) {
    out.push(`| \`${r.name}\` | ${r.chart} | ${r.env} | \`${r.change}\` | ${r.decision} | ${r.bounded ? "yes" : "**no**"} | ${r.roundTrip} | ${r.status} |`);
  }
  out.push("");
  out.push("## Regenerate", "", "~~~sh", "npm run reverse-reconcile:generate", "npm run reverse-reconcile:verify", "~~~");
  return out.join("\n") + "\n";
}

if (mode === "--generate") {
  const result = evaluate();
  write(summaryPath, summaryMd(result));
  console.log(`wrote reverse-reconcile -> ${relativeRepo(root)}/ (${result.rows.length} receipt(s) checked)`);
} else if (mode === "--verify") {
  const result = evaluate();
  check(existsSync(summaryPath), `${relativeRepo(summaryPath)} is missing; run npm run reverse-reconcile:generate`);
  check(readFileSync(summaryPath, "utf8") === summaryMd(result), `${relativeRepo(summaryPath)} is stale; run npm run reverse-reconcile:generate`);
  console.log(`verified reverse-reconcile: ${result.rows.length} receipt(s) authorized, bounded, round-trip-closed`);
} else {
  console.log("Usage:\n  node scripts/verify-reverse-reconcile.mjs --generate\n  node scripts/verify-reverse-reconcile.mjs --verify");
}
