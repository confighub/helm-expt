# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

```text
rows: 15
blocked: 9
watch: 6
configHub-oci-live-comparison: 5
two-cluster-kind-parity: 10
semantic-parity-defects: 0
infra-or-rig-rows: 0
prerequisite-or-lifecycle-rows: 2
runtime-or-watch-rows: 13
```

## Lane Breakdown

| Lane | Rows | Pass | Watch | Blocked | Fail |
| --- | ---: | ---: | ---: | ---: | ---: |
| configHub-oci-live-comparison | 5 | 0 | 5 | 0 | 0 |
| two-cluster-kind-parity | 10 | 0 | 1 | 9 | 0 |

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
| lifecycle-route | 1 | Choose the lifecycle route or observation contract before rerunning strict parity. |
| operating-policy | 1 | Record the operating policy decision, then rerun only if the expected readiness changes. |
| runtime-review | 11 | Inspect runtime readiness, waits, storage, capacity, or app initialization before rerunning. |
| stage-prerequisite | 1 | Stage or model CRDs, APIs, Secrets, storage, or another prerequisite before rerunning. |

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
| model-or-stage-first | 3 | Stage the prerequisite, choose the lifecycle route, or record the operating policy before rerunning. |
| review-target-first | 12 | Review runtime, storage, controller health, or wait conditions before rerunning. |

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

| Priority | Readiness | Next step | Lane | Chart | Base | Current | Reason | Command |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `argo-cd/argo-cd@9.5.15` | default | watch | target-runtime: pod config/runtime errors (parity passed) | `npm run live-parity:top20 -- --from-rank 6 --to-rank 6 --continue-on-fail` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `grafana/tempo@1.24.4` | local-persistent | watch | target-runtime: PVC/storage pending (parity passed) | `npm run live-parity:top20 -- --from-rank 19 --to-rank 19 --continue-on-fail` |
| 30 | model-or-stage-first | operating-policy | configHub-oci-live-comparison | `hashicorp/vault@0.32.0` | default | watch | operate-policy: Vault init/unseal readiness (parity passed) | `npm run live-parity:top20 -- --from-rank 12 --to-rank 12 --continue-on-fail` |
| 30 | review-target-first | gitops-runtime-review | configHub-oci-live-comparison | `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | watch | gitops-runtime: Argo health Progressing (parity passed) | `npm run live-parity:top20 -- --from-rank 3 --to-rank 3 --continue-on-fail` |
| 30 | review-target-first | runtime-review | configHub-oci-live-comparison | `prometheus-community/kube-prometheus-stack@85.3.3` | default | watch | target-runtime: pod ContainerCreating (parity passed) | `npm run live-parity:top20 -- --from-rank 7 --to-rank 7 --continue-on-fail` |
| 50 | model-or-stage-first | stage-prerequisite | two-cluster-kind-parity | `grafana/tempo@1.24.4` | s3-query-observability | blocked | target-prerequisite: CRDs missing | `npm run kind-parity:run -- --chart grafana/tempo --version 1.24.4 --base s3-query-observability` |
| 55 | model-or-stage-first | lifecycle-route | two-cluster-kind-parity | `jetstack/cert-manager@v1.20.2` | default | blocked | helm-hook: post-install hook failed (parity passed) | `npm run kind-parity:run -- --chart jetstack/cert-manager --version v1.20.2 --base default` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `bitnami/mongodb@19.0.7` | existing-secret-replicaset | blocked | target-runtime: pod crash loop (parity passed) | `npm run kind-parity:run -- --chart bitnami/mongodb --version 19.0.7 --base existing-secret-replicaset --repo-url oci://registry-1.docker.io/bitnamicharts` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `grafana/loki@7.0.0` | simple-scalable-minio | blocked | target-runtime: pods pending (parity passed) | `npm run kind-parity:run -- --chart grafana/loki --version 7.0.0 --base simple-scalable-minio` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `grafana/tempo@1.24.4` | local-persistent | blocked | target-runtime: pods pending (parity passed) | `npm run kind-parity:run -- --chart grafana/tempo --version 1.24.4 --base local-persistent` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | blocked | target-runtime: pod crash loop (parity passed) | `npm run kind-parity:run -- --chart hashicorp/consul --version 2.0.0 --base secure-mesh-existing-secrets` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `hashicorp/vault@0.32.0` | default | blocked | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart hashicorp/vault --version 0.32.0 --base default` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `hashicorp/vault@0.32.0` | ha-raft-ui | blocked | target-runtime: pods pending (parity passed) | `npm run kind-parity:run -- --chart hashicorp/vault --version 0.32.0 --base ha-raft-ui` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `ingress-nginx/ingress-nginx@4.15.1` | default | watch | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart ingress-nginx/ingress-nginx --version 4.15.1 --base default` |
| 60 | review-target-first | runtime-review | two-cluster-kind-parity | `metrics-server/metrics-server@3.13.0` | external-tls-ca | blocked | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart metrics-server/metrics-server --version 3.13.0 --base external-tls-ca` |

## Related Lifecycle Evidence

These rows still have their strict parity result, but a separate lifecycle
receipt already explains the hook, CRD, webhook, or controller-owned behavior.

| Chart | Base | Rerun result | Lifecycle result | Lifecycle receipt |
| --- | --- | --- | --- | --- |
| `jetstack/cert-manager@v1.20.2` | default | blocked | pass | runs/lifecycle-observations/cert-manager-eso/jetstack-cert-manager-default/receipt.yaml |


The machine-readable queue is:

```text
data/live-parity-rerun-plan/rerun-plan.csv
```
