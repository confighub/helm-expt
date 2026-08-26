# Data Index

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
| I want the current status of the agreed Top 50. | [top50-completion/summary.md](./top50-completion/summary.md)<br>[top50-completion/plan.csv](./top50-completion/plan.csv) |
| I want the compact catalog data routing index. | [catalog-index/summary.md](./catalog-index/summary.md) |
| I want the broad chart/version/base status in one browser sheet. | [master-catalog-matrix/matrix.html](./master-catalog-matrix/matrix.html)<br>[master-catalog-matrix/summary.md](./master-catalog-matrix/summary.md)<br>[master-catalog-matrix/matrix.csv](./master-catalog-matrix/matrix.csv) |
| I want the current headline status. | [status-dashboard/summary.md](./status-dashboard/summary.md) |
| I want to know if I can use a specific chart. | [chart-use-guide/summary.md](./chart-use-guide/summary.md)<br>[chart-use-guide/chart-use-guide.csv](./chart-use-guide/chart-use-guide.csv) |
| I want the plain-English path from one chart preset into ConfigHub. | [confighub-example-guides/summary.md](./confighub-example-guides/summary.md)<br>[confighub-example-guides/guides.csv](./confighub-example-guides/guides.csv) |
| I want to know if I can use a chart AND how: support level beside evidence depth, prerequisites, quirks, the applicable skill, and the cub-scout post-apply check. | [chart-fact-sheets/summary.md](./chart-fact-sheets/summary.md)<br>[chart-fact-sheets/fact-sheets.html](./chart-fact-sheets/fact-sheets.html)<br>[chart-fact-sheets/fact-sheets.csv](./chart-fact-sheets/fact-sheets.csv) |
| I know the chart name and need paths to bases, receipts, hook routes, quirk routes, and decisions. | [chart-evidence-router/summary.md](./chart-evidence-router/summary.md)<br>[chart-evidence-router/router.csv](./chart-evidence-router/router.csv) |
| I want to know what outcomes are actually promised and proven. | [outcome-evidence-contract/summary.md](./outcome-evidence-contract/summary.md)<br>[outcome-evidence-contract/outcomes.csv](./outcome-evidence-contract/outcomes.csv) |
| I want the same choose, check, and promote jobs on the website and command line. | [config-workshop-command-contract/summary.md](./config-workshop-command-contract/summary.md)<br>[config-workshop-command-contract/command-map.json](./config-workshop-command-contract/command-map.json) |
| I want a pull-request comment from the same checked result. | [config-workshop-ci-report/summary.md](./config-workshop-ci-report/summary.md) |
| I want the next work queues. | [status-dashboard/next-work-queues.csv](./status-dashboard/next-work-queues.csv)<br>[status-dashboard/active-proof-queue.csv](./status-dashboard/active-proof-queue.csv) |
| I want to know which catalog base to try first. | [top20-base-readiness/start-here.md](./top20-base-readiness/start-here.md) |
| I want to know whether any top-20 chart/base is easy, partial, blocked, or watch. | [top20-base-readiness/summary.md](./top20-base-readiness/summary.md) |
| I want one spreadsheet row per chart/base proof lane. | [outcome-coverage/base-outcomes.csv](./outcome-coverage/base-outcomes.csv) |
| I want to check whether a public claim is backed, partial, planned, or refused. | [claims-register/summary.md](./claims-register/summary.md)<br>[claims-register/claims.csv](./claims-register/claims.csv) |
| I want to know whether value-change blast radius is measured or still assumed. | [blast-radius-accuracy/summary.md](./blast-radius-accuracy/summary.md)<br>[blast-radius-accuracy/cases.csv](./blast-radius-accuracy/cases.csv) |
| I want the top-100 coverage contract. | [top100-coverage/summary.md](./top100-coverage/summary.md)<br>[top100-coverage/coverage.csv](./top100-coverage/coverage.csv) |
| I want the strict top-100 work queue. | [top100-coverage/work-queue.md](./top100-coverage/work-queue.md)<br>[top100-coverage/work-queue.csv](./top100-coverage/work-queue.csv)<br>[top100-coverage/decisions-needed.md](./top100-coverage/decisions-needed.md) |
| I want to know which useful base variants need designing next. | [useful-base-design-queue/summary.md](./useful-base-design-queue/summary.md)<br>[useful-base-design-queue/queue.csv](./useful-base-design-queue/queue.csv) |
| I want to know which useful base variants have been made real. | [useful-base-realization-wave/summary.md](./useful-base-realization-wave/summary.md)<br>[useful-base-realization-wave/wave.csv](./useful-base-realization-wave/wave.csv) |
| I want the source-scan quirk work queue. | [quirk-work-queue/summary.md](./quirk-work-queue/summary.md)<br>[quirk-work-queue/top100-queue.csv](./quirk-work-queue/top100-queue.csv) |
| I want the hardest top-100 proof gaps to assign next. | [hard-proof-gaps/summary.md](./hard-proof-gaps/summary.md)<br>[hard-proof-gaps/shortlist.csv](./hard-proof-gaps/shortlist.csv) |
| I want remote dependency closure status. | [remote-dependency-closure/summary.md](./remote-dependency-closure/summary.md)<br>[remote-dependency-closure/top100.csv](./remote-dependency-closure/top100.csv) |
| I want the first strict top-100 promotion wave. | [top100-promotion-wave/summary.md](./top100-promotion-wave/summary.md)<br>[top100-promotion-wave/wave.csv](./top100-promotion-wave/wave.csv)<br>[top100-promotion-wave/fast-track.md](./top100-promotion-wave/fast-track.md)<br>[top100-promotion-wave/fast-track-reviews/README.md](./top100-promotion-wave/fast-track-reviews/README.md)<br>[top100-promotion-wave/fast-track-reviews/storage-rollback/README.md](./top100-promotion-wave/fast-track-reviews/storage-rollback/README.md)<br>[top100-promotion-wave/fast-track-reviews/target-scope/README.md](./top100-promotion-wave/fast-track-reviews/target-scope/README.md)<br>[top100-promotion-wave/work-orders.md](./top100-promotion-wave/work-orders.md) |
| I want to know how upstream chart updates are handled. | [refresh-survival/summary.md](./refresh-survival/summary.md)<br>[latest-top20-refresh/action-queue/summary.md](./latest-top20-refresh/action-queue/summary.md)<br>[latest-top20-refresh/replacement-decisions/summary.md](./latest-top20-refresh/replacement-decisions/summary.md) |
| I want one complete chart-upgrade, promotion, and live-rollout example. | [redis-upgrade-app-proof/summary.md](./redis-upgrade-app-proof/summary.md) |
| I want one public, no-account walkthrough from package pull through a retained Redis base choice and verified OCI output. | [redis-public-walkthrough-proof/summary.md](./redis-public-walkthrough-proof/summary.md) |
| I want the ConfigHub, OCI, Argo CD, and Kubara platform-delivery example. | [kubara-oci-delivery-proof/summary.md](./kubara-oci-delivery-proof/summary.md) |
| I want the checked eight-component EKS inference path, including one retained change, Argo CD delivery, and one real CPU model request. | [certified-bundles/eks-inference-stack.md](./certified-bundles/eks-inference-stack.md)<br>[eks-inference-sandbox-proof/summary.md](./eks-inference-sandbox-proof/summary.md)<br>[eks-inference-promotion-delivery-proof/summary.md](./eks-inference-promotion-delivery-proof/summary.md)<br>[vllm-cpu-starter-proof/summary.md](./vllm-cpu-starter-proof/summary.md) |
| I want to pull and verify one AICR-derived configuration anonymously, without a cluster or GPU. | [aicr-cpu-starter-public-proof/summary.md](./aicr-cpu-starter-public-proof/summary.md) |
| I want the ConfigHub, OCI, Argo CD, and Sveltos fleet-delivery example. | [sveltos-oci-delivery-proof/summary.md](./sveltos-oci-delivery-proof/summary.md) |
| I want the top-100 or top-500 planning picture. | [top100-readiness/summary.md](./top100-readiness/summary.md)<br>[top100-readiness/next80-queues.md](./top100-readiness/next80-queues.md)<br>[top500-catalog-analysis/review.csv](./top500-catalog-analysis/review.csv) |
| I want live parity status. | [live-kind-parity/summary.md](./live-kind-parity/summary.md)<br>[live-helm-confighub-compare/summary.md](./live-helm-confighub-compare/summary.md)<br>[live-matrix-burndown/summary.md](./live-matrix-burndown/summary.md)<br>[gitops-health-residue/summary.md](./gitops-health-residue/summary.md) |
| I want large ConfigHub upload/apply/GitOps operations split into visible stages. | [large-config-operations/summary.md](./large-config-operations/summary.md)<br>[large-config-operations/operations.csv](./large-config-operations/operations.csv) |
| I want to understand local live non-pass rows. | [local-live-triage/summary.md](./local-live-triage/summary.md)<br>[local-live-triage/triage.csv](./local-live-triage/triage.csv) |
| I want hook, APIService, CRD, webhook, or lifecycle status. | [hook-coverage/summary.md](./hook-coverage/summary.md)<br>[apiservice-coverage/summary.md](./apiservice-coverage/summary.md)<br>[apiservice-coverage/work-orders.md](./apiservice-coverage/work-orders.md)<br>[lifecycle-boundary/summary.md](./lifecycle-boundary/summary.md)<br>[webhook-cert-lifecycle/summary.md](./webhook-cert-lifecycle/summary.md)<br>[outcome-coverage/feature-outcomes.csv](./outcome-coverage/feature-outcomes.csv) |
| I want candidate routes for hook-bearing source charts. | [hook-route-candidates/summary.md](./hook-route-candidates/summary.md)<br>[hook-route-candidates/candidates.csv](./hook-route-candidates/candidates.csv)<br>[hook-route-candidates/work-orders.md](./hook-route-candidates/work-orders.md) |
| I want the machine-readable lifecycle route contract: where a hook or hidden behavior goes, who executes it, the default, and the off-ramps. | [lifecycle-routes/summary.md](./lifecycle-routes/summary.md)<br>[lifecycle-routes/routes.csv](./lifecycle-routes/routes.csv)<br>[lifecycle-routes/routes.json](./lifecycle-routes/routes.json) |
| I want to know which operating skill/playbook applies to a chart. | [chart-skills/summary.md](./chart-skills/summary.md)<br>[chart-skills/skills.csv](./chart-skills/skills.csv)<br>[chart-skills/skills.json](./chart-skills/skills.json) |
| I want the executable action plan for a chart's hooks/lifecycle: phase, action kind, facts, evidence, and whether it runs automatically. | [lifecycle-route-actions/summary.md](./lifecycle-route-actions/summary.md)<br>[lifecycle-route-actions/actions.csv](./lifecycle-route-actions/actions.csv)<br>[lifecycle-route-actions/actions.json](./lifecycle-route-actions/actions.json) |
| I want the compact ConfigHub-facing render config for each real Helm base variant, with the full proof chain still attached. | [helm-render-intents/summary.md](./helm-render-intents/summary.md)<br>[helm-render-intents/intents.csv](./helm-render-intents/intents.csv)<br>[helm-render-intents/intents.json](./helm-render-intents/intents.json) |
| I want the installer package OCI ref users should pull for each chart/version. | [installer-oci-packages/summary.md](./installer-oci-packages/summary.md)<br>[installer-oci-packages/packages.csv](./installer-oci-packages/packages.csv)<br>[installer-oci-packages/packages.json](./installer-oci-packages/packages.json) |
| I want to follow one configuration from its source digest through ConfigHub, output OCI, delivery, and live observation. | [oci-evidence-chains/summary.md](./oci-evidence-chains/summary.md)<br>[oci-evidence-chains/matrix.csv](./oci-evidence-chains/matrix.csv)<br>[oci-evidence-chains/chains.json](./oci-evidence-chains/chains.json) |
| I want to know why a two-cluster kind-parity row is watch or blocked, who fixes it, and whether I can use the chart today. | [kind-parity-decisions/summary.md](./kind-parity-decisions/summary.md)<br>[kind-parity-decisions/decisions.csv](./kind-parity-decisions/decisions.csv)<br>[kind-parity-decisions/decisions.json](./kind-parity-decisions/decisions.json) |
| I want to know why a GitOps/OCI or live Helm-vs-ConfigHub row is watch or blocked, who fixes it, and whether I can use the chart today. | [live-parity-decisions/summary.md](./live-parity-decisions/summary.md)<br>[live-parity-decisions/decisions.csv](./live-parity-decisions/decisions.csv)<br>[live-parity-decisions/decisions.json](./live-parity-decisions/decisions.json) |
| I want the next live commands grouped into small ordered run blocks, with a predicted residue family per row (derived, never a claim). | [live-run-blocks/summary.md](./live-run-blocks/summary.md)<br>[live-run-blocks/run-blocks.csv](./live-run-blocks/run-blocks.csv)<br>[live-run-blocks/run-blocks.json](./live-run-blocks/run-blocks.json) |
| I want every non-green/not-yet-run matrix cell triaged into needs-a-run vs needs-a-fix vs needs-modeling vs already-decided, with a reason and next action. | [matrix-completion-audit/summary.md](./matrix-completion-audit/summary.md)<br>[matrix-completion-audit/audit.csv](./matrix-completion-audit/audit.csv)<br>[matrix-completion-audit/audit.json](./matrix-completion-audit/audit.json) |
| I want the variant-promotion column as an actionable queue: which variants can run cub variant promote now, which old watch receipts need rerun on the fixed ConfigHub server, and which are blocked by proof prerequisites. | [variant-promotion-closeout/summary.md](./variant-promotion-closeout/summary.md)<br>[variant-promotion-closeout/closeout.csv](./variant-promotion-closeout/closeout.csv)<br>[variant-promotion-closeout/closeout.json](./variant-promotion-closeout/closeout.json) |
| I want the remote-image watch rows turned into product decisions: the exact missing image, where it fails, and whether to refresh the chart/base, override the image, pin/mirror a digest, route a lifecycle image, or watch/refuse. | [remote-image-runtime-workdown/summary.md](./remote-image-runtime-workdown/summary.md)<br>[remote-image-runtime-workdown/workdown.csv](./remote-image-runtime-workdown/workdown.csv)<br>[remote-image-runtime-workdown/workdown.json](./remote-image-runtime-workdown/workdown.json) |
| I want the ready-to-run variant promotions grouped into safe serial batches of commands to run once ConfigHub auth returns. | [variant-promotion-proof-batches/summary.md](./variant-promotion-proof-batches/summary.md)<br>[variant-promotion-proof-batches/batches.csv](./variant-promotion-proof-batches/batches.csv)<br>[variant-promotion-proof-batches/batches.json](./variant-promotion-proof-batches/batches.json) |
| I want the catalog-owned model gaps (rows that need a recipe/base change, not a re-run): the gap kind, the recommended action, and any sibling base that already passes. | [model-gap-workdown/summary.md](./model-gap-workdown/summary.md)<br>[model-gap-workdown/workdown.csv](./model-gap-workdown/workdown.csv)<br>[model-gap-workdown/workdown.json](./model-gap-workdown/workdown.json) |
| I want the target/user prerequisites a base needs before it can pass (a CRD, Namespace, Secret, storage, external API, or target topology), who owns each, and the exact prerequisite name. | [target-prerequisite-workdown/summary.md](./target-prerequisite-workdown/summary.md)<br>[target-prerequisite-workdown/workdown.csv](./target-prerequisite-workdown/workdown.csv)<br>[target-prerequisite-workdown/workdown.json](./target-prerequisite-workdown/workdown.json) |
| I want an action packet per non-green row: what to stage before rerunning (create-namespace / stage-secret / install-crds / provide-external-service / provide-storage-or-topology / operator-review), the required inputs, the evidence to look for, and the rerun command. | [target-prerequisite-actions/summary.md](./target-prerequisite-actions/summary.md)<br>[target-prerequisite-actions/actions.csv](./target-prerequisite-actions/actions.csv)<br>[target-prerequisite-actions/actions.json](./target-prerequisite-actions/actions.json) |
| I want every current model gap and target prerequisite routed to a product resolution path: new base variant, existing sibling base, derived target variant, target-scoped policy, or operator review. | [model-prereq-resolution/summary.md](./model-prereq-resolution/summary.md)<br>[model-prereq-resolution/resolution.csv](./model-prereq-resolution/resolution.csv)<br>[model-prereq-resolution/resolution.json](./model-prereq-resolution/resolution.json) |
| I want the ranked plan to reach 100% verified matrix disposition: the non-green cells collapsed into action families by cells-cleared-per-action, owner lane, and linked issues, with variant promotion as a first-class family. | [coverage-completion-plan/summary.md](./coverage-completion-plan/summary.md)<br>[coverage-completion-plan/actions.csv](./coverage-completion-plan/actions.csv)<br>[coverage-completion-plan/actions.json](./coverage-completion-plan/actions.json) |
| I want extension-slot or custom-config risk. | [extension-slots/summary.md](./extension-slots/summary.md)<br>[nginx-config-checks/summary.md](./nginx-config-checks/summary.md) |
| I want production support status and next actions. | [status-dashboard/next-work-queues.csv](./status-dashboard/next-work-queues.csv)<br>[production-support-decisions/summary.md](./production-support-decisions/summary.md)<br>[production-support-decisions/work-items.csv](./production-support-decisions/work-items.csv)<br>[production-support-decisions/decisions.csv](./production-support-decisions/decisions.csv)<br>[hard-chart-production-packets/summary.md](./hard-chart-production-packets/summary.md) |
| I want accepted pre-review production dispositions. | [production-disposition/summary.md](./production-disposition/summary.md)<br>[production-disposition/support-decision-contract.md](./production-disposition/support-decision-contract.md)<br>[production-disposition/support-decision-queue.csv](./production-disposition/support-decision-queue.csv) |

## Start Here

| File | Use it for |
| --- | --- |
| [top50-completion/summary.md](./top50-completion/summary.md) | The agreed fifty-task programme: current status, evidence, verification command, and completion step for every outcome. |
| [catalog-index/summary.md](./catalog-index/summary.md) | Compact question-to-source router for top100/top500 catalog status, prerequisites, base gaps, blockers, and evidence. |
| [master-catalog-matrix/matrix.html](./master-catalog-matrix/matrix.html) | Human/product browser view: one row per chart/version/base with user route, strongest evidence, core lanes, production scope, hooks, quirks, hard gaps, and next action. |
| [master-catalog-matrix/matrix.csv](./master-catalog-matrix/matrix.csv) | Machine/spreadsheet form of the master catalog matrix. Same row set as matrix.html, without relying on color. |
| [master-catalog-matrix/summary.md](./master-catalog-matrix/summary.md) | Compact GitHub orientation for the master catalog matrix. |
| [status-dashboard/summary.md](./status-dashboard/summary.md) | Start here for a one-page status dashboard: top100, top500 evidence, proof lanes, hooks, quirks, GitOps, and live parity. |
| [chart-use-guide/summary.md](./chart-use-guide/summary.md) | Chart-use guide: one short answer per top-100 chart for whether to use it now, promote it, design a better base, or decide a limitation first. |
| [confighub-example-guides/summary.md](./confighub-example-guides/summary.md) | Plain-English guide set for how each public chart preset stores rendered YAML in ConfigHub: what was rendered, why it is the starting point, how to repeat it, and what prerequisites remain. |
| [config-workshop-command-contract/summary.md](./config-workshop-command-contract/summary.md) | The shared website and command-line contract for choosing, checking, retaining, and promoting configuration, with one exact Helm proof and one source-neutral YAML record. |
| [config-workshop-ci-report/summary.md](./config-workshop-ci-report/summary.md) | Source-neutral pull-request reports from exact WorkshopResult records, with bounded verdicts, findings, lifecycle requirements, omitted checks, and separate runtime status. |
| [anonymous-oci-ci-proof/summary.md](./anonymous-oci-ci-proof/summary.md) | Anonymous OCI work in GitHub Actions: public package digest, rendered object set, OCI-layout digest, pull-back comparison, and explicit limits. |
| [oci-evidence-chains/summary.md](./oci-evidence-chains/summary.md) | Source-neutral OCI evidence chains for Helm, AICR, cub installer, Kubara, Sveltos, and literal Kubernetes configuration, with missing delivery or observation kept explicit. |
| [redis-upgrade-app-proof/summary.md](./redis-upgrade-app-proof/summary.md) | Live Redis Upgrade App proof: retain a post-render replica change across a chart upgrade, show the two-wave environment impact, promote in sequence, and check one OCI digest on two Argo CD clusters. |
| [redis-public-walkthrough-proof/summary.md](./redis-public-walkthrough-proof/summary.md) | Public Redis walkthrough: anonymously pull two published chart versions, retain the existing-Secret base across the upgrade, keep Secret objects out of both renders, and verify each local OCI output by pulling it back. |
| [eks-inference-sandbox-proof/summary.md](./eks-inference-sandbox-proof/summary.md) | Live ConfigHub configuration proof for eight checked EKS inference OCI bundles: exact sources, linked variants, sandbox gates, and published Releases, without claiming a cloud or Kubernetes deployment. |
| [eks-inference-promotion-delivery-proof/summary.md](./eks-inference-promotion-delivery-proof/summary.md) | Live promotion and delivery proof for one EKS inference configuration change: one field changed, identical dev/staging/delivery Unit hashes, a published OCI Release, the matching Argo CD revision, and two healthy local replicas. |
| [vllm-cpu-starter-proof/summary.md](./vllm-cpu-starter-proof/summary.md) | Live CPU inference proof: two checked Units changed from the EKS inference source, ConfigHub published release OCI, Argo CD pulled the same digest, vLLM became ready, and one real model request completed. |
| [aicr-cpu-starter-public-proof/summary.md](./aicr-cpu-starter-public-proof/summary.md) | Anonymous AICR configuration proof: public source digest, seven reviewed Application hashes, source-and-intent record, local OCI digest, and pull-back comparison without ConfigHub, Kubernetes, cloud, or GPU access. |
| [kubara-oci-delivery-proof/summary.md](./kubara-oci-delivery-proof/summary.md) | Live platform proof: approve a Kubara-generated base in ConfigHub, run its CRD, Secret, and Redis setup work, package the prepared objects as portable OCI, reconcile them with Argo CD, and bring up one selected Metrics Server Application. |
| [sveltos-oci-delivery-proof/summary.md](./sveltos-oci-delivery-proof/summary.md) | Live fleet-platform proof: approve a Sveltos ClusterProfile in ConfigHub, package the approved object as portable OCI, reconcile it with Argo CD, let Sveltos install Kyverno on the matching workload cluster, and repair drift. |
| [chart-evidence-router/summary.md](./chart-evidence-router/summary.md) | Per-chart evidence router: chart-use answer, first base, catalog path, proof lanes, variant revisions, receipts, hooks, quirks, production decisions, and next action. |
| [status-dashboard/next-work-queues.csv](./status-dashboard/next-work-queues.csv) | Machine-readable next work queues for top100 catalog work, top20 production support, live parity, and hook/lifecycle work. |
| [status-dashboard/active-proof-queue.csv](./status-dashboard/active-proof-queue.csv) | Current non-pass live parity rows with the exact support artifact that should be handled before rerun. |
| [status-dashboard/top20-status.csv](./status-dashboard/top20-status.csv) | Compact chart-by-chart status for the top-20 public catalog: recommended base, setup command, base-readiness mix, evidence strength, proof lanes, feature summary, gaps, next action. |
| [top20-base-readiness/start-here.md](./top20-base-readiness/start-here.md) | Short guide to the clean first catalog paths: chart, base, command, and production-support reminder. |
| [top20-base-readiness/summary.md](./top20-base-readiness/summary.md) | One row per top-20 base variant: which bases are good first paths and which need prerequisites, runtime review, or hook lifecycle work. |
| [outcome-coverage/summary.md](./outcome-coverage/summary.md) | Start here. Outcome promises, tests that prove them, and links to the four front-door CSVs. |
| [outcome-coverage/chart-outcomes.csv](./outcome-coverage/chart-outcomes.csv) | One row per chart: model support, production readiness, lane counts, hard gaps, feature summary. |
| [outcome-coverage/base-outcomes.csv](./outcome-coverage/base-outcomes.csv) | One row per chart/base variant: render parity, ConfigHub proof, local live, GitOps/OCI live, live Helm parity. |
| [outcome-coverage/derived-variant-outcomes.csv](./outcome-coverage/derived-variant-outcomes.csv) | One row per derived ConfigHub variant: intended-state proof and target-bound live status. |
| [outcome-coverage/feature-outcomes.csv](./outcome-coverage/feature-outcomes.csv) | One row per chart feature: hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, gaps. |
| [claims-register/summary.md](./claims-register/summary.md) | Claim-to-evidence register: public claims, status, evidence paths, scoped verifiers, and limits. |
| [claims-register/claims.csv](./claims-register/claims.csv) | Spreadsheet form of the claim-to-evidence register. |
| [blast-radius-accuracy/summary.md](./blast-radius-accuracy/summary.md) | Measured blast-radius accuracy seed: predicted affected objects compared with actual committed rerender diffs. |
| [blast-radius-accuracy/cases.csv](./blast-radius-accuracy/cases.csv) | Spreadsheet form of measured and unmeasured value-source-map blast-radius rows. |
| [extension-slots/extension-slots.csv](./extension-slots/extension-slots.csv) | One row per chart with NGINX-like extension slots: scope, built variants, surfaces, route, evidence. |
| [nginx-config-checks/checks.csv](./nginx-config-checks/checks.csv) | NGINX supported-base checks for empty config extension slots, sidecars, metrics, raw objects, and ingress shape. |
| [lifecycle-boundary/summary.md](./lifecycle-boundary/summary.md) | Hook and hook-like lifecycle boundary: hook queue rows, lifecycle observations, evidence, and current limits. |
| [webhook-cert-lifecycle/summary.md](./webhook-cert-lifecycle/summary.md) | Webhook certificate lifecycle evidence: rows where explicit staged certificate material makes a local live workload converge. |
| [hook-coverage/summary.md](./hook-coverage/summary.md) | Top-100 hook coverage bridge: joins source-scan hook rows to maintained hook lifecycle rows and candidate route plans. |
| [apiservice-coverage/summary.md](./apiservice-coverage/summary.md) | Top-100 APIService coverage bridge: separates rendered APIService object evidence from aggregated API availability evidence. |
| [apiservice-coverage/work-orders.md](./apiservice-coverage/work-orders.md) | Assignable APIService proof-wave work orders: KEDA first, source-only import rows next, and Metrics Server keep-fresh pattern. |
| [hook-route-candidates/summary.md](./hook-route-candidates/summary.md) | Candidate hook route plans for source top-100 hook charts that are not yet maintained hook lifecycle queue rows. |
| [hook-route-candidates/work-orders.md](./hook-route-candidates/work-orders.md) | Generated work orders for turning hook route candidates into maintained route receipts, observations, or explicit blockers. |
| [lifecycle-observations/cert-manager-eso/summary.md](./lifecycle-observations/cert-manager-eso/summary.md) | Concrete lifecycle observations for cert-manager and External Secrets: CRD policy, post-apply API readiness, webhook CA injection, and controller-populated Secret data. |
| [live-kind-parity/summary.md](./live-kind-parity/summary.md) | Two-cluster live parity: regular Helm in one vanilla kind cluster and cub installer output in another. |
| [live-matrix-burndown/summary.md](./live-matrix-burndown/summary.md) | Generated live burn-down plan: one row per remaining live-parity or two-cluster kind-parity command needed to close the master matrix live cells. |
| [local-live-triage/summary.md](./local-live-triage/summary.md) | Local Kubernetes non-pass triage: every local live fail/block row mapped to a route class, next action, and receipt. |
| [live-helm-confighub-compare/summary.md](./live-helm-confighub-compare/summary.md) | Selected live Helm-vs-ConfigHub parity: regular Helm compared with ConfigHub delivery for selected top-20 rows. |
| [live-parity-rerun-plan/summary.md](./live-parity-rerun-plan/summary.md) | Rerun queue for non-pass live parity rows: next action, current diagnosis, and exact rerun command. |
| [gitops-health-residue/summary.md](./gitops-health-residue/summary.md) | GitOps controller-health residue: rows where sync/workload evidence can pass while aggregate controller health still needs explanation. |
| [large-config-operations/summary.md](./large-config-operations/summary.md) | Large ConfigHub operation funnel: 50+ object live rows split by runtime, GitOps, target facts, workload convergence, controller health, and missing progress evidence. |
| [production-disposition/summary.md](./production-disposition/summary.md) | Production support boundary for top-20 catalog charts: accepted dispositions, open blockers, and next actions. |
| [production-disposition/dispositions.md](./production-disposition/dispositions.md) | Detailed production disposition plan: accepted receipts, open dispositions, owners, required evidence, and unblock rules. |
| [production-disposition/next-actions.csv](./production-disposition/next-actions.csv) | Production decision work queue: recommended base, decision focus, image digest gap, and next action per top-20 chart. |
| [production-disposition/support-decision-contract.md](./production-disposition/support-decision-contract.md) | Production support decision contract: required fields, current decision states, and the rule for moving from production-review-ready to production-supported. |
| [production-disposition/support-decision-queue.csv](./production-disposition/support-decision-queue.csv) | Pre-review queue showing the candidate production base, support boundary work, and required evidence before target-scoped decisions. |
| [production-support-decisions/summary.md](./production-support-decisions/summary.md) | Target-scoped support decision artifacts: supported, rejected, and superseded decisions, boundaries, evidence state, and next action. |
| [production-support-decisions/work-items.csv](./production-support-decisions/work-items.csv) | One row per production-support task or keep-fresh item: chart, base, work type, status field, priority, action, and source decision. |
| [production-support-decisions/decisions.csv](./production-support-decisions/decisions.csv) | One row per target-scoped support decision artifact: chart, base, decision state, target scope, evidence decision, and next action. |
| [external-scan-lane/chart-workdown.csv](./external-scan-lane/chart-workdown.csv) | Chart-level scan/gate workdown: grouped scanner findings, priority, and next action before production disposition. |
| [scan-disposition-workdown/workdown.csv](./scan-disposition-workdown/workdown.csv) | Scan warning routes: which rows need fixes, hardened bases, explicit security acceptance, runtime endpoint review, or PDB policy decisions. |
| [image-digest-workdown/summary.md](./image-digest-workdown/summary.md) | Image digest workdown: rendered image references that need digest resolution, image overrides, or explicit proof receipts before reproducible production OCI support. |
| [pain-point-coverage/summary.md](./pain-point-coverage/summary.md) | General Helm pain point coverage: current answers, handoffs, evidence, gaps, and next actions. |
| [top100-readiness/summary.md](./top100-readiness/summary.md) | Top-100 readiness: one chart-by-chart answer for workability, adoption bucket, strongest evidence, hard gap, next action, and first work queues. |
| [top100-readiness/next80-queues.md](./top100-readiness/next80-queues.md) | Next80 operating queue: proof-grade non-catalog charts split into promotion review, limitation review, and user-shaped variant work. |
| [top100-coverage/summary.md](./top100-coverage/summary.md) | Top-100 coverage contract result: covered versus partial rows and item-by-item pass/todo breakdown. |
| [top100-coverage/coverage.csv](./top100-coverage/coverage.csv) | One row per top-100 chart: strict coverage contract status, item statuses, evidence paths, and next action. |
| [top100-coverage/work-queue.md](./top100-coverage/work-queue.md) | Top-100 strict coverage work queue: promotion review, user-shaped variants, limitation decisions, and first rows. |
| [top100-coverage/work-queue.csv](./top100-coverage/work-queue.csv) | One row per partial top-100 chart: queue, priority, missing items, first step, done-when rule, evidence, and owner. |
| [top100-coverage/decisions-needed.md](./top100-coverage/decisions-needed.md) | Human decision memos for top-100 limitation-decision rows. |
| [useful-base-design-queue/summary.md](./useful-base-design-queue/summary.md) | Useful base design queue for top-100 charts that are proof-grade but too default-shaped to recommend. |
| [useful-base-design-queue/queue.csv](./useful-base-design-queue/queue.csv) | One row per chart needing a useful base proposal: proposed base shape, user job, render choices, target inputs, and proof required. |
| [useful-base-design-queue/families.csv](./useful-base-design-queue/families.csv) | Grouped useful-base design families for assigning batches of related chart work. |
| [useful-base-realization-wave/summary.md](./useful-base-realization-wave/summary.md) | First wave of useful base proposals made real as recipe variants and cub installer package bases. |
| [useful-base-realization-wave/wave.csv](./useful-base-realization-wave/wave.csv) | One row per realized useful base: strategy, remaining proof work, package base, and recipe variant. |
| [top100-promotion-wave/summary.md](./top100-promotion-wave/summary.md) | First strict top-100 promotion-review wave: proof-grade charts with two-cluster parity that need production disposition and support decisions. |
| [top100-promotion-wave/wave.csv](./top100-promotion-wave/wave.csv) | One row per selected top-100 promotion wave chart: variants, evidence, scan/gate status, first step, and done-when rule. |
| [top100-promotion-wave/wave.yaml](./top100-promotion-wave/wave.yaml) | Machine-readable strict top-100 promotion wave input. |
| [top100-promotion-wave/fast-track.md](./top100-promotion-wave/fast-track.md) | Low-residue top-100 promotion candidates whose remaining work is narrow enough to review quickly. |
| [top100-promotion-wave/fast-track-reviews/README.md](./top100-promotion-wave/fast-track-reviews/README.md) | Review packets for the low-residue top-100 promotion candidates. |
| [top100-promotion-wave/fast-track-reviews/storage-rollback/README.md](./top100-promotion-wave/fast-track-reviews/storage-rollback/README.md) | Storage and rollback review inputs for each fast-track candidate. |
| [top100-promotion-wave/fast-track-reviews/target-scope/README.md](./top100-promotion-wave/fast-track-reviews/target-scope/README.md) | Draft target-scope support decisions for each fast-track candidate. |
| [top100-promotion-wave/work-orders.md](./top100-promotion-wave/work-orders.md) | Assignable chart-by-chart review tasks for the first top-100 promotion wave. |
| [top100-promotion-wave/work-orders.csv](./top100-promotion-wave/work-orders.csv) | Spreadsheet work orders for the first top-100 promotion wave: variant selection, scan/gate, lifecycle, live evidence, and support decision tasks. |
| [refresh-survival/summary.md](./refresh-survival/summary.md) | Latest-version refresh survival: current supported chart versions, upstream update candidates, and promotion gates before replacement. |
| [refresh-survival/refreshes.csv](./refresh-survival/refreshes.csv) | One row per top-20 chart in the latest refresh review: current version, latest version, candidate proof, promotion state, and next action. |
| [latest-top20-refresh/action-queue/summary.md](./latest-top20-refresh/action-queue/summary.md) | Action queue for current top-20 upstream movement: replacement decisions, retained-candidate refreshes, and new-candidate creation. |
| [latest-top20-refresh/action-queue/queue.csv](./latest-top20-refresh/action-queue/queue.csv) | Spreadsheet action queue for latest-refresh work: current version, latest upstream version, retained candidate, priority, command, evidence, and done-when rule. |
| [latest-top20-refresh/action-queue/queue.yaml](./latest-top20-refresh/action-queue/queue.yaml) | Machine-readable latest-refresh action queue. |
| [latest-top20-refresh/promotion-work-orders.md](./latest-top20-refresh/promotion-work-orders.md) | Per-candidate lane closure table for retained proof-complete update candidates. |
| [latest-top20-refresh/promotion-work-orders.csv](./latest-top20-refresh/promotion-work-orders.csv) | Spreadsheet work orders for retained candidates: render proof, ConfigHub proof, local live, live parity, production disposition, catalog/site, and top100/top500 refresh. |
| [latest-top20-refresh/replacement-decisions/summary.md](./latest-top20-refresh/replacement-decisions/summary.md) | Final review queue for retained proof-complete update candidates before any supported catalog version is replaced. |
| [latest-top20-refresh/replacement-decisions/decisions.csv](./latest-top20-refresh/replacement-decisions/decisions.csv) | Spreadsheet replacement-decision queue: current supported version, retained candidate version, latest upstream version, freshness, proof status, evidence, and next action. |
| [latest-top20-refresh/replacement-decisions/decisions.yaml](./latest-top20-refresh/replacement-decisions/decisions.yaml) | Machine-readable replacement-decision queue for the retained proof-complete update candidates. |
| [next-ten-waves/summary.md](./next-ten-waves/summary.md) | Compact next work queues: gap review, latest-version promotion, variant build, production disposition, and import prototypes. |
| [attack-plan-workdown/summary.md](./attack-plan-workdown/summary.md) | Broader execution workdown: import examples, hard gaps, variants, production, runtime/GitOps, latest candidates, and image digests. |
| [top500-catalog-analysis/review.csv](./top500-catalog-analysis/review.csv) | Top-500 evidence map: retained source-scan rows joined to current recipe proof, catalog status, version drift, source features, and next action. |
| [variant-path-coverage/summary.md](./variant-path-coverage/summary.md) | Per chart/base/path matrix for base variants, diffs, operations, and derived ConfigHub variants. |
| [quirk-coverage/summary.md](./quirk-coverage/summary.md) | Coverage audit for Helm quirks: tracked, partly tracked, source-scanned only, or not scanned. |
| [quirk-work-queue/summary.md](./quirk-work-queue/summary.md) | Chart-level work queue for converting public top-100 source-scan quirks into modeled, reviewable, and eventually provable catalog facts. |
| [hard-proof-gaps/summary.md](./hard-proof-gaps/summary.md) | Short assignment surface for the top-100 source-quirk rows most likely to damage trust if overclaimed. |
| [remote-dependency-closure/summary.md](./remote-dependency-closure/summary.md) | Top-100 remote dependency closure map: source-scan dependency risk joined to maintained recipe dependency locks. |
| [high-fanout-demo/summary.md](./high-fanout-demo/summary.md) | Prometheus/kube-prometheus-stack example showing how one base choice changes many objects and prerequisites. |
| [high-fanout-demo/operation-preview.md](./high-fanout-demo/operation-preview.md) | Pre-ship operation preview for kube-prometheus-stack high-fanout inputs: route, reach, guardrail, and next proof. |
| [kps-public-package-proof/summary.md](./kps-public-package-proof/summary.md) | Anonymous pull proof for the public kube-prometheus-stack package, including its checked render and chart-specific CRD and webhook setup files. |
| [edge-recovery/summary.md](./edge-recovery/summary.md) | Recovered graph fragments from catalog-supported recipe artifacts. |
| [csv-index.csv](./csv-index.csv) | Machine-readable index of every CSV under data/. |

The front-door CSVs are intentionally redundant with deeper generated reports.
They join the important evidence into a small set of spreadsheet-friendly
tables. Use the deeper CSVs when you need drill-down.

## CSV Audience Labels

`csv-index.csv` assigns each CSV one audience label. Use the labels to decide
which files are evidence, which files are planning, and which files are
supporting drill-down.

| Audience | Meaning |
| --- | --- |
| `user/front-door` | Start here. These CSVs join the important proof and status data into reader-facing tables. |
| `verification` | Evidence tables for committed proof lanes, live receipts, runtime checks, and parity checks. |
| `corpus` | Maintained chart facts, feature facts, quirk facts, and graph fragments used by the catalog. |
| `planning` | Work queues, promotion reviews, refresh candidates, and future catalog expansion inputs. |
| `supporting` | Secondary generated tables that explain or drill into another summary. Do not cite these as the headline status without following the linked summary. |

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
| Chart facts, quirk facts, or variant metadata | `npm run chart-facts`, `npm run outcomes:generate`, `npm run top100:readiness`, `npm run status:dashboard`, `npm run site:generate` |
| Production support decisions or blockers | `npm run production:disposition`, `npm run production:disposition:details`, `npm run top100:readiness`, `npm run status:dashboard`, `npm run site:generate` |
| Live receipt status | Regenerate the lane summary, then `npm run outcomes:generate`, `npm run status:dashboard`, `npm run site:generate` |
| Per-chart catalog or artifact map inputs | `npm run catalog:maps`, then `npm run catalog:index` if the root catalog view changed |
| CSV files added, removed, or renamed | Run the owner generator first, then `npm run data:index` |

After regenerating, run the same commands with `:verify` where available.
Use `npm run verify` only as the broad release gate after scoped checks pass.

## How To Read Status

| Term | Meaning |
| --- | --- |
| `model-supported` | The chart has a complete, honest model for its declared scope. It is not a live-deployment claim by itself. |
| `render parity` | `cub installer` setup renders the same Kubernetes object set as regular Helm under recorded inputs. |
| `in-ConfigHub` | The rendered objects upload as ConfigHub Units with scan/safe-operation receipts. |
| `local live` | The rendered objects were applied to Kubernetes and observed with workload checks. |
| `GitOps live` | ConfigHub OCI was reconciled by Argo or Flux and observed. |
| `live parity` | A live Helm install was compared with ConfigHub delivery paths. |
| `missing` | No committed receipt for that exact row yet. This is backlog, not failure. |
| `watch` | A committed receipt exists and the lane produced useful evidence, but runtime, storage, controller-health, initialization, or operating policy still needs review. |
| `blocked` | A committed receipt exists, but a target prerequisite, lifecycle route, hook decision, Secret, CRD, storage class, or similar condition must be resolved before the row can pass. |
| `fail` | A committed receipt records a failed check. Read the reason before treating it as a ConfigHub-vs-Helm defect. |

## Dataset Families

| Family | Main summary | Primary use |
| --- | --- | --- |
| `adversarial10` | [adversarial10/summary.md](./adversarial10/summary.md) | hard-chart readiness and control-point analysis |
| `apiservice-coverage` | [apiservice-coverage/summary.md](./apiservice-coverage/summary.md) | top-100 APIService coverage joined across source scan, modeled recipe rows, parity evidence, and runtime observations |
| `app-readiness` | [app-readiness/summary.md](./app-readiness/summary.md) | supporting generated evidence |
| `attack-plan-workdown` | [attack-plan-workdown/summary.md](./attack-plan-workdown/summary.md) | execution workdown across gaps and proof lanes |
| `base-variant-records` | [base-variant-records/summary.md](./base-variant-records/summary.md) | supporting generated evidence |
| `bitnami-successors` | - | supporting generated evidence |
| `blast-radius-accuracy` | [blast-radius-accuracy/summary.md](./blast-radius-accuracy/summary.md) | front-door measured blast-radius accuracy seed and backlog |
| `blast-radius-fleet` | [blast-radius-fleet/summary.md](./blast-radius-fleet/summary.md) | supporting generated evidence |
| `capability-profile-witnesses` | - | supporting generated evidence |
| `catalog-promotion-review` | [catalog-promotion-review/summary.md](./catalog-promotion-review/summary.md) | catalog promotion worksheet for the 100-chart corpus |
| `catalog-promotion-wave2` | [catalog-promotion-wave2/summary.md](./catalog-promotion-wave2/summary.md) | older user-shaped variant work-order worksheet |
| `certified-bundles` | [certified-bundles/summary.md](./certified-bundles/summary.md) | shared certified-bundle receipts: one reference bundle per producer with quirk dispositions and flattening-safety verdict lanes |
| `challenge-intake` | [challenge-intake/summary.md](./challenge-intake/summary.md) | supporting generated evidence |
| `chart-claim-integrity-audit-2026-06-22` | [chart-claim-integrity-audit-2026-06-22/summary.md](./chart-claim-integrity-audit-2026-06-22/summary.md) | supporting generated evidence |
| `chart-evidence-router` | [chart-evidence-router/summary.md](./chart-evidence-router/summary.md) | front-door per-chart evidence router across bases, receipts, hooks, quirks, and decisions |
| `chart-fact-sheets` | [chart-fact-sheets/summary.md](./chart-fact-sheets/summary.md) | supporting generated evidence |
| `chart-facts` | [chart-facts/summary.md](./chart-facts/summary.md) | per-chart feature, quirk, and hard-gap facts |
| `chart-skills` | [chart-skills/summary.md](./chart-skills/summary.md) | advisory chart-to-skill mapping: which docs/skills/ playbooks apply to each chart and why |
| `chart-use-guide` | [chart-use-guide/summary.md](./chart-use-guide/summary.md) | front-door can-I-use-this-chart guide |
| `claims-register` | [claims-register/summary.md](./claims-register/summary.md) | front-door public claim-to-evidence register |
| `confighub-example-guides` | [confighub-example-guides/summary.md](./confighub-example-guides/summary.md) | supporting generated evidence |
| `coverage-completion-plan` | [coverage-completion-plan/summary.md](./coverage-completion-plan/summary.md) | ranked plan to 100% verified matrix disposition: non-green cells collapsed into action families by cells-cleared-per-action, owner lane, expected status, and linked issues, with variant promotion as a first-class family |
| `cub-adoption-caveats` | [cub-adoption-caveats/summary.md](./cub-adoption-caveats/summary.md) | supporting generated evidence |
| `cub-scout-diff` | [cub-scout-diff/summary.md](./cub-scout-diff/summary.md) | supporting generated evidence |
| `data-index` | - | CSV index and generated data guide |
| `derived-variant-target-bound` | [derived-variant-target-bound/summary.md](./derived-variant-target-bound/summary.md) | derived ConfigHub variants with target/live evidence |
| `disposition-frontier` | [disposition-frontier/summary.md](./disposition-frontier/summary.md) | supporting generated evidence |
| `doc-freshness` | [doc-freshness/summary.md](./doc-freshness/summary.md) | supporting generated evidence |
| `edge-recovery` | [edge-recovery/summary.md](./edge-recovery/summary.md) | recovered desired-state graph fragments |
| `environment-matrix` | [environment-matrix/summary.md](./environment-matrix/summary.md) | supporting generated evidence |
| `extension-slots` | [extension-slots/summary.md](./extension-slots/summary.md) | NGINX-like extension-slot coverage and routing |
| `external-scan-lane` | [external-scan-lane/summary.md](./external-scan-lane/summary.md) | external scanner lane review output |
| `flattening-safety` | [flattening-safety/summary.md](./flattening-safety/summary.md) | per-chart flattening-safety verdicts: template-level witness scans and the receipted lane deciding render-early vs render-late |
| `gitops-health-residue` | [gitops-health-residue/summary.md](./gitops-health-residue/summary.md) | ConfigHub OCI/GitOps controller-health residue classification |
| `gitops-route-emission` | [gitops-route-emission/summary.md](./gitops-route-emission/summary.md) | supporting generated evidence |
| `hard-chart-production-packets` | [hard-chart-production-packets/summary.md](./hard-chart-production-packets/summary.md) | supporting generated evidence |
| `hard-proof-gaps` | [hard-proof-gaps/summary.md](./hard-proof-gaps/summary.md) | hard top-100 proof gaps joined across quirk, hook, and dependency queues |
| `helm-catalog-readmes` | [helm-catalog-readmes/summary.md](./helm-catalog-readmes/summary.md) | supporting generated evidence |
| `helm-org` | [helm-org/summary.md](./helm-org/summary.md) | supporting generated evidence |
| `helm-render-intents` | [helm-render-intents/summary.md](./helm-render-intents/summary.md) | ConfigHub-facing render-intent objects generated only for real base variants, with the proof chain attached |
| `high-fanout-demo` | [high-fanout-demo/summary.md](./high-fanout-demo/summary.md) | Prometheus base-variant fanout and prerequisite example |
| `hook-coverage` | [hook-coverage/summary.md](./hook-coverage/summary.md) | top-100 source hook coverage joined across maintained lifecycle rows and candidate route plans |
| `hook-disposition` | [hook-disposition/summary.md](./hook-disposition/summary.md) | supporting generated evidence |
| `hook-lifecycle` | [hook-lifecycle/summary.md](./hook-lifecycle/summary.md) | hook-bearing charts and required lifecycle receipt paths |
| `hook-lifecycle-review` | [hook-lifecycle-review/summary.md](./hook-lifecycle-review/summary.md) | supporting generated evidence |
| `hook-route-candidates` | [hook-route-candidates/summary.md](./hook-route-candidates/summary.md) | candidate hook route plans before maintained lifecycle queue admission |
| `image-digest-workdown` | [image-digest-workdown/summary.md](./image-digest-workdown/summary.md) | image pinning and mutable tag review |
| `installer-oci-packages` | [installer-oci-packages/summary.md](./installer-oci-packages/summary.md) | public installer package OCI refs and consumer setup commands for chart packages |
| `installer-package-signatures` | [installer-package-signatures/summary.md](./installer-package-signatures/summary.md) | supporting generated evidence |
| `kind-parity-decisions` | [kind-parity-decisions/summary.md](./kind-parity-decisions/summary.md) | product-readable decisions for non-pass two-cluster kind-parity rows: residue category, who owns the fix, usable-today answer, and next action |
| `kubara-catalog-1.1-full-coverage` | - | supporting generated evidence |
| `kubara-catalog-refresh` | - | supporting generated evidence |
| `kubara-platform-matrix` | [kubara-platform-matrix/summary.md](./kubara-platform-matrix/summary.md) | supporting generated evidence |
| `kubara-wiring` | [kubara-wiring/summary.md](./kubara-wiring/summary.md) | supporting generated evidence |
| `large-config-operations` | [large-config-operations/summary.md](./large-config-operations/summary.md) | large ConfigHub upload/apply/GitOps operation funnel and progress-evidence gaps |
| `latest-top20-refresh` | [latest-top20-refresh/summary.md](./latest-top20-refresh/summary.md) | latest upstream chart-version refresh candidates |
| `legacy-patch-review` | [legacy-patch-review/summary.md](./legacy-patch-review/summary.md) | older chart-version patch support review |
| `lifecycle-boundary` | [lifecycle-boundary/summary.md](./lifecycle-boundary/summary.md) | hook queue and hook-like lifecycle observation boundary |
| `lifecycle-observations` | [lifecycle-observations/cert-manager-eso/summary.md](./lifecycle-observations/cert-manager-eso/summary.md) | controller-owned or hook-like lifecycle observations |
| `lifecycle-route-actions` | [lifecycle-route-actions/summary.md](./lifecycle-route-actions/summary.md) | hook/lifecycle routes projected into machine-readable action packets: phase, action kind, required facts, evidence required, and an explicit automatic flag |
| `lifecycle-routes` | [lifecycle-routes/summary.md](./lifecycle-routes/summary.md) | machine-readable lifecycle route contract: disposition, route, execution mode, default, alternatives, and human/agent off-ramps |
| `lifecycle-routes-by-variant` | [lifecycle-routes-by-variant/summary.md](./lifecycle-routes-by-variant/summary.md) | supporting generated evidence |
| `live-e2e` | [live-e2e/summary.md](./live-e2e/summary.md) | top-20 local kind runtime status |
| `live-helm-confighub-compare` | [live-helm-confighub-compare/summary.md](./live-helm-confighub-compare/summary.md) | strict live Helm-vs-ConfigHub parity |
| `live-kind-parity` | [live-kind-parity/summary.md](./live-kind-parity/summary.md) | two-cluster kind parity receipts |
| `live-matrix-burndown` | [live-matrix-burndown/summary.md](./live-matrix-burndown/summary.md) | supporting generated evidence |
| `live-parity-decisions` | [live-parity-decisions/summary.md](./live-parity-decisions/summary.md) | product-readable decisions for non-pass ConfigHub OCI + live Helm-vs-ConfigHub (G/P-lane) rows: residue category, who owns the fix, usable-today answer, next action, and support artifact |
| `live-parity-rerun-plan` | [live-parity-rerun-plan/summary.md](./live-parity-rerun-plan/summary.md) | rerun queue for non-pass live parity rows |
| `live-run-blocks` | [live-run-blocks/summary.md](./live-run-blocks/summary.md) | read-only run-block plan for the ready-to-run todo rows: small ordered blocks (G/P before K, hard charts first) with a derived (never claimed) predicted residue family and target profile per row |
| `local-live-triage` | [local-live-triage/summary.md](./local-live-triage/summary.md) | front-door local live non-pass route classes and next actions |
| `master-catalog-matrix` | [master-catalog-matrix/summary.md](./master-catalog-matrix/summary.md) | supporting generated evidence |
| `matrix-completion-audit` | [matrix-completion-audit/summary.md](./matrix-completion-audit/summary.md) | read-only audit of every non-green/not-yet-run matrix cell with lane, state, reason, next action, support artifact, and a completion class separating needs-run from needs-fix from needs-modeling from already-decided |
| `model-completeness` | [model-completeness/summary.md](./model-completeness/summary.md) | chart-level model support criteria |
| `model-gap-workdown` | [model-gap-workdown/summary.md](./model-gap-workdown/summary.md) | catalog-owned model gaps: non-pass rows needing a recipe/base change (not a re-run), classified by gap kind with a recommended action, owner class, and any sibling base that already passes |
| `model-prereq-resolution` | [model-prereq-resolution/summary.md](./model-prereq-resolution/summary.md) | front-door resolution bridge for B1/B2 rows: each model gap and target prerequisite mapped to a new base variant, existing sibling base, derived target variant, target-scoped policy, or operator review |
| `next-ten-waves` | [next-ten-waves/summary.md](./next-ten-waves/summary.md) | compact next work queues |
| `next80-full-proofs` | [next80-full-proofs/summary.md](./next80-full-proofs/summary.md) | 80 additional full proof-grade chart artifacts |
| `nginx-config-checks` | [nginx-config-checks/summary.md](./nginx-config-checks/summary.md) | NGINX supported-base config extension checks |
| `oci-evidence-chains` | [oci-evidence-chains/summary.md](./oci-evidence-chains/summary.md) | source-neutral records linking source digest, reviewed configuration, ConfigHub record, output OCI, delivery, and observation |
| `outcome-coverage` | [outcome-coverage/summary.md](./outcome-coverage/summary.md) | front-door outcome, test, and status map |
| `outcome-evidence-contract` | [outcome-evidence-contract/summary.md](./outcome-evidence-contract/summary.md) | supporting generated evidence |
| `pain-point-coverage` | [pain-point-coverage/summary.md](./pain-point-coverage/summary.md) | front-door Helm pain point coverage map |
| `per-chart-hooks` | [per-chart-hooks/summary.md](./per-chart-hooks/summary.md) | supporting generated evidence |
| `persona-ux-guide-audit-2026-06-22` | [persona-ux-guide-audit-2026-06-22/summary.md](./persona-ux-guide-audit-2026-06-22/summary.md) | supporting generated evidence |
| `preview-readiness` | [preview-readiness/summary.md](./preview-readiness/summary.md) | supporting generated evidence |
| `production-disposition` | [production-disposition/summary.md](./production-disposition/summary.md) | top-20 production blockers and next actions |
| `production-support-decisions` | [production-support-decisions/summary.md](./production-support-decisions/summary.md) | target-scoped production support decision artifacts |
| `quirk-coverage` | [quirk-coverage/summary.md](./quirk-coverage/summary.md) | Helm quirk-axis coverage audit |
| `quirk-inventory-audit` | [quirk-inventory-audit/summary.md](./quirk-inventory-audit/summary.md) | supporting generated evidence |
| `quirk-review-queue` | [quirk-review-queue/summary.md](./quirk-review-queue/summary.md) | queue for chart quirks needing human or product review |
| `quirk-work-queue` | [quirk-work-queue/summary.md](./quirk-work-queue/summary.md) | source-scan quirk work queue for top-100 charts |
| `receipt-aging` | [receipt-aging/summary.md](./receipt-aging/summary.md) | how old every committed receipt is, measured against the newest one, with the count that carry no date at all |
| `refresh-survival` | [refresh-survival/summary.md](./refresh-survival/summary.md) | latest-version refresh survival and upgrade seed |
| `remote-dependency-closure` | [remote-dependency-closure/summary.md](./remote-dependency-closure/summary.md) | remote dependency closure map for top-100 charts |
| `remote-image-runtime-workdown` | [remote-image-runtime-workdown/summary.md](./remote-image-runtime-workdown/summary.md) | product/base decisions for the remote-image watch rows: exact missing image, where it fails, recommended action (refresh / override / pin-mirror / lifecycle-route / watch / refuse), and owner class |
| `runtime-gitops` | [runtime-gitops/summary.md](./runtime-gitops/summary.md) | Argo/Flux OCI live proof wave |
| `scan-disposition-workdown` | [scan-disposition-workdown/summary.md](./scan-disposition-workdown/summary.md) | scan warning routes to fixes, hardened bases, or explicit dispositions |
| `secret-lifecycle` | [secret-lifecycle/summary.md](./secret-lifecycle/summary.md) | front-door Secret handling survey for rendered Secrets, target facts, and lifecycle state |
| `serious-chart-reviews` | - | supporting generated evidence |
| `site-agent-reviews-2026-08-23-three-click` | [site-agent-reviews-2026-08-23-three-click/summary.md](./site-agent-reviews-2026-08-23-three-click/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-13` | [site-persona-simulations-2026-08-13/summary.md](./site-persona-simulations-2026-08-13/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-13-after` | [site-persona-simulations-2026-08-13-after/summary.md](./site-persona-simulations-2026-08-13-after/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-13-question-journeys` | [site-persona-simulations-2026-08-13-question-journeys/summary.md](./site-persona-simulations-2026-08-13-question-journeys/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-21` | [site-persona-simulations-2026-08-21/summary.md](./site-persona-simulations-2026-08-21/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-21-after` | [site-persona-simulations-2026-08-21-after/summary.md](./site-persona-simulations-2026-08-21-after/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-21-final` | [site-persona-simulations-2026-08-21-final/summary.md](./site-persona-simulations-2026-08-21-final/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-22-model-final` | [site-persona-simulations-2026-08-22-model-final/summary.md](./site-persona-simulations-2026-08-22-model-final/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-22-model-v2` | [site-persona-simulations-2026-08-22-model-v2/summary.md](./site-persona-simulations-2026-08-22-model-v2/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-23-change-workflow` | [site-persona-simulations-2026-08-23-change-workflow/summary.md](./site-persona-simulations-2026-08-23-change-workflow/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-23-three-click` | [site-persona-simulations-2026-08-23-three-click/summary.md](./site-persona-simulations-2026-08-23-three-click/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-23-three-click-after` | [site-persona-simulations-2026-08-23-three-click-after/summary.md](./site-persona-simulations-2026-08-23-three-click-after/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-24-command-contract-final` | [site-persona-simulations-2026-08-24-command-contract-final/summary.md](./site-persona-simulations-2026-08-24-command-contract-final/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-24-managed-promotion` | [site-persona-simulations-2026-08-24-managed-promotion/summary.md](./site-persona-simulations-2026-08-24-managed-promotion/summary.md) | supporting generated evidence |
| `site-persona-simulations-2026-08-24-managed-promotion-final` | [site-persona-simulations-2026-08-24-managed-promotion-final/summary.md](./site-persona-simulations-2026-08-24-managed-promotion-final/summary.md) | supporting generated evidence |
| `status-dashboard` | [status-dashboard/summary.md](./status-dashboard/summary.md) | one-page front-door status dashboard |
| `successor-track` | [successor-track/summary.md](./successor-track/summary.md) | supporting generated evidence |
| `sveltos-bulk-ops` | [sveltos-bulk-ops/summary.md](./sveltos-bulk-ops/summary.md) | supporting generated evidence |
| `sveltos-cve-patch` | [sveltos-cve-patch/summary.md](./sveltos-cve-patch/summary.md) | supporting generated evidence |
| `sveltos-env-rollout` | [sveltos-env-rollout/summary.md](./sveltos-env-rollout/summary.md) | supporting generated evidence |
| `target-prerequisite-actions` | [target-prerequisite-actions/summary.md](./target-prerequisite-actions/summary.md) | action packets: per non-green row, what to stage before rerunning (action_kind), the required inputs, the evidence to look for after staging, and the rerun command; automatic=false (preflight plan, not automation) |
| `target-prerequisite-workdown` | [target-prerequisite-workdown/summary.md](./target-prerequisite-workdown/summary.md) | target/user prerequisites: non-pass rows needing a CRD/Namespace/Secret/storage/external-API/topology staged on the target (not a model change), with the exact prerequisite name, owner class, and next action |
| `top100-catalog-analysis` | [top100-catalog-analysis/summary.md](./top100-catalog-analysis/summary.md) | top-100 proof and promotion surface |
| `top100-coverage` | [top100-coverage/summary.md](./top100-coverage/summary.md) | front-door top-100 coverage contract and work queue |
| `top100-promotion-wave` | [top100-promotion-wave/summary.md](./top100-promotion-wave/summary.md) | first strict top-100 promotion-review wave |
| `top100-readiness` | [top100-readiness/summary.md](./top100-readiness/summary.md) | front-door top-100 user readiness and evidence summary |
| `top100-user-readiness` | [top100-user-readiness/summary.md](./top100-user-readiness/summary.md) | front-door top-100 user-language readiness, prerequisites, first base, and next action |
| `top20-base-readiness` | [top20-base-readiness/summary.md](./top20-base-readiness/summary.md) | top-20 base-variant readiness and first-path guidance |
| `top50-completion` | [top50-completion/summary.md](./top50-completion/summary.md) | front-door fifty-task programme status, evidence, and completion queue |
| `top500-catalog-analysis` | [top500-catalog-analysis/summary.md](./top500-catalog-analysis/summary.md) | top-500 catalog planning analysis |
| `torture-suite` | [torture-suite/summary.md](./torture-suite/summary.md) | supporting generated evidence |
| `upstream-drift` | [upstream-drift/summary.md](./upstream-drift/summary.md) | supporting generated evidence |
| `upstream-provenance` | [upstream-provenance/summary.md](./upstream-provenance/summary.md) | supporting generated evidence |
| `useful-base-design-queue` | [useful-base-design-queue/summary.md](./useful-base-design-queue/summary.md) | front-door proposed useful-base queue for default-shaped top-100 charts |
| `useful-base-realization-wave` | [useful-base-realization-wave/summary.md](./useful-base-realization-wave/summary.md) | front-door useful-base proposals made real as candidate recipe/package bases |
| `variant-backlog` | [variant-backlog/summary.md](./variant-backlog/summary.md) | candidate base-variant expansion backlog |
| `variant-goldens` | - | golden work orders for derived-variant examples |
| `variant-path-coverage` | [variant-path-coverage/summary.md](./variant-path-coverage/summary.md) | chart/base/path proof status matrix |
| `variant-promotion` | [variant-promotion/summary.md](./variant-promotion/summary.md) | server-side ConfigHub variant promotion status by chart/base |
| `variant-promotion-closeout` | [variant-promotion-closeout/summary.md](./variant-promotion-closeout/summary.md) | actionable promotion queue: per variant, whether cub variant promote is ready-to-run, watch-grade pending receipt rerun, or blocked by a proof prerequisite, the owner class, and the exact next command or fix |
| `variant-promotion-proof-batches` | [variant-promotion-proof-batches/summary.md](./variant-promotion-proof-batches/summary.md) | run plan: the ready-to-run promotions grouped into safe serial batches of 5-10 cub variant promote proof commands to run once ConfigHub auth returns (not completed evidence) |
| `variant-revision-digests` | [variant-revision-digests/summary.md](./variant-revision-digests/summary.md) | supporting generated evidence |
| `webhook-cert-lifecycle` | [webhook-cert-lifecycle/summary.md](./webhook-cert-lifecycle/summary.md) | webhook serving certificate lifecycle evidence and proof boundaries |

## Every CSV

The complete CSV list is generated at:

~~~text
data/csv-index.csv
~~~

It includes 222 CSV files. Each row records the path, audience,
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
