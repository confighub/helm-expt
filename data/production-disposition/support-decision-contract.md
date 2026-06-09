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
| resolve-images-before-production-oci | 7 |
| security-acceptance-or-hardened-base | 4 |
| target-runtime-scope-review | 4 |

| Chart | Candidate base | Base readiness | Decision state | Next action |
| --- | --- | --- | --- | --- |
| `bitnami/mongodb@19.0.7` | generated-passwords | start-here | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `bitnami/postgresql@18.6.7` | generated-passwords | try-with-proof | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `bitnami/redis@25.5.3` | default | start-here | lifecycle-support-scope-decision | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| `jetstack/cert-manager@v1.20.2` | default | lifecycle-observed | lifecycle-support-scope-decision | choose whether default is in production scope; record the target-scoped lifecycle support decision before claiming production support |
| `bitnami/nginx@24.0.2` | http-clusterip | start-here | ready-for-final-scope-decision | choose the supported production base and target scope, refresh live/e2e evidence, and record the final support decision |
| `bitnami/mysql@14.0.3` | generated-passwords | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `bitnami/rabbitmq@16.0.14` | generated-passwords | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `external-secrets/external-secrets@2.5.0` | default | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `grafana/grafana@10.5.15` | generated-passwords | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `grafana/loki@7.0.0` | single-binary-filesystem | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `hashicorp/consul@2.0.0` | default-control-plane | start-here | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `metrics-server/metrics-server@3.13.0` | default | try-with-proof | resolve-images-before-production-oci | resolve image digests for each affected variant before production OCI support |
| `longhorn/longhorn@1.11.2` | default | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | runtime-watch | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `prometheus-community/prometheus@29.8.0` | default | try-with-proof | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | start-here | security-acceptance-or-hardened-base | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| `argo-cd/argo-cd@9.5.15` | default | runtime-watch | target-runtime-scope-review | choose whether default is in production scope; close or document its runtime-watch live-readiness issue first |
| `grafana/tempo@1.24.4` | local-persistent | runtime-review-needed | target-runtime-scope-review | choose whether local-persistent is in production scope; close or document its runtime-review-needed live-readiness issue first |
| `hashicorp/vault@0.32.0` | default | runtime-review-needed | target-runtime-scope-review | choose whether default is in production scope; close or document its runtime-review-needed live-readiness issue first |
| `ingress-nginx/ingress-nginx@4.15.1` | default | runtime-watch | target-runtime-scope-review | choose whether default is in production scope; close or document its runtime-watch live-readiness issue first |

## Rule

This file describes the contract. It does not create production support. A chart
becomes production-supported only after its proposed decision artifact is
written, reviewed, and backed by fresh evidence for the selected target scope.
