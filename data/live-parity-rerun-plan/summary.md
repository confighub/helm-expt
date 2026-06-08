# Live Parity Rerun Plan

This is the generated queue for reducing non-pass live parity rows. It combines:

- the ConfigHub/OCI live comparison lane;
- the strict two-cluster kind parity lane.

Use this file to choose the next live rerun. Use the receipts linked from each
row to diagnose failures. Do not treat an infrastructure or upstream-runtime
block as a ConfigHub-vs-Helm parity defect unless the semantic comparison fails.

```text
rows: 22
blocked: 12
watch: 10
configHub-oci-live-comparison: 7
two-cluster-kind-parity: 15
semantic-parity-defects: 0
infra-or-rig-rows: 0
prerequisite-or-lifecycle-rows: 5
runtime-or-watch-rows: 17
```

## Recommended Order

1. Inspect any `parity:` rows first. Those are the only rows that currently
   point at an object-set difference.
2. Re-run any `infra:` rows on a clean host, one at a time.
3. Resolve `target-prerequisite:` and `helm-hook:` rows by staging the
   prerequisite or choosing the lifecycle route before rerunning.
4. Review `target-runtime:`, `helm-runtime:`, and `watch` rows last. They
   usually mean object parity passed and the target needs a readiness, storage,
   capacity, or operating-policy decision.

## Rerun Queue

| Priority | Lane | Chart | Base | Current | Reason | Command |
| ---: | --- | --- | --- | --- | --- | --- |
| 30 | configHub-oci-live-comparison | `argo-cd/argo-cd@9.5.15` | default | watch | watch: inspect receipt | `npm run live-parity:top20 -- --from-rank 6 --to-rank 6 --continue-on-fail` |
| 30 | configHub-oci-live-comparison | `bitnami/mysql@14.0.3` | generated-passwords | watch | watch: inspect receipt | `npm run live-parity:top20 -- --from-rank 16 --to-rank 16 --continue-on-fail` |
| 30 | configHub-oci-live-comparison | `grafana/tempo@1.24.4` | local-persistent | watch | watch: inspect receipt | `npm run live-parity:top20 -- --from-rank 19 --to-rank 19 --continue-on-fail` |
| 30 | configHub-oci-live-comparison | `hashicorp/consul@2.0.0` | default-control-plane | watch | watch: inspect receipt | `npm run live-parity:top20 -- --from-rank 20 --to-rank 20 --continue-on-fail` |
| 30 | configHub-oci-live-comparison | `hashicorp/vault@0.32.0` | default | watch | watch: inspect receipt | `npm run live-parity:top20 -- --from-rank 12 --to-rank 12 --continue-on-fail` |
| 30 | configHub-oci-live-comparison | `ingress-nginx/ingress-nginx@4.15.1` | admission-disabled | watch | watch: inspect receipt | `npm run live-parity:top20 -- --from-rank 3 --to-rank 3 --continue-on-fail` |
| 30 | configHub-oci-live-comparison | `prometheus-community/kube-prometheus-stack@85.3.3` | default | watch | watch: inspect receipt | `npm run live-parity:top20 -- --from-rank 7 --to-rank 7 --continue-on-fail` |
| 50 | two-cluster-kind-parity | `argo-cd/argo-cd@9.5.15` | no-crds | blocked | target-prerequisite: CRDs disabled or missing (parity passed) | `npm run kind-parity:run -- --chart argo-cd/argo-cd --version 9.5.15 --base no-crds` |
| 50 | two-cluster-kind-parity | `external-secrets/external-secrets@2.5.0` | no-crds | blocked | target-prerequisite: CRDs disabled or missing (parity passed) | `npm run kind-parity:run -- --chart external-secrets/external-secrets --version 2.5.0 --base no-crds` |
| 50 | two-cluster-kind-parity | `grafana/tempo@1.24.4` | s3-query-observability | blocked | target-prerequisite: CRDs missing | `npm run kind-parity:run -- --chart grafana/tempo --version 1.24.4 --base s3-query-observability` |
| 50 | two-cluster-kind-parity | `prometheus-community/kube-prometheus-stack@85.3.3` | no-crds | blocked | target-prerequisite: CRDs missing | `npm run kind-parity:run -- --chart prometheus-community/kube-prometheus-stack --version 85.3.3 --base no-crds` |
| 55 | two-cluster-kind-parity | `jetstack/cert-manager@v1.20.2` | default | blocked | helm-hook: post-install hook failed (parity passed) | `npm run kind-parity:run -- --chart jetstack/cert-manager --version v1.20.2 --base default` |
| 60 | two-cluster-kind-parity | `argo-cd/argo-cd@9.5.15` | default | watch | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart argo-cd/argo-cd --version 9.5.15 --base default` |
| 60 | two-cluster-kind-parity | `bitnami/mongodb@19.0.7` | existing-secret-replicaset | blocked | target-runtime: pod crash loop (parity passed) | `npm run kind-parity:run -- --chart bitnami/mongodb --version 19.0.7 --base existing-secret-replicaset` |
| 60 | two-cluster-kind-parity | `grafana/loki@7.0.0` | simple-scalable-minio | blocked | target-runtime: pods pending (parity passed) | `npm run kind-parity:run -- --chart grafana/loki --version 7.0.0 --base simple-scalable-minio` |
| 60 | two-cluster-kind-parity | `grafana/tempo@1.24.4` | local-persistent | blocked | target-runtime: pods pending (parity passed) | `npm run kind-parity:run -- --chart grafana/tempo --version 1.24.4 --base local-persistent` |
| 60 | two-cluster-kind-parity | `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | blocked | target-runtime: pod crash loop (parity passed) | `npm run kind-parity:run -- --chart hashicorp/consul --version 2.0.0 --base secure-mesh-existing-secrets` |
| 60 | two-cluster-kind-parity | `hashicorp/vault@0.32.0` | default | blocked | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart hashicorp/vault --version 0.32.0 --base default` |
| 60 | two-cluster-kind-parity | `hashicorp/vault@0.32.0` | ha-raft-ui | blocked | target-runtime: pods pending (parity passed) | `npm run kind-parity:run -- --chart hashicorp/vault --version 0.32.0 --base ha-raft-ui` |
| 60 | two-cluster-kind-parity | `ingress-nginx/ingress-nginx@4.15.1` | default | watch | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart ingress-nginx/ingress-nginx --version 4.15.1 --base default` |
| 60 | two-cluster-kind-parity | `metrics-server/metrics-server@3.13.0` | external-tls-ca | blocked | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart metrics-server/metrics-server --version 3.13.0 --base external-tls-ca` |
| 60 | two-cluster-kind-parity | `prometheus-community/kube-prometheus-stack@85.3.3` | default | watch | helm-runtime: upstream not ready (parity passed) | `npm run kind-parity:run -- --chart prometheus-community/kube-prometheus-stack --version 85.3.3 --base default` |

The machine-readable queue is:

```text
data/live-parity-rerun-plan/rerun-plan.csv
```
