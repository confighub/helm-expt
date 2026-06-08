# Production Disposition And Live/E2E Lane

The top-20 are mandatory catalog entries because their upstream Helm charts are
too popular to omit. This lane records the work needed to move those supported
top-20 entries from `local-test` support toward production support.

It does **not** claim production readiness yet.

## Summary

```text
catalog-supported local-test charts: 20
ConfigHub proof receipts passing: 20
live/e2e observed charts: 20
production-supported charts: 0
production-blocked pending disposition: 20
source Helm-hook rows: 1
hook/lifecycle disposition rows: 12
related lifecycle observation rows: 2
accepted production disposition receipts: 4
charts with accepted dispositions: 2
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

## Top-20 Disposition Table

| Chart | Variants | ConfigHub proof | Live/e2e | Production status | Accepted | Open dispositions |
| --- | --- | --- | --- | --- | ---: | --- |
| `argo-cd/argo-cd@9.5.15` | default, no-crds | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy |
| `bitnami/mongodb@19.0.7` | generated-passwords, existing-secret-replicaset | pass | local-kind-observed | blocked | 0 | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, target fact preflight |
| `bitnami/mysql@14.0.3` | generated-passwords, existing-secret | pass | local-kind-observed | blocked | 0 | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `bitnami/nginx@24.0.2` | http-clusterip, existing-tls-ingress | pass | local-kind-observed | blocked | 2 | extension slot provenance and scan policy, scan/gate warning disposition |
| `bitnami/postgresql@18.6.7` | generated-passwords, existing-secret | pass | local-kind-observed | blocked | 0 | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `bitnami/rabbitmq@16.0.14` | generated-passwords, existing-secret | pass | local-kind-observed | blocked | 0 | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `bitnami/redis@25.5.3` | default, reuse-existing-secret | pass | local-kind-observed | blocked | 2 | generated fact ownership, scan/gate warning disposition |
| `external-secrets/external-secrets@2.5.0` | default, no-crds | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition, webhook readiness and failure policy |
| `grafana/grafana@10.5.15` | generated-passwords, existing-secret-ingress | pass | local-kind-observed | blocked | 0 | cluster RBAC review, extension slot provenance and scan policy, generated fact ownership, scan/gate warning disposition, target fact preflight |
| `grafana/loki@7.0.0` | single-binary-filesystem, simple-scalable-minio | pass | local-kind-observed | blocked | 0 | cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy |
| `grafana/tempo@1.24.4` | local-persistent, s3-query-observability | pass | local-kind-observed | blocked | 0 | extension slot provenance and scan policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `hashicorp/consul@2.0.0` | default-control-plane, secure-mesh-existing-secrets | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight, webhook readiness and failure policy |
| `hashicorp/vault@0.32.0` | default, ha-raft-ui | pass | local-kind-observed | blocked | 0 | cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition, storage backup restore and rollback policy, webhook readiness and failure policy |
| `ingress-nginx/ingress-nginx@4.15.1` | default, admission-disabled | pass | local-kind-observed | blocked | 0 | cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, webhook readiness and failure policy |
| `jetstack/cert-manager@v1.20.2` | default, crds-enabled | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, webhook readiness and failure policy |
| `longhorn/longhorn@1.11.2` | default, ui-ingress | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, hook and lifecycle phase policy, scan/gate warning disposition, webhook readiness and failure policy |
| `metrics-server/metrics-server@3.13.0` | default, external-tls-ca | pass | local-kind-observed | blocked | 0 | cluster RBAC review, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, target fact preflight |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default, no-crds | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, generated fact ownership, scan/gate warning disposition, webhook readiness and failure policy |
| `prometheus-community/prometheus@29.8.0` | default, server-only-ephemeral | pass | local-kind-observed | blocked | 0 | cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default, sync-secret-rotation | pass | local-kind-observed | blocked | 0 | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition |

## Doctrine

The top-20 must be in the catalog. Their local-test paths are easy to try
because they have passing ConfigHub/cub installer receipts. They are not
production-supported until their scan/gate warnings, lifecycle risks, target
facts, and live/e2e observation requirements have explicit dispositions.
