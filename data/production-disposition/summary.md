# Production Disposition And Live/E2E Lane

This lane starts the work needed to move the supported top-20 from
`local-test` support toward production support.

It does **not** claim production readiness yet.

## Summary

```text
catalog-supported local-test charts: 20
ConfigHub use-more-now receipts passing: 20
live/e2e observed charts: 1
production-supported charts: 0
production-blocked pending disposition: 20
```

## Top-20 Disposition Table

| Chart | Variants | ConfigHub proof | Live/e2e | Production status | Required dispositions |
| --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default, no-crds | pass | not-started | blocked | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy |
| `bitnami/mongodb@19.0.7` | generated-passwords, existing-secret-replicaset | pass | not-started | blocked | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, target fact preflight |
| `bitnami/mysql@14.0.3` | generated-passwords, existing-secret | pass | not-started | blocked | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `bitnami/nginx@24.0.2` | http-clusterip, existing-tls-ingress | pass | not-started | blocked | extension slot provenance and scan policy, generated fact ownership, scan/gate warning disposition, target fact preflight |
| `bitnami/postgresql@18.6.7` | generated-passwords, existing-secret | pass | not-started | blocked | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `bitnami/rabbitmq@16.0.14` | generated-passwords, existing-secret | pass | not-started | blocked | extension slot provenance and scan policy, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `bitnami/redis@25.5.3` | default, reuse-existing-secret | pass | local-kind-observed | blocked | generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, target fact preflight |
| `external-secrets/external-secrets@2.5.0` | default, no-crds | pass | not-started | blocked | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition, webhook readiness and failure policy |
| `grafana/grafana@10.5.15` | generated-passwords, existing-secret-ingress | pass | not-started | blocked | cluster RBAC review, extension slot provenance and scan policy, generated fact ownership, scan/gate warning disposition, target fact preflight |
| `grafana/loki@7.0.0` | single-binary-filesystem, simple-scalable-minio | pass | not-started | blocked | cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy |
| `grafana/tempo@1.24.4` | local-persistent, s3-query-observability | pass | not-started | blocked | extension slot provenance and scan policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight |
| `hashicorp/consul@2.0.0` | default-control-plane, secure-mesh-existing-secrets | pass | not-started | blocked | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, storage backup restore and rollback policy, target fact preflight, webhook readiness and failure policy |
| `hashicorp/vault@0.32.0` | default, ha-raft-ui | pass | not-started | blocked | cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition, storage backup restore and rollback policy, webhook readiness and failure policy |
| `ingress-nginx/ingress-nginx@4.15.1` | default, admission-disabled | pass | not-started | blocked | cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, webhook readiness and failure policy |
| `jetstack/cert-manager@v1.20.2` | default, crds-enabled | pass | not-started | blocked | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, hook and lifecycle phase policy, scan/gate warning disposition, webhook readiness and failure policy |
| `longhorn/longhorn@1.11.2` | default, ui-ingress | pass | not-started | blocked | CRD lifecycle and upgrade policy, cluster RBAC review, hook and lifecycle phase policy, scan/gate warning disposition, webhook readiness and failure policy |
| `metrics-server/metrics-server@3.13.0` | default, external-tls-ca | pass | not-started | blocked | cluster RBAC review, generated fact ownership, hook and lifecycle phase policy, scan/gate warning disposition, target fact preflight |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default, no-crds | pass | not-started | blocked | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, generated fact ownership, scan/gate warning disposition, webhook readiness and failure policy |
| `prometheus-community/prometheus@29.8.0` | default, server-only-ephemeral | pass | not-started | blocked | cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default, sync-secret-rotation | pass | not-started | blocked | CRD lifecycle and upgrade policy, cluster RBAC review, extension slot provenance and scan policy, scan/gate warning disposition |

## Doctrine

The supported top-20 are easy to try because their local-test paths have
passing ConfigHub/cub install receipts. They are not production-supported until
their scan/gate warnings, lifecycle risks, target facts, and live/e2e
observation requirements have explicit dispositions.
