# Doc Freshness — when to update the authored docs

The corpus's generated docs cannot go stale silently: their verifiers fail
the build. The authored docs (README, docs/) CAN — they describe evidence
that keeps moving. This snapshot answers "which authored doc needs review
right now": a doc is **review-due** when an evidence source it links to
(under `data`, `scripts`, `tests`, `recipes`, `packages`, `CATALOG.md`)
changed more recently than the doc itself.

Colored rendering: [freshness.html](freshness.html) (open in a browser).
Snapshot as of 2026-06-11 (commit `4b69b1bb`). Refresh with `npm run doc-freshness` — cheap, ride
it on any docs PR. The verifier gates completeness (every authored doc is in
the snapshot) without breaking the build as history moves.

Two ways to clear a review-due row, both legitimate: **edit the doc** (its
last-changed date advances), or **acknowledge it** in
[reviewed.csv](reviewed.csv) with a `doc,reviewed_on,note` row saying it was
reviewed and is still accurate. Acknowledgments exist so docs that link
fast-churning dashboards do not sit permanently red until someone makes a
cosmetic edit.

## Current Status

| Metric | Count |
| --- | ---: |
| Authored docs tracked | 157 |
| Fresh (no linked source newer than the doc) | 19 |
| **Review-due** | 22 |
| No linked evidence sources (cannot auto-trigger) | 116 |

## Review queue

Sorted by how far behind the doc is. "Newer sources" shows up to the three
most recently changed triggers.

| Doc | Area | Doc last changed | Days behind | Newer sources |
| --- | --- | --- | ---: | --- |
| [docs/planning/helm-community-persona-plan.md](../../docs/planning/helm-community-persona-plan.md) | planning | 2026-06-10 | 2 | `data/live-kind-parity/summary.md (2026-06-11)` |
| [docs/user/helm-pain-points.md](../../docs/user/helm-pain-points.md) | user | 2026-06-10 | 2 | `data/outcome-coverage/base-outcomes.csv (2026-06-11)`<br>`data/variant-path-coverage/coverage-matrix.csv (2026-06-11)`<br>`data/pain-point-coverage/pain-points.csv (2026-06-10)` |
| [docs/user/verify-it-yourself.md](../../docs/user/verify-it-yourself.md) | user | 2026-06-10 | 2 | `data/live-kind-parity/summary.md (2026-06-11)` |
| [docs/planning/agreed-execution-plan.md](../../docs/planning/agreed-execution-plan.md) | planning | 2026-06-11 | 1 | `data/status-dashboard/summary.md (2026-06-11)`<br>`data/outcome-coverage/summary.md (2026-06-11)` |
| [docs/planning/current-handover.md](../../docs/planning/current-handover.md) | planning | 2026-06-11 | 1 | `data/outcome-coverage/summary.md (2026-06-11)` |
| [docs/planning/large-machine-handover.md](../../docs/planning/large-machine-handover.md) | planning | 2026-06-11 | 1 | `data/outcome-coverage/summary.md (2026-06-11)` |
| [docs/planning/next-20-tasks.md](../../docs/planning/next-20-tasks.md) | planning | 2026-06-11 | 1 | `data/outcome-coverage/summary.md (2026-06-11)` |
| [docs/planning/next-execution-plan.md](../../docs/planning/next-execution-plan.md) | planning | 2026-06-11 | 1 | `data/status-dashboard/summary.md (2026-06-11)`<br>`data/outcome-coverage/summary.md (2026-06-11)`<br>`data/production-support-decisions/work-items.csv (2026-06-11)` |
| [docs/planning/outside-user-test.md](../../docs/planning/outside-user-test.md) | planning | 2026-06-10 | 1 | `data/top100-coverage/summary.md (2026-06-10)` |
| [docs/planning/upgrade-story-plan.md](../../docs/planning/upgrade-story-plan.md) | planning | 2026-06-10 | 1 | `data/refresh-survival/kube-prometheus-stack-upgrade-seed.md (2026-06-10)` |
| [docs/reference/top100-user-readiness.md](../../docs/reference/top100-user-readiness.md) | reference | 2026-06-10 | 1 | `data/top100-readiness/readiness.csv (2026-06-11)`<br>`data/top20-base-readiness/base-readiness.csv (2026-06-11)`<br>`data/top100-readiness/summary.md (2026-06-11)` |
| [docs/user/current-proof-status.md](../../docs/user/current-proof-status.md) | user | 2026-06-11 | 1 | `data/status-dashboard/summary.md (2026-06-11)`<br>`data/outcome-coverage/summary.md (2026-06-11)`<br>`data/status-dashboard/top20-status.csv (2026-06-11)` |
| [docs/user/hook-lifecycle-strategy.md](../../docs/user/hook-lifecycle-strategy.md) | user | 2026-06-10 | 1 | `data/lifecycle-boundary/summary.md (2026-06-11)` |
| [docs/user/live-parity.md](../../docs/user/live-parity.md) | user | 2026-06-11 | 1 | `data/live-kind-parity/summary.md (2026-06-11)` |
| [docs/user/outcomes-and-tests.md](../../docs/user/outcomes-and-tests.md) | user | 2026-06-11 | 1 | `data/README.md (2026-06-11)`<br>`data/csv-index.csv (2026-06-11)`<br>`data/status-dashboard/status.csv (2026-06-11)` |
| [docs/user/production-support-decisions.md](../../docs/user/production-support-decisions.md) | user | 2026-06-11 | 1 | `data/production-support-decisions/decisions.csv (2026-06-11)`<br>`data/production-support-decisions/summary.md (2026-06-11)`<br>`data/production-support-decisions/work-items.csv (2026-06-11)` |
| [docs/user/top100-readiness.md](../../docs/user/top100-readiness.md) | user | 2026-06-10 | 1 | `data/outcome-coverage/base-outcomes.csv (2026-06-11)`<br>`data/top100-readiness/readiness.csv (2026-06-11)`<br>`data/top100-readiness/next80-queues.csv (2026-06-11)` |
| [docs/user/top100-status.md](../../docs/user/top100-status.md) | user | 2026-06-10 | 1 | `data/top100-readiness/summary.md (2026-06-11)`<br>`data/top20-base-readiness/start-here.md (2026-06-11)`<br>`data/top100-user-readiness/summary.md (2026-06-11)` |
| [docs/user/verification-lanes.md](../../docs/user/verification-lanes.md) | user | 2026-06-11 | 1 | `data/outcome-coverage/summary.md (2026-06-11)` |
| [docs/user/what-we-refuse-to-claim.md](../../docs/user/what-we-refuse-to-claim.md) | user | 2026-06-10 | 1 | `data/live-e2e/cub-scout-watchlist.md (2026-06-11)`<br>`data/live-e2e/normalization-rules.md (2026-06-10)` |
| [docs/user/what-you-get.md](../../docs/user/what-you-get.md) | user | 2026-06-10 | 1 | `data/edge-recovery/summary.md (2026-06-11)` |
| [docs/user/why-this-does-not-collapse.md](../../docs/user/why-this-does-not-collapse.md) | user | 2026-06-10 | 1 | `data/live-e2e/cub-scout-watchlist.md (2026-06-11)`<br>`data/quirk-coverage/summary.md (2026-06-10)`<br>`data/live-e2e/normalization-rules.md (2026-06-10)` |

## Docs with no linked evidence sources

These cannot be auto-triggered by source changes. Either they are timeless,
or they should link the evidence they describe — linking is what wires a doc
into this freshness model.

- [docs/corpus/known-adversarial-charts.md](../../docs/corpus/known-adversarial-charts.md)
- [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md)
- [docs/demo/argo-cd/confighub-proof-transcript.md](../../docs/demo/argo-cd/confighub-proof-transcript.md)
- [docs/demo/argo-cd/confighub-proof.md](../../docs/demo/argo-cd/confighub-proof.md)
- [docs/demo/cert-manager/confighub-proof-transcript.md](../../docs/demo/cert-manager/confighub-proof-transcript.md)
- [docs/demo/cert-manager/confighub-proof.md](../../docs/demo/cert-manager/confighub-proof.md)
- [docs/demo/consul/confighub-proof-transcript.md](../../docs/demo/consul/confighub-proof-transcript.md)
- [docs/demo/consul/confighub-proof.md](../../docs/demo/consul/confighub-proof.md)
- [docs/demo/external-secrets/confighub-proof-transcript.md](../../docs/demo/external-secrets/confighub-proof-transcript.md)
- [docs/demo/external-secrets/confighub-proof.md](../../docs/demo/external-secrets/confighub-proof.md)
- [docs/demo/grafana/confighub-proof-transcript.md](../../docs/demo/grafana/confighub-proof-transcript.md)
- [docs/demo/grafana/confighub-proof.md](../../docs/demo/grafana/confighub-proof.md)
- [docs/demo/ingress-nginx/confighub-proof-transcript.md](../../docs/demo/ingress-nginx/confighub-proof-transcript.md)
- [docs/demo/ingress-nginx/confighub-proof.md](../../docs/demo/ingress-nginx/confighub-proof.md)
- [docs/demo/kube-prometheus-stack/confighub-proof-transcript.md](../../docs/demo/kube-prometheus-stack/confighub-proof-transcript.md)
- [docs/demo/kube-prometheus-stack/confighub-proof.md](../../docs/demo/kube-prometheus-stack/confighub-proof.md)
- [docs/demo/loki/confighub-proof-transcript.md](../../docs/demo/loki/confighub-proof-transcript.md)
- [docs/demo/loki/confighub-proof.md](../../docs/demo/loki/confighub-proof.md)
- [docs/demo/longhorn/confighub-proof-transcript.md](../../docs/demo/longhorn/confighub-proof-transcript.md)
- [docs/demo/longhorn/confighub-proof.md](../../docs/demo/longhorn/confighub-proof.md)
- [docs/demo/metrics-server/confighub-proof-transcript.md](../../docs/demo/metrics-server/confighub-proof-transcript.md)
- [docs/demo/metrics-server/confighub-proof.md](../../docs/demo/metrics-server/confighub-proof.md)
- [docs/demo/mongodb/confighub-proof-transcript.md](../../docs/demo/mongodb/confighub-proof-transcript.md)
- [docs/demo/mongodb/confighub-proof.md](../../docs/demo/mongodb/confighub-proof.md)
- [docs/demo/mysql/confighub-proof-transcript.md](../../docs/demo/mysql/confighub-proof-transcript.md)
- [docs/demo/mysql/confighub-proof.md](../../docs/demo/mysql/confighub-proof.md)
- [docs/demo/nginx/confighub-proof-plan.md](../../docs/demo/nginx/confighub-proof-plan.md)
- [docs/demo/nginx/confighub-proof-transcript.md](../../docs/demo/nginx/confighub-proof-transcript.md)
- [docs/demo/nginx/confighub-proof.md](../../docs/demo/nginx/confighub-proof.md)
- [docs/demo/postgresql/confighub-proof-transcript.md](../../docs/demo/postgresql/confighub-proof-transcript.md)
- [docs/demo/postgresql/confighub-proof.md](../../docs/demo/postgresql/confighub-proof.md)
- [docs/demo/prometheus/confighub-proof-transcript.md](../../docs/demo/prometheus/confighub-proof-transcript.md)
- [docs/demo/prometheus/confighub-proof.md](../../docs/demo/prometheus/confighub-proof.md)
- [docs/demo/rabbitmq/confighub-proof-transcript.md](../../docs/demo/rabbitmq/confighub-proof-transcript.md)
- [docs/demo/rabbitmq/confighub-proof.md](../../docs/demo/rabbitmq/confighub-proof.md)
- [docs/demo/redis/confighub-proof-transcript.md](../../docs/demo/redis/confighub-proof-transcript.md)
- [docs/demo/redis/confighub-proof.md](../../docs/demo/redis/confighub-proof.md)
- [docs/demo/redis/demo-script.md](../../docs/demo/redis/demo-script.md)
- [docs/demo/redis/function-scan-lane.md](../../docs/demo/redis/function-scan-lane.md)
- [docs/demo/redis/safe-ops-lane.md](../../docs/demo/redis/safe-ops-lane.md)
- [docs/demo/redis/ux-acceptance.md](../../docs/demo/redis/ux-acceptance.md)
- [docs/demo/secrets-store-csi-driver/confighub-proof-transcript.md](../../docs/demo/secrets-store-csi-driver/confighub-proof-transcript.md)
- [docs/demo/secrets-store-csi-driver/confighub-proof.md](../../docs/demo/secrets-store-csi-driver/confighub-proof.md)
- [docs/demo/tempo/confighub-proof-transcript.md](../../docs/demo/tempo/confighub-proof-transcript.md)
- [docs/demo/tempo/confighub-proof.md](../../docs/demo/tempo/confighub-proof.md)
- [docs/demo/vault/confighub-proof-transcript.md](../../docs/demo/vault/confighub-proof-transcript.md)
- [docs/demo/vault/confighub-proof.md](../../docs/demo/vault/confighub-proof.md)
- [docs/planning/blog-posts.md](../../docs/planning/blog-posts.md)
- [docs/planning/catalog-promotion-next-candidates.md](../../docs/planning/catalog-promotion-next-candidates.md)
- [docs/planning/catalog-promotion-review.md](../../docs/planning/catalog-promotion-review.md)
- [docs/planning/corpus-rationalization-plan.md](../../docs/planning/corpus-rationalization-plan.md)
- [docs/planning/dedicated-website-plan.md](../../docs/planning/dedicated-website-plan.md)
- [docs/planning/helm-community-persona-prd.md](../../docs/planning/helm-community-persona-prd.md)
- [docs/planning/independent-review-brief.md](../../docs/planning/independent-review-brief.md)
- [docs/planning/issue-backlog.md](../../docs/planning/issue-backlog.md)
- [docs/planning/latest-top20-refresh-plan.md](../../docs/planning/latest-top20-refresh-plan.md)
- [docs/planning/legacy-patch-review.md](../../docs/planning/legacy-patch-review.md)
- [docs/planning/pilot-adversarial-testing.md](../../docs/planning/pilot-adversarial-testing.md)
- [docs/planning/review-prompts.md](../../docs/planning/review-prompts.md)
- [docs/planning/robust-sceptic-plan.md](../../docs/planning/robust-sceptic-plan.md)
- [docs/planning/serverless-verified-install-plan.md](../../docs/planning/serverless-verified-install-plan.md)
- [docs/planning/top100-full-proof-target.md](../../docs/planning/top100-full-proof-target.md)
- [docs/planning/top20-full-proof-target.md](../../docs/planning/top20-full-proof-target.md)
- [docs/planning/top500-matrix-refresh-review.md](../../docs/planning/top500-matrix-refresh-review.md)
- [docs/planning/verified-install-commercial-model.md](../../docs/planning/verified-install-commercial-model.md)
- [docs/reference/artifact-verifier-spec.md](../../docs/reference/artifact-verifier-spec.md)
- [docs/reference/capability-profile-catalog.md](../../docs/reference/capability-profile-catalog.md)
- [docs/reference/catalog-doctrine.md](../../docs/reference/catalog-doctrine.md)
- [docs/reference/chart-recipe-manifest-flow.md](../../docs/reference/chart-recipe-manifest-flow.md)
- [docs/reference/complete-corresponding-model.md](../../docs/reference/complete-corresponding-model.md)
- [docs/reference/confighub-promotion-mapping.md](../../docs/reference/confighub-promotion-mapping.md)
- [docs/reference/customization-algorithm.md](../../docs/reference/customization-algorithm.md)
- [docs/reference/customization-decision-tree.md](../../docs/reference/customization-decision-tree.md)
- [docs/reference/derived-variant-live-proof.md](../../docs/reference/derived-variant-live-proof.md)
- [docs/reference/direct-cub-helm-model.md](../../docs/reference/direct-cub-helm-model.md)
- [docs/reference/fork-vocabulary.md](../../docs/reference/fork-vocabulary.md)
- [docs/reference/generated-fact-receipts.md](../../docs/reference/generated-fact-receipts.md)
- [docs/reference/helm-community-persona-reference.md](../../docs/reference/helm-community-persona-reference.md)
- [docs/reference/helm-import-contract.md](../../docs/reference/helm-import-contract.md)
- [docs/reference/lane-test-doctrine.md](../../docs/reference/lane-test-doctrine.md)
- [docs/reference/observation-freshness-slo.md](../../docs/reference/observation-freshness-slo.md)
- [docs/reference/per-chart-recipes.md](../../docs/reference/per-chart-recipes.md)
- [docs/reference/redis-default-variant-spec.md](../../docs/reference/redis-default-variant-spec.md)
- [docs/reference/redis-installer-package-spec.md](../../docs/reference/redis-installer-package-spec.md)
- [docs/reference/redis-local-e2e-spec.md](../../docs/reference/redis-local-e2e-spec.md)
- [docs/reference/redis-local-scan-spec.md](../../docs/reference/redis-local-scan-spec.md)
- [docs/reference/redis-proof-spec.md](../../docs/reference/redis-proof-spec.md)
- [docs/reference/redis-reuse-existing-secret-variant-spec.md](../../docs/reference/redis-reuse-existing-secret-variant-spec.md)
- [docs/reference/redis-variant-diff-spec.md](../../docs/reference/redis-variant-diff-spec.md)
- [docs/reference/seven-stage-helm-lifecycle.md](../../docs/reference/seven-stage-helm-lifecycle.md)
- [docs/reference/two-cluster-parity-harness.md](../../docs/reference/two-cluster-parity-harness.md)
- [docs/reference/upgrade-rollback-receipts.md](../../docs/reference/upgrade-rollback-receipts.md)
- [docs/reference/variant-creation-artifact.md](../../docs/reference/variant-creation-artifact.md)
- [docs/reference/variant-creator-verification.md](../../docs/reference/variant-creator-verification.md)
- [docs/reference/variant-promotion-worked-example.md](../../docs/reference/variant-promotion-worked-example.md)
- [docs/reference/verification-properties.md](../../docs/reference/verification-properties.md)
- [docs/user/adopting-existing-apps.md](../../docs/user/adopting-existing-apps.md)
- [docs/user/chain-of-proof.md](../../docs/user/chain-of-proof.md)
- [docs/user/change-routing-before-oci.md](../../docs/user/change-routing-before-oci.md)
- [docs/user/choose-your-path.md](../../docs/user/choose-your-path.md)
- [docs/user/creating-variants.md](../../docs/user/creating-variants.md)
- [docs/user/cub-variant-command-surface.md](../../docs/user/cub-variant-command-surface.md)
- [docs/user/custom-overlays.md](../../docs/user/custom-overlays.md)
- [docs/user/how-the-harness-works.md](../../docs/user/how-the-harness-works.md)
- [docs/user/introduction-to-the-harness.md](../../docs/user/introduction-to-the-harness.md)
- [docs/user/maintenance-sla.md](../../docs/user/maintenance-sla.md)
- [docs/user/prometheus-overlay-promotion-example.md](../../docs/user/prometheus-overlay-promotion-example.md)
- [docs/user/ux-proposal-bulk-scan-patch-tutorial.md](../../docs/user/ux-proposal-bulk-scan-patch-tutorial.md)
- [docs/user/ux-proposal-externaldns-custom-overlay-tutorial.md](../../docs/user/ux-proposal-externaldns-custom-overlay-tutorial.md)
- [docs/user/ux-proposal-gitops-runtime-proof-tutorial.md](../../docs/user/ux-proposal-gitops-runtime-proof-tutorial.md)
- [docs/user/ux-proposal-prometheus-base-variant-tutorial.md](../../docs/user/ux-proposal-prometheus-base-variant-tutorial.md)
- [docs/user/ux-proposal-prometheus-promotion-tutorial.md](../../docs/user/ux-proposal-prometheus-promotion-tutorial.md)
- [docs/user/ux-proposal-redis-quick-start-tutorial.md](../../docs/user/ux-proposal-redis-quick-start-tutorial.md)
- [docs/user/ux-proposal-redis-secret-modes-tutorial.md](../../docs/user/ux-proposal-redis-secret-modes-tutorial.md)
- [docs/user/why-synced-is-not-working.md](../../docs/user/why-synced-is-not-working.md)
- [docs/user/why-this-exists.md](../../docs/user/why-this-exists.md)

## Regenerate

~~~sh
npm run doc-freshness
npm run doc-freshness:verify
~~~
