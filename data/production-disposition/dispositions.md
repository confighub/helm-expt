# Top-20 Production Disposition Details

The top-20 catalog entries are supported for `local-test`. This file states
exactly what must be closed before production support can be claimed.

The lifecycle columns separate retained source-hook evidence from recipe-level
lifecycle policy and related CRD/webhook/controller observations.

Accepted disposition receipts recorded: 80

| Chart | Local-test variants | Production state | Accepted | Open | Source hooks | Lifecycle basis | Live/e2e receipts |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default, no-crds | production-blocked | 0 | 6 | 0 | recipe-hook-policy:no-hooks | 1 |
| `bitnami/mongodb@19.0.7` | generated-passwords, existing-secret-replicaset | production-review-ready | 6 | 0 | 0 | recipe-hook-policy:no-hooks | 1 |
| `bitnami/mysql@14.0.3` | generated-passwords, existing-secret | production-review-ready | 5 | 0 | 0 | recipe-hook-policy:no-hooks | 1 |
| `bitnami/nginx@24.0.2` | http-clusterip, existing-tls-ingress | production-review-ready | 4 | 0 | 0 | none | 1 |
| `bitnami/postgresql@18.6.7` | generated-passwords, existing-secret | production-review-ready | 5 | 0 | 0 | recipe-hook-policy:no-hooks | 1 |
| `bitnami/rabbitmq@16.0.14` | generated-passwords, existing-secret | production-review-ready | 5 | 0 | 0 | recipe-hook-policy:no-hooks | 1 |
| `bitnami/redis@25.5.3` | default, reuse-existing-secret | production-review-ready | 4 | 0 | 0 | recipe-hook-policy:no-hooks | 2 |
| `external-secrets/external-secrets@2.5.0` | default, no-crds | production-review-ready | 5 | 0 | 0 | lifecycle-observations:2/2 | 1 |
| `grafana/grafana@10.5.15` | generated-passwords, existing-secret-ingress | production-review-ready | 5 | 0 | 0 | none | 1 |
| `grafana/loki@7.0.0` | single-binary-filesystem, simple-scalable-minio | production-review-ready | 5 | 0 | 0 | recipe-lifecycle-policy | 1 |
| `grafana/tempo@1.24.4` | local-persistent, s3-query-observability | production-review-ready | 4 | 0 | 0 | none | 1 |
| `hashicorp/consul@2.0.0` | default-control-plane, secure-mesh-existing-secrets | production-blocked | 0 | 8 | 0 | recipe-lifecycle-policy | 1 |
| `hashicorp/vault@0.32.0` | default, ha-raft-ui | production-review-ready | 5 | 0 | 0 | none | 1 |
| `ingress-nginx/ingress-nginx@4.15.1` | default, admission-disabled | production-review-ready | 4 | 0 | 0 | recipe-hook-policy:no-hooks | 1 |
| `jetstack/cert-manager@v1.20.2` | default, crds-enabled | production-review-ready | 6 | 0 | 0 | recipe-hook-policy:no-hooks; lifecycle-observations:2/2 | 1 |
| `longhorn/longhorn@1.11.2` | default, ui-ingress | production-review-ready | 5 | 0 | 0 | recipe-hook-policy:no-hooks | 1 |
| `metrics-server/metrics-server@3.13.0` | default, external-tls-ca | production-review-ready | 5 | 0 | 0 | recipe-hook-policy:no-hooks | 1 |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default, no-crds | production-blocked | 0 | 6 | 2 | source-hooks:2 | 1 |
| `prometheus-community/prometheus@29.8.0` | default, server-only-ephemeral | production-review-ready | 3 | 0 | 0 | none | 1 |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default, sync-secret-rotation | production-review-ready | 4 | 0 | 0 | none | 1 |

## Closest Rows

These rows have accepted production-disposition receipts or three or fewer
open dispositions. They are the clearest next production-review work queue.
The same queue is available as `next-actions.csv`.

| Chart | Accepted | Open | Open dispositions | Next receipt | External scan reading |
| --- | ---: | ---: | --- | --- | --- |
| `bitnami/mongodb@19.0.7` | 6 | 0 |  | - | existing-secret-replicaset: warn, 2 finding(s) (pdb-unhealthy-pod-eviction-policy:2); generated-passwords: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1) |
| `jetstack/cert-manager@v1.20.2` | 6 | 0 |  | - | crds-enabled: warn, 6 finding(s) (unset-cpu-requirements:3;unset-memory-requirements:3); default: warn, 6 finding(s) (unset-cpu-requirements:3;unset-memory-requirements:3) |
| `bitnami/mysql@14.0.3` | 5 | 0 |  | - | existing-secret: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1); generated-passwords: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1) |
| `bitnami/postgresql@18.6.7` | 5 | 0 |  | - | existing-secret: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1); generated-passwords: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1) |
| `bitnami/rabbitmq@16.0.14` | 5 | 0 |  | - | existing-secret: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1); generated-passwords: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1) |
| `external-secrets/external-secrets@2.5.0` | 5 | 0 |  | - | default: warn, 6 finding(s) (unset-cpu-requirements:3;unset-memory-requirements:3); no-crds: warn, 6 finding(s) (unset-cpu-requirements:3;unset-memory-requirements:3) |
| `grafana/grafana@10.5.15` | 5 | 0 |  | - | existing-secret-ingress: warn, 3 finding(s) (no-read-only-root-fs:1;unset-cpu-requirements:1;unset-memory-requirements:1); generated-passwords: warn, 3 finding(s) (no-read-only-root-fs:1;unset-cpu-requirements:1;unset-memory-requirements:1) |
| `grafana/loki@7.0.0` | 5 | 0 |  | - | simple-scalable-minio: warn, 21 finding(s) (unset-memory-requirements:9;unset-cpu-requirements:8;pdb-unhealthy-pod-eviction-policy:3;no-read-only-root-fs:1); single-binary-filesystem: warn, 12 finding(s) (unset-cpu-requirements:6;unset-memory-requirements:6) |
| `hashicorp/vault@0.32.0` | 5 | 0 |  | - | default: warn, 9 finding(s) (no-read-only-root-fs:2;unset-cpu-requirements:2;unset-memory-requirements:2;liveness-port:1;readiness-port:1); ha-raft-ui: warn, 12 finding(s) (dangling-service:2;no-read-only-root-fs:2;unset-cpu-requirements:2;unset-memory-requirements:2;liveness-port:1) |
| `longhorn/longhorn@1.11.2` | 5 | 0 |  | - | default: warn, 24 finding(s) (no-read-only-root-fs:5;run-as-non-root:5;unset-cpu-requirements:5;unset-memory-requirements:5;dangling-service:2); ui-ingress: warn, 24 finding(s) (no-read-only-root-fs:5;run-as-non-root:5;unset-cpu-requirements:5;unset-memory-requirements:5;dangling-service:2) |
| `metrics-server/metrics-server@3.13.0` | 5 | 0 |  | - | default: warn, 1 finding(s) (unset-memory-requirements:1); external-tls-ca: warn, 1 finding(s) (unset-memory-requirements:1) |
| `bitnami/nginx@24.0.2` | 4 | 0 |  | - | existing-tls-ingress: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1); http-clusterip: warn, 1 finding(s) (pdb-unhealthy-pod-eviction-policy:1) |
| `bitnami/redis@25.5.3` | 4 | 0 |  | - | default: warn, 2 finding(s) (pdb-unhealthy-pod-eviction-policy:2); reuse-existing-secret: warn, 2 finding(s) (pdb-unhealthy-pod-eviction-policy:2) |
| `grafana/tempo@1.24.4` | 4 | 0 |  | - | local-persistent: warn, 3 finding(s) (no-read-only-root-fs:1;unset-cpu-requirements:1;unset-memory-requirements:1); s3-query-observability: warn, 6 finding(s) (no-read-only-root-fs:2;unset-cpu-requirements:2;unset-memory-requirements:2) |
| `ingress-nginx/ingress-nginx@4.15.1` | 4 | 0 |  | - | admission-disabled: warn, 4 finding(s) (liveness-port:1;no-read-only-root-fs:1;readiness-port:1;unset-memory-requirements:1); default: warn, 4 finding(s) (liveness-port:1;no-read-only-root-fs:1;readiness-port:1;unset-memory-requirements:1) |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | 4 | 0 |  | - | default: warn, 8 finding(s) (no-read-only-root-fs:3;run-as-non-root:3;privilege-escalation-container:1;privileged-container:1); sync-secret-rotation: warn, 8 finding(s) (no-read-only-root-fs:3;run-as-non-root:3;privilege-escalation-container:1;privileged-container:1) |
| `prometheus-community/prometheus@29.8.0` | 3 | 0 |  | - | default: warn, 21 finding(s) (unset-cpu-requirements:6;unset-memory-requirements:6;no-read-only-root-fs:4;sensitive-host-mounts:3;host-network:1); server-only-ephemeral: warn, 6 finding(s) (no-read-only-root-fs:2;unset-cpu-requirements:2;unset-memory-requirements:2) |

## Standard Disposition Types

### CRD lifecycle and upgrade policy

- owner: catalog-review
- required evidence: CRD ownership decision; upgrade ordering; rollback/deprecation policy
- unblock rule: supported only when CRD ownership and upgrade behavior are explicit

### webhook readiness and failure policy

- owner: catalog-review
- required evidence: webhook deployment readiness; failurePolicy review; certificate/bootstrap handling
- unblock rule: supported only when webhook failure modes are known before apply

### cluster RBAC review

- owner: security-review
- required evidence: cluster-scoped RBAC inventory; least-privilege disposition; operator acceptance
- unblock rule: supported only after cluster-scoped permissions have an explicit disposition

### storage backup restore and rollback policy

- owner: operate-review
- required evidence: PVC/storage class assumptions; backup/restore path; rollback constraints
- unblock rule: supported only when stateful rollback is not hand-waved

### generated fact ownership

- owner: catalog-review
- required evidence: generated secret/cert inventory; persistence or target binding; rotation policy
- unblock rule: supported only when generated material is captured or deliberately externalized

### target fact preflight

- owner: installer-review
- required evidence: installer externalRequires/facts; preflight command or documented block; freshness expectation
- unblock rule: supported only when required target facts are checkable before apply

### hook and lifecycle phase policy

- owner: catalog-review
- required evidence: hook inventory; phase mapping; unsupported hook blockers
- unblock rule: supported only when hooks are mapped to lifecycle policy or intentionally excluded

### extension slot provenance and scan policy

- owner: catalog-review
- required evidence: tpl/raw value inventory; allowed extension slots; scan coverage for rendered additions
- unblock rule: supported only when extensions are explicit and scanned after render

### scan/gate warning disposition

- owner: security-review
- required evidence: local scan receipt; external scan receipt; waiver or fix decision
- unblock rule: supported only when warnings are accepted, fixed, or variant-blocking

## Rule

A chart becomes `production-review-ready` when each required disposition is
accepted, fixed, or turned into an explicit variant blocker, and the result is
backed by rendered-digest-bound scan and live/e2e receipts. Production support
still requires a separate target-scoped support decision.
