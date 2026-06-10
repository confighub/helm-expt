# Production Disposition And Live/E2E Lane

The top-20 are mandatory catalog entries because their upstream Helm charts are
too popular to omit. This lane records the work needed to move those supported
top-20 entries from `local-test` support toward production support.

It does not claim production support itself. Production support is recorded in
the target-scoped decision artifacts under
`data/production-support-decisions/`.

## Summary

```text
catalog-supported local-test charts: 20
ConfigHub proof receipts passing: 20
live/e2e observed charts: 20
production-review-ready disposition rows: 20
production-blocked pending disposition: 0
target-scoped support decision artifacts: 20
target-scoped supported decisions: 17
target-scoped superseded decisions: 2
target-scoped rejected decisions: 1
target-scoped draft decisions: 0
source Helm-hook rows: 1
hook/lifecycle disposition rows: 12
related lifecycle observation rows: 2
accepted production disposition receipts: 104
charts with accepted dispositions: 20
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
a non-default base still needs target runtime review. The target-scoped
production support decision chooses the supported base, target scope, accepted
risk boundary, and required runtime checks.

## How To Read The Production State

| State | Meaning |
| --- | --- |
| `catalog-supported` | The chart is in the public catalog with maintained bases and local-test proof. |
| `production-review-ready` | The required pre-review disposition receipts exist for the chart. |
| `blocked` | One or more required pre-review disposition receipts are missing. |
| `production-supported` | Not set by this lane. It requires a separate target-scoped support decision. |

`production-review-ready` is not the same as production support. It means the
chart has enough accepted disposition evidence to make or audit a target-scoped
production support decision.

Use these generated files as follows:

| File | Use |
| --- | --- |
| `data/production-support-decisions/summary.md` | Current target-scoped support decisions: supported, superseded, rejected, or draft. |
| `data/production-disposition/next-actions.csv` | Historical pre-decision action per top-20 chart. |
| `data/production-disposition/support-decision-contract.md` | Pre-decision contract and queue used to create the current support decisions. |
| `data/production-disposition/support-decision-queue.csv` | Historical one-row-per-chart support-decision queue. |
| `data/production-disposition/dispositions.md` | Accepted receipts, evidence, owners, and unblock rules. |
| `data/scan-disposition-workdown/summary.md` | Whether scan findings need fixes, hardened bases, explicit acceptance, runtime review, or policy decisions. |

Typical support work includes choosing the production base, naming the target
scope, accepting or patching scan findings, confirming lifecycle and target-fact
requirements, refreshing live/e2e evidence for that scope, and recording or
updating the support decision.

## Pre-Decision Workstreams

This historical queue shows the decision that was needed before the current
target-scoped decisions were closed. Use the current decision artifacts for the
active support state.

| Workstream | Charts | Next action |
| --- | ---: | --- |
| Final support decision | 1 | Choose the supported base, target scope, delivery path, and evidence refresh rule.<br>`bitnami/nginx@24.0.2` (http-clusterip) |
| Image digest resolution | 11 | Pin images by digest or record an explicit exception before production OCI support.<br>`argo-cd/argo-cd@9.5.15` (default)<br>`bitnami/mysql@14.0.3` (generated-passwords)<br>`bitnami/rabbitmq@16.0.14` (generated-passwords)<br>`external-secrets/external-secrets@2.5.0` (default)<br>`grafana/grafana@10.5.15` (generated-passwords)<br>and 6 more |
| Lifecycle support boundary | 4 | Record which lifecycle behavior is supported, observed, excluded, or operator-owned.<br>`bitnami/mongodb@19.0.7` (generated-passwords)<br>`bitnami/postgresql@18.6.7` (generated-passwords)<br>`bitnami/redis@25.5.3` (default)<br>`ingress-nginx/ingress-nginx@4.15.1` (internal-clusterip) |
| Security acceptance or hardened base | 4 | Accept current security findings for the target scope or create a hardened base variant.<br>`longhorn/longhorn@1.11.2` (default)<br>`prometheus-community/kube-prometheus-stack@85.3.3` (default)<br>`prometheus-community/prometheus@29.8.0` (server-only-ephemeral)<br>`secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` (default) |

For the full per-chart contract, use
`data/production-disposition/support-decision-contract.md`. For the
spreadsheet form, use
`data/production-disposition/support-decision-queue.csv`.

## Top-20 Disposition Table

| Chart | Variants | ConfigHub proof | Live/e2e | Production status | Accepted | Open dispositions |
| --- | --- | --- | --- | --- | ---: | --- |
| `argo-cd/argo-cd@9.5.15` | default, no-crds | pass | local-kind-observed | production-review-ready | 7 |  |
| `bitnami/mongodb@19.0.7` | generated-passwords, existing-secret-replicaset | pass | local-kind-observed | production-review-ready | 6 |  |
| `bitnami/mysql@14.0.3` | generated-passwords, existing-secret | pass | local-kind-observed | production-review-ready | 5 |  |
| `bitnami/nginx@24.0.2` | http-clusterip, existing-tls-ingress | pass | local-kind-observed | production-review-ready | 4 |  |
| `bitnami/postgresql@18.6.7` | generated-passwords, existing-secret | pass | local-kind-observed | production-review-ready | 5 |  |
| `bitnami/rabbitmq@16.0.14` | generated-passwords, existing-secret | pass | local-kind-observed | production-review-ready | 5 |  |
| `bitnami/redis@25.5.3` | default, reuse-existing-secret | pass | local-kind-observed | production-review-ready | 4 |  |
| `external-secrets/external-secrets@2.5.0` | default, no-crds | pass | local-kind-observed | production-review-ready | 6 |  |
| `grafana/grafana@10.5.15` | generated-passwords, existing-secret-ingress | pass | local-kind-observed | production-review-ready | 5 |  |
| `grafana/loki@7.0.0` | single-binary-filesystem, simple-scalable-minio | pass | local-kind-observed | production-review-ready | 5 |  |
| `grafana/tempo@1.24.4` | local-persistent, s3-query-observability | pass | local-kind-observed | production-review-ready | 4 |  |
| `hashicorp/consul@2.0.0` | default-control-plane, secure-mesh-existing-secrets | pass | local-kind-observed | production-review-ready | 8 |  |
| `hashicorp/vault@0.32.0` | dev-mode, default, ha-raft-ui | pass | local-kind-observed | production-review-ready | 5 |  |
| `ingress-nginx/ingress-nginx@4.15.1` | default, admission-disabled, internal-clusterip | pass | local-kind-observed | production-review-ready | 5 |  |
| `jetstack/cert-manager@v1.20.2` | default, crds-enabled | pass | local-kind-observed | production-review-ready | 6 |  |
| `longhorn/longhorn@1.11.2` | default, ui-ingress | pass | local-kind-observed | production-review-ready | 5 |  |
| `metrics-server/metrics-server@3.13.0` | default, external-tls-ca | pass | local-kind-observed | production-review-ready | 5 |  |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default, no-crds | pass | local-kind-observed | production-review-ready | 7 |  |
| `prometheus-community/prometheus@29.8.0` | default, server-only-ephemeral | pass | local-kind-observed | production-review-ready | 3 |  |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default, sync-secret-rotation | pass | local-kind-observed | production-review-ready | 4 |  |

## Doctrine

The top-20 must be in the catalog. Their local-test paths are easy to try
because they have passing ConfigHub/cub installer receipts. They are not
production-supported until their scan/gate warnings, lifecycle risks, target
facts, and live/e2e observation requirements have explicit dispositions and a
separate production support decision records the target scope.
