#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "hard-proof-gaps");
const summaryPath = join(outDir, "summary.md");
const csvPath = join(outDir, "shortlist.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(summaryPath, report.summary);
  write(csvPath, report.csv);
  console.log(`wrote ${relativeRepo(summaryPath)}`);
  console.log(`wrote ${relativeRepo(csvPath)}`);
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(summaryPath), "missing hard proof gaps summary; run npm run top100:hard-gaps");
  check(existsSync(csvPath), "missing hard proof gaps CSV; run npm run top100:hard-gaps");
  check(readFileSync(summaryPath, "utf8") === report.summary, "hard proof gaps summary is stale");
  check(readFileSync(csvPath, "utf8") === report.csv, "hard proof gaps CSV is stale");
  console.log(`verified hard proof gaps shortlist for ${report.rows.length} chart(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-hard-proof-gaps.mjs --generate
  node scripts/generate-hard-proof-gaps.mjs --verify`);
}

function buildReport() {
  const quirkRows = parseCsvFile("data/quirk-work-queue/top100-queue.csv");
  const remoteRows = parseCsvFile("data/remote-dependency-closure/top100.csv");
  const hookRows = parseCsvFile("data/hook-route-candidates/candidates.csv");
  const coverageRows = parseCsvFile("data/top100-coverage/work-queue.csv");

  const remoteByRef = new Map(remoteRows.map((row) => [chartRef(row.chart, row.source_version), row]));
  const hookByRef = new Map(hookRows.map((row) => [chartRef(row.chart, row.version), row]));
  const coverageByRef = new Map(coverageRows.map((row) => [row.chart_ref, row]));

  const rows = quirkRows
    .filter((row) => row.priority === "P0")
    .map((row) => shortlistRow(row, remoteByRef, hookByRef, coverageByRef))
    .filter(Boolean)
    .sort((left, right) => Number(right.score) - Number(left.score) || Number(left.source_rank) - Number(right.source_rank))
    .slice(0, 25)
    .map((row, index) => ({ ...row, shortlist_rank: index + 1 }));

  check(rows.length > 0, "expected at least one hard proof gap row");
  check(rows.some((row) => row.primary_gap === "apiservice"), "expected APIService gap to remain visible");
  check(rows.some((row) => row.remote_dependency_workstream), "expected remote dependency gap to remain visible");
  check(rows.some((row) => row.hook_route_candidate), "expected hook route candidates to remain visible");

  return {
    rows,
    csv: rowsToCsv(rows),
    summary: summary(rows),
  };
}

function shortlistRow(row, remoteByRef, hookByRef, coverageByRef) {
  const ref = chartRef(row.chart, row.source_version);
  const remote = remoteByRef.get(ref);
  const hook = hookByRef.get(ref);
  const coverage = coverageByRef.get(ref);
  const openQuirks = splitList(row.open_quirks);
  const unresolved = unresolvedQuirks(openQuirks, remote, hook);
  if (unresolved.length === 0) return null;
  const activeRemoteWorkstream = remote?.workstream && remote.workstream !== "keep-current" ? remote.workstream : "";
  const sourcePrimaryGap = primaryGapFor(unresolved);
  const primaryGap = activeRemoteWorkstream && ["remote-dependencies", "non-exact-dependencies"].includes(sourcePrimaryGap)
    ? activeRemoteWorkstream
    : sourcePrimaryGap;
  const score = unresolved.reduce((sum, item) => sum + gapWeight(item), 0)
    + leverageScore(row.source_rank)
    + (remote?.priority === "P0" && activeRemoteWorkstream ? 8 : 0)
    + (hook ? 8 : 0)
    + (row.catalog_status === "catalog-supported" ? 8 : 0)
    + (unresolved.includes("apiservice") ? 6 : 0)
    + (unresolved.includes("webhooks") ? 4 : 0)
    + (unresolved.includes("crds") ? 4 : 0);
  const remoteAction = remote?.next_action ?? "";
  const hookAction = hook?.promotion_next_step ?? "";
  const primary = gapInfo(primaryGap);
  const firstAction = [
    activeRemoteWorkstream && remoteAction && remoteAction !== primary.first_action ? remoteAction : "",
    primary.first_action,
    hook ? hookAction : "",
  ].filter(Boolean)[0] ?? "";
  const requiredArtifact = [
    activeRemoteWorkstream && remote?.done_when ? "data/remote-dependency-closure/top100.csv" : "",
    primary.next_artifact,
    hook ? "data/hook-route-candidates/candidates.csv" : "",
  ].filter(Boolean)[0] ?? "";
  return {
    shortlist_rank: "",
    score,
    source_rank: row.source_rank,
    chart: row.chart,
    version: row.source_version,
    chart_ref: ref,
    catalog_status: row.catalog_status,
    proof_surface: row.proof_surface,
    top100_queue: coverage?.queue ?? "",
    primary_gap: primaryGap,
    open_quirks: row.open_quirks,
    unresolved_quirks: unresolved.join(";"),
    remote_dependency_workstream: activeRemoteWorkstream,
    hook_route_candidate: hook?.candidate_route ?? "",
    first_action: firstAction,
    required_artifact: requiredArtifact,
    why_it_matters: primary.why_it_matters,
    model_gap: row.model_gap,
    source_evidence: row.source_evidence,
    not_a_claim: "shortlist row only; not a support decision or proof that the chart is unsupported",
  };
}

function summary(rows) {
  const byGap = groupCount(rows, "primary_gap");
  const catalogRows = rows.filter((row) => row.catalog_status === "catalog-supported");
  const hookRows = rows.filter((row) => row.hook_route_candidate);
  const remoteRows = rows.filter((row) => row.remote_dependency_workstream);
  return `# Hard Proof Gaps Shortlist

This generated shortlist joins the P0 source-quirk queue with remote dependency
closure and hook route candidate data. It is the short assignment surface for
the top-100 rows most likely to damage trust if the project overclaims them.

It does not say these charts are unsupported. It says the named gap must be
modeled, routed, observed, or explicitly refused before stronger catalog or
production claims are made.

## Summary

~~~text
shortlist rows: ${rows.length}
catalog-supported rows on shortlist: ${catalogRows.length}
rows with remote dependency work: ${remoteRows.length}
rows with hook route candidates: ${hookRows.length}
~~~

## Main Gap Types

| Gap | Rows |
| --- | ---: |
${[...byGap.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([gap, count]) => `| ${gap} | ${count} |`).join("\n")}

## First Rows

| Rank | Chart | Main gap | Why it matters | First action |
| ---: | --- | --- | --- | --- |
${rows.slice(0, 12).map((row) => `| ${row.shortlist_rank} | \`${row.chart_ref}\` | ${row.primary_gap} | ${escapePipes(row.why_it_matters)} | ${escapePipes(row.first_action)} |`).join("\n")}

## Catalog Rows On The Shortlist

These rows are visible because they are already public catalog entries or have
strong proof surfaces. They should be kept honest first.

| Chart | Main gap | Next artifact |
| --- | --- | --- |
${catalogRows.map((row) => `| \`${row.chart_ref}\` | ${row.primary_gap} | ${row.required_artifact || "-"} |`).join("\n") || "| none | - | - |"}

## How To Use This

1. Pick a row from the top of the table.
2. Open the source evidence and required artifact.
3. Decide whether the gap becomes a modeled fact, a route receipt, a runtime
   observation, a better base variant, or an explicit blocker.
4. Regenerate the owning queue before changing any support or catalog claim.

## Source Tables

| Source | Use |
| --- | --- |
| [quirk-work-queue/top100-queue.csv](../quirk-work-queue/top100-queue.csv) | P0 source-quirk queue and first action. |
| [remote-dependency-closure/top100.csv](../remote-dependency-closure/top100.csv) | Dependency closure and refresh-survival workstreams. |
| [hook-route-candidates/candidates.csv](../hook-route-candidates/candidates.csv) | Candidate routes for hook-bearing source charts not yet in the maintained queue. |
| [top100-coverage/work-queue.csv](../top100-coverage/work-queue.csv) | Current top-100 promotion, variant, and limitation queues. |
`;
}

function rowsToCsv(rows) {
  const headers = [
    "shortlist_rank",
    "score",
    "source_rank",
    "chart",
    "version",
    "chart_ref",
    "catalog_status",
    "proof_surface",
    "top100_queue",
    "primary_gap",
    "open_quirks",
    "unresolved_quirks",
    "remote_dependency_workstream",
    "hook_route_candidate",
    "first_action",
    "required_artifact",
    "why_it_matters",
    "model_gap",
    "source_evidence",
    "not_a_claim",
  ];
  return `${[headers.join(","), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(","))].join("\n")}\n`;
}

function unresolvedQuirks(openQuirks, remote, hook) {
  return openQuirks.filter((quirk) => {
    if (["remote-dependencies", "non-exact-dependencies"].includes(quirk) && remote?.workstream === "keep-current") return false;
    if (["hooks", "hook-delete-policy", "hook-weight-ordering"].includes(quirk) && !hook) return false;
    return true;
  });
}

function primaryGapFor(quirks) {
  const order = [
    "apiservice",
    "remote-dependencies",
    "non-exact-dependencies",
    "hooks",
    "hook-delete-policy",
    "hook-weight-ordering",
    "semver-compare",
    "files-get",
    "generated-facts",
    "lookup",
    "capabilities",
    "webhooks",
    "crds",
    "stateful-storage",
    "required-or-fail",
  ];
  return quirks.slice().sort((left, right) => {
    const leftRank = order.includes(left) ? order.indexOf(left) : order.length;
    const rightRank = order.includes(right) ? order.indexOf(right) : order.length;
    return leftRank - rightRank || left.localeCompare(right);
  })[0];
}

function gapWeight(gap) {
  return {
    "create-recipe-import-candidate": 7,
    "chart-lock-digest": 6,
    "dependency-range-policy": 6,
    "add-dependency-lock": 6,
    "apiservice": 7,
    "remote-dependencies": 6,
    "non-exact-dependencies": 6,
    "hooks": 6,
    "hook-delete-policy": 5,
    "hook-weight-ordering": 5,
    "semver-compare": 5,
    "files-get": 5,
    "generated-facts": 4,
    "lookup": 4,
    "capabilities": 4,
    "webhooks": 4,
    "crds": 4,
    "stateful-storage": 3,
    "required-or-fail": 3,
  }[gap] ?? 2;
}

function gapInfo(gap) {
  const info = {
    "apiservice": {
      first_action: "add an APIService readiness model and runtime observation route",
      next_artifact: "chart facts axis plus lifecycle observation receipt",
      why_it_matters: "APIService aggregation can pass render parity while failing at API aggregation or TLS/runtime readiness.",
    },
    "create-recipe-import-candidate": {
      first_action: "create recipe/import candidate and write dependency-lock.yaml before treating the chart as a catalog offer",
      next_artifact: "recipe candidate with source lock, dependency lock, first base variant, render parity, and catalog decision",
      why_it_matters: "source-only charts have no maintained recipe path, so catalog claims would be disconnected from proof artifacts.",
    },
    "chart-lock-digest": {
      first_action: "record Chart.lock digest or source-derived dependency provenance",
      next_artifact: "dependency lock with Chart.lock digest or source-derived dependency provenance",
      why_it_matters: "a dependency list without a digest leaves provenance and refresh-survival weaker than the rendered proof suggests.",
    },
    "dependency-range-policy": {
      first_action: "record dependency range policy and refresh-survival check for non-exact dependency constraints",
      next_artifact: "dependency policy row plus refresh-survival receipt",
      why_it_matters: "non-exact dependency ranges can silently change the rendered dependency closure during refresh.",
    },
    "add-dependency-lock": {
      first_action: "add dependency-lock.yaml or mark the dependency closure explicitly empty",
      next_artifact: "dependency-lock.yaml or explicit empty-closure receipt",
      why_it_matters: "without a dependency lock, the recipe cannot prove which subcharts were part of the rendered object set.",
    },
    "remote-dependencies": {
      first_action: "model remote dependency closure in chart facts and source/dependency lock evidence",
      next_artifact: "dependency closure facts plus refresh-survival check",
      why_it_matters: "remote subcharts can change provenance, hooks, CRDs, RBAC, and rendered objects outside the parent chart.",
    },
    "non-exact-dependencies": {
      first_action: "pin or explicitly accept dependency ranges and add refresh-survival evidence",
      next_artifact: "dependency policy row plus refresh-survival receipt",
      why_it_matters: "non-exact dependency ranges can silently change the rendered dependency closure during refresh.",
    },
    "hooks": {
      first_action: "choose a lifecycle route and commit a route or observation receipt",
      next_artifact: "hook lifecycle route receipt",
      why_it_matters: "hooks are phaseful actions; render parity does not prove install, upgrade, delete, or test behavior.",
    },
    "hook-delete-policy": {
      first_action: "record cleanup/rerun policy alongside the hook route",
      next_artifact: "hook lifecycle route receipt with cleanup policy",
      why_it_matters: "delete policy affects reruns, cleanup, and rollback semantics.",
    },
    "hook-weight-ordering": {
      first_action: "record ordering semantics and candidate sync-wave or managed-action route",
      next_artifact: "hook lifecycle route receipt with ordering policy",
      why_it_matters: "hook weights encode ordering that may not map directly to ConfigHub or GitOps delivery.",
    },
    "semver-compare": {
      first_action: "promote version-conditional rendering into chart facts and variant-path coverage",
      next_artifact: "chart facts axis plus capability/version matrix row",
      why_it_matters: "version-conditional templates can change rendered objects under a different Kubernetes, chart, or dependency version.",
    },
    "files-get": {
      first_action: "add bundled-file inventory to the source lock and value/provenance map",
      next_artifact: "source-lock bundled file index",
      why_it_matters: "bundled files can drive rendered config while bypassing values and values schema.",
    },
    "generated-facts": {
      first_action: "classify generated values as generated facts, target facts, or existing-secret bases",
      next_artifact: "generated-facts policy plus field reachability row",
      why_it_matters: "random, time, certificate, and password functions can break deterministic review unless captured or replaced.",
    },
    "lookup": {
      first_action: "turn lookup dependencies into target facts or preflight checks",
      next_artifact: "target-fact requirement plus preflight receipt",
      why_it_matters: "lookup makes rendered output depend on live cluster state unless facts are captured explicitly.",
    },
    "capabilities": {
      first_action: "bind the render to named capability profiles and test the important alternate profile",
      next_artifact: "capability profile matrix row",
      why_it_matters: "capability branches can render different objects across Kubernetes versions and API availability.",
    },
    "webhooks": {
      first_action: "add webhook readiness and CA/admission observation where the chart is promoted",
      next_artifact: "webhook lifecycle observation receipt",
      why_it_matters: "webhooks can render correctly but fail admission, TLS, or readiness after apply.",
    },
    "crds": {
      first_action: "separate CRD install from CRD upgrade policy and record the supported route",
      next_artifact: "CRD lifecycle policy row",
      why_it_matters: "CRD install can be simple while CRD upgrade, conversion, and pruning remain operator-reviewed.",
    },
    "stateful-storage": {
      first_action: "record storage prerequisite, retention, and runtime binding checks for supported targets",
      next_artifact: "target-scoped storage support decision",
      why_it_matters: "stateful charts need target-specific storage proof beyond object render parity.",
    },
    "required-or-fail": {
      first_action: "promote required inputs into typed prompts, placeholders, or supported base choices",
      next_artifact: "input contract row",
      why_it_matters: "required()/fail() blocks mean the happy path depends on values that should be explicit to users and agents.",
    },
  };
  return info[gap] ?? {
    first_action: "classify this source signal before making stronger claims",
    next_artifact: "modeled chart fact or explicit blocker",
    why_it_matters: "unmodeled source signals can make the catalog look more complete than it is.",
  };
}

function leverageScore(rank) {
  const value = Number(rank);
  if (value <= 10) return 12;
  if (value <= 25) return 9;
  if (value <= 50) return 6;
  return 3;
}

function parseCsvFile(path) {
  return parseCsv(readFileSync(join(repoRoot, path), "utf8"));
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
  const cells = [];
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
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function chartRef(chart, version) {
  return `${chart}@${version}`;
}

function splitList(value) {
  return String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean);
}

function groupCount(rows, key) {
  const result = new Map();
  for (const row of rows) result.set(row[key], (result.get(row[key]) ?? 0) + 1);
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
