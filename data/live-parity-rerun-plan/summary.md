# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

```text
rows: 4
lifecycle-routed-not-active-rerun: 1
blocked: 4
watch: 0
configHub-oci-live-comparison: 0
two-cluster-kind-parity: 4
semantic-parity-defects: 0
infra-or-rig-rows: 0
prerequisite-or-lifecycle-rows: 1
runtime-or-watch-rows: 0
```

## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| configHub-oci-live-comparison | 0 | 0 | 0 | 0 | 0 |
| two-cluster-kind-parity | 4 | 0 | 0 | 4 | 0 |

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
| operating-policy | 1 | Record the operating policy decision, then rerun only if the expected readiness changes. |
| stage-prerequisite | 1 | Stage or model CRDs, APIs, Secrets, storage, or another prerequisite before rerunning. |
| target-fit-review | 2 | Choose a target that provides the required platform behavior, or create a base that fits the target. |

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
| model-or-stage-first | 4 | Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning. |

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
| 50 | model-or-stage-first | stage-prerequisite | two-cluster-kind-parity | `grafana/tempo@1.24.4` | s3-query-observability | blocked | target-prerequisite: object store endpoint not satisfied (parity passed) | [`recipes/grafana/tempo/1.24.4/target-prerequisite-plan.yaml`](../../recipes/grafana/tempo/1.24.4/target-prerequisite-plan.yaml) | `npm run kind-parity:run -- --chart grafana/tempo --version 1.24.4 --base s3-query-observability` |
| 50 | model-or-stage-first | target-fit-review | two-cluster-kind-parity | `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | blocked | target-fit: secure mesh target topology not satisfied (parity passed) | [`recipes/hashicorp/consul/2.0.0/target-topology.yaml`](../../recipes/hashicorp/consul/2.0.0/target-topology.yaml) | `npm run kind-parity:run -- --chart hashicorp/consul --version 2.0.0 --base secure-mesh-existing-secrets` |
| 50 | model-or-stage-first | operating-policy | two-cluster-kind-parity | `hashicorp/vault@0.32.0` | default | blocked | operate-policy: Vault init/unseal required (parity passed) | [`recipes/hashicorp/vault/0.32.0/operating-policy.yaml`](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) | `npm run kind-parity:run -- --chart hashicorp/vault --version 0.32.0 --base default` |
| 50 | model-or-stage-first | target-fit-review | two-cluster-kind-parity | `hashicorp/vault@0.32.0` | ha-raft-ui | blocked | target-fit: HA raft target topology not satisfied (parity passed) | [`recipes/hashicorp/vault/0.32.0/operating-policy.yaml`](../../recipes/hashicorp/vault/0.32.0/operating-policy.yaml) | `npm run kind-parity:run -- --chart hashicorp/vault --version 0.32.0 --base ha-raft-ui` |

## Related Lifecycle Evidence

These rows have a separate lifecycle receipt for hook, CRD, webhook, or
controller-owned behavior. Rows with a passing lifecycle receipt are not active
rerun work unless the lifecycle decision changes.

| Chart | Base | Rerun result | Lifecycle result | Lifecycle receipt |
| --- | --- | --- | --- | --- |
| `jetstack/cert-manager@v1.20.2` | default | blocked | pass | runs/lifecycle-observations/cert-manager-eso/jetstack-cert-manager-default/receipt.yaml |


The machine-readable queue is:

```text
data/live-parity-rerun-plan/rerun-plan.csv
```
