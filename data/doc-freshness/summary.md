# Doc Freshness - when to update the authored docs

The corpus's generated docs cannot go stale silently: their verifiers fail
the build. The authored docs (README, docs/) CAN - they describe evidence
that keeps moving. This snapshot answers "which authored doc needs review
right now": a doc is **review-due** when an evidence source it links to
(under `data`, `scripts`, `tests`, `recipes`, `packages`, `CATALOG.md`)
changed more recently than the doc itself.

Colored rendering: [freshness.html](freshness.html) (open in a browser).
Snapshot as of 2026-08-27 (commit `f9ad225ca`). Refresh with `npm run doc-freshness` - cheap, ride
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
| Authored docs tracked | 293 |
| Fresh (no linked source newer than the doc) | 52 |
| **Review-due** | 86 |
| No linked evidence sources (cannot auto-trigger) | 155 |

## Review queue

Sorted by how far behind the doc is. "Newer sources" shows up to the three
most recently changed triggers.

| Doc | Area | Doc last changed | Days behind | Newer sources |
| --- | --- | --- | ---: | --- |
| [docs/reference/top100-user-readiness.md](../../docs/reference/top100-user-readiness.md) | reference | 2026-06-12 | 76 | `data/top20-base-readiness/base-readiness.csv (2026-08-26)`<br>`data/chart-facts/chart-facts.csv (2026-08-12)`<br>`data/top100-coverage/summary.md (2026-08-12)` |
| [docs/user/outcomes-and-tests.md](../../docs/user/outcomes-and-tests.md) | user | 2026-06-11 | 76 | `CATALOG.md (2026-08-26)`<br>`data/status-dashboard/top20-status.csv (2026-08-26)`<br>`data/README.md (2026-08-26)` |
| [docs/user/top100-status.md](../../docs/user/top100-status.md) | user | 2026-06-12 | 75 | `data/top20-base-readiness/start-here.md (2026-08-26)`<br>`data/top100-readiness/summary.md (2026-08-12)`<br>`data/top100-user-readiness/summary.md (2026-08-12)` |
| [docs/planning/where-does-my-hook-go.md](../../docs/planning/where-does-my-hook-go.md) | planning | 2026-06-14 | 73 | `data/lifecycle-routes/routes.json (2026-08-25)`<br>`data/lifecycle-routes/summary.md (2026-08-25)` |
| [docs/planning/next-20-tasks.md](../../docs/planning/next-20-tasks.md) | planning | 2026-06-16 | 70 | `data/claims-register/summary.md (2026-08-24)`<br>`data/outcome-coverage/summary.md (2026-08-12)`<br>`data/variant-goldens/derived-expansion-wave/README.md (2026-06-30)` |
| [docs/reference/master-catalog-matrix.md](../../docs/reference/master-catalog-matrix.md) | reference | 2026-06-18 | 69 | `data/master-catalog-matrix/matrix.csv (2026-08-26)`<br>`data/master-catalog-matrix/matrix.html (2026-08-26)`<br>`data/master-catalog-matrix/summary.md (2026-08-26)` |
| [docs/user/reading-the-matrix.md](../../docs/user/reading-the-matrix.md) | user | 2026-06-18 | 69 | `data/master-catalog-matrix/matrix.html (2026-08-26)`<br>`data/lifecycle-route-actions/summary.md (2026-08-25)`<br>`data/live-matrix-burndown/summary.md (2026-08-10)` |
| [docs/planning/robust-sceptic-plan.md](../../docs/planning/robust-sceptic-plan.md) | planning | 2026-06-18 | 68 | `data/claims-register/summary.md (2026-08-24)` |
| [docs/planning/current-handover.md](../../docs/planning/current-handover.md) | planning | 2026-06-23 | 64 | `CATALOG.md (2026-08-26)`<br>`data/chart-facts/summary.md (2026-08-12)`<br>`data/image-digest-workdown/summary.md (2026-08-12)` |
| [docs/user/top100-readiness.md](../../docs/user/top100-readiness.md) | user | 2026-06-10 | 63 | `data/outcome-coverage/feature-outcomes.csv (2026-08-12)`<br>`data/top100-readiness/next80-queues.csv (2026-08-12)`<br>`data/top100-readiness/readiness.csv (2026-08-12)` |
| [docs/user/why-this-does-not-collapse.md](../../docs/user/why-this-does-not-collapse.md) | user | 2026-06-10 | 63 | `data/quirk-coverage/summary.md (2026-08-12)`<br>`data/top100-coverage/summary.md (2026-08-12)`<br>`data/live-e2e/normalization-rules.md (2026-06-30)` |
| [docs/planning/large-machine-handover.md](../../docs/planning/large-machine-handover.md) | planning | 2026-06-11 | 62 | `data/outcome-coverage/summary.md (2026-08-12)` |
| [docs/reference/helm-quirk-support-matrix.md](../../docs/reference/helm-quirk-support-matrix.md) | reference | 2026-06-11 | 62 | `data/top100-user-readiness/summary.md (2026-08-12)` |
| [docs/reference/quirk-coverage.md](../../docs/reference/quirk-coverage.md) | reference | 2026-06-11 | 62 | `data/quirk-coverage/coverage.csv (2026-08-12)`<br>`data/quirk-coverage/summary.md (2026-08-12)`<br>`data/extension-slots/summary.md (2026-08-09)` |
| [docs/user/verification-lanes.md](../../docs/user/verification-lanes.md) | user | 2026-06-11 | 62 | `data/outcome-coverage/summary.md (2026-08-12)`<br>`tests/npm-scripts.md (2026-07-28)` |
| [docs/planning/dedicated-website-plan.md](../../docs/planning/dedicated-website-plan.md) | planning | 2026-06-22 | 61 | `tests/persona-ux-strategy.md (2026-08-21)` |
| [docs/planning/persona-ux-rerun-2026-06-22.md](../../docs/planning/persona-ux-rerun-2026-06-22.md) | planning | 2026-06-22 | 61 | `tests/persona-ux-strategy.md (2026-08-21)` |
| [docs/user/helm-pain-points.md](../../docs/user/helm-pain-points.md) | user | 2026-06-10 | 61 | `data/outcome-coverage/base-outcomes.csv (2026-08-10)`<br>`data/variant-path-coverage/coverage-matrix.csv (2026-08-10)`<br>`data/pain-point-coverage/pain-points.csv (2026-06-10)` |
| [docs/planning/chart-claim-integrity-audit-2026-06-22.md](../../docs/planning/chart-claim-integrity-audit-2026-06-22.md) | planning | 2026-06-23 | 60 | `tests/persona-ux-strategy.md (2026-08-21)`<br>`scripts/verify-chart-claim-integrity.mjs (2026-08-09)`<br>`data/chart-claim-integrity-audit-2026-06-22/summary.md (2026-07-02)` |
| [docs/reference/secret-lifecycle.md](../../docs/reference/secret-lifecycle.md) | reference | 2026-06-13 | 60 | `data/secret-lifecycle/secrets.csv (2026-08-12)`<br>`data/secret-lifecycle/summary.md (2026-08-12)`<br>`data/secret-lifecycle/variant-summary.csv (2026-08-12)` |
| [docs/user/extension-slots.md](../../docs/user/extension-slots.md) | user | 2026-06-11 | 59 | `data/extension-slots/extension-slots.csv (2026-08-09)`<br>`data/extension-slots/summary.md (2026-08-09)` |
| [docs/user/nginx-configuration-files.md](../../docs/user/nginx-configuration-files.md) | user | 2026-06-11 | 59 | `data/extension-slots/summary.md (2026-08-09)` |
| [docs/reference/variant-promotion-model.md](../../docs/reference/variant-promotion-model.md) | reference | 2026-06-14 | 58 | `data/variant-promotion/summary.md (2026-08-10)` |
| [docs/user/remote-images-and-supported-bases.md](../../docs/user/remote-images-and-supported-bases.md) | user | 2026-06-16 | 57 | `data/image-digest-workdown/summary.md (2026-08-12)`<br>`data/remote-image-runtime-workdown/summary.md (2026-06-24)` |
| [docs/reference/proof-kit-migration.md](../../docs/reference/proof-kit-migration.md) | reference | 2026-06-11 | 48 | `data/live-helm-confighub-compare/summary.md (2026-07-29)` |
| [docs/user/production-support-decisions.md](../../docs/user/production-support-decisions.md) | user | 2026-06-11 | 47 | `data/production-disposition/summary.md (2026-07-28)`<br>`data/production-support-decisions/decisions.csv (2026-07-28)`<br>`data/production-support-decisions/summary.md (2026-07-28)` |
| [docs/user/serious-charts.md](../../docs/user/serious-charts.md) | user | 2026-06-11 | 47 | `data/hard-chart-production-packets/summary.md (2026-07-28)`<br>`data/production-readiness-packets/cert-manager/packet.md (2026-06-23)`<br>`data/production-readiness-packets/external-secrets/packet.md (2026-06-23)` |
| [docs/planning/helm-community-persona-plan.md](../../docs/planning/helm-community-persona-plan.md) | planning | 2026-06-13 | 46 | `data/live-helm-confighub-compare/summary.md (2026-07-29)`<br>`data/live-kind-parity/summary.md (2026-07-29)`<br>`data/live-parity-rerun-plan/summary.md (2026-07-29)` |
| [docs/user/target-prerequisites-before-rerun.md](../../docs/user/target-prerequisites-before-rerun.md) | user | 2026-06-16 | 43 | `data/model-gap-workdown/summary.md (2026-07-29)`<br>`data/target-prerequisite-actions/summary.md (2026-07-29)`<br>`data/target-prerequisite-workdown/summary.md (2026-07-29)` |
| [docs/user/offering.md](../../docs/user/offering.md) | user | 2026-06-30 | 41 | `data/chart-use-guide/summary.md (2026-08-10)` |
| [docs/planning/user-journey-test-pathways-plan.md](../../docs/planning/user-journey-test-pathways-plan.md) | planning | 2026-06-21 | 38 | `tests/README.md (2026-07-28)` |
| [docs/user/pathway-route-hooks-transparently.md](../../docs/user/pathway-route-hooks-transparently.md) | user | 2026-06-21 | 38 | `tests/README.md (2026-07-28)` |
| [docs/planning/config-catalog-demo-program.md](../../docs/planning/config-catalog-demo-program.md) | planning | 2026-07-27 | 31 | `data/serverless-oci-gitops-proof/summary.md (2026-08-26)`<br>`data/anonymous-oci-ci-proof/summary.md (2026-08-10)` |
| [docs/user/hard-questions.md](../../docs/user/hard-questions.md) | user | 2026-07-26 | 30 | `data/claims-register/summary.md (2026-08-24)`<br>`data/secret-lifecycle/summary.md (2026-08-12)`<br>`data/chart-use-guide/summary.md (2026-08-10)` |
| [docs/planning/free-path-pitch.md](../../docs/planning/free-path-pitch.md) | planning | 2026-07-14 | 29 | `data/cub-adoption-caveats/summary.md (2026-08-12)` |
| [docs/user/current-proof-status.md](../../docs/user/current-proof-status.md) | user | 2026-07-29 | 28 | `CATALOG.md (2026-08-26)`<br>`data/status-dashboard/top20-status.csv (2026-08-26)`<br>`recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md (2026-08-26)` |
| [docs/user/hook-lifecycle-strategy.md](../../docs/user/hook-lifecycle-strategy.md) | user | 2026-07-29 | 27 | `data/kps-lifecycle-route-proof/summary.md (2026-08-25)`<br>`data/lifecycle-routes/routes.csv (2026-08-25)`<br>`data/lifecycle-routes/routes.json (2026-08-25)` |
| [docs/planning/pilot-adversarial-testing.md](../../docs/planning/pilot-adversarial-testing.md) | planning | 2026-07-05 | 24 | `tests/README.md (2026-07-28)` |
| [docs/reference/matrix-completion-audit.md](../../docs/reference/matrix-completion-audit.md) | reference | 2026-08-02 | 24 | `data/master-catalog-matrix/summary.md (2026-08-26)`<br>`data/matrix-completion-audit/summary.md (2026-08-12)`<br>`data/outcome-coverage/base-outcomes.csv (2026-08-10)` |
| [docs/user/variants-after-upload.md](../../docs/user/variants-after-upload.md) | user | 2026-08-02 | 24 | `data/master-catalog-matrix/summary.md (2026-08-26)` |
| [docs/reference/residue-families.md](../../docs/reference/residue-families.md) | reference | 2026-08-02 | 23 | `data/lifecycle-route-actions/summary.md (2026-08-25)` |
| [docs/user/chart-hooks-what-happens.md](../../docs/user/chart-hooks-what-happens.md) | user | 2026-08-02 | 23 | `data/kps-lifecycle-route-proof/summary.md (2026-08-25)`<br>`data/lifecycle-route-actions/summary.md (2026-08-25)`<br>`data/lifecycle-routes/summary.md (2026-08-25)` |
| [docs/user/known-gaps-we-surface.md](../../docs/user/known-gaps-we-surface.md) | user | 2026-08-02 | 20 | `data/default-credential-check/summary.md (2026-08-21)` |
| [docs/demo/aicr/claim-integrity.md](../../docs/demo/aicr/claim-integrity.md) | demo | 2026-08-08 | 18 | `data/aicr-claim-integrity/summary.md (2026-08-25)`<br>`data/aicr-entry-naming/summary.md (2026-08-25)` |
| [docs/demo/aicr/eks-h100-training-kubeflow-v0-18-0.md](../../docs/demo/aicr/eks-h100-training-kubeflow-v0-18-0.md) | demo | 2026-08-08 | 18 | `data/aicr-platform-evidence/summary.md (2026-08-25)`<br>`data/aicr-version-diff/summary.md (2026-08-25)`<br>`data/aicr-ordering-parity/summary.md (2026-08-22)` |
| [docs/planning/aicr-version-refresh-brief.md](../../docs/planning/aicr-version-refresh-brief.md) | planning | 2026-08-08 | 18 | `data/aicr-version-diff/summary.md (2026-08-25)` |
| [docs/planning/nim-ngc-license-read.md](../../docs/planning/nim-ngc-license-read.md) | planning | 2026-08-08 | 18 | `data/gated-artifacts/summary.md (2026-08-25)`<br>`tests/doctrine.md (2026-08-09)` |
| [docs/user/how-it-works.md](../../docs/user/how-it-works.md) | user | 2026-07-23 | 18 | `tests/doctrine.md (2026-08-09)`<br>`tests/README.md (2026-07-28)`<br>`data/oci-hook-delivery-proof/summary.md (2026-07-26)` |
| [docs/demo/apps/rbac-review.md](../../docs/demo/apps/rbac-review.md) | demo | 2026-07-27 | 17 | `data/app-readiness/summary.md (2026-08-12)` |
| [docs/planning/aicr-track-conclusion.md](../../docs/planning/aicr-track-conclusion.md) | planning | 2026-08-09 | 17 | `data/aicr-platform-evidence/summary.md (2026-08-25)` |
| [docs/reference/aicr-evidence-and-our-receipts.md](../../docs/reference/aicr-evidence-and-our-receipts.md) | reference | 2026-08-08 | 15 | `data/aicr-ordering-parity/summary.md (2026-08-22)` |
| [docs/planning/agreed-execution-plan.md](../../docs/planning/agreed-execution-plan.md) | planning | 2026-07-29 | 14 | `data/outcome-coverage/summary.md (2026-08-12)`<br>`data/status-dashboard/summary.md (2026-08-12)` |
| [docs/user/day2-upgrade-story.md](../../docs/user/day2-upgrade-story.md) | user | 2026-08-07 | 14 | `data/redis-upgrade-app-proof/summary.md (2026-08-20)`<br>`data/flattening-safety/summary.md (2026-08-09)` |
| [docs/user/security-end-to-end.md](../../docs/user/security-end-to-end.md) | user | 2026-07-26 | 14 | `tests/doctrine.md (2026-08-09)`<br>`tests/README.md (2026-07-28)` |
| [docs/user/live-parity.md](../../docs/user/live-parity.md) | user | 2026-07-29 | 13 | `data/live-matrix-burndown/summary.md (2026-08-10)`<br>`data/live-helm-confighub-compare/summary.md (2026-07-29)`<br>`data/live-kind-parity/summary.md (2026-07-29)` |
| [docs/reference/certified-bundle-spec.md](../../docs/reference/certified-bundle-spec.md) | reference | 2026-08-09 | 12 | `data/certified-bundles/summary.md (2026-08-20)` |
| [docs/user/generative-gitops-fit.md](../../docs/user/generative-gitops-fit.md) | user | 2026-08-15 | 11 | `data/master-catalog-matrix/matrix.html (2026-08-26)`<br>`data/outcome-evidence-contract/summary.md (2026-08-24)`<br>`data/claims-register/summary.md (2026-08-24)` |
| [docs/reference/variant-promotion-closeout.md](../../docs/reference/variant-promotion-closeout.md) | reference | 2026-08-02 | 8 | `data/variant-promotion-closeout/summary.md (2026-08-10)`<br>`data/variant-promotion/status.csv (2026-08-10)` |
| [docs/user/helm-presets-and-values.md](../../docs/user/helm-presets-and-values.md) | user | 2026-08-02 | 8 | `data/confighub-example-guides/summary.md (2026-08-10)` |
| [docs/planning/aicr-nim-track-backlog.md](../../docs/planning/aicr-nim-track-backlog.md) | planning | 2026-08-21 | 7 | `data/receipt-aging/summary.md (2026-08-27)`<br>`data/aicr-upstream-watch/summary.md (2026-08-25)` |
| [docs/user/gitops-adopter-guide.md](../../docs/user/gitops-adopter-guide.md) | user | 2026-08-02 | 7 | `tests/doctrine.md (2026-08-09)` |
| [docs/user/helm-upgrade-crash-example.md](../../docs/user/helm-upgrade-crash-example.md) | user | 2026-06-13 | 5 | `data/blast-radius-accuracy/summary.md (2026-06-18)` |
| [docs/demo/aicr/eks-h100-training-kubeflow-v0-19-0.md](../../docs/demo/aicr/eks-h100-training-kubeflow-v0-19-0.md) | demo | 2026-08-22 | 4 | `data/aicr-v0-19-0-nested-sources/summary.md (2026-08-25)`<br>`data/aicr-version-diff/summary.md (2026-08-25)` |
| [docs/user/inspect-oci-package.md](../../docs/user/inspect-oci-package.md) | user | 2026-07-30 | 3 | `data/literal-config-examples/summary.md (2026-08-02)` |
| [docs/demo/aicr/cpu-starter.md](../../docs/demo/aicr/cpu-starter.md) | demo | 2026-08-21 | 2 | `data/aicr-ordering-parity/summary.md (2026-08-22)`<br>`data/aicr-platform-variant/summary.md (2026-08-21)` |
| [docs/demo/hooks-crds/kube-prometheus-stack.md](../../docs/demo/hooks-crds/kube-prometheus-stack.md) | demo | 2026-08-24 | 2 | `data/kps-public-package-proof/summary.md (2026-08-26)`<br>`data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml (2026-08-25)`<br>`data/kps-lifecycle-route-proof/summary.md (2026-08-25)` |
| [docs/planning/config-workshop-ai-drift-growth-strategy.md](../../docs/planning/config-workshop-ai-drift-growth-strategy.md) | planning | 2026-08-12 | 2 | `data/challenge-intake/summary.md (2026-08-14)` |
| [docs/planning/next-execution-plan.md](../../docs/planning/next-execution-plan.md) | planning | 2026-08-25 | 2 | `data/top50-completion/summary.md (2026-08-26)` |
| [docs/planning/roadmap.md](../../docs/planning/roadmap.md) | planning | 2026-08-25 | 2 | `data/master-catalog-matrix/matrix.html (2026-08-26)`<br>`data/top50-completion/summary.md (2026-08-26)` |
| [docs/reference/question-intake-operation.md](../../docs/reference/question-intake-operation.md) | reference | 2026-08-13 | 2 | `data/challenge-intake/summary.md (2026-08-14)` |
| [docs/user/config-catalog-demonstrations.md](../../docs/user/config-catalog-demonstrations.md) | user | 2026-08-24 | 2 | `data/helm-render-intents/summary.md (2026-08-26)`<br>`data/installer-oci-packages/summary.md (2026-08-26)`<br>`data/serverless-oci-gitops-proof/summary.md (2026-08-26)` |
| [docs/user/serious-chart-proof.md](../../docs/user/serious-chart-proof.md) | user | 2026-08-24 | 2 | `recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md (2026-08-26)` |
| [README.md](../../README.md) | root | 2026-08-26 | 1 | `CATALOG.md (2026-08-26)` |
| [docs/README.md](../../docs/README.md) | docs | 2026-08-26 | 1 | `CATALOG.md (2026-08-26)` |
| [docs/demo/aicr/refusal-corpus.md](../../docs/demo/aicr/refusal-corpus.md) | demo | 2026-08-08 | 1 | `data/aicr-refusal-corpus/summary.md (2026-08-08)` |
| [docs/demo/aicr/snapshot-diff.md](../../docs/demo/aicr/snapshot-diff.md) | demo | 2026-08-25 | 1 | `data/aicr-snapshot-review/review.yaml (2026-08-25)` |
| [docs/planning/aicr-pilot-variants-brief.md](../../docs/planning/aicr-pilot-variants-brief.md) | planning | 2026-08-21 | 1 | `data/aicr-platform-variant/summary.md (2026-08-21)` |
| [docs/planning/kubara-git-to-confighub-blog-brief.md](../../docs/planning/kubara-git-to-confighub-blog-brief.md) | planning | 2026-08-05 | 1 | `data/kubara-platform-matrix/matrix.html (2026-08-06)`<br>`data/kubara-release-acceptance/contract.yaml (2026-08-06)` |
| [docs/planning/upgrade-story-plan.md](../../docs/planning/upgrade-story-plan.md) | planning | 2026-06-10 | 1 | `data/refresh-survival/kube-prometheus-stack-upgrade-seed.md (2026-06-10)` |
| [docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) | reference | 2026-08-25 | 1 | `data/serverless-oci-gitops-proof/summary.md (2026-08-26)` |
| [docs/reference/installer-package-signing.md](../../docs/reference/installer-package-signing.md) | reference | 2026-08-26 | 1 | `data/installer-package-signatures/summary.md (2026-08-26)` |
| [docs/user/ai-assisted-helm-changes.md](../../docs/user/ai-assisted-helm-changes.md) | user | 2026-07-27 | 1 | `data/ai-change-review-live-proof/summary.md (2026-07-27)` |
| [docs/user/model-and-vocabulary.md](../../docs/user/model-and-vocabulary.md) | user | 2026-08-25 | 1 | `data/base-variant-records/summary.md (2026-08-26)` |
| [docs/user/prometheus-high-fanout.md](../../docs/user/prometheus-high-fanout.md) | user | 2026-08-26 | 1 | `recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md (2026-08-26)` |
| [docs/user/serverless-mode.md](../../docs/user/serverless-mode.md) | user | 2026-08-26 | 1 | `data/serverless-install-parity-proof/summary.md (2026-08-26)`<br>`data/serverless-oci-gitops-proof/summary.md (2026-08-26)` |
| [docs/user/tutorial-sequence.md](../../docs/user/tutorial-sequence.md) | user | 2026-08-26 | 1 | `recipes/prometheus-community/prometheus/29.8.0/CATALOG.md (2026-08-26)` |

## Docs with no linked evidence sources

These cannot be auto-triggered by source changes. Either they are timeless,
or they should link the evidence they describe - linking is what wires a doc
into this freshness model.

- [docs/corpus/known-adversarial-charts.md](../../docs/corpus/known-adversarial-charts.md)
- [docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md)
- [docs/demo/aicr/eks-h100-inference-nim.md](../../docs/demo/aicr/eks-h100-inference-nim.md)
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
- [docs/demo/hooks-crds/argo-workflows.md](../../docs/demo/hooks-crds/argo-workflows.md)
- [docs/demo/ingress-nginx/confighub-proof-transcript.md](../../docs/demo/ingress-nginx/confighub-proof-transcript.md)
- [docs/demo/ingress-nginx/confighub-proof.md](../../docs/demo/ingress-nginx/confighub-proof.md)
- [docs/demo/kubara/adoption-1-choose.md](../../docs/demo/kubara/adoption-1-choose.md)
- [docs/demo/kubara/adoption-2-generate.md](../../docs/demo/kubara/adoption-2-generate.md)
- [docs/demo/kubara/adoption-3-git.md](../../docs/demo/kubara/adoption-3-git.md)
- [docs/demo/kubara/adoption-4-oci.md](../../docs/demo/kubara/adoption-4-oci.md)
- [docs/demo/kubara/adoption-5-confighub-org.md](../../docs/demo/kubara/adoption-5-confighub-org.md)
- [docs/demo/kubara/adoption-6-apps.md](../../docs/demo/kubara/adoption-6-apps.md)
- [docs/demo/kubara/app-rollout.md](../../docs/demo/kubara/app-rollout.md)
- [docs/demo/kubara/gui-tour.md](../../docs/demo/kubara/gui-tour.md)
- [docs/demo/kubara/index.md](../../docs/demo/kubara/index.md)
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
- [docs/planning/agent-operated-cross-format-catalog.md](../../docs/planning/agent-operated-cross-format-catalog.md)
- [docs/planning/aicr-catalog-brief.md](../../docs/planning/aicr-catalog-brief.md)
- [docs/planning/blog-posts.md](../../docs/planning/blog-posts.md)
- [docs/planning/catalog-consumer-contract-brief.md](../../docs/planning/catalog-consumer-contract-brief.md)
- [docs/planning/catalog-entry-contract-brief.md](../../docs/planning/catalog-entry-contract-brief.md)
- [docs/planning/catalog-promotion-next-candidates.md](../../docs/planning/catalog-promotion-next-candidates.md)
- [docs/planning/catalog-promotion-review.md](../../docs/planning/catalog-promotion-review.md)
- [docs/planning/catalog-refresh-plan.md](../../docs/planning/catalog-refresh-plan.md)
- [docs/planning/chapter-three-gateway-rework.md](../../docs/planning/chapter-three-gateway-rework.md)
- [docs/planning/corpus-rationalization-plan.md](../../docs/planning/corpus-rationalization-plan.md)
- [docs/planning/fuzz-corpus-tests-roadmap.md](../../docs/planning/fuzz-corpus-tests-roadmap.md)
- [docs/planning/get-started-rewrite-brief.md](../../docs/planning/get-started-rewrite-brief.md)
- [docs/planning/helm-community-persona-prd.md](../../docs/planning/helm-community-persona-prd.md)
- [docs/planning/helm-vs-cub-adoption-audit.md](../../docs/planning/helm-vs-cub-adoption-audit.md)
- [docs/planning/hook-route-execution-plan.md](../../docs/planning/hook-route-execution-plan.md)
- [docs/planning/house-layout.md](../../docs/planning/house-layout.md)
- [docs/planning/house-voice.md](../../docs/planning/house-voice.md)
- [docs/planning/independent-review-brief.md](../../docs/planning/independent-review-brief.md)
- [docs/planning/issue-backlog.md](../../docs/planning/issue-backlog.md)
- [docs/planning/latest-top20-refresh-plan.md](../../docs/planning/latest-top20-refresh-plan.md)
- [docs/planning/legacy-patch-review.md](../../docs/planning/legacy-patch-review.md)
- [docs/planning/maintenance-strategy.md](../../docs/planning/maintenance-strategy.md)
- [docs/planning/onboarding-and-entry-paths.md](../../docs/planning/onboarding-and-entry-paths.md)
- [docs/planning/per-chart-fact-sheet-spec.md](../../docs/planning/per-chart-fact-sheet-spec.md)
- [docs/planning/persona-ux-audit-2026-06-22.md](../../docs/planning/persona-ux-audit-2026-06-22.md)
- [docs/planning/remote-url-oci-probe.md](../../docs/planning/remote-url-oci-probe.md)
- [docs/planning/review-prompts.md](../../docs/planning/review-prompts.md)
- [docs/planning/server-account-pitch.md](../../docs/planning/server-account-pitch.md)
- [docs/planning/serverless-verified-install-plan.md](../../docs/planning/serverless-verified-install-plan.md)
- [docs/planning/sveltos-fleet-brief.md](../../docs/planning/sveltos-fleet-brief.md)
- [docs/planning/top20-full-proof-target.md](../../docs/planning/top20-full-proof-target.md)
- [docs/planning/top500-matrix-refresh-review.md](../../docs/planning/top500-matrix-refresh-review.md)
- [docs/planning/user-journey-test-pathways-brief.md](../../docs/planning/user-journey-test-pathways-brief.md)
- [docs/planning/verified-install-commercial-model.md](../../docs/planning/verified-install-commercial-model.md)
- [docs/reference/aicr-composition-model.md](../../docs/reference/aicr-composition-model.md)
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
- [docs/reference/helm-user-pain-evidence.md](../../docs/reference/helm-user-pain-evidence.md)
- [docs/reference/how-the-catalog-is-built.md](../../docs/reference/how-the-catalog-is-built.md)
- [docs/reference/lane-test-doctrine.md](../../docs/reference/lane-test-doctrine.md)
- [docs/reference/observation-freshness-slo.md](../../docs/reference/observation-freshness-slo.md)
- [docs/reference/per-chart-recipes.md](../../docs/reference/per-chart-recipes.md)
- [docs/reference/promotion-diff-classes.md](../../docs/reference/promotion-diff-classes.md)
- [docs/reference/redis-worked-example.md](../../docs/reference/redis-worked-example.md)
- [docs/reference/seven-stage-helm-lifecycle.md](../../docs/reference/seven-stage-helm-lifecycle.md)
- [docs/reference/two-cluster-parity-harness.md](../../docs/reference/two-cluster-parity-harness.md)
- [docs/reference/upgrade-rollback-receipts.md](../../docs/reference/upgrade-rollback-receipts.md)
- [docs/reference/variant-creation-artifact.md](../../docs/reference/variant-creation-artifact.md)
- [docs/reference/variant-creator-verification.md](../../docs/reference/variant-creator-verification.md)
- [docs/reference/verification-properties.md](../../docs/reference/verification-properties.md)
- [docs/user/adopting-existing-apps.md](../../docs/user/adopting-existing-apps.md)
- [docs/user/app-to-live-walkthrough.md](../../docs/user/app-to-live-walkthrough.md)
- [docs/user/approval-story.md](../../docs/user/approval-story.md)
- [docs/user/broken-chart-triage.md](../../docs/user/broken-chart-triage.md)
- [docs/user/change-routing-before-oci.md](../../docs/user/change-routing-before-oci.md)
- [docs/user/choose-your-path.md](../../docs/user/choose-your-path.md)
- [docs/user/confighub-data-model.md](../../docs/user/confighub-data-model.md)
- [docs/user/configuration-question-workflow.md](../../docs/user/configuration-question-workflow.md)
- [docs/user/creating-variants.md](../../docs/user/creating-variants.md)
- [docs/user/cub-variant-command-surface.md](../../docs/user/cub-variant-command-surface.md)
- [docs/user/custom-overlays.md](../../docs/user/custom-overlays.md)
- [docs/user/derived-variant-walkthrough.md](../../docs/user/derived-variant-walkthrough.md)
- [docs/user/example-rendered-diff.md](../../docs/user/example-rendered-diff.md)
- [docs/user/existing-helm-release-diagnostic.md](../../docs/user/existing-helm-release-diagnostic.md)
- [docs/user/expected-results-and-clusters.md](../../docs/user/expected-results-and-clusters.md)
- [docs/user/first-run-walkthrough.md](../../docs/user/first-run-walkthrough.md)
- [docs/user/how-the-harness-works.md](../../docs/user/how-the-harness-works.md)
- [docs/user/introduction-to-the-harness.md](../../docs/user/introduction-to-the-harness.md)
- [docs/user/large-config-operations.md](../../docs/user/large-config-operations.md)
- [docs/user/maintenance-sla.md](../../docs/user/maintenance-sla.md)
- [docs/user/nim-coverage.md](../../docs/user/nim-coverage.md)
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
