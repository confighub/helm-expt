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
    .filter((path) => path !== "data/lane-test-matrix/variant-lanes.csv")
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
    ["I want the current status of the agreed Top 50.", "data/top50-completion/summary.md; data/top50-completion/plan.csv"],
    ["I want the compact catalog data routing index.", "data/catalog-index/summary.md"],
    ["I want the broad chart/version/base status in one browser sheet.", "data/master-catalog-matrix/matrix.html; data/master-catalog-matrix/summary.md; data/master-catalog-matrix/matrix.csv"],
    ["I want the current headline status.", "data/status-dashboard/summary.md"],
    ["I want to know if I can use a specific chart.", "data/chart-use-guide/summary.md; data/chart-use-guide/chart-use-guide.csv"],
    ["I want the plain-English path from one chart preset into ConfigHub.", "data/confighub-example-guides/summary.md; data/confighub-example-guides/guides.csv"],
    ["I want to know if I can use a chart AND how: support level beside evidence depth, prerequisites, quirks, the applicable skill, and the cub-scout post-apply check.", "data/chart-fact-sheets/summary.md; data/chart-fact-sheets/fact-sheets.html; data/chart-fact-sheets/fact-sheets.csv"],
    ["I know the chart name and need paths to bases, receipts, hook routes, quirk routes, and decisions.", "data/chart-evidence-router/summary.md; data/chart-evidence-router/router.csv"],
    ["I want to know what outcomes are actually promised and proven.", "data/outcome-evidence-contract/summary.md; data/outcome-evidence-contract/outcomes.csv"],
    ["I want the next work queues.", "data/status-dashboard/next-work-queues.csv; data/status-dashboard/active-proof-queue.csv"],
    ["I want to know which catalog base to try first.", "data/top20-base-readiness/start-here.md"],
    ["I want to know whether any top-20 chart/base is easy, partial, blocked, or watch.", "data/top20-base-readiness/summary.md"],
    ["I want one spreadsheet row per chart/base proof lane.", "data/outcome-coverage/base-outcomes.csv"],
    ["I want to check whether a public claim is backed, partial, planned, or refused.", "data/claims-register/summary.md; data/claims-register/claims.csv"],
    ["I want to know whether value-change blast radius is measured or still assumed.", "data/blast-radius-accuracy/summary.md; data/blast-radius-accuracy/cases.csv"],
    ["I want the top-100 coverage contract.", "data/top100-coverage/summary.md; data/top100-coverage/coverage.csv"],
    ["I want the strict top-100 work queue.", "data/top100-coverage/work-queue.md; data/top100-coverage/work-queue.csv; data/top100-coverage/decisions-needed.md"],
    ["I want to know which useful base variants need designing next.", "data/useful-base-design-queue/summary.md; data/useful-base-design-queue/queue.csv"],
    ["I want to know which useful base variants have been made real.", "data/useful-base-realization-wave/summary.md; data/useful-base-realization-wave/wave.csv"],
    ["I want the source-scan quirk work queue.", "data/quirk-work-queue/summary.md; data/quirk-work-queue/top100-queue.csv"],
    ["I want the hardest top-100 proof gaps to assign next.", "data/hard-proof-gaps/summary.md; data/hard-proof-gaps/shortlist.csv"],
    ["I want remote dependency closure status.", "data/remote-dependency-closure/summary.md; data/remote-dependency-closure/top100.csv"],
    ["I want the first strict top-100 promotion wave.", "data/top100-promotion-wave/summary.md; data/top100-promotion-wave/wave.csv; data/top100-promotion-wave/fast-track.md; data/top100-promotion-wave/fast-track-reviews/README.md; data/top100-promotion-wave/fast-track-reviews/storage-rollback/README.md; data/top100-promotion-wave/fast-track-reviews/target-scope/README.md; data/top100-promotion-wave/work-orders.md"],
    ["I want to know how upstream chart updates are handled.", "data/refresh-survival/summary.md; data/latest-top20-refresh/action-queue/summary.md; data/latest-top20-refresh/replacement-decisions/summary.md"],
    ["I want one complete chart-upgrade, promotion, and live-rollout example.", "data/redis-upgrade-app-proof/summary.md"],
    ["I want one public, no-account walkthrough from package pull through a retained Redis base choice and verified OCI output.", "data/redis-public-walkthrough-proof/summary.md"],
    ["I want the ConfigHub, OCI, Argo CD, and Kubara platform-delivery example.", "data/kubara-oci-delivery-proof/summary.md"],
    ["I want the ConfigHub, OCI, Argo CD, and Sveltos fleet-delivery example.", "data/sveltos-oci-delivery-proof/summary.md"],
    ["I want the top-100 or top-500 planning picture.", "data/top100-readiness/summary.md; data/top100-readiness/next80-queues.md; data/top500-catalog-analysis/review.csv"],
    ["I want live parity status.", "data/live-kind-parity/summary.md; data/live-helm-confighub-compare/summary.md; data/live-matrix-burndown/summary.md; data/gitops-health-residue/summary.md"],
    ["I want large ConfigHub upload/apply/GitOps operations split into visible stages.", "data/large-config-operations/summary.md; data/large-config-operations/operations.csv"],
    ["I want to understand local live non-pass rows.", "data/local-live-triage/summary.md; data/local-live-triage/triage.csv"],
    ["I want hook, APIService, CRD, webhook, or lifecycle status.", "data/hook-coverage/summary.md; data/apiservice-coverage/summary.md; data/apiservice-coverage/work-orders.md; data/lifecycle-boundary/summary.md; data/webhook-cert-lifecycle/summary.md; data/outcome-coverage/feature-outcomes.csv"],
    ["I want candidate routes for hook-bearing source charts.", "data/hook-route-candidates/summary.md; data/hook-route-candidates/candidates.csv; data/hook-route-candidates/work-orders.md"],
    ["I want the machine-readable lifecycle route contract: where a hook or hidden behavior goes, who executes it, the default, and the off-ramps.", "data/lifecycle-routes/summary.md; data/lifecycle-routes/routes.csv; data/lifecycle-routes/routes.json"],
    ["I want to know which operating skill/playbook applies to a chart.", "data/chart-skills/summary.md; data/chart-skills/skills.csv; data/chart-skills/skills.json"],
    ["I want the executable action plan for a chart's hooks/lifecycle: phase, action kind, facts, evidence, and whether it runs automatically.", "data/lifecycle-route-actions/summary.md; data/lifecycle-route-actions/actions.csv; data/lifecycle-route-actions/actions.json"],
    ["I want the compact ConfigHub-facing render config for each real Helm base variant, with the full proof chain still attached.", "data/helm-render-intents/summary.md; data/helm-render-intents/intents.csv; data/helm-render-intents/intents.json"],
    ["I want the installer package OCI ref users should pull for each chart/version.", "data/installer-oci-packages/summary.md; data/installer-oci-packages/packages.csv; data/installer-oci-packages/packages.json"],
    ["I want to follow one configuration from its source digest through ConfigHub, output OCI, delivery, and live observation.", "data/oci-evidence-chains/summary.md; data/oci-evidence-chains/matrix.csv; data/oci-evidence-chains/chains.json"],
    ["I want to know why a two-cluster kind-parity row is watch or blocked, who fixes it, and whether I can use the chart today.", "data/kind-parity-decisions/summary.md; data/kind-parity-decisions/decisions.csv; data/kind-parity-decisions/decisions.json"],
    ["I want to know why a GitOps/OCI or live Helm-vs-ConfigHub row is watch or blocked, who fixes it, and whether I can use the chart today.", "data/live-parity-decisions/summary.md; data/live-parity-decisions/decisions.csv; data/live-parity-decisions/decisions.json"],
    ["I want the next live commands grouped into small ordered run blocks, with a predicted residue family per row (derived, never a claim).", "data/live-run-blocks/summary.md; data/live-run-blocks/run-blocks.csv; data/live-run-blocks/run-blocks.json"],
    ["I want every non-green/not-yet-run matrix cell triaged into needs-a-run vs needs-a-fix vs needs-modeling vs already-decided, with a reason and next action.", "data/matrix-completion-audit/summary.md; data/matrix-completion-audit/audit.csv; data/matrix-completion-audit/audit.json"],
    ["I want the variant-promotion column as an actionable queue: which variants can run cub variant promote now, which old watch receipts need rerun on the fixed ConfigHub server, and which are blocked by proof prerequisites.", "data/variant-promotion-closeout/summary.md; data/variant-promotion-closeout/closeout.csv; data/variant-promotion-closeout/closeout.json"],
    ["I want the remote-image watch rows turned into product decisions: the exact missing image, where it fails, and whether to refresh the chart/base, override the image, pin/mirror a digest, route a lifecycle image, or watch/refuse.", "data/remote-image-runtime-workdown/summary.md; data/remote-image-runtime-workdown/workdown.csv; data/remote-image-runtime-workdown/workdown.json"],
    ["I want the ready-to-run variant promotions grouped into safe serial batches of commands to run once ConfigHub auth returns.", "data/variant-promotion-proof-batches/summary.md; data/variant-promotion-proof-batches/batches.csv; data/variant-promotion-proof-batches/batches.json"],
    ["I want the catalog-owned model gaps (rows that need a recipe/base change, not a re-run): the gap kind, the recommended action, and any sibling base that already passes.", "data/model-gap-workdown/summary.md; data/model-gap-workdown/workdown.csv; data/model-gap-workdown/workdown.json"],
    ["I want the target/user prerequisites a base needs before it can pass (a CRD, Namespace, Secret, storage, external API, or target topology), who owns each, and the exact prerequisite name.", "data/target-prerequisite-workdown/summary.md; data/target-prerequisite-workdown/workdown.csv; data/target-prerequisite-workdown/workdown.json"],
    ["I want an action packet per non-green row: what to stage before rerunning (create-namespace / stage-secret / install-crds / provide-external-service / provide-storage-or-topology / operator-review), the required inputs, the evidence to look for, and the rerun command.", "data/target-prerequisite-actions/summary.md; data/target-prerequisite-actions/actions.csv; data/target-prerequisite-actions/actions.json"],
    ["I want every current model gap and target prerequisite routed to a product resolution path: new base variant, existing sibling base, derived target variant, target-scoped policy, or operator review.", "data/model-prereq-resolution/summary.md; data/model-prereq-resolution/resolution.csv; data/model-prereq-resolution/resolution.json"],
    ["I want the ranked plan to reach 100% verified matrix disposition: the non-green cells collapsed into action families by cells-cleared-per-action, owner lane, and linked issues, with variant promotion as a first-class family.", "data/coverage-completion-plan/summary.md; data/coverage-completion-plan/actions.csv; data/coverage-completion-plan/actions.json"],
    ["I want extension-slot or custom-config risk.", "data/extension-slots/summary.md; data/nginx-config-checks/summary.md"],
    ["I want production support status and next actions.", "data/status-dashboard/next-work-queues.csv; data/production-support-decisions/summary.md; data/production-support-decisions/work-items.csv; data/production-support-decisions/decisions.csv; data/hard-chart-production-packets/summary.md"],
    ["I want accepted pre-review production dispositions.", "data/production-disposition/summary.md; data/production-disposition/support-decision-contract.md; data/production-disposition/support-decision-queue.csv"],
  ];
  const primary = [
    ["data/top50-completion/summary.md", "The agreed fifty-task programme: current status, evidence, verification command, and completion step for every outcome."],
    ["data/catalog-index/summary.md", "Compact question-to-source router for top100/top500 catalog status, prerequisites, base gaps, blockers, and evidence."],
    ["data/master-catalog-matrix/matrix.html", "Human/product browser view: one row per chart/version/base with user route, strongest evidence, core lanes, production scope, hooks, quirks, hard gaps, and next action."],
    ["data/master-catalog-matrix/matrix.csv", "Machine/spreadsheet form of the master catalog matrix. Same row set as matrix.html, without relying on color."],
    ["data/master-catalog-matrix/summary.md", "Compact GitHub orientation for the master catalog matrix."],
    ["data/status-dashboard/summary.md", "Start here for a one-page status dashboard: top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity."],
    ["data/chart-use-guide/summary.md", "Chart-use guide: one short answer per top-100 chart for whether to use it now, promote it, design a better base, or decide a limitation first."],
    ["data/confighub-example-guides/summary.md", "Plain-English guide set for how each public chart preset stores rendered YAML in ConfigHub: what was rendered, why it is the starting point, how to repeat it, and what prerequisites remain."],
    ["data/anonymous-oci-ci-proof/summary.md", "Anonymous OCI work in GitHub Actions: public package digest, rendered object set, OCI-layout digest, pull-back comparison, and explicit limits."],
    ["data/oci-evidence-chains/summary.md", "Source-neutral OCI evidence chains for Helm, AICR, cub installer, Kubara, Sveltos, and literal Kubernetes configuration, with missing delivery or observation kept explicit."],
    ["data/redis-upgrade-app-proof/summary.md", "Live Redis Upgrade App proof: retain a post-render replica change across a chart upgrade, show the two-wave environment impact, promote in sequence, and check one OCI digest on two Argo CD clusters."],
    ["data/redis-public-walkthrough-proof/summary.md", "Public Redis walkthrough: anonymously pull two published chart versions, retain the existing-Secret base across the upgrade, keep Secret objects out of both renders, and verify each local OCI output by pulling it back."],
    ["data/kubara-oci-delivery-proof/summary.md", "Live platform proof: approve a Kubara-generated base in ConfigHub, run its CRD, Secret, and Redis setup work, package the prepared objects as portable OCI, reconcile them with Argo CD, and bring up one selected Metrics Server Application."],
    ["data/sveltos-oci-delivery-proof/summary.md", "Live fleet-platform proof: approve a Sveltos ClusterProfile in ConfigHub, package the approved object as portable OCI, reconcile it with Argo CD, let Sveltos install Kyverno on the matching workload cluster, and repair drift."],
    ["data/chart-evidence-router/summary.md", "Per-chart evidence router: chart-use answer, first base, catalog path, proof lanes, variant revisions, receipts, hooks, quirks, production decisions, and next action."],
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
    ["data/webhook-cert-lifecycle/summary.md", "Webhook certificate lifecycle evidence: rows where explicit staged certificate material makes a local live workload converge."],
    ["data/hook-coverage/summary.md", "Top-100 hook coverage bridge: joins source-scan hook rows to maintained hook lifecycle rows and candidate route plans."],
    ["data/apiservice-coverage/summary.md", "Top-100 APIService coverage bridge: separates rendered APIService object evidence from aggregated API availability evidence."],
    ["data/apiservice-coverage/work-orders.md", "Assignable APIService proof-wave work orders: KEDA first, source-only import rows next, and Metrics Server keep-fresh pattern."],
    ["data/hook-route-candidates/summary.md", "Candidate hook route plans for source top-100 hook charts that are not yet maintained hook lifecycle queue rows."],
    ["data/hook-route-candidates/work-orders.md", "Generated work orders for turning hook route candidates into maintained route receipts, observations, or explicit blockers."],
    ["data/lifecycle-observations/cert-manager-eso/summary.md", "Concrete lifecycle observations for cert-manager and External Secrets: CRD policy, post-apply API readiness, webhook CA injection, and controller-populated Secret data."],
    ["data/live-kind-parity/summary.md", "Two-cluster live parity: regular Helm in one vanilla kind cluster and cub installer output in another."],
    ["data/live-matrix-burndown/summary.md", "Generated live burn-down plan: one row per remaining live-parity or two-cluster kind-parity command needed to close the master matrix live cells."],
    ["data/local-live-triage/summary.md", "Local Kubernetes non-pass triage: every local live fail/block row mapped to a route class, next action, and receipt."],
    ["data/live-helm-confighub-compare/summary.md", "Selected live Helm-vs-ConfigHub parity: regular Helm compared with ConfigHub delivery for selected top-20 rows."],
    ["data/live-parity-rerun-plan/summary.md", "Rerun queue for non-pass live parity rows: next action, current diagnosis, and exact rerun command."],
    ["data/gitops-health-residue/summary.md", "GitOps controller-health residue: rows where sync/workload evidence can pass while aggregate controller health still needs explanation."],
    ["data/large-config-operations/summary.md", "Large ConfigHub operation funnel: 50+ object live rows split by runtime, GitOps, target facts, workload convergence, controller health, and missing progress evidence."],
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
    ["data/useful-base-design-queue/summary.md", "Useful base design queue for top-100 charts that are proof-grade but too default-shaped to recommend."],
    ["data/useful-base-design-queue/queue.csv", "One row per chart needing a useful base proposal: proposed base shape, user job, render choices, target inputs, and proof required."],
    ["data/useful-base-design-queue/families.csv", "Grouped useful-base design families for assigning batches of related chart work."],
    ["data/useful-base-realization-wave/summary.md", "First wave of useful base proposals made real as recipe variants and cub installer package bases."],
    ["data/useful-base-realization-wave/wave.csv", "One row per realized useful base: strategy, remaining proof work, package base, and recipe variant."],
    ["data/top100-promotion-wave/summary.md", "First strict top-100 promotion-review wave: proof-grade charts with two-cluster parity that need production disposition and support decisions."],
    ["data/top100-promotion-wave/wave.csv", "One row per selected top-100 promotion wave chart: variants, evidence, scan/gate status, first step, and done-when rule."],
    ["data/top100-promotion-wave/wave.yaml", "Machine-readable strict top-100 promotion wave input."],
    ["data/top100-promotion-wave/fast-track.md", "Low-residue top-100 promotion candidates whose remaining work is narrow enough to review quickly."],
    ["data/top100-promotion-wave/fast-track-reviews/README.md", "Review packets for the low-residue top-100 promotion candidates."],
    ["data/top100-promotion-wave/fast-track-reviews/storage-rollback/README.md", "Storage and rollback review inputs for each fast-track candidate."],
    ["data/top100-promotion-wave/fast-track-reviews/target-scope/README.md", "Draft target-scope support decisions for each fast-track candidate."],
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
    ["data/hard-proof-gaps/summary.md", "Short assignment surface for the top-100 source-quirk rows most likely to damage trust if overclaimed."],
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
  if (path.startsWith("data/master-catalog-matrix/")) return "user/front-door";
  if (path.startsWith("data/disposition-frontier/")) return "user/front-door";
  if (path.startsWith("data/environment-matrix/")) return "user/front-door";
  if (path.startsWith("data/torture-suite/")) return "user/front-door";
  if (path.startsWith("data/chart-use-guide/")) return "user/front-door";
  if (path.startsWith("data/chart-fact-sheets/")) return "user/front-door";
  if (path.startsWith("data/chart-evidence-router/")) return "user/front-door";
  if (path.startsWith("data/helm-render-intents/")) return "user/front-door";
  if (path.startsWith("data/installer-oci-packages/")) return "user/front-door";
  if (path.startsWith("data/oci-evidence-chains/")) return "user/front-door";
  if (path.startsWith("data/status-dashboard/")) return "user/front-door";
  if (path.startsWith("data/local-live-triage/")) return "user/front-door";
  if (path.startsWith("data/live-matrix-burndown/")) return "user/front-door";
  if (path.startsWith("data/live-run-blocks/")) return "user/front-door";
  if (path.startsWith("data/matrix-completion-audit/")) return "user/front-door";
  if (path.startsWith("data/variant-promotion-closeout/")) return "user/front-door";
  if (path.startsWith("data/remote-image-runtime-workdown/")) return "user/front-door";
  if (path.startsWith("data/variant-promotion-proof-batches/")) return "user/front-door";
  if (path.startsWith("data/model-gap-workdown/")) return "user/front-door";
  if (path.startsWith("data/target-prerequisite-workdown/")) return "user/front-door";
  if (path.startsWith("data/target-prerequisite-actions/")) return "user/front-door";
  if (path.startsWith("data/model-prereq-resolution/")) return "user/front-door";
  if (path.startsWith("data/coverage-completion-plan/")) return "user/front-door";
  if (path.startsWith("data/gitops-health-residue/")) return "user/front-door";
  if (path.startsWith("data/large-config-operations/")) return "user/front-door";
  if (path.startsWith("data/outcome-evidence-contract/")) return "user/front-door";
  if (path.startsWith("data/top20-base-readiness/")) return "user/front-door";
  if (path.startsWith("data/outcome-coverage/")) return "user/front-door";
  if (path.startsWith("data/claims-register/")) return "user/front-door";
  if (path.startsWith("data/blast-radius-accuracy/")) return "user/front-door";
  if (path.startsWith("data/pain-point-coverage/")) return "user/front-door";
  if (path.startsWith("data/top100-user-readiness/")) return "user/front-door";
  if (path.startsWith("data/top100-readiness/")) return "user/front-door";
  if (path.startsWith("data/top50-completion/")) return "user/front-door";
  if (path.startsWith("data/top100-coverage/")) return "user/front-door";
  if (path.startsWith("data/useful-base-design-queue/")) return "user/front-door";
  if (path.startsWith("data/useful-base-realization-wave/")) return "user/front-door";
  if (path.startsWith("data/refresh-survival/")) return "user/front-door";
  if (path.startsWith("data/variant-path-coverage/")) return "user/front-door";
  if (path.startsWith("data/variant-promotion/")) return "user/front-door";
  if (path.startsWith("data/quirk-coverage/")) return "user/front-door";
  if (path.startsWith("data/extension-slots/")) return "user/front-door";
  if (path.startsWith("data/production-disposition/")) return "user/front-door";
  if (path.startsWith("data/production-support-decisions/")) return "user/front-door";
  if (path.startsWith("data/hard-chart-production-packets/")) return "user/front-door";
  if (path === "data/external-scan-lane/chart-workdown.csv") return "user/front-door";
  if (path.startsWith("data/scan-disposition-workdown/")) return "user/front-door";
  if (path.startsWith("data/nginx-config-checks/")) return "verification";
  if (path.startsWith("data/hook-coverage/")) return "user/front-door";
  if (path.startsWith("data/apiservice-coverage/")) return "user/front-door";
  if (path.startsWith("data/lifecycle-boundary/")) return "user/front-door";
  if (path.startsWith("data/lifecycle-routes/")) return "user/front-door";
  if (path.startsWith("data/chart-skills/")) return "user/front-door";
  if (path.startsWith("data/lifecycle-route-actions/")) return "user/front-door";
  if (path.startsWith("data/kind-parity-decisions/")) return "user/front-door";
  if (path.startsWith("data/live-parity-decisions/")) return "user/front-door";
  if (path.startsWith("data/webhook-cert-lifecycle/")) return "user/front-door";
  if (path.startsWith("data/high-fanout-demo/")) return "user/front-door";
  if (path.startsWith("data/edge-recovery/")) return "corpus";
  if (path.includes("lane-test") || path.includes("live") || path.includes("runtime") || path.includes("derived-variant-target-bound")) return "verification";
  if (path.includes("chart-facts") || path.includes("top100") || path.includes("top500") || path.includes("hook") || path.includes("image") || path.includes("quirk")) return "corpus";
  if (path.includes("production") || path.includes("catalog") || path.includes("latest") || path.includes("legacy") || path.includes("next-ten")) return "planning";
  return "supporting";
}

function roleFor(path) {
  if (path === "data/csv-index.csv") return "machine-readable index of every CSV under data";
  if (path === "data/master-catalog-matrix/matrix.html") return "human/product browser view: one row per chart/version/base with user route, strongest evidence, core lanes, production scope, hooks, quirks, hard gaps, and next action";
  if (path === "data/master-catalog-matrix/matrix.csv") return "machine/spreadsheet form of the master catalog matrix; same row set as matrix.html without color";
  if (path === "data/master-catalog-matrix/summary.md") return "compact GitHub orientation for the master catalog matrix";
  if (path.startsWith("data/master-catalog-matrix/")) return "front-door master view: one row per catalog variant with lanes, hooks, quirks, decisions";
  if (path.startsWith("data/disposition-frontier/")) return "distance to the 99% disposition bar: every lane cell scored, missing cells derived to honest dispositions + next actions";
  if (path.startsWith("data/environment-matrix/")) return "recorded environment-determinism cells (TZ/locale/flag profiles)";
  if (path.startsWith("data/torture-suite/")) return "synthetic breaker fixtures: every chart lands in a named pass/refusal/route, never silence";
  if (path.startsWith("data/doc-freshness/")) return "authored-doc freshness snapshot and review acknowledgments";
  if (path === "data/chart-use-guide/chart-use-guide.csv") return "one row per top-100 chart: whether to use now, promote, design a better base, or decide a limitation first";
  if (path === "data/chart-evidence-router/router.csv") return "one row per top-100 chart: catalog path, base rows, variant revisions, receipts, hook route, quirk route, production decisions, and next action";
  if (path === "data/status-dashboard/status.csv") return "front-door status dashboard across top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity";
  if (path === "data/status-dashboard/next-work-queues.csv") return "machine-readable next work queues: section, item, count, action, source table, and detail";
  if (path === "data/status-dashboard/active-proof-queue.csv") return "current non-pass live parity rows with their next step, support artifact, receipt, and rerun command";
  if (path === "data/status-dashboard/top20-status.csv") return "one row per top-20 catalog chart: recommended base, setup command, base-readiness mix, evidence strength, proof lanes, feature summary, gaps, next action";
  if (path === "data/local-live-triage/triage.csv") return "one row per local live non-pass chart/base: route class, user meaning, next action, and receipt";
  if (path === "data/local-live-triage/classes.csv") return "route-class summary for local live non-pass rows";
  if (path === "data/live-matrix-burndown/work-items.csv") return "one row per remaining live command needed to close master-matrix G/P or K cells; live-parity rows exercise G and P together, kind-parity rows exercise K";
  if (path === "data/outcome-evidence-contract/outcomes.csv") return "one row per user-visible outcome: question, status, evidence, verifier command, scope, and next action";
  if (path === "data/live-e2e/cub-scout-watchlist.csv") return "strict cub-scout live witness gaps where ordinary live checks pass but rendered/live parity needs a target capability or lifecycle decision";
  if (path === "data/gitops-health-residue/residue.csv") return "one row per ConfigHub OCI/GitOps controller-health residue: app sync, aggregate health, resource health breakdown, classification, and next action";
  if (path === "data/large-config-operations/operations.csv") return "one row per 50+ object live ConfigHub operation: stage, GitOps status, workload result, target profile, controller-health residue, and missing progress evidence";
  if (path === "data/top20-base-readiness/base-readiness.csv") return "one row per top-20 base variant: user readiness, proof status, target facts, command, and next action";
  if (path === "data/outcome-coverage/chart-outcomes.csv") return "one row per chart: model support, lane counts, gaps";
  if (path === "data/outcome-coverage/base-outcomes.csv") return "one row per chart/base: proof lane status";
  if (path === "data/outcome-coverage/derived-variant-outcomes.csv") return "one row per derived variant: intended and target-bound status";
  if (path === "data/outcome-coverage/feature-outcomes.csv") return "one row per chart feature or quirk";
  if (path === "data/claims-register/claims.csv") return "one row per public claim: status, evidence paths, scoped verifier, and limit";
  if (path === "data/blast-radius-accuracy/cases.csv") return "one row per value-source-map blast-radius case: measured score or unmeasured backlog";
  if (path === "data/pain-point-coverage/pain-points.csv") return "one row per Helm pain point: answer, handoff, evidence, gap";
  if (path === "data/top100-user-readiness/readiness.csv") return "one row per top-100 chart in user language: bucket, current proof, first base, prerequisites, absorbed responsibilities, and next action";
  if (path === "data/top100-readiness/readiness.csv") return "one row per top-100 chart: workability, adoption bucket, strongest evidence, gap, next action, and queue source";
  if (path === "data/top100-readiness/next80-queues.csv") return "one row per next80 proof-grade chart: queue, rank, features, artifacts, and next action";
  if (path === "data/top50-completion/plan.csv") return "one row per agreed programme outcome: status, current evidence, verification commands, completion step, and linked issue";
  if (path === "data/oci-evidence-chains/matrix.csv") return "one row per supported starting format: source, review, ConfigHub record, output OCI, delivery, observation, and current proof boundary";
  if (path === "data/top100-coverage/coverage.csv") return "one row per top-100 chart: strict coverage contract status, item statuses, evidence paths, and next action";
  if (path === "data/top100-coverage/work-queue.csv") return "one row per partial top-100 chart: strict coverage queue, priority, missing items, first step, and done-when rule";
  if (path === "data/useful-base-design-queue/queue.csv") return "one row per top-100 chart that needs a useful base: proposed base shape, user job, render choices, target inputs, and proof required";
  if (path === "data/useful-base-design-queue/families.csv") return "useful base queue grouped by proposed design family";
  if (path === "data/useful-base-realization-wave/wave.csv") return "one row per useful base made real as a recipe variant and cub installer package base";
  if (path === "data/top100-promotion-wave/wave.csv") return "one row per selected strict top-100 promotion wave chart";
  if (path === "data/top100-promotion-wave/fast-track.csv") return "one row per low-residue top-100 promotion candidate with clean scan/gate state";
  if (path === "data/top100-promotion-wave/fast-track-reviews/review-packets.csv") return "one row per fast-track promotion review packet";
  if (path === "data/top100-promotion-wave/fast-track-reviews/storage-rollback/storage-reviews.csv") return "one row per fast-track candidate storage and rollback review";
  if (path === "data/top100-promotion-wave/fast-track-reviews/target-scope/target-scope-decisions.csv") return "one row per fast-track candidate target-scope decision draft";
  if (path === "data/top100-promotion-wave/work-orders.csv") return "one row per promotion-review task for the first strict top-100 wave";
  if (path === "data/refresh-survival/refreshes.csv") return "one row per top-20 latest-version refresh: current proof, latest upstream version, retained candidate state, and promotion route";
  if (path === "data/latest-top20-refresh/action-queue/queue.csv") return "one row per top-20 upstream update row: action, priority, first step, command, evidence, and done-when rule";
  if (path === "data/latest-top20-refresh/promotion-work-orders.csv") return "one row per candidate chart and support lane needed before latest-version promotion";
  if (path === "data/latest-top20-refresh/replacement-decisions/decisions.csv") return "one row per retained proof-complete update candidate: current version, candidate version, latest upstream version, freshness, proof state, decision topics, evidence, and next action";
  if (path === "data/edge-recovery/edges.csv") return "recovered desired-state graph fragments from recipe artifacts";
  if (path === "data/variant-path-coverage/coverage-matrix.csv") return "one row per chart/base/path proof status";
  if (path === "data/variant-promotion/status.csv") return "one row per chart/base: whether server-side cub variant promote is proven, available but not receipt-backed, blocked, missing, or n/a";
  if (path === "data/quirk-coverage/coverage.csv") return "one row per Helm quirk axis: coverage tier, evidence, remaining gap, next action";
  if (path === "data/quirk-work-queue/top100-queue.csv") return "one row per affected public top-100 source chart: open quirk set, priority, first action, and next artifact";
  if (path === "data/hard-proof-gaps/shortlist.csv") return "shortlist of top-100 quirk, hook, and dependency gaps most likely to undermine trust if overclaimed";
  if (path === "data/remote-dependency-closure/top100.csv") return "one row per top-100 chart with remote, vendored, or non-exact dependency risk joined to maintained dependency-lock evidence";
  if (path === "data/extension-slots/extension-slots.csv") return "one row per chart with NGINX-like extension slots and the route for populated slots";
  if (path === "data/nginx-config-checks/checks.csv") return "NGINX supported-base checks for config extension slots and rendered object shape";
  if (path === "data/lifecycle-boundary/lifecycle-boundary.csv") return "one row per hook queue item or hook-like lifecycle observation";
  if (path === "data/lifecycle-routes/routes.csv") return "one row per hook/lifecycle route: disposition, route, execution mode, default, alternatives, human/agent off-ramps, and whether it is safe to show as automatic";
  if (path === "data/chart-skills/skills.csv") return "one row per chart: which docs/skills/ operating playbooks apply (advisory), the top skill, and the matched chart-fact signals";
  if (path === "data/lifecycle-route-actions/actions.csv") return "one row per hook/lifecycle route projected into an action packet: lifecycle phase, action kind, disposition, required target facts, evidence required, and whether the product runs it automatically (false today)";
  if (path === "data/helm-render-intents/intents.csv") return "one row per real base variant with chart/version/base, render inputs, evidence lanes, lifecycle route status, target-prerequisite action count, and source repository URL";
  if (path === "data/installer-oci-packages/packages.csv") return "one row per installer package with chart/version, package path, public package OCI ref, bases, setup command, and publication receipt status";
  if (path === "data/kind-parity-decisions/decisions.csv") return "one row per non-pass two-cluster kind-parity row: residue category, who fixes it (user/catalog/review), whether it is usable today, plain user decision, and next action";
  if (path === "data/live-parity-decisions/decisions.csv") return "one row per non-pass ConfigHub OCI + live Helm-vs-ConfigHub (G/P-lane) row: residue category, who fixes it, whether it is usable today, plain user decision, next action, and support artifact";
  if (path === "data/live-run-blocks/run-blocks.csv") return "one row per ready-to-run todo live row grouped into a run block: block id/goal, exact command, lane cells, predicted residue family + target profile (derived from committed evidence, never a claim) with basis and confidence, serial-safety notes, and why it matters for 99%";
  if (path === "data/matrix-completion-audit/audit.csv") return "one row per non-green/not-yet-run matrix cell: lane, state, product-readable reason, next action, support artifact, owner, and a completion class (needs-run / needs-target-or-prereq-fix / needs-modeling / already-decided)";
  if (path === "data/variant-promotion-closeout/closeout.csv") return "one row per variant promotion cell: state, whether a server-side clone exists, promote readiness (ready-to-run / watch-grade / blocked-needs-confighub-proof), owner class (run-proof / catalog-modeling), evidence receipt, and exact next command";
  if (path === "data/remote-image-runtime-workdown/workdown.csv") return "one row per remote-image watch row: exact missing image(s), where it fails (container/init/hook), whether both Helm and ConfigHub fail, candidate override path or unknown, recommended product action (refresh-chart-or-base / supported-image-override / pin-or-mirror-digest / route-lifecycle-image / watch-upstream / refuse), and owner class";
  if (path === "data/variant-promotion-proof-batches/batches.csv") return "one row per ready-to-run promotion, assigned to a safe serial batch (5-10 commands) with the exact node scripts/run-top20-confighub-proof.mjs variant-promotion command to run once ConfigHub auth returns";
  if (path === "data/model-gap-workdown/workdown.csv") return "one row per catalog-owned model-gap (non-pass row needing a recipe/base change, not a re-run): model-gap kind (crd-lifecycle / missing-crd / object-set-shape / generated-fact / semantic-normalization / base-design), recommended action, owner class, a sibling base that already passes, the rerun command after the fix, and evidence path";
  if (path === "data/target-prerequisite-workdown/workdown.csv") return "one row per target/user prerequisite (non-pass row needing something staged on the target, not a model change): prerequisite kind (crd / namespace / secret / storage / object-store / topology / external-api) and exact name, whether semantic parity already passed, owner class (user-stage / catalog-support / target-policy / operator-review / upstream-or-registry), support artifact, next action, and rerun command";
  if (path === "data/target-prerequisite-actions/actions.csv") return "one action packet per target-prerequisite row: action_kind (create-namespace / stage-secret / install-crds / provide-external-service / provide-storage-or-topology / operator-review / unknown-preflight), required inputs, evidence required after staging, rerun command, and automatic=false (preflight plan, not automation)";
  if (path === "data/model-prereq-resolution/resolution.csv") return "one row per current model-gap or target-prerequisite row: source queue, gap kind, resolution path, variant role, recommended variant/action, first step, required evidence, rerun command, and source receipt";
  if (path === "data/coverage-completion-plan/actions.csv") return "one row per action family on the path to 100% verified matrix disposition: action_type, sub-group, owner lane, affected cell count (cells-cleared-per-action), affected rows, command/prerequisite, expected status (predictions marked), evidence surface to regenerate, and linked issues; ranked by cells cleared";
  if (path === "data/webhook-cert-lifecycle/evidence.csv") return "one row per staged webhook certificate route: Secret, paired live observation, and proof boundary";
  if (path === "data/hook-coverage/top100-hook-coverage.csv") return "one row per source top-100 hook chart joined to maintained lifecycle coverage or candidate route coverage";
  if (path === "data/apiservice-coverage/top100-apiservice-coverage.csv") return "one row per source top-100 APIService chart: source signal, modeled status, object/workload evidence, parity evidence, aggregation evidence, and next action";
  if (path === "data/hook-route-candidates/candidates.csv") return "one row per source-top-100 hook route candidate: pattern, dependency source, candidate route, and promotion step";
  if (path === "data/hook-route-candidates/work-orders.csv") return "one row per hook route candidate work order: review task, done-when rule, and evidence target";
  if (path === "data/production-disposition/next-actions.csv") return "one row per top-20 chart: recommended base, production decision focus, image digest status, and next action";
  if (path === "data/production-disposition/support-decision-queue.csv") return "pre-review production support queue: candidate base, support boundary work, and required evidence";
  if (path === "data/production-support-decisions/decisions.csv") return "one row per target-scoped support decision artifact";
  if (path === "data/production-support-decisions/work-items.csv") return "one row per production-support task or keep-fresh item";
  if (path === "data/hard-chart-production-packets/packets.csv") return "one row per hard chart production packet: supported base, target-scoped decision, proof status, safe use today, and broader support work";
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
    "chart-evidence-router": "front-door per-chart evidence router across bases, receipts, hooks, quirks, and decisions",
    "claims-register": "front-door public claim-to-evidence register",
    "blast-radius-accuracy": "front-door measured blast-radius accuracy seed and backlog",
    "status-dashboard": "one-page front-door status dashboard",
    "local-live-triage": "front-door local live non-pass route classes and next actions",
    "top20-base-readiness": "top-20 base-variant readiness and first-path guidance",
    "pain-point-coverage": "front-door Helm pain point coverage map",
    "top100-user-readiness": "front-door top-100 user-language readiness, prerequisites, first base, and next action",
    "top100-readiness": "front-door top-100 user readiness and evidence summary",
    "top50-completion": "front-door fifty-task programme status, evidence, and completion queue",
    "top100-coverage": "front-door top-100 coverage contract and work queue",
    "useful-base-design-queue": "front-door proposed useful-base queue for default-shaped top-100 charts",
    "useful-base-realization-wave": "front-door useful-base proposals made real as candidate recipe/package bases",
    "top100-promotion-wave": "first strict top-100 promotion-review wave",
    "refresh-survival": "latest-version refresh survival and upgrade seed",
    "edge-recovery": "recovered desired-state graph fragments",
    "variant-path-coverage": "chart/base/path proof status matrix",
    "variant-promotion": "server-side ConfigHub variant promotion status by chart/base",
    "quirk-coverage": "Helm quirk-axis coverage audit",
    "quirk-work-queue": "source-scan quirk work queue for top-100 charts",
    "hard-proof-gaps": "hard top-100 proof gaps joined across quirk, hook, and dependency queues",
    "remote-dependency-closure": "remote dependency closure map for top-100 charts",
    "extension-slots": "NGINX-like extension-slot coverage and routing",
    "nginx-config-checks": "NGINX supported-base config extension checks",
    "lifecycle-boundary": "hook queue and hook-like lifecycle observation boundary",
    "lifecycle-routes": "machine-readable lifecycle route contract: disposition, route, execution mode, default, alternatives, and human/agent off-ramps",
    "chart-skills": "advisory chart-to-skill mapping: which docs/skills/ playbooks apply to each chart and why",
    "lifecycle-route-actions": "hook/lifecycle routes projected into machine-readable action packets: phase, action kind, required facts, evidence required, and an explicit automatic flag",
    "helm-render-intents": "ConfigHub-facing render-intent objects generated only for real base variants, with the proof chain attached",
    "installer-oci-packages": "public installer package OCI refs and consumer setup commands for chart packages",
    "oci-evidence-chains": "source-neutral records linking source digest, reviewed configuration, ConfigHub record, output OCI, delivery, and observation",
    "kind-parity-decisions": "product-readable decisions for non-pass two-cluster kind-parity rows: residue category, who owns the fix, usable-today answer, and next action",
    "live-parity-decisions": "product-readable decisions for non-pass ConfigHub OCI + live Helm-vs-ConfigHub (G/P-lane) rows: residue category, who owns the fix, usable-today answer, next action, and support artifact",
    "live-run-blocks": "read-only run-block plan for the ready-to-run todo rows: small ordered blocks (G/P before K, hard charts first) with a derived (never claimed) predicted residue family and target profile per row",
    "matrix-completion-audit": "read-only audit of every non-green/not-yet-run matrix cell with lane, state, reason, next action, support artifact, and a completion class separating needs-run from needs-fix from needs-modeling from already-decided",
    "variant-promotion-closeout": "actionable promotion queue: per variant, whether cub variant promote is ready-to-run, watch-grade pending receipt rerun, or blocked by a proof prerequisite, the owner class, and the exact next command or fix",
    "remote-image-runtime-workdown": "product/base decisions for the remote-image watch rows: exact missing image, where it fails, recommended action (refresh / override / pin-mirror / lifecycle-route / watch / refuse), and owner class",
    "variant-promotion-proof-batches": "run plan: the ready-to-run promotions grouped into safe serial batches of 5-10 cub variant promote proof commands to run once ConfigHub auth returns (not completed evidence)",
    "model-gap-workdown": "catalog-owned model gaps: non-pass rows needing a recipe/base change (not a re-run), classified by gap kind with a recommended action, owner class, and any sibling base that already passes",
    "target-prerequisite-workdown": "target/user prerequisites: non-pass rows needing a CRD/Namespace/Secret/storage/external-API/topology staged on the target (not a model change), with the exact prerequisite name, owner class, and next action",
    "target-prerequisite-actions": "action packets: per non-green row, what to stage before rerunning (action_kind), the required inputs, the evidence to look for after staging, and the rerun command; automatic=false (preflight plan, not automation)",
    "model-prereq-resolution": "front-door resolution bridge for B1/B2 rows: each model gap and target prerequisite mapped to a new base variant, existing sibling base, derived target variant, target-scoped policy, or operator review",
    "coverage-completion-plan": "ranked plan to 100% verified matrix disposition: non-green cells collapsed into action families by cells-cleared-per-action, owner lane, expected status, and linked issues, with variant promotion as a first-class family",
    "webhook-cert-lifecycle": "webhook serving certificate lifecycle evidence and proof boundaries",
    "secret-lifecycle": "front-door Secret handling survey for rendered Secrets, target facts, and lifecycle state",
    "hook-coverage": "top-100 source hook coverage joined across maintained lifecycle rows and candidate route plans",
    "apiservice-coverage": "top-100 APIService coverage joined across source scan, modeled recipe rows, parity evidence, and runtime observations",
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
    "gitops-health-residue": "ConfigHub OCI/GitOps controller-health residue classification",
    "large-config-operations": "large ConfigHub upload/apply/GitOps operation funnel and progress-evidence gaps",
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
    "chart-evidence-router": { generate: "npm run chart:evidence-router", verify: "npm run chart:evidence-router:verify" },
    "claims-register": { generate: "npm run claims:register", verify: "npm run claims:register:verify" },
    "blast-radius-accuracy": { generate: "npm run blast-radius:accuracy", verify: "npm run blast-radius:accuracy:verify" },
    "master-catalog-matrix": { generate: "npm run master-matrix", verify: "npm run master-matrix:verify" },
    "disposition-frontier": { generate: "npm run disposition-frontier", verify: "npm run disposition-frontier:verify" },
    "environment-matrix": { generate: "npm run environment-matrix", verify: "npm run environment-matrix:verify" },
    "torture-suite": { generate: "npm run torture:suite", verify: "npm run torture:suite:verify" },
    "doc-freshness": { generate: "npm run doc-freshness", verify: "npm run doc-freshness:verify" },
    "status-dashboard": { generate: "npm run status:dashboard", verify: "npm run status:dashboard:verify" },
    "local-live-triage": { generate: "npm run local-live:triage", verify: "npm run local-live:triage:verify" },
    "top20-base-readiness": { generate: "npm run top20:base-readiness", verify: "npm run top20:base-readiness:verify" },
    "pain-point-coverage": { generate: "npm run pain-points:generate", verify: "npm run pain-points:verify" },
    "top100-user-readiness": { generate: "npm run top100:user-readiness", verify: "npm run top100:user-readiness:verify" },
    "top100-readiness": { generate: "npm run top100:readiness", verify: "npm run top100:readiness:verify" },
    "top50-completion": { generate: "npm run top50:completion", verify: "npm run top50:completion:verify" },
    "top100-coverage": { generate: "npm run top100:coverage", verify: "npm run top100:coverage:verify" },
    "useful-base-design-queue": { generate: "npm run top100:useful-base-queue", verify: "npm run top100:useful-base-queue:verify" },
    "useful-base-realization-wave": { generate: "npm run top100:useful-base-realization", verify: "npm run top100:useful-base-realization:verify" },
    "top100-promotion-wave": { generate: "npm run top100:promotion-wave", verify: "npm run top100:promotion-wave:verify" },
    "refresh-survival": { generate: "npm run refresh:survival", verify: "npm run refresh:survival:verify" },
    "edge-recovery": { generate: "npm run edges:generate", verify: "npm run edges:verify" },
    "variant-path-coverage": { generate: "npm run variant-paths:generate", verify: "npm run variant-paths:verify" },
    "variant-promotion": { generate: "npm run variant-promotion:status", verify: "npm run variant-promotion:status:verify" },
    "quirk-coverage": { generate: "npm run quirk-coverage", verify: "npm run quirk-coverage:verify" },
    "quirk-work-queue": { generate: "npm run quirk-work-queue", verify: "npm run quirk-work-queue:verify" },
    "hard-proof-gaps": { generate: "npm run top100:hard-gaps", verify: "npm run top100:hard-gaps:verify" },
    "remote-dependency-closure": { generate: "npm run remote-deps:closure", verify: "npm run remote-deps:closure:verify" },
    "extension-slots": { generate: "npm run extension-slots", verify: "npm run extension-slots:verify" },
    "nginx-config-checks": { generate: "npm run nginx:config-checks", verify: "npm run nginx:config-checks:verify" },
    "lifecycle-boundary": { generate: "npm run lifecycle:boundary", verify: "npm run lifecycle:boundary:verify" },
    "lifecycle-routes": { generate: "npm run lifecycle:routes", verify: "npm run lifecycle:routes:verify" },
    "chart-skills": { generate: "npm run chart-skills", verify: "npm run chart-skills:verify" },
    "lifecycle-route-actions": { generate: "npm run lifecycle:route-actions", verify: "npm run lifecycle:route-actions:verify" },
    "helm-render-intents": { generate: "npm run helm-render-intents", verify: "npm run helm-render-intents:verify" },
    "installer-oci-packages": { generate: "npm run installer-oci:catalog", verify: "npm run installer-oci:catalog:verify" },
    "oci-evidence-chains": { generate: "npm run oci-evidence:generate", verify: "npm run oci-evidence:verify" },
    "kind-parity-decisions": { generate: "npm run kind-parity:decisions", verify: "npm run kind-parity:decisions:verify" },
    "live-parity-decisions": { generate: "npm run live-parity:decisions", verify: "npm run live-parity:decisions:verify" },
    "live-run-blocks": { generate: "npm run live-run-blocks", verify: "npm run live-run-blocks:verify" },
    "matrix-completion-audit": { generate: "npm run matrix-completion-audit", verify: "npm run matrix-completion-audit:verify" },
    "variant-promotion-closeout": { generate: "npm run variant-promotion-closeout", verify: "npm run variant-promotion-closeout:verify" },
    "remote-image-runtime-workdown": { generate: "npm run remote-image-runtime-workdown", verify: "npm run remote-image-runtime-workdown:verify" },
    "variant-promotion-proof-batches": { generate: "npm run variant-promotion-proof-batches", verify: "npm run variant-promotion-proof-batches:verify" },
    "model-gap-workdown": { generate: "npm run model-gap-workdown", verify: "npm run model-gap-workdown:verify" },
    "target-prerequisite-workdown": { generate: "npm run target-prerequisite-workdown", verify: "npm run target-prerequisite-workdown:verify" },
    "target-prerequisite-actions": { generate: "npm run target-prerequisite-actions", verify: "npm run target-prerequisite-actions:verify" },
    "model-prereq-resolution": { generate: "npm run model-prereq-resolution", verify: "npm run model-prereq-resolution:verify" },
    "coverage-completion-plan": { generate: "npm run coverage-completion-plan", verify: "npm run coverage-completion-plan:verify" },
    "webhook-cert-lifecycle": { generate: "npm run webhook-cert:lifecycle", verify: "npm run webhook-cert:lifecycle:verify" },
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
    "live-matrix-burndown": { generate: "npm run live-matrix:burndown", verify: "npm run live-matrix:burndown:verify" },
    "gitops-health-residue": { generate: "npm run gitops:health-residue", verify: "npm run gitops:health-residue:verify" },
    "live-kind-parity": { generate: "npm run kind-parity:summary", verify: "npm run kind-parity:verify" },
    "runtime-gitops": { generate: "npm run runtime-gitops:wave", verify: "npm run runtime-gitops:wave:verify" },
    "hook-lifecycle": { generate: "npm run hooks:lifecycle", verify: "npm run hooks:lifecycle:verify" },
    "hook-coverage": { generate: "npm run hooks:coverage", verify: "npm run hooks:coverage:verify" },
    "apiservice-coverage": { generate: "npm run apiservice:coverage", verify: "npm run apiservice:coverage:verify" },
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
