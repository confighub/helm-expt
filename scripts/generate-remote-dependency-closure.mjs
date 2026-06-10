#!/usr/bin/env node

// Remote dependency closure report.
//
// This joins public top-100 source-scan dependency risk to maintained recipe
// dependency-lock.yaml files. It is an evidence map, not a dependency resolver:
// it records what the repository already knows and what action comes next.
//
//   node scripts/generate-remote-dependency-closure.mjs --generate
//   node scripts/generate-remote-dependency-closure.mjs --verify
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, listFiles, readYaml, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outputRoot = join(repoRoot, "data", "remote-dependency-closure");
const outputs = {
  csv: join(outputRoot, "top100.csv"),
  summary: join(outputRoot, "summary.md"),
};

if (mode === "--generate") {
  const report = buildReport();
  write(outputs.csv, report.csv);
  write(outputs.summary, report.summary);
  console.log(`wrote ${relativeRepo(outputs.csv)}`);
  console.log(`wrote ${relativeRepo(outputs.summary)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(outputs.csv), `${relativeRepo(outputs.csv)} is missing; run npm run remote-deps:closure`);
  check(existsSync(outputs.summary), `${relativeRepo(outputs.summary)} is missing; run npm run remote-deps:closure`);
  check(readFileSync(outputs.csv, "utf8") === report.csv, `${relativeRepo(outputs.csv)} is stale; run npm run remote-deps:closure`);
  check(readFileSync(outputs.summary, "utf8") === report.summary, `${relativeRepo(outputs.summary)} is stale; run npm run remote-deps:closure`);
  console.log(`verified remote dependency closure for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-remote-dependency-closure.mjs --generate
  node scripts/generate-remote-dependency-closure.mjs --verify`);
}

function buildReport() {
  const sourceRows = JSON.parse(readFileSync(join(repoRoot, "data/top500-catalog-analysis/source/source-feature-scan.raw.json"), "utf8"))
    .filter((row) => row.scanStatus === "scanned" && number(row.rank) <= 100)
    .filter((row) => number(row.remoteDependencyRepos) > 0 || number(row.nonExactDependencyConstraints) > 0 || row.vendoredSubcharts === true)
    .sort((a, b) => number(a.rank) - number(b.rank));
  const modeledRows = parseCsvFile("data/top100-catalog-analysis/review.csv");
  const quirkQueueRows = parseCsvFile("data/quirk-work-queue/top100-queue.csv");
  const locksByChart = dependencyLocksByChart();
  const modeledByChart = modelIndex(modeledRows);
  const quirkByChart = new Map(quirkQueueRows.map((row) => [row.chart, row]));

  const rows = sourceRows.map((source) => {
    const match = modeledMatch(source, modeledByChart);
    const locks = locksByChart.get(source.chart) ?? (match.modeled ? locksByChart.get(match.modeled.chart) : undefined);
    return rowFor(source, match, locks, quirkByChart.get(source.chart));
  });
  const csv = toCsv(rows);
  const summary = toSummary(rows);
  return { rows, csv, summary };
}

function rowFor(source, match, locks, quirk) {
  const modeled = match.modeled;
  const lock = chooseLock(source, modeled, locks ?? []);
  const deps = lock?.dependencies ?? [];
  const remoteRepos = unique(deps.map((dep) => dep.repository).filter((repo) => repo && repo !== "-"));
  const libraryDeps = deps.filter((dep) => dep.type === "library");
  const sourceVersion = String(source.version ?? "");
  const modeledVersion = modeled?.version ?? "";
  const closureStatus = statusFor({ source, modeled, lock, sourceVersion, modeledVersion });
  const topQuirk = quirk?.top_quirk ?? "";
  const workstream = workstreamFor({ source, lock, closureStatus, topQuirk });
  return {
    priority: priorityFor(source, closureStatus, quirk),
    workstream,
    done_when: doneWhenFor(workstream),
    source_rank: String(source.rank),
    chart: source.chart,
    source_version: sourceVersion,
    modeled_chart_ref: modeled?.chart ?? "",
    join_status: match.status,
    modeled_version: modeledVersion,
    catalog_status: modeled?.catalog_status ?? "not-in-modeled-top100",
    proof_surface: modeled?.proof_surface ?? "",
    source_remote_repo_count: String(number(source.remoteDependencyRepos)),
    source_non_exact_constraints: String(number(source.nonExactDependencyConstraints)),
    source_dependency_lock_present: String(Boolean(source.dependencyLockPresent)),
    source_vendored_subcharts: String(Boolean(source.vendoredSubcharts)),
    top_quirk: topQuirk,
    lock_status: closureStatus,
    lock_path: lock?.path ?? "",
    lock_chart_version: lock?.version ?? "",
    lock_dependency_count: String(deps.length),
    lock_remote_repo_count: String(remoteRepos.length),
    lock_library_dependency_count: String(libraryDeps.length),
    lock_has_chart_lock_digest: String(Boolean(lock?.chartLockDigest)),
    dependency_names: deps.map((dep) => dep.name).filter(Boolean).join(";"),
    dependency_repositories: remoteRepos.join(";"),
    next_action: nextActionFor({ workstream }),
  };
}

function modelIndex(rows) {
  const exact = new Map(rows.map((row) => [row.chart, row]));
  const byNameVersion = new Map();
  for (const row of rows) {
    const key = `${chartName(row.chart)}@${row.version}`;
    if (!byNameVersion.has(key)) byNameVersion.set(key, []);
    byNameVersion.get(key).push(row);
  }
  return { exact, byNameVersion };
}

function modeledMatch(source, index) {
  const exact = index.exact.get(source.chart);
  if (exact) return { modeled: exact, status: "exact-chart-ref" };
  const candidates = index.byNameVersion.get(`${chartName(source.chart)}@${source.version}`) ?? [];
  if (candidates.length === 1) return { modeled: candidates[0], status: "chart-name-version-alias" };
  if (candidates.length > 1) return { modeled: null, status: "ambiguous-chart-name-version-alias" };
  return { modeled: null, status: "source-only" };
}

function chartName(chart) {
  return String(chart ?? "").split("/").pop() ?? "";
}

function chooseLock(source, modeled, locks) {
  if (locks.length === 0) return null;
  const sourceVersion = String(source.version ?? "");
  const modeledVersion = modeled?.version ?? "";
  return locks.find((lock) => lock.version === sourceVersion)
    ?? locks.find((lock) => lock.version === modeledVersion)
    ?? locks[0];
}

function statusFor({ source, modeled, lock, sourceVersion, modeledVersion }) {
  if (!modeled) return "source-only-no-maintained-recipe";
  if (!lock) return "modeled-without-dependency-lock";
  if (lock.version === sourceVersion) return "source-version-lock-present";
  if (lock.version === modeledVersion) return "modeled-version-lock-present";
  return "different-version-lock-present";
}

function workstreamFor({ source, lock, closureStatus, topQuirk }) {
  if (closureStatus === "source-only-no-maintained-recipe") return "create-recipe-import-candidate";
  if (closureStatus === "modeled-without-dependency-lock") return "add-dependency-lock";
  if (number(source.nonExactDependencyConstraints) > 0) return "dependency-range-policy";
  if (!lock?.chartLockDigest && lock?.dependencies?.length > 0) return "chart-lock-digest";
  if (topQuirk === "remote-dependencies") return "promote-closure-facts";
  return "keep-current";
}

function nextActionFor({ workstream }) {
  return {
    "create-recipe-import-candidate": "create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer",
    "add-dependency-lock": "add dependency-lock.yaml or mark the dependency closure explicitly empty",
    "dependency-range-policy": "record dependency range policy and refresh-survival check for non-exact dependency constraints",
    "chart-lock-digest": "record Chart.lock digest or explain why the dependency lock is source-derived rather than Chart.lock-derived",
    "promote-closure-facts": "promote dependency closure facts into chart facts and keep refresh-survival evidence current",
    "keep-current": "keep dependency lock evidence current with the supported recipe version",
  }[workstream] ?? "review dependency closure row";
}

function doneWhenFor(workstream) {
  return {
    "create-recipe-import-candidate": "recipe candidate exists with source lock, dependency lock, first base variant, render parity, and an explicit catalog decision",
    "add-dependency-lock": "dependency-lock.yaml exists or the recipe records that the dependency closure is intentionally empty",
    "dependency-range-policy": "non-exact dependency constraints have a recorded policy plus refresh-survival evidence for the supported version",
    "chart-lock-digest": "dependency lock records a Chart.lock digest or explains the source of the locked dependency list",
    "promote-closure-facts": "chart facts and status surfaces expose dependency closure, remote repositories, and refresh-survival expectation",
    "keep-current": "dependency evidence is still current for the supported recipe version",
  }[workstream] ?? "row has an explicit closure decision";
}

function priorityFor(source, closureStatus, quirk) {
  if (closureStatus === "source-only-no-maintained-recipe") return number(source.rank) <= 50 ? "P0" : "P1";
  if (closureStatus === "modeled-without-dependency-lock") return "P0";
  if (quirk?.priority === "P0") return "P0";
  if (number(source.nonExactDependencyConstraints) > 0) return "P1";
  return "P2";
}

function dependencyLocksByChart() {
  const result = new Map();
  const paths = listFiles(join(repoRoot, "recipes")).filter((path) => path.endsWith("/dependency-lock.yaml"));
  for (const path of paths) {
    const doc = readYaml(path);
    const spec = doc.spec ?? {};
    const chart = String(spec.chart ?? "");
    if (!chart) continue;
    const dependencies = Array.isArray(spec.dependencies) ? spec.dependencies.map((dep) => ({
      name: String(dep.name ?? ""),
      repository: String(dep.repository ?? ""),
      version: String(dep.version ?? ""),
      type: String(dep.type ?? ""),
    })) : [];
    const row = {
      path: relativeRepo(path),
      chart,
      version: String(spec.version ?? ""),
      dependencies,
      chartLockDigest: String(spec.chartLockDigest ?? ""),
    };
    if (!result.has(chart)) result.set(chart, []);
    result.get(chart).push(row);
  }
  for (const locks of result.values()) locks.sort((a, b) => a.version.localeCompare(b.version));
  return result;
}

function toSummary(rows) {
  const statusCounts = countBy(rows, "lock_status");
  const priorityCounts = countBy(rows, "priority");
  const withLocks = rows.filter((row) => row.lock_path).length;
  const sourceOnly = rows.filter((row) => row.lock_status === "source-only-no-maintained-recipe").length;
  const noChartLockDigest = rows.filter((row) => row.lock_path && row.lock_dependency_count !== "0" && row.lock_has_chart_lock_digest !== "true").length;
  const p0Rows = rows.filter((row) => row.priority === "P0").slice(0, 20);
  const workstreamCounts = countBy(rows, "workstream");
  const workstreamTable = workstreamRows(workstreamCounts)
    .map(([workstream, count]) => `| \`${workstream}\` | ${count} | ${escapePipes(nextActionFor({ workstream }))} | ${escapePipes(doneWhenFor(workstream))} |`)
    .join("\n");
  const statusTable = [...statusCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([status, count]) => `| \`${status}\` | ${count} | ${statusMeaning(status)} |`)
    .join("\n");
  const topTable = p0Rows.map((row) => `| ${row.source_rank} | \`${row.chart}@${row.source_version}\` | \`${row.lock_status}\` | ${row.lock_dependency_count} | ${escapePipes(row.next_action)} |`).join("\n");
  const repositoryCounts = countRepositories(rows);
  const repoTable = repositoryCounts.slice(0, 12).map(([repo, count]) => `| \`${repo}\` | ${count} |`).join("\n");
  return `# Remote Dependency Closure

This generated report joins public top-100 source-scan dependency risk to the
dependency locks in maintained recipe artifacts.

It answers:

~~~text
Which popular charts depend on remote or vendored subcharts, and what exact
dependency closure evidence do we already have?
~~~

This is not a live dependency resolver and not a support claim. It uses the
committed source scan, maintained recipe metadata, and dependency-lock.yaml
files.

## Current Reading

~~~text
source top-100 rows with remote, vendored, or non-exact dependencies: ${rows.length}
rows with a maintained dependency lock:                         ${withLocks}/${rows.length}
source-only rows without a maintained recipe:                   ${sourceOnly}/${rows.length}
locked rows with dependencies but no Chart.lock digest:          ${noChartLockDigest}/${rows.length}
P0:                                                             ${priorityCounts.get("P0") ?? 0}
P1:                                                             ${priorityCounts.get("P1") ?? 0}
P2:                                                             ${priorityCounts.get("P2") ?? 0}
~~~

## Closure Status

| Status | Rows | Meaning |
| --- | ---: | --- |
${statusTable}

## Workstreams

| Workstream | Rows | First action | Done when |
| --- | ---: | --- | --- |
${workstreamTable}

## Highest Priority Rows

| Source rank | Chart | Lock status | Locked dependencies | Next action |
| ---: | --- | --- | ---: | --- |
${topTable}

## Most Common Locked Repositories

| Repository | Locked rows |
| --- | ---: |
${repoTable}

## How To Use This

- If the row has \`source-version-lock-present\`, the maintained recipe has a
  dependency lock for the same chart version seen in the source scan.
- If the row has \`modeled-version-lock-present\`, the maintained recipe has a
  lock for the catalog version, but the source scan and model version differ.
  Use refresh-survival evidence before replacing or promoting the chart.
- If \`join_status\` is \`chart-name-version-alias\`, the source repository and
  maintained recipe repository differ, but the chart name and version match.
  Keep that alias visible when presenting catalog coverage.
- If the row is \`source-only-no-maintained-recipe\`, create a recipe/import
  candidate before making catalog claims.
- If dependencies are locked but no \`chartLockDigest\` is present, decide
  whether to backfill a Chart.lock digest or explicitly document the source of
  the dependency list.

## Files

| File | Purpose |
| --- | --- |
| \`top100.csv\` | One row per top-100 source chart with remote, vendored, or non-exact dependency risk. |
| \`recipes/*/*/*/dependency-lock.yaml\` | Maintained recipe dependency locks joined into this report. |
| \`data/quirk-work-queue/top100-queue.csv\` | Source quirk priority used to rank dependency work. |
| \`data/top500-catalog-analysis/source/source-feature-scan.raw.json\` | Source-scan input. |

Regenerate:

~~~sh
npm run remote-deps:closure
npm run remote-deps:closure:verify
~~~
`;
}

function statusMeaning(status) {
  return {
    "source-version-lock-present": "A maintained dependency lock matches the source-scan chart version.",
    "modeled-version-lock-present": "A maintained dependency lock exists for the modeled/catalog version; source scan and model may differ.",
    "different-version-lock-present": "A dependency lock exists, but not for the source or modeled version selected here.",
    "modeled-without-dependency-lock": "The chart is modeled but no dependency lock was found.",
    "source-only-no-maintained-recipe": "The source chart is not currently represented by a maintained recipe row.",
  }[status] ?? "Unknown status.";
}

function workstreamRows(counts) {
  const order = [
    "create-recipe-import-candidate",
    "add-dependency-lock",
    "dependency-range-policy",
    "chart-lock-digest",
    "promote-closure-facts",
    "keep-current",
  ];
  return [...counts.entries()].sort((left, right) => {
    const leftRank = order.includes(left[0]) ? order.indexOf(left[0]) : order.length;
    const rightRank = order.includes(right[0]) ? order.indexOf(right[0]) : order.length;
    return leftRank - rightRank || left[0].localeCompare(right[0]);
  });
}

function countRepositories(rows) {
  const counts = new Map();
  for (const row of rows) {
    for (const repo of row.dependency_repositories.split(";").filter(Boolean)) {
      counts.set(repo, (counts.get(repo) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function parseCsvFile(path) {
  const text = readFileSync(join(repoRoot, path), "utf8").trim();
  if (!text) return [];
  const rows = parseCsv(text);
  const headers = rows[0];
  return rows.slice(1).map((cols) => Object.fromEntries(headers.map((header, index) => [header, cols[index] ?? ""])));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        cell += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === "\"") {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);
  return rows;
}

function toCsv(rows) {
  const headers = [
    "priority",
    "workstream",
    "done_when",
    "source_rank",
    "chart",
    "source_version",
    "modeled_chart_ref",
    "join_status",
    "modeled_version",
    "catalog_status",
    "proof_surface",
    "source_remote_repo_count",
    "source_non_exact_constraints",
    "source_dependency_lock_present",
    "source_vendored_subcharts",
    "top_quirk",
    "lock_status",
    "lock_path",
    "lock_chart_version",
    "lock_dependency_count",
    "lock_remote_repo_count",
    "lock_library_dependency_count",
    "lock_has_chart_lock_digest",
    "dependency_names",
    "dependency_repositories",
    "next_action",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n")}\n`;
}

function countBy(rows, field) {
  const result = new Map();
  for (const row of rows) result.set(row[field], (result.get(row[field]) ?? 0) + 1);
  return result;
}

function unique(values) {
  return [...new Set(values)];
}

function number(value) {
  const parsed = Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapePipes(value) {
  return String(value ?? "").replaceAll("|", "\\|");
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
