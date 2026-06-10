#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { check, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const outDir = join(repoRoot, "data", "refresh-survival");
const summaryPath = join(outDir, "summary.md");
const csvPath = join(outDir, "refreshes.csv");
const kpsSeedPath = join(outDir, "kube-prometheus-stack-upgrade-seed.md");

const latestReviewPath = join(repoRoot, "data", "latest-top20-refresh", "review.csv");
const candidateStatusPath = join(repoRoot, "data", "latest-top20-refresh", "candidates", "candidate-status.csv");
const promotionReadinessPath = join(repoRoot, "data", "latest-top20-refresh", "promotion-readiness.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(csvPath, report.csv);
  write(summaryPath, report.summary);
  write(kpsSeedPath, report.kpsSeed);
  console.log("wrote refresh survival report");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(csvPath), "data/refresh-survival/refreshes.csv is missing; run npm run refresh:survival");
  check(existsSync(summaryPath), "data/refresh-survival/summary.md is missing; run npm run refresh:survival");
  check(existsSync(kpsSeedPath), "data/refresh-survival/kube-prometheus-stack-upgrade-seed.md is missing; run npm run refresh:survival");
  check(readFileSync(csvPath, "utf8") === report.csv, "data/refresh-survival/refreshes.csv is stale; run npm run refresh:survival");
  check(readFileSync(summaryPath, "utf8") === report.summary, "data/refresh-survival/summary.md is stale; run npm run refresh:survival");
  check(readFileSync(kpsSeedPath, "utf8") === report.kpsSeed, "data/refresh-survival/kube-prometheus-stack-upgrade-seed.md is stale; run npm run refresh:survival");
  console.log(`verified refresh survival report: ${report.rows.length} checked, ${report.updateCandidates.length} update candidate(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-refresh-survival.mjs --generate
  node scripts/generate-refresh-survival.mjs --verify`);
}

function buildReport() {
  const latestRows = parseCsv(readFileSync(latestReviewPath, "utf8"));
  const candidateRows = parseCsv(readFileSync(candidateStatusPath, "utf8"));
  const readinessRows = parseCsv(readFileSync(promotionReadinessPath, "utf8"));

  const candidateByChart = new Map(candidateRows.map((row) => [row.chart, row]));
  const readinessByChart = new Map(readinessRows.map((row) => [row.chart, row]));

  const rows = latestRows.map((row) => {
    const candidate = candidateByChart.get(row.chart);
    const readiness = readinessByChart.get(row.chart);
    const refreshState = row.status === "current" ? "current-proof-still-current" : "upstream-update-candidate";
    const candidateProof = candidate ? "candidate-render-proof-present" : row.status === "current" ? "not-needed" : "missing";
    const catalogState = readiness?.catalog_promotion ?? "current-catalog-path";
    const promotionState = readiness?.promotion_readiness ?? (row.status === "current" ? "current-supported-version" : "missing");
    const liveState = candidate ? "not-yet-live-promoted" : row.status === "current" ? "current-supported-version" : "missing";
    const route =
      row.status === "current"
        ? "keep current catalog proof; refresh on next upstream movement"
        : "run ConfigHub proof, live e2e, production disposition, catalog, top100, and top500 lanes before replacement";
    return {
      chart: row.chart,
      current_version: row.current_version,
      latest_version: row.latest_version,
      refresh_state: refreshState,
      candidate_proof: candidateProof,
      candidate_variants: candidate?.variants ?? "",
      candidate_object_counts: candidate?.object_counts ?? "",
      catalog_state: catalogState,
      promotion_state: promotionState,
      live_promotion_state: liveState,
      source_review: "data/latest-top20-refresh/review.csv",
      candidate_evidence: candidate?.recipe_path ?? "",
      next_action: route,
    };
  });

  const updateCandidates = rows.filter((row) => row.refresh_state === "upstream-update-candidate");
  const currentRows = rows.filter((row) => row.refresh_state === "current-proof-still-current");
  const candidateProofs = updateCandidates.filter((row) => row.candidate_proof === "candidate-render-proof-present");
  const notPromoted = updateCandidates.filter((row) => row.catalog_state === "not-promoted");
  const kps = rows.find((row) => row.chart === "prometheus-community/kube-prometheus-stack");
  check(kps, "missing kube-prometheus-stack row in latest refresh");

  return {
    rows,
    updateCandidates,
    csv: csv(rows),
    summary: summary({ rows, currentRows, updateCandidates, candidateProofs, notPromoted }),
    kpsSeed: kpsUpgradeSeed(kps),
  };
}

function summary({ rows, currentRows, updateCandidates, candidateProofs, notPromoted }) {
  return `# Refresh Survival

This generated report shows whether the catalog survives upstream Helm chart
movement without silently changing what users install.

It is not a live upgrade proof. It is the refresh control surface that says
which chart versions remain current, which upstream charts moved, and which
candidate versions have only passed the recipe/package/render/compare lane so
far.

## Result

\`\`\`text
Top-20 rows checked: ${rows.length}
Current chart proofs: ${currentRows.length} / ${rows.length}
Upstream update candidates: ${updateCandidates.length} / ${rows.length}
Candidates with render proof: ${candidateProofs.length} / ${updateCandidates.length}
Candidates not yet promoted: ${notPromoted.length} / ${updateCandidates.length}
\`\`\`

## Update Candidates

| Chart | Current proof | Latest candidate | Candidate proof | Promotion state | Next action |
| --- | --- | --- | --- | --- | --- |
${updateCandidates
  .map(
    (row) =>
      `| \`${row.chart}\` | \`${row.current_version}\` | \`${row.latest_version}\` | ${row.candidate_proof} | ${row.promotion_state} | ${row.next_action} |`,
  )
  .join("\n")}

## What This Proves

- Supported catalog rows do not roll forward just because upstream Helm changed.
- New upstream versions can be tested as candidate artifacts while the previous
  supported version remains pinned.
- Candidate render proof is only the first lane. Support still needs ConfigHub
  proof, live e2e, production disposition, catalog regeneration, and top100/top500
  regeneration.

## What This Does Not Prove

- It does not prove a live upgrade from the old version to the new version.
- It does not prove the candidate should replace the supported version.
- It does not prove production support for any target profile.

## Files

| File | Role |
| --- | --- |
| [refreshes.csv](./refreshes.csv) | One row per top-20 chart in the latest refresh review. |
| [kube-prometheus-stack-upgrade-seed.md](./kube-prometheus-stack-upgrade-seed.md) | Narrow upgrade-story seed for the serious Helm chart in the current update wave. |
| [../latest-top20-refresh/summary.md](../latest-top20-refresh/summary.md) | Latest top-20 refresh snapshot. |
| [../latest-top20-refresh/promotion-readiness.md](../latest-top20-refresh/promotion-readiness.md) | Candidate promotion readiness. |

## Verify

\`\`\`sh
npm run refresh:survival:verify
\`\`\`
`;
}

function kpsUpgradeSeed(row) {
  const currentDefault = objectCount("recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/object-inventory.yaml");
  const currentNoCrds = objectCount("recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/rendered/object-inventory.yaml");
  const candidateDefault = objectCount("data/latest-top20-refresh/candidates/kube-prometheus-stack-86.1.0/recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/default/r001/rendered/object-inventory.yaml");
  const candidateNoCrds = objectCount("data/latest-top20-refresh/candidates/kube-prometheus-stack-86.1.0/recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/no-crds/r001/rendered/object-inventory.yaml");

  return `# kube-prometheus-stack Upgrade Seed

This is the narrow seed for the upgrade-story lane. It uses
\`prometheus-community/kube-prometheus-stack\` because this chart exercises the
hard parts of Helm support: CRDs, admission webhooks, generated credentials,
dependencies, cluster RBAC, and many rendered monitoring resources.

## Scope

| Item | Value |
| --- | --- |
| Chart | \`${row.chart}\` |
| Current supported proof | \`${row.current_version}\` |
| Latest candidate | \`${row.latest_version}\` |
| Variants | \`${row.candidate_variants}\` |
| Kubernetes profile | kind Kubernetes 1.30 for current live receipts; candidate live upgrade not run yet |

## Render Seed

| Variant | Current object count | Candidate object count | Current evidence | Candidate evidence |
| --- | ---: | ---: | --- | --- |
| \`default\` | ${currentDefault} | ${candidateDefault} | \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/object-inventory.yaml\` | \`data/latest-top20-refresh/candidates/kube-prometheus-stack-86.1.0/recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/default/r001/rendered/object-inventory.yaml\` |
| \`no-crds\` | ${currentNoCrds} | ${candidateNoCrds} | \`recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/rendered/object-inventory.yaml\` | \`data/latest-top20-refresh/candidates/kube-prometheus-stack-86.1.0/recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/no-crds/r001/rendered/object-inventory.yaml\` |

The candidate has render proof only. It is not a supported catalog replacement.

## Required Upgrade Proof

Before replacing the supported catalog version, the upgrade lane must produce:

1. old rendered object set versus new rendered object set;
2. field-level diff with provenance where available;
3. CRD lifecycle review for install and upgrade ordering;
4. webhook and generated-credential route review;
5. scan and gate receipts for the new rendered revision;
6. ConfigHub upload, function scan, safe-ops, and server-side variant receipts;
7. live kind observation before and after upgrade;
8. live Helm-vs-ConfigHub parity for the upgraded target profile;
9. updated catalog, production disposition, top100, and top500 outputs.

## Current Decision

Keep \`${row.current_version}\` as the supported catalog version. Treat
\`${row.latest_version}\` as a candidate until the lanes above pass or are
explicitly routed.

## Verify

\`\`\`sh
npm run refresh:survival:verify
\`\`\`
`;
}

function objectCount(relativePath) {
  const path = join(repoRoot, relativePath);
  check(existsSync(path), `${relativePath} is missing`);
  const match = readFileSync(path, "utf8").match(/objectCount:\s*"?(\d+)"?/);
  check(match, `${relativePath} has no objectCount`);
  return Number(match[1]);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines.shift() ?? "");
  return lines.filter(Boolean).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function csv(rows) {
  const headers = [
    "chart",
    "current_version",
    "latest_version",
    "refresh_state",
    "candidate_proof",
    "candidate_variants",
    "candidate_object_counts",
    "catalog_state",
    "promotion_state",
    "live_promotion_state",
    "source_review",
    "candidate_evidence",
    "next_action",
  ];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  if (!/[",\n;]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}
