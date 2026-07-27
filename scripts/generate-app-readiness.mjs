#!/usr/bin/env node
// Catalog-wide RBAC review over committed default renders. This is deliberately
// read-only and deterministic: it needs neither a cluster nor a fresh Helm render.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, parseDocs, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const root = join(repoRoot, "data", "app-readiness");
const outputs = { summary: join(root, "summary.md"), csv: join(root, "rbac-findings.csv"), html: join(root, "matrix.html") };

function defaultRenders() {
  return listFiles(join(repoRoot, "recipes"))
    .filter((f) => f.endsWith("/revisions/default/r001/rendered/release-objects.yaml"))
    .sort();
}

function chartOf(file) {
  return relativeRepo(file).replace(/^recipes\//, "").split("/revisions/")[0];
}

// Risk heuristics over a single RBAC policy rule (read-only, conservative).
function ruleFindings(rule) {
  const verbs = (rule.verbs ?? []).map(String);
  const resources = (rule.resources ?? []).map(String);
  const out = [];
  const verbWild = verbs.includes("*");
  if (verbWild && resources.includes("*")) out.push("full-wildcard");
  if (resources.includes("secrets") && (verbWild || verbs.some((v) => ["get", "list", "watch"].includes(v)))) out.push("secret-read");
  if (verbs.some((v) => ["escalate", "bind", "impersonate"].includes(v))) out.push("priv-escalation");
  if (resources.includes("*") && !verbWild) out.push("all-resources");
  return out;
}

function analyze() {
  const rows = [];
  for (const file of defaultRenders()) {
    const docs = parseDocs(readFileSync(file, "utf8"));
    let clusterRoles = 0, roles = 0, riskyRules = 0;
    const findings = new Set();
    for (const d of docs) {
      if (d.kind !== "ClusterRole" && d.kind !== "Role") continue;
      if (d.kind === "ClusterRole") clusterRoles++; else roles++;
      for (const rule of d.rules ?? []) {
        const f = ruleFindings(rule);
        if (f.length) { riskyRules++; f.forEach((x) => findings.add(x)); }
      }
    }
    rows.push({ chart: chartOf(file), clusterRoles, roles, riskyRules, findings: [...findings].sort() });
  }
  rows.sort((a, b) => b.riskyRules - a.riskyRules || b.findings.length - a.findings.length || a.chart.localeCompare(b.chart));
  return rows;
}

function csv(rows) {
  const header = "chart,cluster_roles,roles,risky_rules,findings";
  const lines = rows.map((r) => [r.chart, r.clusterRoles, r.roles, r.riskyRules, `"${r.findings.join("; ")}"`].join(","));
  return [header, ...lines].join("\n") + "\n";
}

function summaryMd(rows) {
  const charts = rows.length;
  const withRbac = rows.filter((r) => r.clusterRoles + r.roles > 0).length;
  const withRisk = rows.filter((r) => r.riskyRules > 0);
  const findingTotals = {};
  for (const r of rows) for (const f of r.findings) findingTotals[f] = (findingTotals[f] ?? 0) + 1;
  const o = [];
  o.push("# RBAC permissions in catalog charts", "");
  o.push("This report checks the rendered default configuration for every catalog chart and lists RBAC rules that deserve review. It reads the committed Kubernetes objects, so it does not need access to a cluster and does not run Helm again.", "");
  o.push("Broad permissions are sometimes necessary, especially for operators and platform services. The purpose of this report is to show where those permissions occur so a team can decide whether each one is appropriate for its use.", "");
  o.push(`Scanned **${charts}** default renders; **${withRbac}** ship RBAC; **${withRisk.length}** contain at least one broad/risky rule by these conservative heuristics.`, "");
  o.push("Findings across the catalog:", "");
  o.push("| Finding | Charts | Meaning |", "| --- | ---: | --- |");
  const meanings = {
    "full-wildcard": "a rule grants `*` verbs on `*` resources (admin-like)",
    "secret-read": "a rule can read Secrets (`get`/`list`/`watch` or `*`)",
    "priv-escalation": "a rule has `escalate`/`bind`/`impersonate`",
    "all-resources": "a rule targets `*` resources (non-wildcard verbs)",
  };
  for (const f of Object.keys(meanings)) o.push(`| \`${f}\` | ${findingTotals[f] ?? 0} | ${meanings[f]} |`);
  o.push("");
  o.push("## Charts to review first", "");
  o.push("| Chart | ClusterRoles | Roles | Risky rules | Findings |", "| --- | ---: | ---: | ---: | --- |");
  for (const r of withRisk.slice(0, 25)) o.push(`| \`${r.chart}\` | ${r.clusterRoles} | ${r.roles} | ${r.riskyRules} | ${r.findings.map((f) => `\`${f}\``).join(", ")} |`);
  if (withRisk.length > 25) o.push(`| _… and ${withRisk.length - 25} more_ | | | | |`);
  o.push("");
  o.push("## What happens after a finding", "");
  o.push("A finding is a reason to inspect the rendered Role or ClusterRole. If the permission is not needed, propose a precise object change, review the diff, run the normal policy checks, and require approval before delivery.", "");
  o.push("The [live RBAC review example](../rbac-review-live-proof/summary.md) follows that path for one namespaced service account. It removes Secret access, keeps ConfigMap access, proves that ConfigHub blocked the correction until approval, publishes the approved objects as OCI, and lets Argo CD deliver the result to an isolated Kubernetes cluster. The [walkthrough](../../docs/demo/apps/rbac-review.md) explains each step.", "");
  o.push("");
  o.push("## Limits", "");
  o.push("- The rules are conservative. A finding asks for review; it does not declare that a chart is wrong.");
  o.push("- The report does not expand aggregated ClusterRoles or resolve the complete RoleBinding and ClusterRoleBinding graph.");
  o.push("- The catalog-wide scan is read-only. The live example proves one reviewed correction and Argo CD delivery on one throwaway cluster. It does not prove a permanent public package, Flux delivery, or fleet-wide RBAC analysis.");
  o.push("");
  o.push("## Regenerate", "", "~~~sh", "npm run app-readiness:generate", "npm run app-readiness:verify", "~~~");
  return o.join("\n") + "\n";
}

function html(rows) {
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const withRisk = rows.filter((r) => r.riskyRules > 0);
  const max = Math.max(1, ...rows.map((r) => r.riskyRules));
  const p = [];
  p.push("<!doctype html><html><head><meta charset=\"utf-8\"><title>RBAC permissions in catalog charts</title>");
  p.push("<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:24px;color:#1b1f23}h1{font-size:20px}table{border-collapse:collapse;margin:10px 0;font-size:12.5px}th,td{border:1px solid #d0d7de;padding:5px 9px;text-align:left}th{background:#f6f8fa}td.n{text-align:right}.note{color:#57606a;font-size:13px;max-width:64em}</style></head><body>");
  p.push("<h1>RBAC permissions in catalog charts</h1>");
  p.push("<p class=\"note\">This report checks committed default renders for broad RBAC rules. It needs no cluster and does not run Helm again. A finding asks for review; it does not declare that a chart is wrong. Red intensity scales with the number of rules found.</p>");
  p.push("<table><tr><th>Chart</th><th>ClusterRoles</th><th>Roles</th><th>Risky rules</th><th>Findings</th></tr>");
  for (const r of withRisk) {
    const t = Math.min(1, r.riskyRules / max);
    const bg = `rgba(207,34,46,${(0.08 + 0.5 * t).toFixed(2)})`;
    p.push(`<tr><td><code>${esc(r.chart)}</code></td><td class="n">${r.clusterRoles}</td><td class="n">${r.roles}</td><td class="n" style="background:${bg}">${r.riskyRules}</td><td>${esc(r.findings.join(", "))}</td></tr>`);
  }
  p.push("</table></body></html>");
  return p.join("\n") + "\n";
}

function build() {
  const rows = analyze();
  return { rows, summary: summaryMd(rows), csv: csv(rows), html: html(rows) };
}

if (mode === "--generate") {
  const r = build();
  write(outputs.summary, r.summary);
  write(outputs.csv, r.csv);
  write(outputs.html, r.html);
  console.log(`wrote app-readiness -> ${relativeRepo(root)}/ (${r.rows.length} default renders; ${r.rows.filter((x) => x.riskyRules > 0).length} with risky RBAC)`);
} else if (mode === "--verify") {
  const r = build();
  const byName = { summary: r.summary, csv: r.csv, html: r.html };
  for (const [name, path] of Object.entries(outputs)) {
    check(existsSync(path), `${relativeRepo(path)} is missing; run npm run app-readiness:generate`);
    check(readFileSync(path, "utf8") === byName[name], `${relativeRepo(path)} is stale; run npm run app-readiness:generate`);
  }
  console.log(`verified app-readiness: ${r.rows.length} default renders analysed`);
} else {
  console.log("Usage:\n  node scripts/generate-app-readiness.mjs --generate\n  node scripts/generate-app-readiness.mjs --verify");
}
