#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { check, listFiles, relativeRepo, repoRoot, write } from "./lib/proof-common.mjs";

const mode = process.argv[2] ?? "--generate";
const readmePath = join(repoRoot, "data", "README.md");
const csvIndexPath = join(repoRoot, "data", "csv-index.csv");

if (mode === "--generate") {
  const report = buildReport();
  write(readmePath, report.readme);
  write(csvIndexPath, report.csv);
  console.log("wrote data index");
} else if (mode === "--verify") {
  const report = buildReport();
  check(existsSync(readmePath), "data/README.md is missing; run npm run data:index");
  check(existsSync(csvIndexPath), "data/csv-index.csv is missing; run npm run data:index");
  check(readFileSync(readmePath, "utf8") === report.readme, "data/README.md is stale; run npm run data:index");
  check(readFileSync(csvIndexPath, "utf8") === report.csv, "data/csv-index.csv is stale; run npm run data:index");
  console.log(`verified data index for ${report.rows.length} CSV file(s)`);
} else {
  console.log(`Usage:
  node scripts/generate-data-index.mjs --generate
  node scripts/generate-data-index.mjs --verify`);
}

function buildReport() {
  const discoveredCsvFiles = listFiles(join(repoRoot, "data"))
    .filter((file) => file.endsWith(".csv"))
    .map(relativeRepo)
    .sort();
  const csvFiles = [...new Set([...discoveredCsvFiles, "data/csv-index.csv"])].sort();
  const rows = csvFiles.map((path) => {
    const family = path === "data/csv-index.csv" ? "data-index" : (path.split("/")[1] ?? "");
    return {
      path,
      family,
      audience: audienceFor(path),
      use_for: roleFor(path),
      summary: summaryFor(path),
      regenerate: commandForPath(path, family),
      verify: verifyForPath(path, family),
    };
  });
  return { rows, csv: toCsv(rows), readme: readme(rows) };
}

function readme(rows) {
  const quickRoutes = [
    ["I want the current headline status.", "data/status-dashboard/summary.md"],
    ["I want to know if I can use a specific chart.", "data/chart-use-guide/summary.md; data/chart-use-guide/chart-use-guide.csv"],
    ["I want the next work queues.", "data/status-dashboard/next-work-queues.csv; data/status-dashboard/active-proof-queue.csv"],
    ["I want to know which catalog base to try first.", "data/top20-base-readiness/start-here.md"],
    ["I want to know whether any top-20 chart/base is easy, partial, blocked, or watch.", "data/top20-base-readiness/summary.md"],
    ["I want one spreadsheet row per chart/base proof lane.", "data/outcome-coverage/base-outcomes.csv"],
    ["I want to check whether a public claim is backed, partial, planned, or refused.", "data/claims-register/summary.md; data/claims-register/claims.csv"],
    ["I want to know whether value-change blast radius is measured or still assumed.", "data/blast-radius-accuracy/summary.md; data/blast-radius-accuracy/cases.csv"],
    ["I want the top-100 coverage contract.", "data/top100-coverage/summary.md; data/top100-coverage/coverage.csv"],
    ["I want the strict top-100 work queue.", "data/top100-coverage/work-queue.md; data/top100-coverage/work-queue.csv; data/top100-coverage/decisions-needed.md"],
    ["I want the source-scan quirk work queue.", "data/quirk-work-queue/summary.md; data/quirk-work-queue/top100-queue.csv"],
    ["I want remote dependency closure status.", "data/remote-dependency-closure/summary.md; data/remote-dependency-closure/top100.csv"],
    ["I want the first strict top-100 promotion wave.", "data/top100-promotion-wave/summary.md; data/top100-promotion-wave/wave.csv; data/top100-promotion-wave/fast-track.md; data/top100-promotion-wave/fast-track-reviews/README.md; data/top100-promotion-wave/fast-track-reviews/storage-rollback/README.md; data/top100-promotion-wave/work-orders.md"],
    ["I want to know how upstream chart updates are handled.", "data/refresh-survival/summary.md; data/latest-top20-refresh/action-queue/summary.md; data/latest-top20-refresh/replacement-decisions/summary.md"],
    ["I want the top-100 or top-500 planning picture.", "data/top100-readiness/summary.md; data/top100-readiness/next80-queues.md; data/top500-catalog-analysis/review.csv"],
    ["I want live parity status.", "data/live-kind-parity/summary.md; data/live-helm-confighub-compare/summary.md"],
    ["I want hook, CRD, webhook, or lifecycle status.", "data/lifecycle-boundary/summary.md; data/outcome-coverage/feature-outcomes.csv"],
    ["I want candidate routes for hook-bearing source charts.", "data/hook-route-candidates/summary.md; data/hook-route-candidates/candidates.csv; data/hook-route-candidates/work-orders.md"],
    ["I want extension-slot or custom-config risk.", "data/extension-slots/summary.md; data/nginx-config-checks/summary.md"],
    ["I want production support status and next actions.", "data/status-dashboard/next-work-queues.csv; data/production-support-decisions/summary.md; data/production-support-decisions/work-items.csv; data/production-support-decisions/decisions.csv"],
    ["I want accepted pre-review production dispositions.", "data/production-disposition/summary.md; data/production-disposition/support-decision-contract.md; data/production-disposition/support-decision-queue.csv"],
  ];
  const primary = [
    ["data/status-dashboard/summary.md", "Start here for a one-page status dashboard: top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity."],
    ["data/chart-use-guide/summary.md", "Chart-use guide: one short answer per top-100 chart for whether to use it now, promote it, design a better base, or decide a limitation first."],
    ["data/status-dashboard/next-work-queues.csv", "Machine-readable next work queues for top100 catalog work, top20 production support, live parity, and hook/lifecycle work."],
    ["data/status-dashboard/active-proof-queue.csv", "Current non-pass live parity rows with the exact support artifact that should be handled before rerun."],
    ["data/status-dashboard/top20-status.csv", "Compact chart-by-chart status for the top-20 public catalog: recommended base, setup command, base-readiness mix, evidence strength, proof lanes, feature summary, gaps, next action."],
    ["data/top20-base-readiness/start-here.md", "Short guide to the clean first catalog paths: chart, base, command, and production-support reminder."],
    ["data/top20-base-readiness/summary.md", "One row per top-20 base variant: which bases are good first paths and which need prerequisites, runtime review, or hook lifecycle work."],
    ["data/outcome-coverage/summary.md", "Start here. Outcome promises, tests that prove them, and links to the four front-door CSVs."],
    ["data/outcome-coverage/chart-outcomes.csv", "One row per chart: model support, production readiness, lane counts, hard gaps, feature summary."],
    ["data/outcome-coverage/base-outcomes.csv", "One row per chart/base variant: render parity, ConfigHub proof, local live, GitOps/OCI live, live Helm parity."],
    ["data/outcome-coverage/derived-variant-outcomes.csv", "One row per derived ConfigHub variant: intended-state proof and target-bound live status."],
    ["data/outcome-coverage/feature-outcomes.csv", "One row per chart feature: hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, gaps."],
    ["data/claims-register/summary.md", "Claim-to-evidence register: public claims, status, evidence paths, scoped verifiers, and limits."],
    ["data/claims-register/claims.csv", "Spreadsheet form of the claim-to-evidence register."],
    ["data/blast-radius-accuracy/summary.md", "Measured blast-radius accuracy seed: predicted affected objects compared with actual committed rerender diffs."],
    ["data/blast-radius-accuracy/cases.csv", "Spreadsheet form of measured and unmeasured value-source-map blast-radius rows."],
    ["data/extension-slots/extension-slots.csv", "One row per chart with NGINX-like extension slots: scope, built variants, surfaces, route, evidence."],
    ["data/nginx-config-checks/checks.csv", "NGINX supported-base checks for empty config extension slots, sidecars, metrics, raw objects, and ingress shape."],
    ["data/lifecycle-boundary/summary.md", "Hook and hook-like lifecycle boundary: hook queue rows, lifecycle observations, evidence, and current limits."],
    ["data/hook-route-candidates/summary.md", "Candidate hook route plans for source top-100 hook charts that are not yet maintained hook lifecycle queue rows."],
    ["data/hook-route-candidates/work-orders.md", "Generated work orders for turning hook route candidates into maintained route receipts, observations, or explicit blockers."],
    ["data/lifecycle-observations/cert-manager-eso/summary.md", "Concrete lifecycle observations for cert-manager and External Secrets: CRD policy, post-apply API readiness, webhook CA injection, and controller-populated Secret data."],
    ["data/live-kind-parity/summary.md", "Two-cluster live parity: regular Helm in one vanilla kind cluster and cub installer output in another."],
    ["data/live-helm-confighub-compare/summary.md", "Selected live Helm-vs-ConfigHub parity: regular Helm compared with ConfigHub delivery for selected top-20 rows."],
    ["data/live-parity-rerun-plan/summary.md", "Rerun queue for non-pass live parity rows: next action, current diagnosis, and exact rerun command."],
    ["data/production-disposition/summary.md", "Production support boundary for top-20 catalog charts: accepted dispositions, open blockers, and next actions."],
    ["data/production-disposition/dispositions.md", "Detailed production disposition plan: accepted receipts, open dispositions, owners, required evidence, and unblock rules."],
    ["data/production-disposition/next-actions.csv", "Production decision work queue: recommended base, decision focus, image digest gap, and next action per top-20 chart."],
    ["data/production-disposition/support-decision-contract.md", "Production support decision contract: required fields, current decision states, and the rule for moving from production-review-ready to production-supported."],
    ["data/production-disposition/support-decision-queue.csv", "Pre-review queue showing the candidate production base, support boundary work, and required evidence before target-scoped decisions."],
    ["data/production-support-decisions/summary.md", "Target-scoped support decision artifacts: supported, rejected, and superseded decisions, boundaries, evidence state, and next action."],
    ["data/production-support-decisions/work-items.csv", "One row per production-support task or keep-fresh item: chart, base, work type, status field, priority, action, and source decision."],
    ["data/production-support-decisions/decisions.csv", "One row per target-scoped support decision artifact: chart, base, decision state, target scope, evidence decision, and next action."],
    ["data/external-scan-lane/chart-workdown.csv", "Chart-level scan/gate workdown: grouped scanner findings, priority, and next action before production disposition."],
    ["data/scan-disposition-workdown/workdown.csv", "Scan warning routes: which rows need fixes, hardened bases, explicit security acceptance, runtime endpoint review, or PDB policy decisions."],
    ["data/image-digest-workdown/summary.md", "Image digest workdown: rendered image references that need digest resolution, image overrides, or explicit proof receipts before reproducible production OCI support."],
    ["data/pain-point-coverage/summary.md", "General Helm pain point coverage: current answers, handoffs, evidence, gaps, and next actions."],
    ["data/top100-readiness/summary.md", "Top-100 readiness: one chart-by-chart answer for workability, adoption bucket, strongest evidence, hard gap, next action, and first work queues."],
    ["data/top100-readiness/next80-queues.md", "Next80 operating queue: proof-grade non-catalog charts split into promotion review, limitation review, and user-shaped variant work."],
    ["data/top100-coverage/summary.md", "Top-100 coverage contract result: covered versus partial rows and item-by-item pass/todo breakdown."],
    ["data/top100-coverage/coverage.csv", "One row per top-100 chart: strict coverage contract status, item statuses, evidence paths, and next action."],
    ["data/top100-coverage/work-queue.md", "Top-100 strict coverage work queue: promotion review, user-shaped variants, limitation decisions, and first rows."],
    ["data/top100-coverage/work-queue.csv", "One row per partial top-100 chart: queue, priority, missing items, first step, done-when rule, evidence, and owner."],
    ["data/top100-coverage/decisions-needed.md", "Human decision memos for top-100 limitation-decision rows."],
    ["data/top100-promotion-wave/summary.md", "First strict top-100 promotion-review wave: proof-grade charts with two-cluster parity that need production disposition and support decisions."],
    ["data/top100-promotion-wave/wave.csv", "One row per selected top-100 promotion wave chart: variants, evidence, scan/gate status, first step, and done-when rule."],
    ["data/top100-promotion-wave/wave.yaml", "Machine-readable strict top-100 promotion wave input."],
    ["data/top100-promotion-wave/fast-track.md", "Low-residue top-100 promotion candidates whose remaining work is narrow enough to review quickly."],
    ["data/top100-promotion-wave/fast-track-reviews/README.md", "Review packets for the low-residue top-100 promotion candidates."],
    ["data/top100-promotion-wave/fast-track-reviews/storage-rollback/README.md", "Storage and rollback review inputs for each fast-track candidate."],
    ["data/top100-promotion-wave/work-orders.md", "Assignable chart-by-chart review tasks for the first top-100 promotion wave."],
    ["data/top100-promotion-wave/work-orders.csv", "Spreadsheet work orders for the first top-100 promotion wave: variant selection, scan/gate, lifecycle, live evidence, and support decision tasks."],
    ["data/refresh-survival/summary.md", "Latest-version refresh survival: current supported chart versions, upstream update candidates, and promotion gates before replacement."],
    ["data/refresh-survival/refreshes.csv", "One row per top-20 chart in the latest refresh review: current version, latest version, candidate proof, promotion state, and next action."],
    ["data/latest-top20-refresh/action-queue/summary.md", "Action queue for current top-20 upstream movement: replacement decisions, retained-candidate refreshes, and new-candidate creation."],
    ["data/latest-top20-refresh/action-queue/queue.csv", "Spreadsheet action queue for latest-refresh work: current version, latest upstream version, retained candidate, priority, command, evidence, and done-when rule."],
    ["data/latest-top20-refresh/action-queue/queue.yaml", "Machine-readable latest-refresh action queue."],
    ["data/latest-top20-refresh/promotion-work-orders.md", "Per-candidate lane closure table for retained proof-complete update candidates."],
    ["data/latest-top20-refresh/promotion-work-orders.csv", "Spreadsheet work orders for retained candidates: render proof, ConfigHub proof, local live, live parity, production disposition, catalog/site, and top100/top500 refresh."],
    ["data/latest-top20-refresh/replacement-decisions/summary.md", "Final review queue for retained proof-complete update candidates before any supported catalog version is replaced."],
    ["data/latest-top20-refresh/replacement-decisions/decisions.csv", "Spreadsheet replacement-decision queue: current supported version, retained candidate version, latest upstream version, freshness, proof status, evidence, and next action."],
    ["data/latest-top20-refresh/replacement-decisions/decisions.yaml", "Machine-readable replacement-decision queue for the retained proof-complete update candidates."],
    ["data/next-ten-waves/summary.md", "Compact next work queues: gap review, latest-version promotion, variant build, production disposition, and import prototypes."],
    ["data/attack-plan-workdown/summary.md", "Broader execution workdown: import examples, hard gaps, variants, production, runtime/GitOps, latest candidates, and image digests."],
    ["data/top500-catalog-analysis/review.csv", "Top-500 evidence map: retained source-scan rows joined to current recipe proof, catalog status, version drift, source features, and next action."],
    ["data/variant-path-coverage/summary.md", "Per chart/base/path matrix for base variants, diffs, operations, and derived ConfigHub variants."],
    ["data/quirk-coverage/summary.md", "Coverage audit for Helm quirks: tracked, partly tracked, source-scanned only, or not scanned."],
    ["data/quirk-work-queue/summary.md", "Chart-level work queue for converting public top-100 source-scan quirks into modeled, reviewable, and eventually provable catalog facts."],
    ["data/remote-dependency-closure/summary.md", "Top-100 remote dependency closure map: source-scan dependency risk joined to maintained recipe dependency locks."],
    ["data/high-fanout-demo/summary.md", "Prometheus/kube-prometheus-stack example showing how one base choice changes many objects and prerequisites."],
    ["data/high-fanout-demo/operation-preview.md", "Pre-ship operation preview for kube-prometheus-stack high-fanout inputs: route, reach, guardrail, and next proof."],
    ["data/edge-recovery/summary.md", "Recovered graph fragments from catalog-supported recipe artifacts."],
    ["data/csv-index.csv", "Machine-readable index of every CSV under data/."],
  ];
  const families = [...new Set(rows.map((row) => row.family))].sort();
  return `# Data Index

This directory contains generated evidence, CSVs, and summary pages for the
Helm experiment. The data is meant to answer three questions without requiring
readers to inspect every recipe folder:

~~~text
What outcomes are promised?
Which tests prove those outcomes?
What is the current status for each chart, base, derived variant, and feature?
~~~

## Quick Routes

Do not start by opening every CSV. Pick the question first, then use the
smallest generated surface that answers it.

| Question | Start with |
| --- | --- |
${quickRoutes.map(([question, paths]) => `| ${question} | ${paths.split("; ").map((path) => `[${path.replace("data/", "")}](${path.replace("data/", "./")})`).join("<br>")} |`).join("\n")}

## Start Here

| File | Use it for |
| --- | --- |
${primary.map(([path, role]) => `| [${path.replace("data/", "")}](${path.replace("data/", "./")}) | ${role} |`).join("\n")}

The front-door CSVs are intentionally redundant with deeper generated reports.
They join the important evidence into a small set of spreadsheet-friendly
tables. Use the deeper CSVs when you need drill-down.

## CSV Audience Labels

\`csv-index.csv\` assigns each CSV one audience label. Use the labels to decide
which files are evidence, which files are planning, and which files are
supporting drill-down.

| Audience | Meaning |
| --- | --- |
| \`user/front-door\` | Start here. These CSVs join the important proof and status data into reader-facing tables. |
| \`verification\` | Evidence tables for committed proof lanes, live receipts, runtime checks, and parity checks. |
| \`corpus\` | Maintained chart facts, feature facts, quirk facts, and graph fragments used by the catalog. |
| \`planning\` | Work queues, promotion reviews, refresh candidates, and future catalog expansion inputs. |
| \`supporting\` | Secondary generated tables that explain or drill into another summary. Do not cite these as the headline status without following the linked summary. |

When in doubt, read in this order:

~~~text
user/front-door
-> verification
-> corpus
-> planning
-> supporting
~~~

## Regeneration Order

Use the narrowest generator that matches the change, then run the matching
verify command. Do not run live tests just to refresh CSVs.

| Change | Regenerate in this order |
| --- | --- |
| Chart facts, quirk facts, or variant metadata | \`npm run chart-facts\`, \`npm run outcomes:generate\`, \`npm run top100:readiness\`, \`npm run status:dashboard\`, \`npm run site:generate\` |
| Production support decisions or blockers | \`npm run production:disposition\`, \`npm run production:disposition:details\`, \`npm run top100:readiness\`, \`npm run status:dashboard\`, \`npm run site:generate\` |
| Live receipt status | Regenerate the lane summary, then \`npm run outcomes:generate\`, \`npm run status:dashboard\`, \`npm run site:generate\` |
| Per-chart catalog or artifact map inputs | \`npm run catalog:maps\`, then \`npm run catalog:index\` if the root catalog view changed |
| CSV files added, removed, or renamed | Run the owner generator first, then \`npm run data:index\` |

After regenerating, run the same commands with \`:verify\` where available.
Use \`npm run verify\` only as the broad release gate after scoped checks pass.

## How To Read Status

| Term | Meaning |
| --- | --- |
| \`model-supported\` | The chart has a complete, honest model for its declared scope. It is not a live-deployment claim by itself. |
| \`render parity\` | \`cub installer\` setup renders the same Kubernetes object set as regular Helm under recorded inputs. |
| \`in-ConfigHub\` | The rendered objects upload as ConfigHub Units with scan/safe-operation receipts. |
| \`local live\` | The rendered objects were applied to Kubernetes and observed with workload checks. |
| \`GitOps live\` | ConfigHub OCI was reconciled by Argo or Flux and observed. |
| \`live parity\` | A live Helm install was compared with ConfigHub delivery paths. |
| \`missing\` | No committed receipt for that exact row yet. This is backlog, not failure. |
| \`watch\` | A committed receipt exists and the lane produced useful evidence, but runtime, storage, controller-health, initialization, or operating policy still needs review. |
| \`blocked\` | A committed receipt exists, but a target prerequisite, lifecycle route, hook decision, Secret, CRD, storage class, or similar condition must be resolved before the row can pass. |
| \`fail\` | A committed receipt records a failed check. Read the reason before treating it as a ConfigHub-vs-Helm defect. |

## Dataset Families

| Family | Main summary | Primary use |
| --- | --- | --- |
${families.map((family) => {
  const summary = mainSummaryForFamily(family);
  const summaryLink = existsSync(join(repoRoot, summary)) ? `[${summary.replace("data/", "")}](${summary.replace("data/", "./")})` : "-";
  return `| \`${family}\` | ${summaryLink} | ${familyRole(family)} |`;
}).join("\n")}

## Every CSV

The complete CSV list is generated at:

~~~text
data/csv-index.csv
~~~

It includes ${rows.length} CSV files. Each row records the path, audience,
purpose, summary, and regenerate/verify command where known.

## Regeneration

Regenerate and verify this index:

~~~sh
npm run data:index
npm run data:index:verify
~~~

The full repository verifier includes the data index:

~~~sh
npm run verify
~~~
`;
}

function audienceFor(path) {
  if (path === "data/csv-index.csv") return "user/front-door";
  if (path.startsWith("data/chart-use-guide/")) return "user/front-door";
  if (path.startsWith("data/status-dashboard/")) return "user/front-door";
  if (path.startsWith("data/top20-base-readiness/")) return "user/front-door";
  if (path.startsWith("data/outcome-coverage/")) return "user/front-door";
  if (path.startsWith("data/claims-register/")) return "user/front-door";
  if (path.startsWith("data/blast-radius-accuracy/")) return "user/front-door";
  if (path.startsWith("data/pain-point-coverage/")) return "user/front-door";
  if (path.startsWith("data/top100-readiness/")) return "user/front-door";
  if (path.startsWith("data/top100-coverage/")) return "user/front-door";
  if (path.startsWith("data/refresh-survival/")) return "user/front-door";
  if (path.startsWith("data/variant-path-coverage/")) return "user/front-door";
  if (path.startsWith("data/quirk-coverage/")) return "user/front-door";
  if (path.startsWith("data/extension-slots/")) return "user/front-door";
  if (path.startsWith("data/production-disposition/")) return "user/front-door";
  if (path.startsWith("data/production-support-decisions/")) return "user/front-door";
  if (path === "data/external-scan-lane/chart-workdown.csv") return "user/front-door";
  if (path.startsWith("data/scan-disposition-workdown/")) return "user/front-door";
  if (path.startsWith("data/nginx-config-checks/")) return "verification";
  if (path.startsWith("data/lifecycle-boundary/")) return "user/front-door";
  if (path.startsWith("data/high-fanout-demo/")) return "user/front-door";
  if (path.startsWith("data/edge-recovery/")) return "corpus";
  if (path.includes("lane-test") || path.includes("live") || path.includes("runtime") || path.includes("derived-variant-target-bound")) return "verification";
  if (path.includes("chart-facts") || path.includes("top100") || path.includes("top500") || path.includes("hook") || path.includes("image") || path.includes("quirk")) return "corpus";
  if (path.includes("production") || path.includes("catalog") || path.includes("latest") || path.includes("legacy") || path.includes("next-ten")) return "planning";
  return "supporting";
}

function roleFor(path) {
  if (path === "data/csv-index.csv") return "machine-readable index of every CSV under data";
  if (path === "data/chart-use-guide/chart-use-guide.csv") return "one row per top-100 chart: whether to use now, promote, design a better base, or decide a limitation first";
  if (path === "data/status-dashboard/status.csv") return "front-door status dashboard across top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity";
  if (path === "data/status-dashboard/next-work-queues.csv") return "machine-readable next work queues: section, item, count, action, source table, and detail";
  if (path === "data/status-dashboard/active-proof-queue.csv") return "current non-pass live parity rows with their next step, support artifact, receipt, and rerun command";
  if (path === "data/status-dashboard/top20-status.csv") return "one row per top-20 catalog chart: recommended base, setup command, base-readiness mix, evidence strength, proof lanes, feature summary, gaps, next action";
  if (path === "data/live-e2e/cub-scout-watchlist.csv") return "strict cub-scout live witness gaps where ordinary live checks pass but rendered/live parity needs a target capability or lifecycle decision";
  if (path === "data/top20-base-readiness/base-readiness.csv") return "one row per top-20 base variant: user readiness, proof status, target facts, command, and next action";
  if (path === "data/outcome-coverage/chart-outcomes.csv") return "one row per chart: model support, lane counts, gaps";
  if (path === "data/outcome-coverage/base-outcomes.csv") return "one row per chart/base: proof lane status";
  if (path === "data/outcome-coverage/derived-variant-outcomes.csv") return "one row per derived variant: intended and target-bound status";
  if (path === "data/outcome-coverage/feature-outcomes.csv") return "one row per chart feature or quirk";
  if (path === "data/claims-register/claims.csv") return "one row per public claim: status, evidence paths, scoped verifier, and limit";
  if (path === "data/blast-radius-accuracy/cases.csv") return "one row per value-source-map blast-radius case: measured score or unmeasured backlog";
  if (path === "data/pain-point-coverage/pain-points.csv") return "one row per Helm pain point: answer, handoff, evidence, gap";
  if (path === "data/top100-readiness/readiness.csv") return "one row per top-100 chart: workability, adoption bucket, strongest evidence, gap, next action, and queue source";
  if (path === "data/top100-readiness/next80-queues.csv") return "one row per next80 proof-grade chart: queue, rank, features, artifacts, and next action";
  if (path === "data/top100-coverage/coverage.csv") return "one row per top-100 chart: strict coverage contract status, item statuses, evidence paths, and next action";
  if (path === "data/top100-coverage/work-queue.csv") return "one row per partial top-100 chart: strict coverage queue, priority, missing items, first step, and done-when rule";
  if (path === "data/top100-promotion-wave/wave.csv") return "one row per selected strict top-100 promotion wave chart";
  if (path === "data/top100-promotion-wave/fast-track.csv") return "one row per low-residue top-100 promotion candidate with clean scan/gate state";
  if (path === "data/top100-promotion-wave/fast-track-reviews/review-packets.csv") return "one row per fast-track promotion review packet";
  if (path === "data/top100-promotion-wave/fast-track-reviews/storage-rollback/storage-reviews.csv") return "one row per fast-track candidate storage and rollback review";
  if (path === "data/top100-promotion-wave/work-orders.csv") return "one row per promotion-review task for the first strict top-100 wave";
  if (path === "data/refresh-survival/refreshes.csv") return "one row per top-20 latest-version refresh: current proof, latest upstream version, retained candidate state, and promotion route";
  if (path === "data/latest-top20-refresh/action-queue/queue.csv") return "one row per top-20 upstream update row: action, priority, first step, command, evidence, and done-when rule";
  if (path === "data/latest-top20-refresh/promotion-work-orders.csv") return "one row per candidate chart and support lane needed before latest-version promotion";
  if (path === "data/latest-top20-refresh/replacement-decisions/decisions.csv") return "one row per retained proof-complete update candidate: current version, candidate version, latest upstream version, freshness, proof state, decision topics, evidence, and next action";
  if (path === "data/edge-recovery/edges.csv") return "recovered desired-state graph fragments from recipe artifacts";
  if (path === "data/variant-path-coverage/coverage-matrix.csv") return "one row per chart/base/path proof status";
  if (path === "data/quirk-coverage/coverage.csv") return "one row per Helm quirk axis: coverage tier, evidence, remaining gap, next action";
  if (path === "data/quirk-work-queue/top100-queue.csv") return "one row per affected public top-100 source chart: open quirk set, priority, first action, and next artifact";
  if (path === "data/remote-dependency-closure/top100.csv") return "one row per top-100 chart with remote, vendored, or non-exact dependency risk joined to maintained dependency-lock evidence";
  if (path === "data/extension-slots/extension-slots.csv") return "one row per chart with NGINX-like extension slots and the route for populated slots";
  if (path === "data/nginx-config-checks/checks.csv") return "NGINX supported-base checks for config extension slots and rendered object shape";
  if (path === "data/lifecycle-boundary/lifecycle-boundary.csv") return "one row per hook queue item or hook-like lifecycle observation";
  if (path === "data/hook-route-candidates/candidates.csv") return "one row per source-top-100 hook route candidate: pattern, dependency source, candidate route, and promotion step";
  if (path === "data/hook-route-candidates/work-orders.csv") return "one row per hook route candidate work order: review task, done-when rule, and evidence target";
  if (path === "data/production-disposition/next-actions.csv") return "one row per top-20 chart: recommended base, production decision focus, image digest status, and next action";
  if (path === "data/production-disposition/support-decision-queue.csv") return "pre-review production support queue: candidate base, support boundary work, and required evidence";
  if (path === "data/production-support-decisions/decisions.csv") return "one row per target-scoped support decision artifact";
  if (path === "data/production-support-decisions/work-items.csv") return "one row per production-support task or keep-fresh item";
  if (path === "data/external-scan-lane/chart-workdown.csv") return "one row per chart: external scan findings grouped into priority and next production action";
  if (path === "data/scan-disposition-workdown/workdown.csv") return "one row per top-20 chart: route scan warnings to fixes, hardened bases, acceptance, endpoint review, or PDB decisions";
  if (path === "data/high-fanout-demo/prometheus-kps.csv") return "Prometheus/kube-prometheus-stack high-fanout base-variant example";
  if (path.endsWith("variant-lanes.csv")) return "row-level proof lane matrix";
  if (path.endsWith("chart-facts.csv")) return "chart facts and hard gaps";
  if (path.endsWith("report.csv")) return "model completeness report";
  if (path.endsWith("top20.csv")) return "top-20 production disposition";
  if (path.endsWith("summary.csv")) return "machine-readable summary";
  if (path.endsWith("review.csv")) return "review or promotion worksheet";
  if (path.endsWith("work-orders.csv")) return "generated work orders";
  if (path.endsWith("receipt-index.csv")) return "required receipt paths and minimum checks";
  if (path.endsWith("wave1.csv")) return "first runtime/GitOps wave";
  if (path.endsWith("queue.csv")) return "review queue";
  if (path.endsWith("backlog.csv")) return "variant backlog";
  return "supporting generated CSV";
}

function summaryFor(path) {
  if (path === "data/live-e2e/cub-scout-watchlist.csv") return "data/live-e2e/cub-scout-watchlist.md";
  const summary = join(dirname(join(repoRoot, path)), "summary.md");
  return existsSync(summary) ? relativeRepo(summary) : "";
}

function familyRole(family) {
  const roles = {
    adversarial10: "hard-chart readiness and control-point analysis",
    "outcome-coverage": "front-door outcome, test, and status map",
    "chart-use-guide": "front-door can-I-use-this-chart guide",
    "claims-register": "front-door public claim-to-evidence register",
    "blast-radius-accuracy": "front-door measured blast-radius accuracy seed and backlog",
    "status-dashboard": "one-page front-door status dashboard",
    "top20-base-readiness": "top-20 base-variant readiness and first-path guidance",
    "pain-point-coverage": "front-door Helm pain point coverage map",
    "top100-readiness": "front-door top-100 user readiness and evidence summary",
    "top100-coverage": "front-door top-100 coverage contract and work queue",
    "top100-promotion-wave": "first strict top-100 promotion-review wave",
    "refresh-survival": "latest-version refresh survival and upgrade seed",
    "edge-recovery": "recovered desired-state graph fragments",
    "variant-path-coverage": "chart/base/path proof status matrix",
    "quirk-coverage": "Helm quirk-axis coverage audit",
    "quirk-work-queue": "source-scan quirk work queue for top-100 charts",
    "remote-dependency-closure": "remote dependency closure map for top-100 charts",
    "extension-slots": "NGINX-like extension-slot coverage and routing",
    "nginx-config-checks": "NGINX supported-base config extension checks",
    "lifecycle-boundary": "hook queue and hook-like lifecycle observation boundary",
    "high-fanout-demo": "Prometheus base-variant fanout and prerequisite example",
    "data-index": "CSV index and generated data guide",
    "lane-test-matrix": "exact chart/base proof lane status",
    "model-completeness": "chart-level model support criteria",
    "chart-facts": "per-chart feature, quirk, and hard-gap facts",
    "catalog-promotion-review": "catalog promotion worksheet for the 100-chart corpus",
    "catalog-promotion-wave2": "older user-shaped variant work-order worksheet",
    "derived-variant-target-bound": "derived ConfigHub variants with target/live evidence",
    "external-scan-lane": "external scanner lane review output",
    "scan-disposition-workdown": "scan warning routes to fixes, hardened bases, or explicit dispositions",
    "live-helm-confighub-compare": "strict live Helm-vs-ConfigHub parity",
    "live-e2e": "top-20 local kind runtime status",
    "live-kind-parity": "two-cluster kind parity receipts",
    "live-parity-rerun-plan": "rerun queue for non-pass live parity rows",
    "runtime-gitops": "Argo/Flux OCI live proof wave",
    "hook-lifecycle": "hook-bearing charts and required lifecycle receipt paths",
    "hook-route-candidates": "candidate hook route plans before maintained lifecycle queue admission",
    "lifecycle-observations": "controller-owned or hook-like lifecycle observations",
    "latest-top20-refresh": "latest upstream chart-version refresh candidates",
    "legacy-patch-review": "older chart-version patch support review",
    "next80-full-proofs": "80 additional full proof-grade chart artifacts",
    "top100-catalog-analysis": "top-100 proof and promotion surface",
    "top500-catalog-analysis": "top-500 catalog planning analysis",
    "production-disposition": "top-20 production blockers and next actions",
    "production-support-decisions": "target-scoped production support decision artifacts",
    "quirk-review-queue": "queue for chart quirks needing human or product review",
    "image-digest-workdown": "image pinning and mutable tag review",
    "attack-plan-workdown": "execution workdown across gaps and proof lanes",
    "next-ten-waves": "compact next work queues",
    "variant-backlog": "candidate base-variant expansion backlog",
    "variant-goldens": "golden work orders for derived-variant examples",
  };
  return roles[family] ?? "supporting generated evidence";
}

function mainSummaryForFamily(family) {
  if (family === "lifecycle-observations") return "data/lifecycle-observations/cert-manager-eso/summary.md";
  return `data/${family}/summary.md`;
}

function commandFor(family) {
  const commands = commandMap()[family];
  return commands?.generate ?? "";
}

function verifyFor(family) {
  const commands = commandMap()[family];
  return commands?.verify ?? "";
}

function commandForPath(path, family) {
  if (path === "data/production-disposition/next-actions.csv") return "npm run production:disposition:details";
  if (path === "data/live-e2e/cub-scout-watchlist.csv") return "manual update after strict cub-scout live witness rerun";
  if (path.startsWith("data/top100-promotion-wave/fast-track")) return "npm run top100:promotion-fast-track";
  if (path.startsWith("data/latest-top20-refresh/replacement-decisions/")) return "npm run top20:latest-replacement-decisions";
  if (path.startsWith("data/latest-top20-refresh/action-queue/")) return "npm run top20:latest-action-queue";
  return commandFor(family);
}

function verifyForPath(path, family) {
  if (path === "data/production-disposition/next-actions.csv") return "npm run production:disposition:details:verify";
  if (path === "data/live-e2e/cub-scout-watchlist.csv") return "npm run data:index:verify";
  if (path.startsWith("data/top100-promotion-wave/fast-track")) return "npm run top100:promotion-fast-track:verify";
  if (path.startsWith("data/latest-top20-refresh/replacement-decisions/")) return "npm run top20:latest-replacement-decisions:verify";
  if (path.startsWith("data/latest-top20-refresh/action-queue/")) return "npm run top20:latest-action-queue:verify";
  return verifyFor(family);
}

function commandMap() {
  return {
    "outcome-coverage": { generate: "npm run outcomes:generate", verify: "npm run outcomes:verify" },
    "chart-use-guide": { generate: "npm run chart-use:guide", verify: "npm run chart-use:guide:verify" },
    "claims-register": { generate: "npm run claims:register", verify: "npm run claims:register:verify" },
    "blast-radius-accuracy": { generate: "npm run blast-radius:accuracy", verify: "npm run blast-radius:accuracy:verify" },
    "status-dashboard": { generate: "npm run status:dashboard", verify: "npm run status:dashboard:verify" },
    "top20-base-readiness": { generate: "npm run top20:base-readiness", verify: "npm run top20:base-readiness:verify" },
    "pain-point-coverage": { generate: "npm run pain-points:generate", verify: "npm run pain-points:verify" },
    "top100-readiness": { generate: "npm run top100:readiness", verify: "npm run top100:readiness:verify" },
    "top100-coverage": { generate: "npm run top100:coverage", verify: "npm run top100:coverage:verify" },
    "top100-promotion-wave": { generate: "npm run top100:promotion-wave", verify: "npm run top100:promotion-wave:verify" },
    "refresh-survival": { generate: "npm run refresh:survival", verify: "npm run refresh:survival:verify" },
    "edge-recovery": { generate: "npm run edges:generate", verify: "npm run edges:verify" },
    "variant-path-coverage": { generate: "npm run variant-paths:generate", verify: "npm run variant-paths:verify" },
    "quirk-coverage": { generate: "npm run quirk-coverage", verify: "npm run quirk-coverage:verify" },
    "quirk-work-queue": { generate: "npm run quirk-work-queue", verify: "npm run quirk-work-queue:verify" },
    "remote-dependency-closure": { generate: "npm run remote-deps:closure", verify: "npm run remote-deps:closure:verify" },
    "extension-slots": { generate: "npm run extension-slots", verify: "npm run extension-slots:verify" },
    "nginx-config-checks": { generate: "npm run nginx:config-checks", verify: "npm run nginx:config-checks:verify" },
    "lifecycle-boundary": { generate: "npm run lifecycle:boundary", verify: "npm run lifecycle:boundary:verify" },
    "high-fanout-demo": { generate: "npm run high-fanout:generate", verify: "npm run high-fanout:verify" },
    "data-index": { generate: "npm run data:index", verify: "npm run data:index:verify" },
    adversarial10: { generate: "npm run adversarial10:generate", verify: "npm run adversarial10:verify" },
    "lane-test-matrix": { generate: "npm run lane-tests:generate", verify: "npm run lane-tests:verify" },
    "model-completeness": { generate: "npm run completeness:generate", verify: "npm run completeness:verify" },
    "chart-facts": { generate: "npm run chart-facts", verify: "npm run chart-facts:verify" },
    "catalog-promotion-review": { generate: "npm run catalog:review", verify: "npm run catalog:review:verify" },
    "catalog-promotion-wave2": { generate: "npm run catalog:wave2", verify: "npm run catalog:wave2:verify" },
    "derived-variant-target-bound": { generate: "npm run derived-variants:target-bound:summary", verify: "npm run derived-variants:target-bound:summary:verify" },
    "external-scan-lane": { generate: "npm run external-scan", verify: "npm run external-scan:verify" },
    "scan-disposition-workdown": { generate: "npm run scan-disposition:workdown", verify: "npm run scan-disposition:workdown:verify" },
    "live-e2e": { generate: "npm run top20:local-e2e:summary", verify: "npm run top20:verify-local-e2e" },
    "live-helm-confighub-compare": { generate: "npm run live-parity:top20:summary", verify: "npm run live-parity:top20:verify-slots" },
    "live-parity-rerun-plan": { generate: "npm run live-parity:rerun-plan", verify: "npm run live-parity:rerun-plan:verify" },
    "live-kind-parity": { generate: "npm run kind-parity:summary", verify: "npm run kind-parity:verify" },
    "runtime-gitops": { generate: "npm run runtime-gitops:wave", verify: "npm run runtime-gitops:wave:verify" },
    "hook-lifecycle": { generate: "npm run hooks:lifecycle", verify: "npm run hooks:lifecycle:verify" },
    "lifecycle-observations": { generate: "npm run lifecycle:cert-manager-eso:summary", verify: "npm run lifecycle:cert-manager-eso:verify" },
    "top100-catalog-analysis": { generate: "npm run top100:catalog", verify: "npm run top100:catalog:verify" },
    "top500-catalog-analysis": { generate: "npm run top500:catalog", verify: "npm run top500:catalog:verify" },
    "production-disposition": { generate: "npm run production:disposition", verify: "npm run production:disposition:verify" },
    "production-support-decisions": { generate: "npm run production:support-decisions", verify: "npm run production:support-decisions:verify" },
    "image-digest-workdown": { generate: "npm run image-digests:workdown", verify: "npm run image-digests:workdown:verify" },
    "attack-plan-workdown": { generate: "npm run attack-plan:generate", verify: "npm run attack-plan:verify" },
    "next-ten-waves": { generate: "npm run next-ten:waves", verify: "npm run next-ten:waves:verify" },
    "latest-top20-refresh": { generate: "npm run top20:latest-refresh", verify: "npm run top20:latest-refresh:verify" },
    "next80-full-proofs": { generate: "npm run next80:generate", verify: "npm run next80:verify" },
    "quirk-review-queue": { generate: "npm run quirk-queue:generate", verify: "npm run quirk-queue:verify" },
    "legacy-patch-review": { generate: "npm run legacy-patch:review", verify: "npm run legacy-patch:review:verify" },
    "variant-backlog": { generate: "npm run variant-backlog:generate", verify: "npm run variant-backlog:verify" },
    "variant-goldens": { generate: "npm run variant-goldens", verify: "npm run variant-goldens:verify" },
  };
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value) {
  const text = value === undefined || value === null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}
