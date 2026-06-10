import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  check,
  relativeRepo,
  repoRoot,
  write,
} from "./lib/proof-common.mjs";

const outDir = join(repoRoot, "data", "hook-route-candidates");
const candidatesPath = join(outDir, "candidates.csv");
const workOrdersPath = join(outDir, "work-orders.md");
const workOrdersCsvPath = join(outDir, "work-orders.csv");
const mode = process.argv[2] ?? "--generate";

if (mode === "--generate") {
  const report = buildReport();
  write(workOrdersPath, report.markdown);
  write(workOrdersCsvPath, report.csv);
  console.log(`wrote ${relativeRepo(workOrdersPath)}`);
  console.log(`wrote ${relativeRepo(workOrdersCsvPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(workOrdersPath), "missing hook route work orders; run npm run hooks:route-work-orders");
  check(existsSync(workOrdersCsvPath), "missing hook route work order CSV; run npm run hooks:route-work-orders");
  check(readFileSync(workOrdersPath, "utf8") === report.markdown, "hook route work orders are stale");
  check(readFileSync(workOrdersCsvPath, "utf8") === report.csv, "hook route work order CSV is stale");
  console.log(`verified hook route work orders for ${report.rows.length} candidate chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-hook-route-work-orders.mjs --generate
  node scripts/generate-hook-route-work-orders.mjs --verify`);
}

function buildReport() {
  const rows = parseCsvFile(candidatesPath).map((row) => ({
    ...row,
    chart_ref: `${row.chart}@${row.version}`,
  }));
  check(rows.length > 0, "expected hook route candidates");
  check(rows.every((row) => row.status === "candidate-route-plan"), "hook route work orders must start from candidate route plans");
  const orders = rows.flatMap((row) => candidateWorkOrders(row));
  return {
    rows,
    orders,
    markdown: workOrdersMarkdown(rows, orders),
    csv: workOrdersToCsv(orders),
  };
}

function candidateWorkOrders(row) {
  let order = 1;
  const add = (workType, reviewer, reason, doneWhen, evidence) => ({
    chart: row.chart,
    version: row.version,
    chart_ref: row.chart_ref,
    order: order++,
    work_type: workType,
    reviewer,
    pattern: row.pattern,
    candidate_route: row.candidate_route,
    reason,
    done_when: doneWhen,
    evidence,
  });
  const orders = [
    add(
      "base-rendering-review",
      "catalog reviewer",
      "Hook source evidence does not prove the hook appears in every supported base.",
      "The selected recipe/base records whether the hook renders, is intentionally inert, or requires a separate supported base.",
      candidateYamlPath(row),
    ),
  ];

  if (isVendored(row)) {
    orders.push(add(
      "dependency-closure-review",
      "catalog reviewer",
      "The hook is dependency-provided, so chart-level review alone can undercount it.",
      "The dependency source, dependency lock, and affected bases are recorded before the route is admitted to the maintained queue.",
      "data/remote-dependency-closure/top100.csv",
    ));
  }

  if (/database-migration/i.test(row.pattern)) {
    orders.push(add(
      "ordered-upgrade-action",
      "operator reviewer",
      "Database migration hooks are ordered lifecycle work, not ordinary desired Kubernetes objects.",
      "The pre-upgrade and post-upgrade actions are mapped to an ordered lifecycle route with rollback and failure-handling notes.",
      candidateYamlPath(row),
    ));
  }

  if (/provisioning-job/i.test(row.pattern)) {
    orders.push(add(
      "provisioning-mode-split",
      "catalog reviewer",
      "Provisioning hooks are usually values-conditional and often should be off in the default base.",
      "The catalog has a provisioning-off base and, if useful, a provisioning-enabled base with target facts and a managed action receipt.",
      candidateYamlPath(row),
    ));
  }

  if (/environment-conditional/i.test(row.pattern)) {
    orders.push(add(
      "target-scope-split",
      "platform reviewer",
      "The hook behavior depends on target class, such as GKE Autopilot or another environment-specific condition.",
      "Supported target classes are split into separate scopes with preflight checks or explicit unsupported-target blockers.",
      candidateYamlPath(row),
    ));
  }

  if (/hook-like/i.test(row.pattern)) {
    orders.push(add(
      "hook-free-claim-review",
      "catalog reviewer",
      "A zero Helm-hook annotation count is not enough when migration jobs still act like lifecycle work.",
      "The chart records whether lifecycle jobs are normal desired state, managed actions, or blockers for the selected base.",
      candidateYamlPath(row),
    ));
  }

  if (hasTargetDependency(row)) {
    orders.push(add(
      "target-preflight",
      "platform reviewer",
      "The route depends on target state, credentials, databases, object stores, or migration state.",
      "Target facts or preflight checks exist for the selected route, or the target prerequisite is explicitly out of scope.",
      candidateYamlPath(row),
    ));
  }

  if (/gitlab\/gitlab/.test(row.chart)) {
    orders.push(add(
      "serious-chart-base-selection",
      "catalog owner",
      "GitLab has broader platform prerequisites than the vendored hook itself.",
      "A serious-chart review chooses the supported base and records which lifecycle concerns are supported, deferred, or blocked.",
      "data/top100-coverage/work-queue.csv",
    ));
  }

  orders.push(
    add(
      "maintained-route-receipt",
      "catalog reviewer",
      "Candidate routes are intentionally not maintained lifecycle receipts.",
      "A HookLifecycleRouteReceipt or explicit blocker exists in the maintained hook lifecycle area for the selected base.",
      "data/hook-lifecycle/summary.md",
    ),
    add(
      "gitops-lifecycle-mapping",
      "operator reviewer",
      "Config-only delivery must say how the lifecycle work is driven when Helm hooks are not executed by Helm.",
      "The route records whether Argo CD, Flux, a ConfigHub action, or an operator-run action owns the lifecycle step.",
      "data/lifecycle-boundary/summary.md",
    ),
    add(
      "runtime-observation-or-execution",
      "operator reviewer",
      "A route is not proof that the lifecycle work completed successfully.",
      "The selected path has an execution receipt, a fresh observation receipt, or a named reason why runtime proof is deferred.",
      "data/hook-lifecycle/maintained-hook-queue.csv",
    ),
    add(
      "maintained-queue-admission",
      "catalog owner",
      "The chart should not be counted as maintained hook coverage until it has a route receipt or explicit blocker.",
      "The row is admitted to the maintained hook queue or remains in candidates with the missing evidence named.",
      "data/hook-lifecycle/summary.md",
    ),
  );

  return orders;
}

function workOrdersMarkdown(rows, orders) {
  const dependencyClosureRows = rows.filter(isVendored).length;
  const targetRows = rows.filter(hasTargetDependency).length;
  const patternCounts = countBy(rows, (row) => row.pattern.replace(/\s*\(.*\)\s*$/, ""));
  return `# Hook Route Candidate Work Orders

**UNOFFICIAL/EXPERIMENTAL — generated work orders, 2026-06-11.**

These generated work orders turn candidate hook route plans into assignable
proof work. They do not execute hooks, admit charts to the maintained hook
queue, or claim production readiness.

## Summary

~~~text
candidate charts: ${rows.length}
work orders: ${orders.length}
dependency-closure hook rows: ${dependencyClosureRows}
target/preflight rows: ${targetRows}
~~~

## Pattern Mix

| Pattern | Charts |
| --- | ---: |
${[...patternCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([pattern, count]) => `| \`${pattern}\` | ${count} |`).join("\n")}

## Work Orders By Chart

${rows.map((row) => chartSection(row, orders.filter((order) => order.chart_ref === row.chart_ref))).join("\n\n")}

## Rules

- A candidate route is not a maintained route receipt.
- Source evidence does not prove a hook renders for a selected base.
- Dependency-provided hooks must be reviewed through the dependency closure.
- Lifecycle work needs an execution receipt, fresh observation receipt, or an
  explicit blocker before support claims.

## Spreadsheet

Use [work-orders.csv](./work-orders.csv) for assignment, filtering, and status
tracking.
`;
}

function chartSection(row, orders) {
  return `### ${row.chart_ref}

Pattern: \`${row.pattern}\`<br>
Phases: \`${row.hook_phases || "-"}\`<br>
Dependency source: \`${row.dependency_source || "-"}\`<br>
Candidate route: \`${row.candidate_route || "-"}\`

| Order | Work type | Reviewer | Done when |
| ---: | --- | --- | --- |
${orders.map((order) => `| ${order.order} | ${order.work_type} | ${order.reviewer} | ${escapePipes(order.done_when)} |`).join("\n")}`;
}

function workOrdersToCsv(rows) {
  const headers = [
    "chart",
    "version",
    "chart_ref",
    "order",
    "work_type",
    "reviewer",
    "pattern",
    "candidate_route",
    "reason",
    "done_when",
    "evidence",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function candidateYamlPath(row) {
  return `data/hook-route-candidates/${row.chart.replace(/[^a-z0-9]+/gi, "-")}.yaml`;
}

function isVendored(row) {
  return /vendored|also vendored/i.test(`${row.dependency_source} ${row.pattern}`);
}

function hasTargetDependency(row) {
  const value = String(row.target_dependencies ?? "").trim();
  return Boolean(value) && !/^none\b/i.test(value);
}

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(path, "utf8"));
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function parseCsvLine(line) {
  const result = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === "\"" && line[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      result.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  result.push(cell);
  return result;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function csvEscape(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll("\"", "\"\"")}"`;
  return text;
}
