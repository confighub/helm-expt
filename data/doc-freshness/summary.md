# Doc Freshness - when to update the authored docs

The corpus's generated docs cannot go stale silently: their verifiers fail
the build. The authored docs (README, docs/) CAN - they describe evidence
that keeps moving. This snapshot answers "which authored doc needs review
right now": a doc is **review-due** when an evidence source it links to
(under `data`, `scripts`, `tests`, `recipes`, `packages`, `CATALOG.md`)
changed more recently than the doc itself.

Colored rendering: [freshness.html](freshness.html) (open in a browser).
Snapshot as of 2026-07-28 (commit `1f6cd894e`). Refresh with `npm run doc-freshness` - cheap, ride
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
| Authored docs tracked | 233 |
| Fresh (no linked source newer than the doc) | 24 |
| **Review-due** | 69 |
| No linked evidence sources (cannot auto-trigger) | 140 |

## Review queue

Sorted by how far behind the doc is. "Newer sources" shows up to the three
most recently changed triggers.

| Doc | Area | Doc last changed | Days behind | Newer sources |
| --- | --- | --- | ---: | --- |
| [docs/user/helm-pain-points.md](../../docs/user/helm-pain-points.md) | user | 2026-06-10 | 49 | `data/outcome-coverage/base-outcomes.csv (2026-07-28)`<br>`data/variant-path-coverage/coverage-matrix.csv (2026-07-28)`<br>`data/pain-point-coverage/pain-points.csv (2026-06-10)` |
| [docs/planning/large-machine-handover.md](../../docs/planning/large-machine-handover.md) | planning | 2026-06-11 | 48 | `data/outcome-coverage/summary.md (2026-07-28)` |
| [docs/reference/helm-quirk-support-matrix.md](../../docs/reference/helm-quirk-support-matrix.md) | reference | 2026-06-11 | 48 | `data/top100-user-readiness/summary.md (2026-07-28)` |
| [docs/user/outcomes-and-tests.md](../../docs/user/outcomes-and-tests.md) | user | 2026-06-11 | 48 | `CATALOG.md (2026-07-28)`<br>`data/next-ten-waves/summary.md (2026-07-28)`<br>`data/outcome-coverage/base-outcomes.csv (2026-07-28)` |
| [docs/user/top100-readiness.md](../../docs/user/top100-readiness.md) | user | 2026-06-10 | 48 | `data/outcome-coverage/base-outcomes.csv (2026-07-28)`<br>`data/top100-promotion-wave/summary.md (2026-07-28)`<br>`data/top100-readiness/next80-queues.csv (2026-07-28)` |
| [docs/user/verification-lanes.md](../../docs/user/verification-lanes.md) | user | 2026-06-11 | 48 | `data/outcome-coverage/summary.md (2026-07-28)`<br>`tests/npm-scripts.md (2026-07-28)` |
| [docs/reference/proof-kit-migration.md](../../docs/reference/proof-kit-migration.md) | reference | 2026-06-11 | 47 | `data/live-helm-confighub-compare/summary.md (2026-07-28)` |
| [docs/reference/top100-user-readiness.md](../../docs/reference/top100-user-readiness.md) | reference | 2026-06-12 | 47 | `data/outcome-coverage/base-outcomes.csv (2026-07-28)`<br>`data/top100-readiness/readiness.csv (2026-07-28)`<br>`data/top100-readiness/summary.md (2026-07-28)` |
| [docs/user/production-support-decisions.md](../../docs/user/production-support-decisions.md) | user | 2026-06-11 | 47 | `data/production-disposition/summary.md (2026-07-28)`<br>`data/production-support-decisions/decisions.csv (2026-07-28)`<br>`data/production-support-decisions/summary.md (2026-07-28)` |
| [docs/user/serious-charts.md](../../docs/user/serious-charts.md) | user | 2026-06-11 | 47 | `data/hard-chart-production-packets/summary.md (2026-07-28)`<br>`data/production-readiness-packets/cert-manager/packet.md (2026-06-23)`<br>`data/production-readiness-packets/external-secrets/packet.md (2026-06-23)` |
| [docs/user/top100-status.md](../../docs/user/top100-status.md) | user | 2026-06-12 | 47 | `data/top100-readiness/summary.md (2026-07-28)`<br>`data/top100-user-readiness/summary.md (2026-07-28)`<br>`data/top20-base-readiness/start-here.md (2026-07-28)` |
| [docs/planning/helm-community-persona-plan.md](../../docs/planning/helm-community-persona-plan.md) | planning | 2026-06-13 | 46 | `data/live-helm-confighub-compare/summary.md (2026-07-28)`<br>`data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/live-kind-parity/summary.md (2026-07-28)` |
| [docs/reference/what-hook-support-means.md](../../docs/reference/what-hook-support-means.md) | reference | 2026-06-11 | 46 | `data/hook-disposition/top100-hook-dispositions.csv (2026-07-26)` |
| [docs/planning/where-does-my-hook-go.md](../../docs/planning/where-does-my-hook-go.md) | planning | 2026-06-14 | 45 | `data/lifecycle-routes/routes.json (2026-07-28)`<br>`data/lifecycle-routes/summary.md (2026-07-28)` |
| [docs/reference/secret-lifecycle.md](../../docs/reference/secret-lifecycle.md) | reference | 2026-06-13 | 45 | `data/secret-lifecycle/secrets.csv (2026-07-28)`<br>`data/secret-lifecycle/summary.md (2026-07-28)`<br>`data/secret-lifecycle/variant-summary.csv (2026-07-28)` |
| [docs/reference/variant-promotion-model.md](../../docs/reference/variant-promotion-model.md) | reference | 2026-06-14 | 44 | `data/variant-promotion/summary.md (2026-07-27)` |
| [docs/planning/next-20-tasks.md](../../docs/planning/next-20-tasks.md) | planning | 2026-06-16 | 43 | `data/outcome-coverage/summary.md (2026-07-28)`<br>`data/claims-register/summary.md (2026-07-27)`<br>`data/variant-goldens/derived-expansion-wave/README.md (2026-06-30)` |
| [docs/reference/matrix-completion-audit.md](../../docs/reference/matrix-completion-audit.md) | reference | 2026-06-16 | 43 | `data/live-parity-decisions/summary.md (2026-07-28)`<br>`data/master-catalog-matrix/summary.md (2026-07-28)`<br>`data/matrix-completion-audit/summary.md (2026-07-28)` |
| [docs/reference/residue-families.md](../../docs/reference/residue-families.md) | reference | 2026-06-16 | 43 | `data/live-parity-decisions/summary.md (2026-07-28)`<br>`data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/kind-parity-decisions/summary.md (2026-07-28)` |
| [docs/user/live-parity.md](../../docs/user/live-parity.md) | user | 2026-06-16 | 43 | `data/live-helm-confighub-compare/summary.md (2026-07-28)`<br>`data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/status-dashboard/active-proof-queue.csv (2026-07-28)` |
| [docs/user/target-prerequisites-before-rerun.md](../../docs/user/target-prerequisites-before-rerun.md) | user | 2026-06-16 | 43 | `data/target-prerequisite-actions/summary.md (2026-07-28)`<br>`data/target-prerequisite-workdown/summary.md (2026-07-28)`<br>`data/model-gap-workdown/summary.md (2026-06-24)` |
| [docs/reference/master-catalog-matrix.md](../../docs/reference/master-catalog-matrix.md) | reference | 2026-06-18 | 41 | `data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/master-catalog-matrix/matrix.csv (2026-07-28)`<br>`data/master-catalog-matrix/matrix.html (2026-07-28)` |
| [docs/user/generative-gitops-fit.md](../../docs/user/generative-gitops-fit.md) | user | 2026-06-18 | 41 | `data/master-catalog-matrix/matrix.html (2026-07-28)`<br>`data/outcome-evidence-contract/summary.md (2026-07-28)`<br>`data/claims-register/summary.md (2026-07-27)` |
| [docs/user/reading-the-matrix.md](../../docs/user/reading-the-matrix.md) | user | 2026-06-18 | 41 | `data/live-parity-decisions/summary.md (2026-07-28)`<br>`data/master-catalog-matrix/matrix.html (2026-07-28)`<br>`data/kind-parity-decisions/summary.md (2026-07-28)` |
| [docs/reference/variant-promotion-closeout.md](../../docs/reference/variant-promotion-closeout.md) | reference | 2026-06-18 | 40 | `data/variant-promotion-closeout/summary.md (2026-07-27)`<br>`data/variant-promotion/status.csv (2026-07-27)` |
| [docs/planning/robust-sceptic-plan.md](../../docs/planning/robust-sceptic-plan.md) | planning | 2026-06-18 | 39 | `data/claims-register/summary.md (2026-07-27)` |
| [docs/planning/outside-user-test.md](../../docs/planning/outside-user-test.md) | planning | 2026-06-21 | 38 | `tests/README.md (2026-07-28)`<br>`data/top100-coverage/summary.md (2026-06-24)` |
| [docs/planning/user-journey-test-pathways-plan.md](../../docs/planning/user-journey-test-pathways-plan.md) | planning | 2026-06-21 | 38 | `tests/README.md (2026-07-28)` |
| [docs/user/pathway-route-hooks-transparently.md](../../docs/user/pathway-route-hooks-transparently.md) | user | 2026-06-21 | 38 | `tests/README.md (2026-07-28)` |
| [docs/planning/current-handover.md](../../docs/planning/current-handover.md) | planning | 2026-06-23 | 36 | `CATALOG.md (2026-07-28)`<br>`data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/next-ten-waves/summary.md (2026-07-28)` |
| [docs/planning/next-execution-plan.md](../../docs/planning/next-execution-plan.md) | planning | 2026-06-23 | 36 | `data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/next-ten-waves/summary.md (2026-07-28)`<br>`data/outcome-coverage/summary.md (2026-07-28)` |
| [docs/user/verification.md](../../docs/user/verification.md) | user | 2026-06-30 | 29 | `data/outcome-coverage/summary.md (2026-07-28)`<br>`data/status-dashboard/summary.md (2026-07-28)`<br>`tests/npm-scripts.md (2026-07-28)` |
| [docs/user/verify-it-yourself.md](../../docs/user/verify-it-yourself.md) | user | 2026-06-30 | 29 | `data/live-kind-parity/summary.md (2026-07-28)` |
| [docs/user/variants-after-upload.md](../../docs/user/variants-after-upload.md) | user | 2026-07-03 | 26 | `data/master-catalog-matrix/summary.md (2026-07-28)` |
| [docs/planning/pilot-adversarial-testing.md](../../docs/planning/pilot-adversarial-testing.md) | planning | 2026-07-05 | 24 | `tests/README.md (2026-07-28)` |
| [docs/planning/dedicated-website-plan.md](../../docs/planning/dedicated-website-plan.md) | planning | 2026-06-22 | 23 | `tests/persona-ux-strategy.md (2026-07-14)` |
| [docs/planning/persona-ux-rerun-2026-06-22.md](../../docs/planning/persona-ux-rerun-2026-06-22.md) | planning | 2026-06-22 | 23 | `tests/persona-ux-strategy.md (2026-07-14)` |
| [docs/user/helm-presets-and-values.md](../../docs/user/helm-presets-and-values.md) | user | 2026-07-07 | 22 | `data/confighub-example-guides/summary.md (2026-07-28)` |
| [docs/planning/chart-claim-integrity-audit-2026-06-22.md](../../docs/planning/chart-claim-integrity-audit-2026-06-22.md) | planning | 2026-06-23 | 21 | `tests/persona-ux-strategy.md (2026-07-14)`<br>`data/chart-claim-integrity-audit-2026-06-22/summary.md (2026-07-02)` |
| [docs/user/why-this-does-not-collapse.md](../../docs/user/why-this-does-not-collapse.md) | user | 2026-06-10 | 21 | `data/live-e2e/normalization-rules.md (2026-06-30)`<br>`data/quirk-coverage/summary.md (2026-06-24)`<br>`data/top100-coverage/summary.md (2026-06-24)` |
| [docs/user/target-prerequisites.md](../../docs/user/target-prerequisites.md) | user | 2026-07-09 | 20 | `data/master-catalog-matrix/summary.md (2026-07-28)`<br>`data/live-kind-parity/summary.md (2026-07-28)`<br>`packages/jetstack/cert-manager/v1.20.2/installer.yaml (2026-07-28)` |
| [docs/reference/quirk-coverage.md](../../docs/reference/quirk-coverage.md) | reference | 2026-06-11 | 19 | `data/extension-slots/summary.md (2026-06-30)`<br>`data/quirk-coverage/coverage.csv (2026-06-24)`<br>`data/quirk-coverage/summary.md (2026-06-24)` |
| [docs/user/extension-slots.md](../../docs/user/extension-slots.md) | user | 2026-06-11 | 19 | `data/extension-slots/extension-slots.csv (2026-06-30)`<br>`data/extension-slots/summary.md (2026-06-30)` |
| [docs/user/nginx-configuration-files.md](../../docs/user/nginx-configuration-files.md) | user | 2026-06-11 | 19 | `data/extension-slots/summary.md (2026-06-30)` |
| [docs/user/remote-images-and-supported-bases.md](../../docs/user/remote-images-and-supported-bases.md) | user | 2026-06-16 | 13 | `data/image-digest-workdown/summary.md (2026-06-29)`<br>`data/remote-image-runtime-workdown/summary.md (2026-06-24)` |
| [docs/planning/free-path-pitch.md](../../docs/planning/free-path-pitch.md) | planning | 2026-07-14 | 12 | `data/cub-adoption-caveats/summary.md (2026-07-25)` |
| [docs/user/known-gaps-we-surface.md](../../docs/user/known-gaps-we-surface.md) | user | 2026-06-21 | 12 | `data/crd-ordering-gap/summary.md (2026-07-03)`<br>`data/default-credential-check/summary.md (2026-07-01)` |
| [docs/user/how-it-works.md](../../docs/user/how-it-works.md) | user | 2026-07-23 | 6 | `tests/README.md (2026-07-28)`<br>`tests/doctrine.md (2026-07-26)`<br>`data/oci-hook-delivery-proof/summary.md (2026-07-26)` |
| [docs/user/helm-upgrade-crash-example.md](../../docs/user/helm-upgrade-crash-example.md) | user | 2026-06-13 | 5 | `data/blast-radius-accuracy/summary.md (2026-06-18)` |
| [docs/planning/agreed-execution-plan.md](../../docs/planning/agreed-execution-plan.md) | planning | 2026-07-26 | 3 | `data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/outcome-coverage/summary.md (2026-07-28)`<br>`data/status-dashboard/summary.md (2026-07-28)` |
| [docs/user/security-end-to-end.md](../../docs/user/security-end-to-end.md) | user | 2026-07-26 | 3 | `tests/README.md (2026-07-28)`<br>`tests/doctrine.md (2026-07-26)` |
| [docs/demo/hooks-crds/kube-prometheus-stack.md](../../docs/demo/hooks-crds/kube-prometheus-stack.md) | demo | 2026-07-27 | 2 | `data/hooks-crds-app/summary.md (2026-07-28)` |
| [docs/planning/config-catalog-demo-program.md](../../docs/planning/config-catalog-demo-program.md) | planning | 2026-07-27 | 2 | `data/serverless-oci-gitops-proof/summary.md (2026-07-28)` |
| [docs/planning/roadmap.md](../../docs/planning/roadmap.md) | planning | 2026-07-27 | 2 | `data/live-parity-rerun-plan/summary.md (2026-07-28)`<br>`data/master-catalog-matrix/matrix.html (2026-07-28)`<br>`data/outcome-evidence-contract/summary.md (2026-07-28)` |
| [docs/user/chart-hooks-what-happens.md](../../docs/user/chart-hooks-what-happens.md) | user | 2026-07-27 | 2 | `data/lifecycle-route-actions/summary.md (2026-07-28)`<br>`data/lifecycle-routes/summary.md (2026-07-28)`<br>`data/per-chart-hooks/summary.md (2026-07-28)` |
| [docs/user/current-proof-status.md](../../docs/user/current-proof-status.md) | user | 2026-07-27 | 2 | `CATALOG.md (2026-07-28)`<br>`data/live-helm-confighub-compare/summary.md (2026-07-28)`<br>`data/live-parity-rerun-plan/summary.md (2026-07-28)` |
| [docs/user/hard-questions.md](../../docs/user/hard-questions.md) | user | 2026-07-26 | 2 | `data/secret-lifecycle/summary.md (2026-07-28)`<br>`data/claims-register/summary.md (2026-07-27)` |
| [docs/user/hook-lifecycle-strategy.md](../../docs/user/hook-lifecycle-strategy.md) | user | 2026-07-27 | 2 | `data/lifecycle-boundary/summary.md (2026-07-28)`<br>`data/lifecycle-routes/routes.csv (2026-07-28)`<br>`data/lifecycle-routes/routes.json (2026-07-28)` |
| [README.md](../../README.md) | root | 2026-07-28 | 1 | `CATALOG.md (2026-07-28)`<br>`data/live-helm-confighub-compare/summary.md (2026-07-28)`<br>`data/live-parity-rerun-plan/summary.md (2026-07-28)` |
| [docs/README.md](../../docs/README.md) | docs | 2026-07-28 | 1 | `CATALOG.md (2026-07-28)`<br>`data/master-catalog-matrix/matrix.html (2026-07-28)`<br>`data/outcome-evidence-contract/summary.md (2026-07-28)` |
| [docs/planning/upgrade-story-plan.md](../../docs/planning/upgrade-story-plan.md) | planning | 2026-06-10 | 1 | `data/refresh-survival/kube-prometheus-stack-upgrade-seed.md (2026-06-10)` |
| [docs/user/README.md](../../docs/user/README.md) | user | 2026-07-26 | 1 | `data/app-readiness/summary.md (2026-07-27)` |
| [docs/user/ai-assisted-helm-changes.md](../../docs/user/ai-assisted-helm-changes.md) | user | 2026-07-27 | 1 | `data/ai-change-review-live-proof/summary.md (2026-07-27)` |
| [docs/user/choosing-commands.md](../../docs/user/choosing-commands.md) | user | 2026-07-28 | 1 | `tests/npm-scripts.md (2026-07-28)` |
| [docs/user/config-catalog-demonstrations.md](../../docs/user/config-catalog-demonstrations.md) | user | 2026-07-28 | 1 | `data/outcome-coverage/summary.md (2026-07-28)`<br>`data/helm-render-intents/summary.md (2026-07-28)`<br>`data/hooks-crds-app/summary.md (2026-07-28)` |
| [docs/user/gitops-adopter-guide.md](../../docs/user/gitops-adopter-guide.md) | user | 2026-07-26 | 1 | `tests/doctrine.md (2026-07-26)` |
| [docs/user/helm-render-intents.md](../../docs/user/helm-render-intents.md) | user | 2026-07-28 | 1 | `data/helm-render-intents/intents.csv (2026-07-28)`<br>`data/helm-render-intents/intents.json (2026-07-28)`<br>`data/helm-render-intents/contract.md (2026-07-28)` |
| [docs/user/installer-oci-packages.md](../../docs/user/installer-oci-packages.md) | user | 2026-07-28 | 1 | `data/installer-oci-packages/packages.csv (2026-07-28)`<br>`data/installer-oci-packages/packages.json (2026-07-28)` |
| [docs/user/offering.md](../../docs/user/offering.md) | user | 2026-06-30 | 1 | `data/chart-use-guide/summary.md (2026-07-01)` |

## Docs with no linked evidence sources

These cannot be auto-triggered by source changes. Either they are timeless,
or they should link the evidence they describe - linking is what wires a doc
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
- [docs/demo/sveltos/kyverno-fleet.md](../../docs/demo/sveltos/kyverno-fleet.md)
- [docs/demo/tempo/confighub-proof-transcript.md](../../docs/demo/tempo/confighub-proof-transcript.md)
- [docs/demo/tempo/confighub-proof.md](../../docs/demo/tempo/confighub-proof.md)
- [docs/demo/vault/confighub-proof-transcript.md](../../docs/demo/vault/confighub-proof-transcript.md)
- [docs/demo/vault/confighub-proof.md](../../docs/demo/vault/confighub-proof.md)
- [docs/planning/agent-experience-audit.md](../../docs/planning/agent-experience-audit.md)
- [docs/planning/agent-experience-worklog.md](../../docs/planning/agent-experience-worklog.md)
- [docs/planning/blog-posts.md](../../docs/planning/blog-posts.md)
- [docs/planning/catalog-promotion-next-candidates.md](../../docs/planning/catalog-promotion-next-candidates.md)
- [docs/planning/catalog-promotion-review.md](../../docs/planning/catalog-promotion-review.md)
- [docs/planning/corpus-rationalization-plan.md](../../docs/planning/corpus-rationalization-plan.md)
- [docs/planning/fuzz-corpus-tests-roadmap.md](../../docs/planning/fuzz-corpus-tests-roadmap.md)
- [docs/planning/get-started-rewrite-brief.md](../../docs/planning/get-started-rewrite-brief.md)
- [docs/planning/helm-community-persona-prd.md](../../docs/planning/helm-community-persona-prd.md)
- [docs/planning/helm-vs-cub-adoption-audit.md](../../docs/planning/helm-vs-cub-adoption-audit.md)
- [docs/planning/hook-route-execution-plan.md](../../docs/planning/hook-route-execution-plan.md)
- [docs/planning/house-layout.md](../../docs/planning/house-layout.md)
- [docs/planning/house-voice.md](../../docs/planning/house-voice.md)
- [docs/planning/how-it-works-website-brief.md](../../docs/planning/how-it-works-website-brief.md)
- [docs/planning/independent-review-brief.md](../../docs/planning/independent-review-brief.md)
- [docs/planning/issue-backlog.md](../../docs/planning/issue-backlog.md)
- [docs/planning/landing-page-restructure-brief.md](../../docs/planning/landing-page-restructure-brief.md)
- [docs/planning/latest-top20-refresh-plan.md](../../docs/planning/latest-top20-refresh-plan.md)
- [docs/planning/legacy-patch-review.md](../../docs/planning/legacy-patch-review.md)
- [docs/planning/maintenance-strategy.md](../../docs/planning/maintenance-strategy.md)
- [docs/planning/per-chart-fact-sheet-spec.md](../../docs/planning/per-chart-fact-sheet-spec.md)
- [docs/planning/persona-ux-audit-2026-06-22.md](../../docs/planning/persona-ux-audit-2026-06-22.md)
- [docs/planning/post-coverage-strategy.md](../../docs/planning/post-coverage-strategy.md)
- [docs/planning/review-prompts.md](../../docs/planning/review-prompts.md)
- [docs/planning/server-account-pitch.md](../../docs/planning/server-account-pitch.md)
- [docs/planning/serverless-verified-install-plan.md](../../docs/planning/serverless-verified-install-plan.md)
- [docs/planning/three-pillars-brief.md](../../docs/planning/three-pillars-brief.md)
- [docs/planning/top100-full-proof-target.md](../../docs/planning/top100-full-proof-target.md)
- [docs/planning/top20-full-proof-target.md](../../docs/planning/top20-full-proof-target.md)
- [docs/planning/top500-matrix-refresh-review.md](../../docs/planning/top500-matrix-refresh-review.md)
- [docs/planning/user-journey-test-pathways-brief.md](../../docs/planning/user-journey-test-pathways-brief.md)
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
- [docs/reference/enterprise-parity-contract.md](../../docs/reference/enterprise-parity-contract.md)
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
- [docs/user/app-to-live-walkthrough.md](../../docs/user/app-to-live-walkthrough.md)
- [docs/user/broken-chart-triage.md](../../docs/user/broken-chart-triage.md)
- [docs/user/change-routing-before-oci.md](../../docs/user/change-routing-before-oci.md)
- [docs/user/choose-your-path.md](../../docs/user/choose-your-path.md)
- [docs/user/confighub-data-model.md](../../docs/user/confighub-data-model.md)
- [docs/user/creating-variants.md](../../docs/user/creating-variants.md)
- [docs/user/cub-variant-command-surface.md](../../docs/user/cub-variant-command-surface.md)
- [docs/user/custom-overlays.md](../../docs/user/custom-overlays.md)
- [docs/user/derived-variant-walkthrough.md](../../docs/user/derived-variant-walkthrough.md)
- [docs/user/expected-results-and-clusters.md](../../docs/user/expected-results-and-clusters.md)
- [docs/user/first-run-walkthrough.md](../../docs/user/first-run-walkthrough.md)
- [docs/user/how-the-harness-works.md](../../docs/user/how-the-harness-works.md)
- [docs/user/introduction-to-the-harness.md](../../docs/user/introduction-to-the-harness.md)
- [docs/user/large-config-operations.md](../../docs/user/large-config-operations.md)
- [docs/user/maintenance-sla.md](../../docs/user/maintenance-sla.md)
- [docs/user/model-and-vocabulary.md](../../docs/user/model-and-vocabulary.md)
- [docs/user/prometheus-overlay-promotion-example.md](../../docs/user/prometheus-overlay-promotion-example.md)
- [docs/user/try-now.md](../../docs/user/try-now.md)
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
