# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

```text
rows: 2
lifecycle-routed-not-active-rerun: 0
blocked: 0
watch: 2
configHub-oci-live-comparison: 1
two-cluster-kind-parity: 1
semantic-parity-defects: 0
infra-or-rig-rows: 0
prerequisite-or-lifecycle-rows: 0
runtime-or-watch-rows: 1
```

## Current Interpretation

No current row says ConfigHub and Helm produced different Kubernetes object meaning. The rows below are the active work queue for stronger live
claims.

| Chart | Base | Current | Meaning | Next action |
| --- | --- | --- | --- | --- |
| `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | watch | Semantic parity and workload readiness passed, but the GitOps controller reported a sync or health condition that needs review. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |
| `autoscaler/cluster-autoscaler@9.57.0` | default | watch | Object parity passed, but the selected base did not render a functional workload because required Helm values were missing. Choose or create a values-profile base before rerunning. | Use a values-profile rerender base such as the reviewed controller base, or model the missing values in a new base before rerunning strict parity. |


## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| configHub-oci-live-comparison | 1 | 0 | 1 | 0 | 0 |
| two-cluster-kind-parity | 1 | 0 | 1 | 0 | 0 |

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
| gitops-runtime-review | 1 | Inspect GitOps/controller health; rerun after target conditions or controller waits are corrected. |
| render-input-model | 1 | Model the required Helm values as a real base before rerunning. |

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
| review-target-first | 1 | Review runtime, storage, controller health, or wait conditions before rerunning. |

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
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml`](../../recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml) | `npm run live-parity:run -- --recipe recipes/hashicorp/consul/2.0.0 --base secure-mesh-existing-secrets --target-profile kind-three-node` |
| 60 | model-or-stage-first | render-input-model | two-cluster-kind-parity | `autoscaler/cluster-autoscaler@9.57.0` | default | watch | render-input: required Helm values missing (parity passed) | [`recipes/autoscaler/cluster-autoscaler/9.57.0/value-model.yaml`](../../recipes/autoscaler/cluster-autoscaler/9.57.0/value-model.yaml) | `npm run kind-parity:run -- --chart autoscaler/cluster-autoscaler --version 9.57.0 --base default` |



The machine-readable queue is:

```text
data/live-parity-rerun-plan/rerun-plan.csv
```
