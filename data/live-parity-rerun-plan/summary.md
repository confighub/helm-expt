# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

```text
rows: 30
lifecycle-routed-not-active-rerun: 0
useful-base-resolved-not-active-rerun: 1
blocked: 3
watch: 27
configHub-oci-live-comparison: 24
two-cluster-kind-parity: 6
semantic-parity-defects: 1
infra-or-rig-rows: 0
prerequisite-or-lifecycle-rows: 3
runtime-or-watch-rows: 24
```

## Current Interpretation

1 row(s) currently point at an object-set parity defect; inspect those first. The rows below are the active work queue for stronger live
claims. 1 row(s) are documented below as resolved by a separate useful base and are no longer active rerun work.

| Chart | Base | Current | Meaning | Next action |
| --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.17` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/mongodb@19.0.9` | existing-secret-replicaset | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/mongodb@19.1.0` | existing-secret-replicaset | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/nginx@24.0.4` | existing-tls-ingress | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/nginx@25.0.0` | existing-tls-ingress | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/opensearch@2.0.10` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/opensearch@2.0.10` | ha | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `elastic/filebeat@8.5.1` | default | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `elastic/filebeat@8.5.1` | node-or-cluster-collector | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `fluent/fluentd@0.5.3` | default | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `grafana/pyroscope@2.0.2` | default | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `grafana/pyroscope@2.0.2` | no-crds | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `grafana/tempo@1.24.4` | s3-query-observability | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `hashicorp/terraform@1.1.2` | default | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `hashicorp/vault@0.32.0` | ha-raft-ui | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `jetstack/trust-manager@v0.22.1` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `kyverno/kyverno-policies@3.8.0` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `linkerd/linkerd-crds@1.8.0` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `minio-operator/tenant@7.1.1` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `open-telemetry/opentelemetry-operator@0.114.0` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `prometheus-community/prometheus@29.9.0` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `traefik/traefik@40.2.0` | no-crds | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `rook-release/rook-ceph-cluster@v1.19.5` | default | blocked | Inspect receipt before rerun. | Open a dedicated parity issue only if the semantic object comparison fails. |
| `bitnami/opensearch@2.0.10` | default | blocked | Semantic object comparison did not pass. Inspect the diff before changing waits or target provisioning. | Open a parity issue only if the diff is not an intentional, documented normalization. |
| `autoscaler/cluster-autoscaler@9.57.0` | controller-default-reviewed | blocked | Rerun the same chart/base with two clean vanilla kind clusters before changing the recipe. | If blocked again, classify as recipe issue, target-fact/prerequisite issue, or chart runtime issue from the receipt. |
| `fairwinds-stable/vpa@4.11.0` | no-crds | watch | The target is missing required API types or prerequisites. Stage them, then rerun the same base. | Record the prerequisite in the chart facts, base variant, or install checks before promoting. |
| `kedacore/keda@2.19.0` | no-crds | watch | The target is missing required API types or prerequisites. Stage them, then rerun the same base. | Record the prerequisite in the chart facts, base variant, or install checks before promoting. |
| `fairwinds-stable/vpa@4.11.0` | default | watch | Object parity passed; rerun only after target resources, storage, and readiness waits are appropriate. | Keep the recipe stable unless the rendered object comparison starts failing. |
| `kyverno/kyverno-policies@3.8.0` | default | watch | Rerun once on a clean pair of vanilla kind clusters; if object parity remains clean, decide whether readiness should stay watch. | Do not change chart artifacts unless semantic parity or object readiness shows a real difference. |


## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| configHub-oci-live-comparison | 24 | 0 | 23 | 1 | 0 |
| two-cluster-kind-parity | 6 | 0 | 4 | 2 | 0 |

Rows in this queue are non-pass live parity rows that need a decision before
the next claim can be made. A `watch` row usually means object parity passed
and runtime/controller health needs review. A `blocked` row can come from
either lane and may be infrastructure, prerequisite, lifecycle, target-fit, or
upstream-runtime work. Only `parity:` rows indicate an object-set defect.

## Recommended Order

1. Inspect any `parity:` rows first. Those are the only rows that currently
   point at an object-set difference.
2. Re-run any `infra:` rows on a clean host, one at a time.
3. Resolve `target-prerequisite:`, `target-fit:`, and `helm-hook:` rows by
   staging the prerequisite, choosing a suitable target, or choosing the
   lifecycle route before rerunning.
4. Review `target-runtime:`, `helm-runtime:`, and `watch` rows last. They
   usually mean object parity passed and the target needs a readiness, storage,
   capacity, or operating-policy decision.

## Next Step Buckets

| Next step | Rows | What to do |
| --- | ---: | --- |
| gitops-runtime-review | 16 | Inspect GitOps/controller health; rerun after target conditions or controller waits are corrected. |
| inspect-parity-diff | 1 | Inspect the object diff before changing waits, target provisioning, or the recipe. |
| inspect-receipt | 1 | Read the receipt and classify the row before rerunning. |
| operating-policy | 1 | Record the operating policy decision, then rerun only if the expected readiness changes. |
| runtime-review | 8 | Inspect runtime readiness, waits, storage, capacity, or app initialization before rerunning. |
| stage-prerequisite | 3 | Stage or model CRDs, APIs, Secrets, storage, or another prerequisite before rerunning. |

Rows in `stage-prerequisite`, `lifecycle-route`, and `operating-policy`
usually need a model or target decision before another rerun is useful. Rows in
`runtime-review` and `gitops-runtime-review` are good rerun candidates only
after the receipt explains what readiness, storage, controller, or wait
condition changed.

## Rerun Readiness

This table separates rows that need modeling or target work from rows that are
reasonable live rerun candidates.

| Readiness | Rows | Meaning |
| --- | ---: | --- |
| inspect-diff-first | 1 | Do not rerun until the semantic diff has been inspected. |
| inspect-receipt-first | 1 | Read the receipt and classify the row before rerunning. |
| model-or-stage-first | 4 | Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning. |
| review-target-first | 24 | Review runtime, storage, controller health, or wait conditions before rerunning. |

## Resolved By Useful Base

These rows are no longer active rerun work. The raw base still has a non-pass
receipt, but a separate useful base models the required render inputs and has a
passing live receipt. The product answer is to use or promote the useful base,
not to keep rerunning a known missing-values render.

| Chart | Raw base | Useful base | Receipt | Reason |
| --- | --- | --- | --- | --- |
| `autoscaler/cluster-autoscaler@9.57.0` | default | controller-default-reviewed | [receipt](../../runs/live-helm-confighub-compare/autoscaler-cluster-autoscaler-controller-default-reviewed/receipt.yaml) | required render inputs are modeled in a useful values-profile base with passing live evidence |


## Run Safety

Run live parity reruns serially. Do not run two live parity commands at the
same time from different terminals or agents. The live harness creates and
prunes parity-owned kind clusters and related local resources; concurrent runs
can delete each other's in-flight cluster and produce a false infrastructure
failure.

If several rows need reruns, run one command, let it finish, inspect the
receipt, regenerate the relevant summary, then move to the next row.

## Repository Overrides

Some pinned public chart versions remain available from OCI even when the classic
Helm repository index no longer exposes them. The generated commands include an
explicit `--repo-url` override for those rows. This keeps the rerun command
faithful to the locked chart/version without changing the recipe.

## Rerun Queue

| Priority | Readiness | Next step | Lane | Chart | Base | Current | Reason | Support artifact | Command |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `argo-cd/argo-cd@9.5.17` | default | watch | gitops-runtime: child Argo Application not materialized (parity passed) | [`recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml`](../../recipes/argo-cd/argo-cd/9.5.17/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/argo-cd/argo-cd/9.5.17 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `bitnami/mongodb@19.0.9` | existing-secret-replicaset | watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [`recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml`](../../recipes/bitnami/mongodb/19.0.9/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.0.9 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `bitnami/mongodb@19.1.0` | existing-secret-replicaset | watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [`recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml`](../../recipes/bitnami/mongodb/19.1.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/bitnami/mongodb/19.1.0 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `bitnami/nginx@24.0.4` | existing-tls-ingress | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml`](../../recipes/bitnami/nginx/24.0.4/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/bitnami/nginx/24.0.4 --base existing-tls-ingress --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `bitnami/nginx@25.0.0` | existing-tls-ingress | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml`](../../recipes/bitnami/nginx/25.0.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/bitnami/nginx/25.0.0 --base existing-tls-ingress --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `bitnami/opensearch@2.0.10` | default | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/bitnami/opensearch/2.0.10/gitops-runtime-review.yaml`](../../recipes/bitnami/opensearch/2.0.10/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/bitnami/opensearch/2.0.10 --base default --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `bitnami/opensearch@2.0.10` | ha | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/bitnami/opensearch/2.0.10/gitops-runtime-review.yaml`](../../recipes/bitnami/opensearch/2.0.10/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/bitnami/opensearch/2.0.10 --base ha --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `elastic/filebeat@8.5.1` | default | watch | target-runtime: pod ContainerCreating (parity passed) | [`recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml`](../../recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml) | `npm run live-parity:run -- --recipe recipes/elastic/filebeat/8.5.1 --base default` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `elastic/filebeat@8.5.1` | node-or-cluster-collector | watch | target-runtime: pod ContainerCreating (parity passed) | [`recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml`](../../recipes/elastic/filebeat/8.5.1/target-prerequisite-plan.yaml) | `npm run live-parity:run -- --recipe recipes/elastic/filebeat/8.5.1 --base node-or-cluster-collector` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `fluent/fluentd@0.5.3` | default | watch | target-runtime: pod config/runtime errors (parity passed) | [`recipes/fluent/fluentd/0.5.3/runtime-review.yaml`](../../recipes/fluent/fluentd/0.5.3/runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/fluent/fluentd/0.5.3 --base default` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `grafana/pyroscope@2.0.2` | default | watch | target-runtime: ConfigHub workload not ready (parity passed) | [`recipes/grafana/pyroscope/2.0.2/runtime-review.yaml`](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base default` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `grafana/pyroscope@2.0.2` | no-crds | watch | target-runtime: ConfigHub workload not ready (parity passed) | [`recipes/grafana/pyroscope/2.0.2/runtime-review.yaml`](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base no-crds` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `grafana/tempo@1.24.4` | s3-query-observability | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml`](../../recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/grafana/tempo/1.24.4 --base s3-query-observability` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml`](../../recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/hashicorp/consul/2.0.0 --base secure-mesh-existing-secrets --target-profile kind-three-node` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `hashicorp/terraform@1.1.2` | default | watch | target-runtime: pod ContainerCreating (parity passed) | [`recipes/hashicorp/terraform/1.1.2/target-prerequisite-plan.yaml`](../../recipes/hashicorp/terraform/1.1.2/target-prerequisite-plan.yaml) | `npm run live-parity:run -- --recipe recipes/hashicorp/terraform/1.1.2 --base default` |
| 30 | model-or-stage-first | operating-policy | configHub-oci-live-comparison | `hashicorp/vault@0.32.0` | ha-raft-ui | watch | operate-policy: Vault init/unseal readiness (parity passed) | [`recipes/hashicorp/vault/0.32.0/operating-policy.yaml`](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) | `npm run live-parity:run -- --recipe recipes/hashicorp/vault/0.32.0 --base ha-raft-ui` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `jetstack/trust-manager@v0.22.1` | default | watch | gitops-runtime: Argo health Progressing (parity passed) | - | `npm run live-parity:run -- --recipe recipes/jetstack/trust-manager/v0.22.1 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `kyverno/kyverno-policies@3.8.0` | default | watch | gitops-runtime: ClusterPolicy OutOfSync health Healthy (parity passed) | [`recipes/kyverno/kyverno-policies/3.8.0/gitops-runtime-review.yaml`](../../recipes/kyverno/kyverno-policies/3.8.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/kyverno/kyverno-policies/3.8.0 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `linkerd/linkerd-crds@1.8.0` | default | watch | gitops-runtime: CustomResourceDefinition OutOfSync health Healthy (parity passed) | [`recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml`](../../recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/linkerd/linkerd-crds/1.8.0 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `minio-operator/tenant@7.1.1` | default | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/minio-operator/tenant/7.1.1/gitops-runtime-review.yaml`](../../recipes/minio-operator/tenant/7.1.1/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/minio-operator/tenant/7.1.1 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `open-telemetry/opentelemetry-operator@0.114.0` | default | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml`](../../recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/open-telemetry/opentelemetry-operator/0.114.0 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `prometheus-community/prometheus@29.9.0` | default | watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [`recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml`](../../recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/prometheus-community/prometheus/29.9.0 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `traefik/traefik@40.2.0` | no-crds | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml`](../../recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/traefik/traefik/40.2.0 --base no-crds` |
| 40 | model-or-stage-first | stage-prerequisite | configHub-oci-live-comparison | `rook-release/rook-ceph-cluster@v1.19.5` | default | blocked | target-prerequisite: namespace missing (parity passed) | [`recipes/rook-release/rook-ceph-cluster/v1.19.5/target-prerequisite-plan.yaml`](../../recipes/rook-release/rook-ceph-cluster/v1.19.5/target-prerequisite-plan.yaml) | `npm run live-parity:run -- --recipe recipes/rook-release/rook-ceph-cluster/v1.19.5 --base default` |
| 45 | inspect-diff-first | inspect-parity-diff | two-cluster-kind-parity | `bitnami/opensearch@2.0.10` | default | blocked | parity: semantic object diff | - | `npm run kind-parity:run -- --chart bitnami/opensearch --version 2.0.10 --base default --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 50 | inspect-receipt-first | inspect-receipt | two-cluster-kind-parity | `autoscaler/cluster-autoscaler@9.57.0` | controller-default-reviewed | blocked | blocked: inspect receipt | - | `npm run kind-parity:run -- --chart autoscaler/cluster-autoscaler --version 9.57.0 --base controller-default-reviewed` |
| 50 | model-or-stage-first | stage-prerequisite | two-cluster-kind-parity | `fairwinds-stable/vpa@4.11.0` | no-crds | watch | target-prerequisite: CRDs disabled or missing (parity passed) | - | `npm run kind-parity:run -- --chart fairwinds-stable/vpa --version 4.11.0 --base no-crds` |
| 50 | model-or-stage-first | stage-prerequisite | two-cluster-kind-parity | `kedacore/keda@2.19.0` | no-crds | watch | target-prerequisite: required Secret missing (parity passed) | - | `npm run kind-parity:run -- --chart kedacore/keda --version 2.19.0 --base no-crds` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `fairwinds-stable/vpa@4.11.0` | default | watch | target-runtime: pod crash loop (parity passed) | - | `npm run kind-parity:run -- --chart fairwinds-stable/vpa --version 4.11.0 --base default` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `kyverno/kyverno-policies@3.8.0` | default | watch | watch: object parity passed; readiness needs review | - | `npm run kind-parity:run -- --chart kyverno/kyverno-policies --version 3.8.0 --base default` |



The machine-readable queue is:

```text
data/live-parity-rerun-plan/rerun-plan.csv
```
