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
| close-dispositions-first | 1 |
| lifecycle-support-scope-decision | 4 |
| resolve-images-before-production-oci | 10 |
| scope-decision-needed | 1 |
| security-acceptance-or-hardened-base | 4 |

## Workstreams

The queue is easier to work by decision state. Each row below groups charts
with the same remaining production-support decision.

| Workstream | Charts | Next action |
| --- | ---: | --- |
| Image digest resolution | 10 | Pin images by digest or record the explicit exception before claiming production OCI support.<br>`argo-cd/argo-cd@9.5.15` (default)<br>`bitnami/mysql@14.0.3` (static-passwords)<br>`bitnami/rabbitmq@16.0.14` (static-passwords)<br>`external-secrets/external-secrets@2.5.0` (default)<br>`grafana/grafana@10.5.15` (existing-secret-ingress)<br>and 5 more |
| Lifecycle support boundary | 4 | Record which lifecycle behavior is supported, observed, excluded, or operator-owned.<br>`bitnami/mongodb@19.0.7` (static-passwords)<br>`bitnami/postgresql@18.6.7` (static-passwords)<br>`bitnami/redis@25.5.3` (default)<br>`ingress-nginx/ingress-nginx@4.15.1` (internal-clusterip) |
| Security acceptance or hardened base | 4 | Accept the current security findings for the target scope or create a hardened base variant.<br>`longhorn/longhorn@1.11.2` (default)<br>`prometheus-community/kube-prometheus-stack@85.3.3` (default)<br>`prometheus-community/prometheus@29.8.0` (server-only-ephemeral)<br>`secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` (default) |
| Close open dispositions | 1 | Write or fix the missing disposition receipts before making a support decision.<br>`jetstack/cert-manager@v1.20.2` (crds-enabled) |
| Scope decision | 1 | Write the missing target-scoped support boundary.<br>`bitnami/nginx@24.0.2` (http-clusterip) |

| Chart | Candidate base | Base readiness | Decision state | Next action |
| --- | --- | --- | --- | --- |
| `jetstack/cert-manager@v1.20.2` | crds-enabled | start-here | close-dispositions-first | write or fix the receipt for target fact preflight |
| `bitnami/mongodb@19.0.7` | static-passwords | render-only | lifecycle-support-scope-decision | choose whether static-passwords is in production scope; close or document its render-only live-readiness issue first |
| `bitnami/postgresql@18.6.7` | static-passwords | render-only | lifecycle-support-scope-decision | choose whether static-passwords is in production scope; close or document its render-only live-readiness issue first |
| `bitnami/redis@25.5.3` | default | render-only | lifecycle-support-scope-decision | choose whether default is in production scope; close or document its render-only live-readiness issue first |
| `ingress-nginx/ingress-nginx@4.15.1` | internal-clusterip | start-here | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `argo-cd/argo-cd@9.5.15` | default | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `bitnami/mysql@14.0.3` | static-passwords | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `bitnami/rabbitmq@16.0.14` | static-passwords | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `external-secrets/external-secrets@2.5.0` | default | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `grafana/grafana@10.5.15` | existing-secret-ingress | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `grafana/loki@7.0.0` | single-binary-filesystem | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `grafana/tempo@1.24.4` | local-persistent | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `hashicorp/consul@2.0.0` | default-control-plane | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `hashicorp/vault@0.32.0` | default | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `metrics-server/metrics-server@3.13.0` | default | start-here | resolve-images-before-production-oci | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `bitnami/nginx@24.0.2` | http-clusterip | render-only | scope-decision-needed | choose whether http-clusterip is in production scope; close or document its render-only live-readiness issue first |
| `longhorn/longhorn@1.11.2` | default | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | render-only | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `prometheus-community/prometheus@29.8.0` | server-only-ephemeral | render-only | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |

## Rule

This file describes the contract. It does not create production support. A chart
becomes production-supported only after its proposed decision artifact is
written, reviewed, and backed by fresh evidence for the selected target scope.
