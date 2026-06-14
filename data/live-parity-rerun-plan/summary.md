# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

```text
rows: 12
lifecycle-routed-not-active-rerun: 0
useful-base-resolved-not-active-rerun: 1
blocked: 0
watch: 12
configHub-oci-live-comparison: 12
two-cluster-kind-parity: 0
semantic-parity-defects: 0
infra-or-rig-rows: 0
prerequisite-or-lifecycle-rows: 0
runtime-or-watch-rows: 11
```

## Current Interpretation

No current row says ConfigHub and Helm produced different Kubernetes object meaning. The rows below are the active work queue for stronger live
claims. 1 row(s) are documented below as resolved by a separate useful base and are no longer active rerun work.

| Chart | Base | Current | Meaning | Next action |
| --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.17` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/mongodb@19.0.9` | existing-secret-replicaset | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/mongodb@19.1.0` | existing-secret-replicaset | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `bitnami/nginx@24.0.4` | existing-tls-ingress | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `grafana/pyroscope@2.0.2` | default | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `grafana/tempo@1.24.4` | s3-query-observability | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `hashicorp/vault@0.32.0` | ha-raft-ui | watch | Receipt exists and comparison did not fail; inspect readiness detail and decide whether this is acceptable target behavior. | Convert to pass only when expected live readiness settles, otherwise keep as watch with a clear target limitation. |
| `linkerd/linkerd-crds@1.8.0` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `open-telemetry/opentelemetry-operator@0.114.0` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `prometheus-community/prometheus@29.9.0` | default | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `traefik/traefik@40.2.0` | no-crds | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |


## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| configHub-oci-live-comparison | 12 | 0 | 12 | 0 | 0 |
| two-cluster-kind-parity | 0 | 0 | 0 | 0 | 0 |

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
| gitops-runtime-review | 10 | Inspect GitOps/controller health; rerun after target conditions or controller waits are corrected. |
| operating-policy | 1 | Record the operating policy decision, then rerun only if the expected readiness changes. |
| runtime-review | 1 | Inspect runtime readiness, waits, storage, capacity, or app initialization before rerunning. |

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
| model-or-stage-first | 1 | Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning. |
| review-target-first | 11 | Review runtime, storage, controller health, or wait conditions before rerunning. |

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
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `grafana/pyroscope@2.0.2` | default | watch | target-runtime: ConfigHub workload not ready (parity passed) | [`recipes/grafana/pyroscope/2.0.2/runtime-review.yaml`](../../recipes/grafana/pyroscope/2.0.2/runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/grafana/pyroscope/2.0.2 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `grafana/tempo@1.24.4` | s3-query-observability | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml`](../../recipes/grafana/tempo/1.24.4/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/grafana/tempo/1.24.4 --base s3-query-observability` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml`](../../recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/hashicorp/consul/2.0.0 --base secure-mesh-existing-secrets --target-profile kind-three-node` |
| 30 | model-or-stage-first | operating-policy | configHub-oci-live-comparison | `hashicorp/vault@0.32.0` | ha-raft-ui | watch | operate-policy: Vault init/unseal readiness (parity passed) | [`recipes/hashicorp/vault/0.32.0/operating-policy.yaml`](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) | `npm run live-parity:run -- --recipe recipes/hashicorp/vault/0.32.0 --base ha-raft-ui` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `linkerd/linkerd-crds@1.8.0` | default | watch | gitops-runtime: CustomResourceDefinition OutOfSync health Healthy (parity passed) | [`recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml`](../../recipes/linkerd/linkerd-crds/1.8.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/linkerd/linkerd-crds/1.8.0 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `open-telemetry/opentelemetry-operator@0.114.0` | default | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml`](../../recipes/open-telemetry/opentelemetry-operator/0.114.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/open-telemetry/opentelemetry-operator/0.114.0 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `prometheus-community/prometheus@29.9.0` | default | watch | gitops-runtime: StatefulSet OutOfSync health Healthy (parity passed) | [`recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml`](../../recipes/prometheus-community/prometheus/29.9.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/prometheus-community/prometheus/29.9.0 --base default` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `traefik/traefik@40.2.0` | no-crds | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml`](../../recipes/traefik/traefik/40.2.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/traefik/traefik/40.2.0 --base no-crds` |



The machine-readable queue is:

```text
data/live-parity-rerun-plan/rerun-plan.csv
```
