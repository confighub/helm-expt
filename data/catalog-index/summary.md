# Catalog Data Index

Generated. Do not edit by hand.

~~~sh
node scripts/generate-catalog-index.mjs --generate
node scripts/generate-catalog-index.mjs --verify
~~~

This is a routing index for top100/top500 catalog data. It does not introduce a
new status field. Pick the question, open the smallest summary, then use the
listed CSV as the authoritative spreadsheet row source.

## Question Routes

| Question | Open first | Authoritative CSV | Fields to read | Notes |
| --- | --- | --- | --- | --- |
| Current headline status | [status-dashboard/summary.md](../status-dashboard/summary.md) | [status-dashboard/status.csv](../status-dashboard/status.csv) | `section`, `metric`, `value`, `status`, `source` | Use for counts and the current dashboard rollup. Follow `source` for drill-down. Owner verify: `npm run status:dashboard:verify`. |
| Can I use a specific top-100 chart? | [chart-use-guide/summary.md](../chart-use-guide/summary.md) | [chart-use-guide/chart-use-guide.csv](../chart-use-guide/chart-use-guide.csv) | `answer`, `first_action`, `recommended_base_or_variant`, `catalog_path` | Best first user-facing yes/no route. Does not replace per-chart receipts. Owner verify: `npm run chart-use:guide:verify`. |
| For a chart, where are the catalog path, bases, receipts, quirks, and decisions? | [chart-evidence-router/summary.md](../chart-evidence-router/summary.md) | [chart-evidence-router/router.csv](../chart-evidence-router/router.csv) | `catalog_path`, `proof_lane_rows`, `variant_revisions`, receipt and route fields | Use when you know the chart name and need links into the authoritative evidence files. Owner verify: `npm run chart:evidence-router:verify`. |
| What works, what needs prerequisites, and what is not ready? | [top100-user-readiness/summary.md](../top100-user-readiness/summary.md) | [top100-user-readiness/readiness.csv](../top100-user-readiness/readiness.csv) | `bucket`, `user_must_provide`, `current_proof`, `next_action` | Best single top-100 chart row for user-language status. Owner verify: `npm run top100:user-readiness:verify`. |
| Which top-100 rows need a better base? | [useful-base-design-queue/summary.md](../useful-base-design-queue/summary.md) | [useful-base-design-queue/queue.csv](../useful-base-design-queue/queue.csv) | `proposed_base`, `user_job`, `render_choices`, `proof_required` | Use for default-shaped proof rows that should not be promoted as-is. Owner verify: `npm run top100:useful-base-queue:verify`. |
| Which useful bases have already been made real? | [useful-base-realization-wave/summary.md](../useful-base-realization-wave/summary.md) | [useful-base-realization-wave/wave.csv](../useful-base-realization-wave/wave.csv) | `chart`, `base`, `strategy`, `remaining_proof_work` | Use after the design queue to see realized recipe/package bases. Owner verify: `npm run top100:useful-base-realization:verify`. |
| Which rows are blocked by a limitation decision? | [top100-coverage/decisions-needed.md](../top100-coverage/decisions-needed.md) | [top100-coverage/work-queue.csv](../top100-coverage/work-queue.csv) | `queue`, `missing_items`, `first_step`, `done_when` | Use for support/disclose/defer/block decisions before promotion. Owner verify: `npm run top100:coverage:verify`. |
| Where is chart/base proof-lane evidence? | [outcome-coverage/summary.md](../outcome-coverage/summary.md) | [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) | `render_parity`, `in_confighub`, `local_live`, `gitops_live`, `live_parity` | Use for lane status by exact chart/base. `missing` is backlog, not failure. Owner verify: `npm run outcomes:verify`. |
| Where is strict top-100 coverage evidence? | [top100-coverage/summary.md](../top100-coverage/summary.md) | [top100-coverage/coverage.csv](../top100-coverage/coverage.csv) | `coverage_status`, item statuses, evidence paths, `next_action` | Use for the strict top-100 contract result and missing item list. Owner verify: `npm run top100:coverage:verify`. |
| What does the top-500 source/catalog scan say? | [top500-catalog-analysis/summary.md](../top500-catalog-analysis/summary.md) | [top500-catalog-analysis/review.csv](../top500-catalog-analysis/review.csv) | `source_rank`, proof status, catalog status, drift, source features | Use for planning beyond the maintained top-100/front-door set. Owner verify: `npm run top500:catalog:verify`. |
| Which hook-bearing rows have coverage or candidate routes? | [hook-coverage/summary.md](../hook-coverage/summary.md) | [hook-coverage/top100-hook-coverage.csv](../hook-coverage/top100-hook-coverage.csv) | source hook signal, maintained lifecycle status, candidate route status | Use for hook status without treating candidate routes as receipts. Owner verify: `npm run hooks:coverage:verify`. |
| Which source quirks still need modeled catalog facts? | [quirk-work-queue/summary.md](../quirk-work-queue/summary.md) | [quirk-work-queue/top100-queue.csv](../quirk-work-queue/top100-queue.csv) | `open_quirks`, `priority`, `first_action`, `next_artifact` | Use for source-scan quirk work that could affect catalog trust. Owner verify: `npm run quirk-work-queue:verify`. |
| Which APIService rows need readiness or aggregation evidence? | [apiservice-coverage/summary.md](../apiservice-coverage/summary.md) | [apiservice-coverage/top100-apiservice-coverage.csv](../apiservice-coverage/top100-apiservice-coverage.csv) | source signal, modeled status, object/workload evidence, aggregation evidence | Use for APIService-specific evidence and work orders. Owner verify: `npm run apiservice:coverage:verify`. |
| Which rows have remote dependency closure risk? | [remote-dependency-closure/summary.md](../remote-dependency-closure/summary.md) | [remote-dependency-closure/top100.csv](../remote-dependency-closure/top100.csv) | dependency risk, maintained lock status, policy gap, next action | Use before claiming strong provenance or refresh-survival coverage. Owner verify: `npm run remote-deps:closure:verify`. |
| Where are production-support decisions and evidence? | [production-support-decisions/summary.md](../production-support-decisions/summary.md) | [production-support-decisions/decisions.csv](../production-support-decisions/decisions.csv) | `decision_state`, `target_scope`, evidence decision, `next_action` | Use for target-scoped production claims. Catalog support is not enough. Owner verify: `npm run production:support-decisions:verify`. |
| What should move next? | [status-dashboard/summary.md](../status-dashboard/summary.md) | [status-dashboard/next-work-queues.csv](../status-dashboard/next-work-queues.csv) | `section`, `queue`, `count`, `next_action`, `source` | Use for assignment routing across top100, production, live parity, and lifecycle queues. Owner verify: `npm run status:dashboard:verify`. |

## Existing Status Fields

Use existing fields before adding another label.

| Field | Values to expect |
| --- | --- |
| `chart-use-guide.answer` | `yes-public-catalog`, `not-yet-public-catalog-proof-ready`, `not-yet-user-ready`, `decision-needed-first` |
| `top100-user-readiness.bucket` | `ready-to-try`, `works-with-target-prerequisites`, `works-with-operator-review`, `needs-better-base-variant`, `not-ready-yet` |
| `outcome-coverage` lane cells | `pass`, `missing`, `watch`, `blocked`, `fail` where committed receipts define the row status |
| `status-dashboard.status` | `good`, `partial`, `gap` as dashboard rollup labels, not per-chart verdicts |

## Maintenance Rule

When a routed CSV changes, run that CSV's owner generator and verifier first.
Then regenerate the root data index and this page:

~~~sh
npm run data:index
node scripts/generate-catalog-index.mjs --generate
npm run data:index:verify
node scripts/generate-catalog-index.mjs --verify
~~~

No live tests are required for this routing page.
