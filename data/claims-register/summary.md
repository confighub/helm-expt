# Claims Register

This generated register maps public claims to evidence, verification commands,
and limits. It is a guardrail for reviewers: if a public page says something
stronger than this table, the page should be corrected or the missing evidence
should be added.

## Status

| Status | Count | Meaning |
| --- | ---: | --- |
| `backed` | 4 | Current claim with committed evidence and a scoped verifier. |
| `partial` | 10 | Useful current evidence, but limited by lane, chart, base, target, or coverage. |
| `planned` | 2 | Design or roadmap item. Do not market as shipped behavior. |
| `refused` | 1 | Explicit non-claim used to keep public messaging narrow. |

## Areas

| Area | Claims |
| --- | ---: |
| catalog | 2 |
| commands | 1 |
| commercial | 2 |
| core | 1 |
| delivery | 1 |
| facts | 1 |
| lifecycle | 2 |
| operations | 1 |
| pain-points | 1 |
| refusals | 1 |
| sceptic-tests | 2 |
| variants | 2 |

## Rules

| Rule | Practical effect |
| --- | --- |
| No evidence means no current claim. | Planned features can be described as plans, not shipped behavior. |
| Partial stays partial. | A row with a live receipt in one lane cannot be marketed as a blanket production guarantee. |
| Refusals are part of the product. | Watch, blocked, and refused claims stay visible because they explain where the model is honest. |
| Evidence paths must exist. | `npm run claims:register:verify` fails if a row points at missing evidence. |

## Claims

| ID | Area | Status | Claim | Evidence | Limit |
| --- | --- | --- | --- | --- | --- |
| `render-parity` | core | `backed` | For catalogued bases, cub installer output is compared with regular Helm output under recorded inputs. | [data/outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv)<br>[data/live-kind-parity/summary.md](../live-kind-parity/summary.md)<br>[data/live-helm-confighub-compare/summary.md](../live-helm-confighub-compare/summary.md)<br>[data/lane-test-matrix/summary.md](../lane-test-matrix/summary.md) | The claim is per chart, version, base, values profile, and target profile. It is not a claim over the whole Helm values space. |
| `top20-live-evidence` | catalog | `backed` | The top-20 catalog has committed live evidence, but exact strength still depends on the chart, base, and lane. | [data/status-dashboard/top20-status.csv](../status-dashboard/top20-status.csv)<br>[data/live-e2e/summary.md](../live-e2e/summary.md)<br>[data/top20-base-readiness/summary.md](../top20-base-readiness/summary.md)<br>[data/outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) | This is not a blanket production-support statement. Production support is target-scoped. |
| `top100-proof-corpus` | catalog | `backed` | The top-100 corpus contains maintained proof-grade recipe and package artifacts, with readiness separated from production support. | [data/top100-readiness/summary.md](../top100-readiness/summary.md)<br>[data/top100-coverage/summary.md](../top100-coverage/summary.md)<br>[data/top100-catalog-analysis/summary.md](../top100-catalog-analysis/summary.md)<br>[data/next80-full-proofs/summary.md](../next80-full-proofs/summary.md) | Many top-100 rows still need catalog review, useful variants, production disposition, or selected live lanes. |
| `helm-pain-point-coverage` | pain-points | `partial` | The project maps common Helm pain points to a general solution and per-chart pain reports. | [docs/user/helm-pain-points.md](../../docs/user/helm-pain-points.md)<br>[data/pain-point-coverage/summary.md](../pain-point-coverage/summary.md)<br>[data/pain-point-coverage/pain-points.csv](../pain-point-coverage/pain-points.csv)<br>[recipes/bitnami/redis/25.5.3/helm-pain-report.yaml](../../recipes/bitnami/redis/25.5.3/helm-pain-report.yaml) | Coverage is strongest for the top-20 and for pain points represented in current source scans and receipts. |
| `hooks-lifecycle` | lifecycle | `partial` | Helm hooks and hook-like lifecycle behavior are inventoried and routed to lifecycle receipts, policy, or explicit refusal. | [docs/user/hook-lifecycle-strategy.md](../../docs/user/hook-lifecycle-strategy.md)<br>[data/hook-lifecycle/summary.md](../hook-lifecycle/summary.md)<br>[data/lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md)<br>[runs/hook-lifecycle/gatekeeper-gatekeeper/default/latest/receipt.yaml](../../runs/hook-lifecycle/gatekeeper-gatekeeper/default/latest/receipt.yaml) | Lifecycle proof is still partial. Some hook classes require per-chart observation or target-specific operating policy. |
| `crd-webhook-controller-observation` | lifecycle | `partial` | CRDs, webhooks, and controller-populated fields are treated as lifecycle facts that need fresh observation, not as static YAML certainty. | [data/lifecycle-observations/cert-manager-eso/summary.md](../lifecycle-observations/cert-manager-eso/summary.md)<br>[data/lifecycle-boundary/summary.md](../lifecycle-boundary/summary.md)<br>[docs/user/why-synced-is-not-working.md](../../docs/user/why-synced-is-not-working.md)<br>[docs/user/what-we-refuse-to-claim.md](../../docs/user/what-we-refuse-to-claim.md) | CRD upgrade and controller mutation remain per-chart decisions until more live upgrade receipts exist. |
| `secrets-generated-facts` | facts | `partial` | Generated values, existing secrets, and target facts are separated so secret handling is explicit. | [docs/reference/generated-fact-receipts.md](../../docs/reference/generated-fact-receipts.md)<br>[recipes/bitnami/redis/25.5.3/install-checks.yaml](../../recipes/bitnami/redis/25.5.3/install-checks.yaml)<br>[docs/user/try-now.md](../../docs/user/try-now.md)<br>[data/attack-plan-workdown/secret-gap-workdown.csv](../attack-plan-workdown/secret-gap-workdown.csv) | This does not make ConfigHub a universal secret manager. Some variants require a pre-existing target secret. |
| `config-variants` | variants | `partial` | Base variants are render-time installer choices; derived ConfigHub variants are post-render refinements for target, environment, region, customer, or operations. | [docs/user/creating-variants.md](../../docs/user/creating-variants.md)<br>[docs/user/change-routing-before-oci.md](../../docs/user/change-routing-before-oci.md)<br>[data/variant-goldens/redis-prod-us-east/README.md](../variant-goldens/redis-prod-us-east/README.md)<br>[data/outcome-coverage/derived-variant-outcomes.csv](../outcome-coverage/derived-variant-outcomes.csv) | If a change requires a new Helm render, it belongs back in the installer recipe path. |
| `custom-overlays` | variants | `partial` | Wrapper chart and values-overlay cases can be modeled as managed imports, with customer choices routed to installer bases or ConfigHub derived variants. | [docs/user/custom-overlays.md](../../docs/user/custom-overlays.md)<br>[docs/reference/customization-algorithm.md](../../docs/reference/customization-algorithm.md)<br>[data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md](../managed-overlay-goldens/external-dns-customer-acme-prod/README.md)<br>[docs/corpus/kubara-customized-overlays.md](../../docs/corpus/kubara-customized-overlays.md) | The Kubara-style case is a managed-import pattern, not a free public-catalog guarantee for arbitrary private overlays. |
| `scan-gates-safe-ops` | operations | `partial` | Rendered objects can be scanned, gated, patched, approved, and recorded as ConfigHub operation evidence. | [data/external-scan-lane/summary.md](../external-scan-lane/summary.md)<br>[data/scan-disposition-workdown/summary.md](../scan-disposition-workdown/summary.md)<br>[docs/user/tutorial-sequence.md](../../docs/user/tutorial-sequence.md)<br>[docs/demo/redis/function-scan-lane.md](../../docs/demo/redis/function-scan-lane.md)<br>[docs/demo/redis/safe-ops-lane.md](../../docs/demo/redis/safe-ops-lane.md) | Scanner results and safe-operation examples do not imply every chart is production-approved. |
| `oci-gitops-runtime` | delivery | `partial` | OCI and GitOps delivery are part of the live proof path, with Argo/Flux status separated from local apply evidence. | [data/runtime-gitops/summary.md](../runtime-gitops/summary.md)<br>[data/runtime-gitops/wave1.csv](../runtime-gitops/wave1.csv)<br>[docs/user/adopting-existing-apps.md](../../docs/user/adopting-existing-apps.md)<br>[docs/user/chain-of-proof.md](../../docs/user/chain-of-proof.md) | A green local live row is not the same thing as Argo or Flux pulling ConfigHub OCI successfully. |
| `public-fast-paths` | commands | `backed` | The command story distinguishes quick inspection, quick ConfigHub import, maintained installer recipes, and post-render variants. | [docs/user/choosing-commands.md](../../docs/user/choosing-commands.md)<br>[docs/reference/direct-cub-helm-model.md](../../docs/reference/direct-cub-helm-model.md)<br>[docs/user/why-this-exists.md](../../docs/user/why-this-exists.md)<br>[docs/user/verify-it-yourself.md](../../docs/user/verify-it-yourself.md) | Fast commands do not carry the same evidence as supported catalog packages unless the proof lanes are run. |
| `serverless-verified-install` | commercial | `planned` | A low-friction verified-install path can exist before full paid ConfigHub operations. | [docs/planning/serverless-verified-install-plan.md](../../docs/planning/serverless-verified-install-plan.md)<br>[docs/planning/verified-install-commercial-model.md](../../docs/planning/verified-install-commercial-model.md)<br>[docs/user/product-support-tiers.md](../../docs/user/product-support-tiers.md) | This is planning, not a current shipped anonymous service claim. |
| `commercial-security-signing` | commercial | `planned` | Signed artifacts, factory scans, image digest inventory, refresh SLAs, private catalogs, and fleet queries are commercial directions. | [docs/planning/verified-install-commercial-model.md](../../docs/planning/verified-install-commercial-model.md)<br>[data/image-digest-workdown/summary.md](../image-digest-workdown/summary.md)<br>[docs/user/product-support-tiers.md](../../docs/user/product-support-tiers.md)<br>[docs/user/maintenance-sla.md](../../docs/user/maintenance-sla.md) | Security signing and paid support claims require production key, policy, transparency, and SLA decisions. |
| `blast-radius-prediction` | sceptic-tests | `partial` | Blast-radius prediction is scored by comparing predicted affected objects with actual rerender diffs, from committed base pairs and recorded single-value rerender receipts. | [data/blast-radius-accuracy/summary.md](../blast-radius-accuracy/summary.md)<br>[data/blast-radius-accuracy/cases.csv](../blast-radius-accuracy/cases.csv)<br>[docs/planning/robust-sceptic-plan.md](../../docs/planning/robust-sceptic-plan.md)<br>[data/edge-recovery/summary.md](../edge-recovery/summary.md)<br>[data/high-fanout-demo/summary.md](../high-fanout-demo/summary.md) | Measured coverage is still a small slice of the catalog (current counts are in data/blast-radius-accuracy/summary.md). Whole-release identity paths stay on the backlog until rename-aware scoring exists. |
| `environment-determinism` | sceptic-tests | `partial` | Rendering is recorded as environment-invariant across timezone and locale variations for the measured corpus, per flag profile. | [data/environment-matrix/summary.md](../environment-matrix/summary.md)<br>[data/environment-matrix/matrix.csv](../environment-matrix/matrix.csv)<br>[docs/planning/robust-sceptic-plan.md](../../docs/planning/robust-sceptic-plan.md) | The matrix covers the proof-grade corpus on one operating system, architecture, and helm version; other platforms and helm versions are open columns intended for CI runners. A divergent cell is recorded, not hidden. |
| `refused-blanket-verification` | refusals | `refused` | The project refuses to claim that a chart is verified without naming the exact chart, version, base, lane, and target profile. | [docs/user/what-we-refuse-to-claim.md](../../docs/user/what-we-refuse-to-claim.md)<br>[docs/user/current-proof-status.md](../../docs/user/current-proof-status.md)<br>[docs/user/live-parity.md](../../docs/user/live-parity.md)<br>[data/live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md) | This is a rule that constrains public claims. It does not reduce the work needed to pass more lanes. |

## Regenerate

~~~sh
npm run claims:register
npm run claims:register:verify
~~~
