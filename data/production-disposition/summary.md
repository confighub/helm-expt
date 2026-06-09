# Production Disposition And Live/E2E Lane

The top-20 are mandatory catalog entries because their upstream Helm charts are
too popular to omit. This lane records the work needed to move those supported
top-20 entries from `local-test` support toward production support.

It does **not** claim production support yet.

## Summary

```text
catalog-supported local-test charts: 20
ConfigHub proof receipts passing: 20
live/e2e observed charts: 20
production-supported charts: 0
production-review-ready pending final support decision: 16
production-blocked pending disposition: 4
source Helm-hook rows: 1
hook/lifecycle disposition rows: 12
related lifecycle observation rows: 2
accepted production disposition receipts: 75
charts with accepted dispositions: 16
```

The hook/lifecycle disposition is a production-review item. It does not always
mean the retained source scan found Helm hooks. Use the evidence fields in
`top20.csv`:

- `source_hook_count` shows retained source-scan hook evidence.
- `lifecycle_policy_basis` shows whether the row came from source hooks,
  recipe hook policy, generic lifecycle policy, or related lifecycle
  observations.
- `lifecycle_observation_receipts` links receipts for cert-manager and
  External Secrets style CRD/webhook/controller behavior.

Use `data/top20-base-readiness/base-readiness.csv` for base-by-base live
readiness. A chart can be production-review-ready at the disposition level while
a non-default base still needs target runtime review. The final production
support decision must choose the supported base, target scope, and required
runtime checks.

## Top-20 Disposition Table

| Chart | Variants | ConfigHub proof | Live/e2e | Production status | Accepted | Open dispositions |
| --- | --- | --- | --- | --- | ---: | --- |
| `argo-cd/argo-cd@9.5.15` | default, no-crds | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy |
| `bitnami/mongodb@19.0.7` | generated-passwords, existing-secret-replicaset | pass | local-kind-observed | production-review-ready | 6 |  |
| `bitnami/mysql@14.0.3` | generated-passwords, existing-secret | pass | local-kind-observed | production-review-ready | 5 |  |
| `bitnami/nginx@24.0.2` | http-clusterip, existing-tls-ingress | pass | local-kind-observed | production-review-ready | 4 |  |
| `bitnami/postgresql@18.6.7` | generated-passwords, existing-secret | pass | local-kind-observed | production-review-ready | 5 |  |
| `bitnami/rabbitmq@16.0.14` | generated-passwords, existing-secret | pass | local-kind-observed | production-review-ready | 5 |  |
| `bitnami/redis@25.5.3` | default, reuse-existing-secret | pass | local-kind-observed | production-review-ready | 4 |  |
| `external-secrets/external-secrets@2.5.0` | default, no-crds | pass | local-kind-observed | production-review-ready | 5 |  |
| `grafana/grafana@10.5.15` | generated-passwords, existing-secret-ingress | pass | local-kind-observed | production-review-ready | 5 |  |
| `grafana/loki@7.0.0` | single-binary-filesystem, simple-scalable-minio | pass | local-kind-observed | production-review-ready | 5 |  |
| `grafana/tempo@1.24.4` | local-persistent, s3-query-observability | pass | local-kind-observed | production-review-ready | 4 |  |
| `hashicorp/consul@2.0.0` | default-control-plane, secure-mesh-existing-secrets | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight, webhook readiness and failure policy |
| `hashicorp/vault@0.32.0` | default, ha-raft-ui | pass | local-kind-observed | production-review-ready | 5 |  |
| `ingress-nginx/ingress-nginx@4.15.1` | default, admission-disabled | pass | local-kind-observed | production-review-ready | 4 |  |
| `jetstack/cert-manager@v1.20.2` | default, crds-enabled | pass | local-kind-observed | production-review-ready | 6 |  |
| `longhorn/longhorn@1.11.2` | default, ui-ingress | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, hook and lifecycle phase policy, scan/gate warning disposition, webhook readiness and failure policy |
| `metrics-server/metrics-server@3.13.0` | default, external-tls-ca | pass | local-kind-observed | production-review-ready | 5 |  |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default, no-crds | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, generated fact ownership, scan/gate warning disposition, webhook readiness and failure policy |
| `prometheus-community/prometheus@29.8.0` | default, server-only-ephemeral | pass | local-kind-observed | production-review-ready | 3 |  |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default, sync-secret-rotation | pass | local-kind-observed | production-review-ready | 4 |  |

## Doctrine

The top-20 must be in the catalog. Their local-test paths are easy to try
because they have passing ConfigHub/cub installer receipts. They are not
production-supported until their scan/gate warnings, lifecycle risks, target
facts, and live/e2e observation requirements have explicit dispositions and a
separate production support decision records the target scope.
