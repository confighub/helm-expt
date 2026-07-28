# Production Support Decisions

This generated report records target-scoped production support decisions. It is
separate from production disposition closure.

Disposition closure means the pre-review evidence exists. A production support
decision names the supported base, target scope, delivery path, accepted risks,
live evidence rule, and operator-owned boundaries.

## Summary

```text
decision artifacts: 20
supported decisions: 17
draft decisions: 0
rejected decisions: 1
superseded decisions: 2
open work items: 0
```

## Workstreams

Workstreams can overlap. One chart can need image, scan, lifecycle, and fresh
evidence work before it becomes production-supported for a target scope.

| Workstream | Charts | Examples | Next action |
| --- | ---: | --- | --- |
| Supported scope evidence | 17 | `argo-cd/argo-cd@9.5.15` (default)<br>`bitnami/mongodb@19.0.7` (static-passwords)<br>`bitnami/mysql@14.0.3` (static-passwords)<br>`bitnami/nginx@24.0.2` (http-clusterip)<br>and 13 more | Keep target-scoped evidence fresh before using the supported scope as a production example. |

## Priority Rows

These rows have the most remaining production-support decisions. The table does
not replace the per-chart decision artifact; it shows where review effort is
currently concentrated.

| Chart | Base | Open work | Next action |
| --- | --- | --- | --- |
| - | - | - | No open production-support work items. |

The spreadsheet form is [work-items.csv](./work-items.csv). It has one row per
production-support task or keep-fresh item, so overlapping work such as image,
scan, lifecycle, runtime, and fresh evidence can be assigned independently.

Each decision directory also has a generated workdown page:

| Chart | Workdown |
| --- | --- |
| `argo-cd/argo-cd@9.5.15` | [default](./argo-cd-argo-cd/README.md) |
| `bitnami/mongodb@19.0.7` | [static-passwords](./bitnami-mongodb/README.md) |
| `bitnami/mysql@14.0.3` | [static-passwords](./bitnami-mysql/README.md) |
| `bitnami/nginx@24.0.2` | [http-clusterip](./bitnami-nginx/README.md) |
| `bitnami/postgresql@18.6.7` | [static-passwords](./bitnami-postgresql/README.md) |
| `bitnami/rabbitmq@16.0.14` | [static-passwords](./bitnami-rabbitmq/README.md) |
| `bitnami/redis@25.5.3` | [default](./bitnami-redis/README.md) |
| `external-secrets/external-secrets@2.5.0` | [default](./external-secrets-external-secrets/README.md) |
| `grafana/grafana@10.5.15` | [existing-secret-ingress](./grafana-grafana/README.md) |
| `grafana/loki@7.0.0` | [single-binary-filesystem](./grafana-loki/README.md) |
| `grafana/tempo@1.24.4` | [local-persistent](./grafana-tempo/README.md) |
| `hashicorp/consul@2.0.0` | [default-control-plane](./hashicorp-consul/README.md) |
| `hashicorp/vault@0.32.0` | [default](./hashicorp-vault/README.md) |
| `ingress-nginx/ingress-nginx@4.15.1` | [internal-clusterip](./ingress-nginx-ingress-nginx/README.md) |
| `jetstack/cert-manager@v1.20.2` | [crds-enabled](./jetstack-cert-manager/README.md) |
| `longhorn/longhorn@1.11.2` | [default](./longhorn-longhorn/README.md) |
| `metrics-server/metrics-server@3.13.0` | [default](./metrics-server-metrics-server/README.md) |
| `prometheus-community/kube-prometheus-stack@85.3.3` | [default](./prometheus-community-kube-prometheus-stack/README.md) |
| `prometheus-community/prometheus@29.8.0` | [server-only-ephemeral](./prometheus-community-prometheus/README.md) |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | [default](./secrets-store-csi-driver-secrets-store-csi-driver/README.md) |

## Decisions

| Chart | Base | Decision | Target scope | Live evidence decision | Next action |
| --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | default | supported | cub-lk-kind-vanilla; namespace=argocd; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate hardened, self-managed, repository-credential, SSO, or backup/restore bases for real customer GitOps control planes. |
| `bitnami/mongodb@19.0.7` | static-passwords | supported | cub-lk-kind-vanilla; namespace=mongodb; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, replica-set, backup/restore, failover, credential-rotation, storage-class, SLO, or resource-hardened bases for real customer MongoDB workloads. |
| `bitnami/mysql@14.0.3` | static-passwords | supported | cub-lk-kind-vanilla; namespace=mysql; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, backup/restore, failover, credential-rotation, storage-class, SLO, or resource-hardened bases for real customer MySQL workloads. |
| `bitnami/nginx@24.0.2` | http-clusterip | supported | cub-lk-kind-vanilla; namespace=nginx; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example. |
| `bitnami/postgresql@18.6.7` | static-passwords | supported | cub-lk-kind-vanilla; namespace=postgresql; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, backup/restore, point-in-time-recovery, failover, credential-rotation, storage-class, SLO, replication, or resource-hardened bases for real customer PostgreSQL workloads. |
| `bitnami/rabbitmq@16.0.14` | static-passwords | supported | cub-lk-kind-vanilla; namespace=rabbitmq; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, clustering, backup/restore, queue-recovery, failover, credential-rotation, Erlang-cookie-rotation, storage-class, SLO, or resource-hardened bases for real customer RabbitMQ workloads. |
| `bitnami/redis@25.5.3` | default | supported | cub-lk-kind-vanilla; namespace=redis; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate existing-secret, backup/restore, failover, storage-class, SLO, or availability-hardened bases for real customer Redis workloads. |
| `external-secrets/external-secrets@2.5.0` | default | supported | cub-lk-kind-vanilla; namespace=external-secrets; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate provider-specific, credential, resource-hardened, or profile-specific bases for real customer External Secrets workloads. |
| `grafana/grafana@10.5.15` | existing-secret-ingress | superseded | vanilla-kubernetes; namespace=grafana; delivery=confighub-oci; controller=argo-or-flux | not-production-supported-because-source-chart-is-deprecated | Keep this as catalog proof evidence only; review a maintained Grafana chart or replacement catalog source before making a production-support claim. |
| `grafana/loki@7.0.0` | single-binary-filesystem | supported | cub-lk-kind-vanilla; namespace=loki; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate object-store, retention, backup, restore, tenant, hardening, and digest-pinned bases for real customer Loki workloads. |
| `grafana/tempo@1.24.4` | local-persistent | superseded | vanilla-kubernetes; namespace=tempo; delivery=confighub-oci; controller=argo-or-flux | not-production-supported-because-source-chart-is-deprecated | Keep this as catalog proof evidence only; review grafana-community/tempo or another maintained successor before making a production-support claim. |
| `hashicorp/consul@2.0.0` | default-control-plane | supported | cub-lk-kind-vanilla; namespace=consul; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate secure-mesh, TLS, ACL, gateway, UI, external-CRD, production-quorum, hardening, and digest-pinned bases for real customer Consul workloads. |
| `hashicorp/vault@0.32.0` | default | rejected | kind-vanilla; namespace=vault; delivery=confighub-oci; controller=argo | parity-passed-production-support-rejected | Keep the default base as a ready-to-try parity example. Create a separate TLS-enabled, digest-pinned, persistent-storage base with explicit init, unseal, recovery, backup, and upgrade procedures before reconsidering production support. |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | supported | cub-lk-kind-vanilla; namespace=ingress-nginx; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example. |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | supported | cub-lk-kind-vanilla; namespace=cert-manager; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate issuer, certificate, provider, or hardened resource bases for real customer certificate workloads. |
| `longhorn/longhorn@1.11.2` | default | supported | cub-lk-kind-vanilla; namespace=longhorn-system; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate backup/restore, upgrade, replica-policy, storage-class, UI-ingress, resource-hardened, or digest-pinned bases for real customer Longhorn workloads. |
| `metrics-server/metrics-server@3.13.0` | default | supported | cub-lk-kind-vanilla; namespace=kube-system; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate external-tls-ca, resource-hardened, RBAC-hardened, API aggregation hardened, digest-pinned, or customer production bases for real Metrics Server workloads. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | supported | cub-lk-kind-vanilla; namespace=monitoring; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example. |
| `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | supported | cub-lk-kind-vanilla; namespace=monitoring; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate default-stack, persistent-storage, remote-write, scrape-customization, ingress, node-exporter, resource-hardened, or digest-pinned bases for real customer monitoring workloads. |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | supported | cub-lk-kind-vanilla; namespace=kube-system; delivery=confighub-oci; controller=argo | fresh-target-evidence-passed | Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate provider, sync-secret-rotation, IAM, node-policy, resource-hardened, or digest-pinned bases for real customer secret-store workloads. |

## Rule

A `supported` decision names a target-scoped support boundary with fresh
evidence. A `draft` decision names a proposed support boundary that still has
open work. A `superseded` or `rejected` decision closes a chart or base
without claiming production support.

Regenerate:

~~~sh
npm run production:support-decisions
npm run production:support-decisions:verify
~~~
