# Production Support Decision Contract

The top-20 catalog entries have local-test proof and accepted production
disposition receipts. They are not production-supported until a target-scoped
support decision is recorded.

A support decision names the exact base variant, target scope, delivery path,
runtime expectations, accepted risks, and evidence refresh required for a
production claim.

## Required Decision Fields

| Field | Meaning |
| --- | --- |
| chart and version | The maintained chart entry. |
| supported base | The base variant that is in production scope. Other bases stay local-test or review-only unless separately approved. |
| target scope | Cluster type, namespace, GitOps controller, storage assumptions, CRD ownership, required Secrets, and other target prerequisites. |
| delivery path | ConfigHub OCI, Argo, Flux, direct apply, or another declared route. |
| scan decision | Findings fixed, accepted, blocked, or moved into a hardened base. |
| image decision | Digest-pinned images or an explicit exception for the supported scope. |
| lifecycle decision | Hooks, CRDs, webhooks, generated facts, controller-populated fields, and observation freshness policy. |
| live evidence | The receipt or command that refreshes live/e2e evidence for the selected scope. |
| support boundary | What the catalog promises, and what remains operator-owned. |

## Current Queue

| Decision state | Charts |
| --- | ---: |
| lifecycle-support-scope-decision | 4 |
| ready-for-final-scope-decision | 1 |
| resolve-images-before-production-oci | 10 |
| security-acceptance-or-hardened-base | 4 |
| target-runtime-scope-review | 1 |

## Workstreams

The queue is easier to work by decision state. Each row below groups charts
with the same remaining production-support decision.

| Workstream | Charts | Next action |
| --- | ---: | --- |
| Final support decision | 1 | Choose the supported base, target scope, delivery path, and evidence refresh rule.<br>`bitnami/nginx@24.0.2` (http-clusterip) |
| Image digest resolution | 10 | Pin images by digest or record the explicit exception before claiming production OCI support.<br>`argo-cd/argo-cd@9.5.15` (default)<br>`bitnami/mysql@14.0.3` (generated-passwords)<br>`bitnami/rabbitmq@16.0.14` (generated-passwords)<br>`external-secrets/external-secrets@2.5.0` (default)<br>`grafana/grafana@10.5.15` (generated-passwords)<br>and 5 more |
| Lifecycle support boundary | 4 | Record which lifecycle behavior is supported, observed, excluded, or operator-owned.<br>`bitnami/mongodb@19.0.7` (generated-passwords)<br>`bitnami/postgresql@18.6.7` (generated-passwords)<br>`bitnami/redis@25.5.3` (default)<br>`ingress-nginx/ingress-nginx@4.15.1` (internal-clusterip) |
| Security acceptance or hardened base | 4 | Accept the current security findings for the target scope or create a hardened base variant.<br>`longhorn/longhorn@1.11.2` (default)<br>`prometheus-community/kube-prometheus-stack@85.3.3` (default)<br>`prometheus-community/prometheus@29.8.0` (server-only-ephemeral)<br>`secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` (default) |
| Target runtime scope | 1 | Decide whether the runtime condition is acceptable for the target scope, then refresh live evidence.<br>`hashicorp/vault@0.32.0` (default) |

| Chart | Candidate base | Base readiness | Decision state | Next action |
| --- | --- | --- | --- | --- |
| `bitnami/mongodb@19.0.7` | generated-passwords | start-here | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `bitnami/postgresql@18.6.7` | generated-passwords | try-with-proof | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `bitnami/redis@25.5.3` | default | start-here | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | start-here | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `bitnami/nginx@24.0.2` | http-clusterip | start-here | ready-for-final-scope-decision | choose the supported production base and target scope, refresh live/e2e evidence, and record the final support decision |
| `argo-cd/argo-cd@9.5.15` | default | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `bitnami/mysql@14.0.3` | generated-passwords | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `external-secrets/external-secrets@2.5.0` | default | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `grafana/grafana@10.5.15` | generated-passwords | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `grafana/loki@7.0.0` | single-binary-filesystem | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `grafana/tempo@1.24.4` | local-persistent | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `hashicorp/consul@2.0.0` | default-control-plane | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `metrics-server/metrics-server@3.13.0` | default | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `longhorn/longhorn@1.11.2` | default | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `hashicorp/vault@0.32.0` | default | runtime-review-needed | target-runtime-scope-review | choose whether default is in production scope; close or document its runtime-review-needed live-readiness issue first |

## Rule

This file describes the contract. It does not create production support. A chart
becomes production-supported only after its proposed decision artifact is
written, reviewed, and backed by fresh evidence for the selected target scope.
