# Top 50 Completion Plan

This is the maintained completion tracker for the public configuration catalog
and its path into ConfigHub. It replaces conversational task counts with fifty
stable task IDs, current evidence, verification commands, and a concrete
completion step.

Generated from [config-catalog/top50.yaml](../../config-catalog/top50.yaml).
Edit that source and run `npm run top50:completion`.

## Current State

```text
available: 29
partial:   19
planned:   2
blocked:   0
total:     50
```

`available` means the named scope has a usable, verified path. It does not
claim that every chart, input format, target, or controller is complete.
`partial` means a representative path works but a material part remains.
`planned` has no complete end-to-end proof yet. `blocked` names the defect
that prevents its completion check from passing.

## Programme Boundary

Track the fifty outcomes required to turn the public configuration catalog into a useful path from Helm, AICR, cub installer, OCI, or Kubernetes YAML through ConfigHub and back to deployable OCI.

The source status definitions are:

| Status | Meaning |
| --- | --- |
| available | The named scope has a usable path, committed evidence, and a verifier. This does not imply support for every chart, source, or target. |
| partial | A representative path works, but an important delivery target, source type, catalog segment, lifecycle case, or product surface remains open. |
| planned | The outcome is agreed but does not yet have an end-to-end proof. |
| blocked | A named defect or external decision currently prevents the completion check from passing. |

## Public front door

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T01 | Pull one ready-made OCI package without an account | available | [data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md)<br>[docs/user/installer-oci-packages.md](../../docs/user/installer-oci-packages.md)<br>[data/redis-public-walkthrough-proof/summary.md](../../data/redis-public-walkthrough-proof/summary.md)<br>[runs/redis-public-walkthrough-proof/receipt.yaml](../../runs/redis-public-walkthrough-proof/receipt.yaml) | Keep every published package reference current when recipes or package contents change. |
| T02 | Explain the package source and provenance | available | [data/helm-render-intents/summary.md](../../data/helm-render-intents/summary.md)<br>[data/installer-oci-packages/packages.csv](../../data/installer-oci-packages/packages.csv) | Keep the source record beside every additional format added to the catalog. |
| T03 | Inspect recorded Helm inputs and rendered objects | available | [docs/user/helm-render-intents.md](../../docs/user/helm-render-intents.md)<br>[data/helm-render-intents/summary.md](../../data/helm-render-intents/summary.md)<br>[data/redis-public-walkthrough-proof/summary.md](../../data/redis-public-walkthrough-proof/summary.md) | Extend the same readable input record to every non-Helm source format. |
| T04 | Verify Helm-equivalent output | available | [data/outcome-coverage/summary.md](../../data/outcome-coverage/summary.md)<br>[data/live-kind-parity/summary.md](../../data/live-kind-parity/summary.md) | Rerun parity whenever a chart version, preset config, renderer, or target capability profile changes. |
| T05 | Show prerequisites and lifecycle work before deployment | partial | [data/lifecycle-routes/summary.md](../../data/lifecycle-routes/summary.md)<br>[data/hook-lifecycle/summary.md](../../data/hook-lifecycle/summary.md)<br>[docs/user/target-prerequisites.md](../../docs/user/target-prerequisites.md) | Turn more candidate routes into chart-specific receipts and keep unsupported routes as named blockers. |
| T06 | Run the public path locally without ConfigHub | available | [docs/user/serverless-mode.md](../../docs/user/serverless-mode.md)<br>[data/redis-public-walkthrough-proof/summary.md](../../data/redis-public-walkthrough-proof/summary.md)<br>[runs/redis-public-walkthrough-proof/receipt.yaml](../../runs/redis-public-walkthrough-proof/receipt.yaml)<br>[runs/serverless-oci-gitops-proof/receipt.yaml](../../runs/serverless-oci-gitops-proof/receipt.yaml) | Keep the command surface aligned with released cub installer behavior. |
| T07 | Run the anonymous path in CI | available | [runs/anonymous-oci-ci-proof/receipt.yaml](../../runs/anonymous-oci-ci-proof/receipt.yaml)<br>[data/demo-program/summary.md](../../data/demo-program/summary.md) | Publish a copyable CI workflow for each supported input family. |
| T08 | Offer a hosted anonymous inspection service | planned | [config-catalog/program.yaml](../../config-catalog/program.yaml)<br>[docs/reference/config-catalog-doctrine.md](../../docs/reference/config-catalog-doctrine.md) | Choose the hosting and abuse-control model, then prove one public request from source to immutable OCI. |

## Bring your own config

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T09 | Review a chart and values supplied by the user | available | [data/byo-helm-values-review/summary.md](../../data/byo-helm-values-review/summary.md)<br>[runs/byo-helm-values-proof/receipt.yaml](../../runs/byo-helm-values-proof/receipt.yaml) | Add private-chart and dependency-auth examples without weakening source-lock requirements. |
| T10 | Review values proposed by AI | available | [docs/user/ai-assisted-helm-changes.md](../../docs/user/ai-assisted-helm-changes.md)<br>[data/byo-helm-values-review/review.yaml](../../data/byo-helm-values-review/review.yaml)<br>[runs/ai-change-review-live-proof/receipt.yaml](../../runs/ai-change-review-live-proof/receipt.yaml) | Add more chart classes and target-aware checks rather than treating one NGINX example as universal. |
| T11 | Build deployable OCI from reviewed source | available | [runs/byo-helm-values-proof/public-oci-receipt.yaml](../../runs/byo-helm-values-proof/public-oci-receipt.yaml)<br>[data/byo-helm-values-review/public-and-confighub.md](../../data/byo-helm-values-review/public-and-confighub.md) | Generalize the build entry point across Helm, AICR, installer packages, and plain Kubernetes YAML. |
| T12 | Inspect and test an existing OCI package | available | [docs/user/inspect-oci-package.md](../../docs/user/inspect-oci-package.md)<br>[data/oci-inspection/summary.md](../../data/oci-inspection/summary.md)<br>[runs/aicr-oci-roundtrip-proof/receipt.yaml](../../runs/aicr-oci-roundtrip-proof/receipt.yaml)<br>[runs/serverless-oci-gitops-proof/receipt.yaml](../../runs/serverless-oci-gitops-proof/receipt.yaml) | Add signature checks and consumer-specific validation without confusing them with the package inspection report. |
| T13 | Transform OCI to OCI without requiring ConfigHub | available | [docs/user/transform-oci-package.md](../../docs/user/transform-oci-package.md)<br>[data/anonymous-oci-transform-proof/summary.md](../../data/anonymous-oci-transform-proof/summary.md)<br>[runs/anonymous-oci-transform-proof/receipt.yaml](../../runs/anonymous-oci-transform-proof/receipt.yaml) | Add patch-file input, signature checks, and a deliberate authenticated registry-publish step. |

## Source pathways

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T14 | Turn AICR input into managed configuration | partial | [examples/aicr/eks-h100-training-kubeflow/recipe.yaml](../../examples/aicr/eks-h100-training-kubeflow/recipe.yaml)<br>[data/aicr-oci-roundtrip-proof/summary.md](../../data/aicr-oci-roundtrip-proof/summary.md)<br>[runs/aicr-oci-roundtrip-proof/receipt.yaml](../../runs/aicr-oci-roundtrip-proof/receipt.yaml)<br>[runs/aicr-variant-promotion-proof/receipt.yaml](../../runs/aicr-variant-promotion-proof/receipt.yaml) | Deliver the promoted configuration through Argo CD and Flux and record live GPU-target evidence. |
| T15 | Turn a cub installer package into rendered OCI | available | [data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md)<br>[docs/user/installer-oci-packages.md](../../docs/user/installer-oci-packages.md)<br>[data/redis-public-walkthrough-proof/summary.md](../../data/redis-public-walkthrough-proof/summary.md)<br>[runs/redis-public-walkthrough-proof/receipt.yaml](../../runs/redis-public-walkthrough-proof/receipt.yaml) | Keep both the multi-preset source packages and the rendered OCI output path synchronized with current installer behavior. |
| T16 | Upload literal Kubernetes YAML without rerendering | available | [docs/user/adopting-existing-apps.md](../../docs/user/adopting-existing-apps.md)<br>[docs/user/app-to-live-walkthrough.md](../../docs/user/app-to-live-walkthrough.md) | Add a small executable receipt that isolates literal YAML upload from the wider App walkthrough. |

## ConfigHub records

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T17 | Claim reviewed OCI as a ConfigHub base variant | available | [data/base-variant-records/summary.md](../../data/base-variant-records/summary.md)<br>[runs/aicr-oci-roundtrip-proof/receipt.yaml](../../runs/aicr-oci-roundtrip-proof/receipt.yaml) | Use one upload contract for all supported source-neutral OCI inputs. |
| T18 | Attach render context and route intent to every base variant | partial | [data/helm-render-intents/summary.md](../../data/helm-render-intents/summary.md)<br>[data/helm-render-intents/contract-gaps.md](../../data/helm-render-intents/contract-gaps.md)<br>[data/master-catalog-matrix/summary.md](../../data/master-catalog-matrix/summary.md)<br>[data/lifecycle-routes/summary.md](../../data/lifecycle-routes/summary.md)<br>[docs/user/helm-render-intents.md](../../docs/user/helm-render-intents.md) | Work through the generated route and target-prerequisite gaps until every base has an exact attached contract or an explicit no-extra-work decision. [Issue](https://github.com/confighub/helm-expt/issues/1037) |
| T19 | Create derived variants by editing exact objects | available | [data/variant-goldens/derived-expansion-wave/README.md](../../data/variant-goldens/derived-expansion-wave/README.md)<br>`runs/derived-variant-execution/` | Keep derived changes linked to their base and add target-bound receipts where delivery is claimed. |
| T20 | Keep approved object edits through source upgrades | partial | [data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md)<br>[runs/redis-upgrade-app-proof/receipt.yaml](../../runs/redis-upgrade-app-proof/receipt.yaml) | Repeat the upgrade proof on another chart and add a useful mutation preview for promotion dry runs. |
| T21 | Promote through development staging and production | partial | [data/byo-helm-values-promotion-proof/summary.md](../../data/byo-helm-values-promotion-proof/summary.md)<br>[runs/aicr-variant-promotion-proof/receipt.yaml](../../runs/aicr-variant-promotion-proof/receipt.yaml) | Add production delivery, rollback, and readable dry-run output to the representative promotion paths. |

## Policy and approval

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T22 | Block unsafe configuration and require approval at high-risk boundaries | available | [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml)<br>[data/apply-policy-profiles/live-helm-catalog.yaml](../../data/apply-policy-profiles/live-helm-catalog.yaml)<br>[runs/config-catalog-policy-functional-proof/receipt.yaml](../../runs/config-catalog-policy-functional-proof/receipt.yaml)<br>[runs/ai-change-review-live-proof/receipt.yaml](../../runs/ai-change-review-live-proof/receipt.yaml)<br>[examples/kubara/local-platform/confighub-upload-receipt.yaml](../../examples/kubara/local-platform/confighub-upload-receipt.yaml)<br>[examples/sveltos/kyverno-fleet/live-receipt.yaml](../../examples/sveltos/kyverno-fleet/live-receipt.yaml) | Add resource-aware field checks for more custom-resource APIs without weakening the common policy or making ordinary warnings blocking. |
| T23 | Make policy checks source-neutral | available | [config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml)<br>[data/ai-change-review-live-proof/summary.md](../../data/ai-change-review-live-proof/summary.md)<br>[runs/ai-change-review-live-proof/receipt.yaml](../../runs/ai-change-review-live-proof/receipt.yaml) | Add checks for more custom-resource versions and teach target-specific checks to read recorded target facts instead of hard-coding one cluster's limits. |

## OCI output

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T24 | Publish reviewed ConfigHub Units as OCI | available | [data/catalog-oci-delivery-proof/summary.md](../../data/catalog-oci-delivery-proof/summary.md)<br>[runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml) | Keep the release and portable OCI roles clearly distinguished in every guide and command. |
| T25 | Preserve digest identity and provenance through the round trip | partial | [docs/user/chain-of-proof.md](../../docs/user/chain-of-proof.md)<br>[data/oci-evidence-chains/summary.md](../../data/oci-evidence-chains/summary.md)<br>[schemas/oci-evidence-chain.schema.json](../../schemas/oci-evidence-chain.schema.json)<br>[runs/aicr-oci-roundtrip-proof/receipt.yaml](../../runs/aicr-oci-roundtrip-proof/receipt.yaml)<br>[runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml) | Deliver and observe the AICR path on a suitable GPU target; it is the one source family whose standardized chain still stops at the output OCI. |

## Delivery

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T26 | Deliver reviewed OCI through Argo CD | available | [data/runtime-gitops/summary.md](../../data/runtime-gitops/summary.md)<br>[runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml) | Maintain fresh controller and workload receipts for every path that claims Argo CD delivery. |
| T27 | Deliver reviewed OCI through Flux | available | [runs/serverless-oci-gitops-proof/receipt.yaml](../../runs/serverless-oci-gitops-proof/receipt.yaml)<br>[runs/oci-deploy-stage-rollout-proof/receipt.yaml](../../runs/oci-deploy-stage-rollout-proof/receipt.yaml)<br>[docs/user/gitops-adopter-guide.md](../../docs/user/gitops-adopter-guide.md) | Maintain the ConfigHub-output Flux receipt and add representative AICR and lifecycle-route Flux evidence. |
| T28 | Deliver reviewed objects by direct apply | available | [docs/user/serverless-mode.md](../../docs/user/serverless-mode.md)<br>[data/live-kind-parity/summary.md](../../data/live-kind-parity/summary.md) | Keep direct apply as a simple option while making interruptions and lifecycle ordering explicit. |
| T29 | Record live convergence and observation freshness | partial | [data/live-e2e/summary.md](../../data/live-e2e/summary.md)<br>[docs/reference/observation-freshness-slo.md](../../docs/reference/observation-freshness-slo.md) | Store more live observations in ConfigHub and refresh receipts when target state or packages change. |
| T30 | Roll back or unwind a reviewed change | available | [docs/user/day2-upgrade-rollback.md](../../docs/user/day2-upgrade-rollback.md)<br>[docs/reference/upgrade-rollback-receipts.md](../../docs/reference/upgrade-rollback-receipts.md)<br>[data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md)<br>[runs/redis-upgrade-app-proof/receipt.yaml](../../runs/redis-upgrade-app-proof/receipt.yaml) | Repeat the receipt pattern for charts with CRD changes, hooks, or data migrations whose rollback limits need a chart-specific recovery plan. |

## Fleet operations

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T31 | Preview fleet blast radius before rollout | partial | [data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md)<br>[data/blast-radius-accuracy/summary.md](../../data/blast-radius-accuracy/summary.md) | Increase measured cases and report misses and false predictions for every supported inheritance pattern. |
| T32 | Roll out one revision in bounded waves | partial | [data/oci-deploy-stage-rollout-proof/summary.md](../../data/oci-deploy-stage-rollout-proof/summary.md)<br>[data/sveltos-oci-delivery-proof/summary.md](../../data/sveltos-oci-delivery-proof/summary.md) | Prove the same bounded rollout using a mixed-source platform fleet and production approval. |
| T33 | Manage a Sveltos fleet from reviewed OCI | partial | [docs/demo/sveltos/kyverno-fleet.md](../../docs/demo/sveltos/kyverno-fleet.md)<br>[runs/sveltos-oci-delivery-proof/receipt.yaml](../../runs/sveltos-oci-delivery-proof/receipt.yaml) | Add rollback, larger selectors, and a source update that exercises ConfigHub variant propagation. |
| T34 | Manage a Kubara platform configuration | partial | [docs/demo/kubara/local-platform.md](../../docs/demo/kubara/local-platform.md)<br>[runs/kubara-oci-delivery-proof/receipt.yaml](../../runs/kubara-oci-delivery-proof/receipt.yaml) | Add a multi-cluster Kubara rollout and show which fleet CRD fields are intended to vary. |
| T35 | Distinguish workloads services and system configuration | available | [config-catalog/operational-class-examples.yaml](../../config-catalog/operational-class-examples.yaml)<br>[data/operational-class-examples/summary.md](../../data/operational-class-examples/summary.md)<br>[data/apply-policy-profiles/live-helm-catalog.yaml](../../data/apply-policy-profiles/live-helm-catalog.yaml) | Classify more catalog records only after their owner, target scope, gate set, rollout choice, and evidence are known. |

## ConfigHub Apps

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T36 | Complete the Upgrade App | partial | [data/redis-upgrade-app-proof/summary.md](../../data/redis-upgrade-app-proof/summary.md)<br>[runs/redis-upgrade-app-proof/receipt.yaml](../../runs/redis-upgrade-app-proof/receipt.yaml) | Add the product App interface, readable promotion preview, persistent registry, and stored live observations. |
| T37 | Complete the Hooks and CRDs App | partial | [docs/demo/hooks-crds/kube-prometheus-stack.md](../../docs/demo/hooks-crds/kube-prometheus-stack.md)<br>[data/hooks-crds-app/summary.md](../../data/hooks-crds-app/summary.md)<br>[data/kps-gitops-lifecycle-proof/summary.md](../../data/kps-gitops-lifecycle-proof/summary.md)<br>[runs/kps-gitops-lifecycle-proof/receipt.yaml](../../runs/kps-gitops-lifecycle-proof/receipt.yaml) | Add the product App interface and automatic route selection, then test rollback and post-success cleanup before widening the claim. |
| T38 | Complete the RBAC Review App | partial | [docs/demo/apps/rbac-review.md](../../docs/demo/apps/rbac-review.md)<br>[runs/rbac-review-live-proof/receipt.yaml](../../runs/rbac-review-live-proof/receipt.yaml) | Query a real fleet binding graph and prove Flux delivery, rollback, and rollout of an approved correction. |
| T39 | Complete the Fleet Platform App | partial | [data/demo-program/summary.md](../../data/demo-program/summary.md)<br>[data/blast-radius-fleet/summary.md](../../data/blast-radius-fleet/summary.md) | Run one mixed-source fleet wave through a shared interface with target-level observations. |
| T40 | Complete the AI Change Review App | partial | [docs/demo/apps/ai-change-review.md](../../docs/demo/apps/ai-change-review.md)<br>[runs/ai-change-review-live-proof/receipt.yaml](../../runs/ai-change-review-live-proof/receipt.yaml) | Add AICR-aware policy, Kubernetes delivery, promotion, rollback, and live workload evidence. |

## Catalog

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T41 | Maintain public packages for the top 100 Helm charts | available | [data/top100-readiness/summary.md](../../data/top100-readiness/summary.md)<br>[data/installer-oci-packages/summary.md](../../data/installer-oci-packages/summary.md) | Keep all packages reproducible and remove any public reference that no longer passes its package verifier. |
| T42 | Complete production-scoped support decisions for the top 20 | available | [data/production-support-decisions/summary.md](../../data/production-support-decisions/summary.md)<br>[data/production-disposition/summary.md](../../data/production-disposition/summary.md) | Keep supported decisions tied to fresh target and image evidence, and require a new hardened base before reopening a rejected or superseded scope. |
| T43 | Promote the next 80 from proof-grade to useful catalog configs | partial | [data/top100-coverage/summary.md](../../data/top100-coverage/summary.md)<br>[data/useful-base-realization-wave/summary.md](../../data/useful-base-realization-wave/summary.md) | Build the remaining useful-base proposals and review promotion candidates in evidence order. |
| T44 | Expand the catalog beyond Helm | partial | [docs/user/config-catalog-demonstrations.md](../../docs/user/config-catalog-demonstrations.md)<br>[data/demo-program/summary.md](../../data/demo-program/summary.md) | Add stable browse pages and ready-to-use artifacts for every source family rather than leaving them only in demonstrations. |
| T45 | Let users browse by starting point and next job | available | [config-catalog/program.yaml](../../config-catalog/program.yaml)<br>[docs/user/config-catalog-demonstrations.md](../../docs/user/config-catalog-demonstrations.md)<br>[site/charts/index.html](../../site/charts/index.html)<br>[site/testing.html](../../site/testing.html) | Keep both navigation tables and their linked source pages current as starting points and jobs change. |
| T46 | Put one plain-English README in every live demo Space | available | [data/helm-catalog-readmes/summary.md](../../data/helm-catalog-readmes/summary.md)<br>`data/helm-catalog-readmes/spaces/` | Keep README Units synchronized whenever a Space, preset config, route, or linked chart page changes. |
| T47 | Join chart pages to packages scripts README and proof | available | [site/charts/bitnami-redis-25-5-3.html](../../site/charts/bitnami-redis-25-5-3.html)<br>[site/sh/bitnami-redis-25-5-3/reuse-existing-secret/try.sh](../../site/sh/bitnami-redis-25-5-3/reuse-existing-secret/try.sh) | Keep generated links valid and preserve plain-English summaries as the catalog gains more source formats. |
| T48 | Make hooks CRDs and setup work manageable per chart | partial | [docs/user/chart-hooks-what-happens.md](../../docs/user/chart-hooks-what-happens.md)<br>[data/hook-route-candidates/work-orders.md](../../data/hook-route-candidates/work-orders.md)<br>[data/lifecycle-routes/summary.md](../../data/lifecycle-routes/summary.md) | Execute the highest-value route work orders under Argo CD, Flux, and direct apply where each route applies. |

## Release quality

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T49 | Keep the complete repository verification gate green | available | [tests/npm-scripts.md](../../tests/npm-scripts.md)<br>[docs/user/verification.md](../../docs/user/verification.md) | Rerun the complete gate whenever packages, receipts, generated data, docs, or public claims change. |

## Adoption

| ID | Outcome | Status | Current evidence | Completion step |
| --- | --- | --- | --- | --- |
| T50 | Measure whether new users understand and complete the journey | planned | [docs/planning/outside-user-test.md](../../docs/planning/outside-user-test.md)<br>[docs/planning/persona-ux-audit-2026-06-22.md](../../docs/planning/persona-ux-audit-2026-06-22.md) | Run fresh outside-user tests, choose the analytics boundary in issue 1060, and turn observed failures into tracked fixes. [Issue](https://github.com/confighub/helm-expt/issues/1060) |

## Verification

```sh
npm run top50:completion:verify
```

The verifier requires exactly fifty sequential IDs, valid status values,
existing evidence paths, and real npm verification commands. It also checks
that this Markdown summary, the CSV work queue, and the JSON record match the
YAML source.
