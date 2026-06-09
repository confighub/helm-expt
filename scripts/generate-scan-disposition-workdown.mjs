#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, readYaml, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "scan-disposition-workdown");
const workdownPath = join(outputRoot, "workdown.csv");
const summaryPath = join(outputRoot, "summary.md");

if (mode === "--generate") {
  const report = buildReport();
  write(workdownPath, report.csv);
  write(summaryPath, report.summary);
  console.log("wrote scan disposition workdown");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(workdownPath), "missing scan disposition workdown; run npm run scan-disposition:workdown");
  check(existsSync(summaryPath), "missing scan disposition summary; run npm run scan-disposition:workdown");
  check(readFileSync(workdownPath, "utf8") === report.csv, "scan disposition workdown is stale");
  check(readFileSync(summaryPath, "utf8") === report.summary, "scan disposition summary is stale");
  console.log(`verified scan disposition workdown for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-scan-disposition-workdown.mjs --generate
  node scripts/generate-scan-disposition-workdown.mjs --verify`);
}

function buildReport() {
  const scanRows = parseCsvFile("data/external-scan-lane/chart-workdown.csv");
  const productionRows = new Map(parseCsvFile("data/production-disposition/next-actions.csv").map((row) => [row.chart, row]));
  const rows = scanRows.map((row) => {
    const topChecks = parseTopChecks(row.topChecks);
    const route = classifyRoute(row.chart, topChecks);
    const production = productionRows.get(row.chart) ?? {};
    const securityDecision = supportSecurityDecision(row.chart, row.version);
    return {
      chart: row.chart,
      version: row.version,
      variants: row.variants,
      scanPriority: row.priority,
      findingCount: row.findingCount,
      topChecks: row.topChecks,
      dispositionRoute: route.route,
      routeReason: route.reason,
      suggestedAction: securityDecision.state === "recorded" ? securityDecision.nextAction : route.action,
      supportSecurityDecision: securityDecision.path,
      supportSecurityDecisionState: securityDecision.decision,
      productionNextDisposition: production.nextDisposition ?? "",
      productionDispositionReceipt: production.nextDispositionReceipt ?? "",
      owner: ownerFor(route.route, production.owner),
      productionState: production.productionState ?? "",
      liveE2EReceipts: production.liveE2EReceipts ?? "",
    };
  });
  rows.sort(
    (left, right) =>
      priorityRank(left.scanPriority) - priorityRank(right.scanPriority) ||
      routeRank(left.dispositionRoute) - routeRank(right.dispositionRoute) ||
      Number(right.findingCount) - Number(left.findingCount) ||
      left.chart.localeCompare(right.chart),
  );
  return {
    rows,
    csv: toCsv(rows),
    summary: toSummary(rows),
  };
}

function classifyRoute(chart, checks) {
  if (checks.has("latest-tag")) {
    return {
      route: "fix-image-pin",
      reason: "rendered objects still use mutable image tags",
      action: "pin image tag or digest in the supported installer base and regenerate the bound proof receipts",
    };
  }
  const securityChecks = [
    "privileged-container",
    "privilege-escalation-container",
    "sensitive-host-mounts",
    "host-network",
    "host-pid",
    "run-as-non-root",
    "no-read-only-root-fs",
  ];
  if (securityChecks.some((check) => checks.has(check))) {
    if (isPrivilegedInfrastructure(chart)) {
      return {
        route: "accept-or-split-privileged-infrastructure",
        reason: "the chart installs infrastructure that normally needs node, host, or privileged access",
        action: "record an explicit security acceptance for the supported scope or create a narrower hardened base where the chart supports it",
      };
    }
    return {
      route: "harden-security-context",
      reason: "rendered workloads need pod/container security review before production support",
      action: "add supported hardening values where safe, or record a chart-specific security disposition for the remaining workload behavior",
    };
  }
  if (checks.has("unset-cpu-requirements") || checks.has("unset-memory-requirements")) {
    return {
      route: "add-resource-policy",
      reason: "rendered workloads lack production resource requests or limits",
      action: "add a production resource policy/base variant or explicitly keep chart defaults as local-test only",
    };
  }
  if (checks.has("dangling-service") || checks.has("liveness-port") || checks.has("readiness-port") || checks.has("startup-port")) {
    return {
      route: "review-runtime-endpoints",
      reason: "rendered services or probes need runtime endpoint confirmation",
      action: "bind the warning to live observation receipts or patch the supported base if the endpoint is wrong",
    };
  }
  if (checks.has("pdb-unhealthy-pod-eviction-policy")) {
    return {
      route: "accept-or-patch-pdb-policy",
      reason: "the remaining warning is an explicit PodDisruptionBudget policy choice",
      action: "accept chart behavior for the supported scope or add a reviewed patch where the chart supports it",
    };
  }
  if (checks.has("job-ttl-seconds-after-finished")) {
    return {
      route: "review-lifecycle-cleanup",
      reason: "rendered Jobs need an explicit lifecycle cleanup decision",
      action: "record lifecycle policy or set a TTL where the chart supports it",
    };
  }
  return {
    route: "review-scan-warning",
    reason: "scanner warning needs a chart-specific disposition",
    action: "classify, fix, accept, or block the warning in the production disposition receipt",
  };
}

function isPrivilegedInfrastructure(chart) {
  return new Set([
    "longhorn/longhorn",
    "secrets-store-csi-driver/secrets-store-csi-driver",
    "prometheus-community/prometheus",
    "prometheus-community/kube-prometheus-stack",
  ]).has(chart);
}

function supportSecurityDecision(chart, version) {
  const path = `data/production-support-decisions/${slug(chart)}/security-decision.yaml`;
  const absolute = join(repoRoot, path);
  if (!existsSync(absolute)) return { state: "missing", decision: "", path: "", nextAction: "" };
  const decision = readYaml(absolute);
  const spec = decision.spec ?? {};
  check(decision.kind === "ProductionSecurityDecision", `${path} must be kind ProductionSecurityDecision`);
  check(spec.chart === chart, `${path} chart mismatch`);
  check(spec.version === version, `${path} version mismatch`);
  return {
    state: "recorded",
    decision: spec.decision ?? "",
    path,
    nextAction:
      "support security decision recorded; use the accepted target scope or create a hardened base for stricter environments",
  };
}

function slug(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function toSummary(rows) {
  const highRows = rows.filter((row) => row.scanPriority === "high");
  const routeCounts = countBy(rows, (row) => row.dispositionRoute);
  const priorityCounts = countBy(rows, (row) => row.scanPriority);
  const latestRows = rows.filter((row) => row.topChecks.includes("latest-tag"));
  return `# Scan Disposition Workdown

This generated workdown turns external scan findings into production-review
routes. It is a bridge between raw scan output and production disposition
receipts.

The purpose is to avoid treating every warning as the same kind of work.
Some warnings should be fixed in the installer base. Some require a new
hardened base. Some are expected for infrastructure charts and need explicit
acceptance before production support is claimed.

## Current Reading

~~~text
top-20 scanned charts:        ${rows.length}
high-priority scan rows:      ${highRows.length}
rows with latest-tag issues:  ${latestRows.length}
production-supported rows:    ${rows.filter((row) => row.productionState === "production-supported").length}
production-review-ready rows: ${rows.filter((row) => row.productionState === "production-review-ready").length}
production-blocked rows:      ${rows.filter((row) => row.productionState === "production-blocked").length}
~~~

## Priority Counts

| Priority | Charts |
| --- | ---: |
${[...priorityCounts.entries()].map(([priority, count]) => `| ${priority} | ${count} |`).join("\n")}

## Disposition Routes

| Route | Charts | Meaning |
| --- | ---: | --- |
${[...routeCounts.entries()].map(([route, count]) => `| \`${route}\` | ${count} | ${routeMeaning(route)} |`).join("\n")}

## High-Priority Rows

| Chart | Findings | Top checks | Route | Support security decision | Suggested action |
| --- | ---: | --- | --- | --- | --- |
${highRows.map((row) => `| \`${row.chart}@${row.version}\` | ${row.findingCount} | ${row.topChecks} | \`${row.dispositionRoute}\` | ${row.supportSecurityDecisionState || "-"} | ${row.suggestedAction} |`).join("\n") || "| - | 0 | - | - | - | - |"}

## Files

| File | Purpose |
| --- | --- |
| \`workdown.csv\` | Spreadsheet-ready scan disposition route for each top-20 chart. |
| \`../external-scan-lane/chart-workdown.csv\` | Raw chart-level scan grouping used as input. |
| \`../production-disposition/next-actions.csv\` | Production disposition queue joined into this workdown. |

## Rule

No chart becomes production-supported because a scan warning merely exists in a
spreadsheet. Each warning must be fixed, accepted, or made a variant blocker in
a production disposition receipt bound to the rendered object set.
`;
}

function routeMeaning(route) {
  return {
    "fix-image-pin": "Mutable image input; fix in supported values and regenerate proof.",
    "add-resource-policy": "Resource requests/limits need a production policy or production base.",
    "harden-security-context": "Pod/container security settings need hardening or explicit acceptance.",
    "accept-or-split-privileged-infrastructure": "Privileged infrastructure behavior is likely intentional and must be accepted or split into a narrower base.",
    "review-runtime-endpoints": "Services/probes need runtime confirmation or a patch.",
    "accept-or-patch-pdb-policy": "PDB behavior needs an explicit accept-or-patch decision.",
    "review-lifecycle-cleanup": "Job cleanup/lifecycle behavior needs a policy.",
    "review-scan-warning": "Generic scan warning review.",
  }[route] ?? "Chart-specific review.";
}

function parseTopChecks(text) {
  const result = new Map();
  for (const item of String(text ?? "").split(";").filter(Boolean)) {
    const [name, count] = item.split(":");
    if (name) result.set(name, Number(count ?? 0));
  }
  return result;
}

function ownerFor(route, fallback) {
  if (route === "fix-image-pin" || route === "add-resource-policy") return "catalog-review";
  if (route === "accept-or-split-privileged-infrastructure" || route === "harden-security-context") return "security-review";
  if (route === "review-runtime-endpoints" || route === "review-lifecycle-cleanup") return "operate-review";
  return fallback || "security-review";
}

function priorityRank(priority) {
  return { high: 0, medium: 1, standard: 2, low: 3 }[priority] ?? 9;
}

function routeRank(route) {
  return {
    "fix-image-pin": 0,
    "harden-security-context": 1,
    "accept-or-split-privileged-infrastructure": 2,
    "add-resource-policy": 3,
    "review-runtime-endpoints": 4,
    "accept-or-patch-pdb-policy": 5,
    "review-lifecycle-cleanup": 6,
    "review-scan-warning": 7,
  }[route] ?? 9;
}

function countBy(rows, fn) {
  const result = new Map();
  for (const row of rows) {
    const key = fn(row) || "unknown";
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return new Map([...result.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])));
}

function parseCsvFile(path) {
  const absolute = join(repoRoot, path);
  check(existsSync(absolute), `missing CSV input ${path}`);
  return parseCsv(readFileSync(absolute, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(parseCsvLine(line).map((value, index) => [headers[index], value])));
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  values.push(current);
  return values;
}

function toCsv(rows) {
  const headers = [
    "chart",
    "version",
    "variants",
    "scanPriority",
    "findingCount",
    "topChecks",
    "dispositionRoute",
    "routeReason",
    "suggestedAction",
    "supportSecurityDecision",
    "supportSecurityDecisionState",
    "productionNextDisposition",
    "productionDispositionReceipt",
    "owner",
    "productionState",
    "liveE2EReceipts",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
