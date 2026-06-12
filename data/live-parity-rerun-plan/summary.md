# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

```text
rows: 3
lifecycle-routed-not-active-rerun: 0
blocked: 0
watch: 3
configHub-oci-live-comparison: 3
two-cluster-kind-parity: 0
semantic-parity-defects: 0
infra-or-rig-rows: 0
prerequisite-or-lifecycle-rows: 0
runtime-or-watch-rows: 1
```

## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| configHub-oci-live-comparison | 3 | 0 | 3 | 0 | 0 |
| two-cluster-kind-parity | 0 | 0 | 0 | 0 | 0 |

The ConfigHub/OCI live comparison rows in this queue are current `watch` rows.
They have semantic parity and need runtime, target, or controller-health review.
The `blocked` rows are currently from the two-cluster kind parity lane.

## Recommended Order

1. Inspect any `parity:` rows first. Those are the only rows that currently
   point at an object-set difference.
2. Re-run any `infra:` rows on a clean host, one at a time.
3. Resolve `target-prerequisite:` and `helm-hook:` rows by staging the
   prerequisite or choosing the lifecycle route before rerunning.
4. Review `target-runtime:`, `helm-runtime:`, and `watch` rows last. They
   usually mean object parity passed and the target needs a readiness, storage,
   capacity, or operating-policy decision.

## Next Step Buckets

| Next step | Rows | What to do |
| --- | ---: | --- |
| gitops-runtime-review | 1 | Inspect GitOps/controller health; rerun after target conditions or controller waits are corrected. |
| operating-policy | 1 | Record the operating policy decision, then rerun only if the expected readiness changes. |
| target-fit-review | 1 | Choose a target that provides the required platform behavior, or create a base that fits the target. |

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
| model-or-stage-first | 2 | Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning. |
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
| 30 | model-or-stage-first | operating-policy | configHub-oci-live-comparison | `hashicorp/vault@0.32.0` | default | watch | operate-policy: Vault init/unseal readiness (parity passed) | [`recipes/hashicorp/vault/0.32.0/operating-policy.yaml`](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) | `npm run live-parity:top20 -- --chart vault --base default --continue-on-fail` |
| 30 | model-or-stage-first | target-fit-review | configHub-oci-live-comparison | `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | watch | target-fit: LoadBalancer Service has no external IP on kind (parity passed) | [`recipes/ingress-nginx/ingress-nginx/4.15.1/target-topology.yaml`](../../recipes/ingress-nginx/ingress-nginx/4.15.1/target-topology.yaml) | `npm run live-parity:top20 -- --chart ingress-nginx --base admission-disabled --continue-on-fail` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `ingress-nginx/ingress-nginx@4.15.1` | default | watch | gitops-runtime: Argo health Progressing (parity passed) | [`recipes/ingress-nginx/ingress-nginx/4.15.1/gitops-runtime-review.yaml`](../../recipes/ingress-nginx/ingress-nginx/4.15.1/gitops-runtime-review.yaml) | `npm run live-parity:top20 -- --chart ingress-nginx --base default --continue-on-fail` |



The machine-readable queue is:

```text
data/live-parity-rerun-plan/rerun-plan.csv
```
