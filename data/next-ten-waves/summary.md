# Next-Ten Waves

This generated directory turns the current execution plan into small work
queues. It is intentionally narrower than the full attack-plan workdown: these
are the next rows to work, not the whole corpus.

## Current Waves

```text
gap-review first rows:             9
strict promotion-review rows:      8
latest-version promotion rows:     7
variant-build rows:                5
production-disposition first rows: 5
import prototype rows:             3
```

## Files

| File | Purpose |
| --- | --- |
| `gap-review-wave.csv` | First existing-secret and CRD/no-CRDs hard gaps to review. |
| `../top100-promotion-wave/wave.csv` | First strict top-100 promotion-review wave: proof-grade charts with two-cluster parity. |
| `latest-promotion-wave.csv` | Six latest top-20 candidates that are ready for full lane promotion work. |
| `variant-build-wave.csv` | Wave-2 chart variants to render and prove next. |
| `production-disposition-wave.csv` | First five catalog-supported charts to move toward production disposition. |
| `import-prototype-wave.csv` | Import examples that explain public chart, managed overlay, and post-render promotion routes. |

The production-disposition wave separates accepted dispositions from open
dispositions, so the queue shows only the production decisions still needing
receipts before the follow-up runtime/GitOps and image-digest lanes run.

## Gap Review Wave

| # | Chart | Capability | Proof tier | Next action |
| --- | --- | --- | --- | --- |
| 1 | bitnami/apache | existing-secret | proof-grade | source-review values; if no toggle exists, keep existing-secret unavailable and document external-secret production path |
| 2 | bitnami/contour | existing-secret | proof-grade | source-review values; if no toggle exists, keep existing-secret unavailable and document external-secret production path |
| 3 | bitnami/elasticsearch | existing-secret | proof-grade | source-review values; if no toggle exists, keep existing-secret unavailable and document external-secret production path |
| 4 | bitnami/memcached | existing-secret | proof-grade | source-review values; if no toggle exists, keep existing-secret unavailable and document external-secret production path |
| 5 | bitnami/nginx | existing-secret | catalog-supported | write production disposition for generated secret ownership and target-fact preflight |
| 6 | bitnami/phpmyadmin | existing-secret | proof-grade | source-review values; if no toggle exists, keep existing-secret unavailable and document external-secret production path |
| 7 | argo-cd/argocd-image-updater | no-crds | proof-grade | source-review CRD values, then classify as chart-toggle-found or no-crds-not-offered |
| 8 | minio-operator/operator | no-crds | proof-grade | source-review CRD values, then classify as chart-toggle-found or no-crds-not-offered |
| 9 | rook-release/rook-ceph | no-crds | proof-grade | source-review CRD values, then classify as chart-toggle-found or no-crds-not-offered |

## Strict Promotion Review Wave

| Priority | Chart | Variants | Scan high | Scan medium | Next |
| --- | --- | --- | --- | --- | --- |
| 2 | cloudnative-pg/cloudnative-pg@0.28.2 | default;no-crds | 0 | 16 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| 2 | elastic/eck-operator@3.4.0 | default;ha;no-crds | 0 | 18 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| 2 | elastic/logstash@8.5.1 | default;ha | 0 | 0 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| 2 | external-dns/external-dns@1.21.1 | default;no-crds;dry-run-txt-registry | 0 | 3 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| 2 | grafana/alloy@1.8.2 | default;no-crds | 0 | 3 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| 2 | kedacore/keda@2.19.0 | default;no-crds | 0 | 17 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| 2 | nats/nats@2.14.0 | default;ha | 0 | 1 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| 2 | prometheus-community/alertmanager@1.37.0 | default;ha | 0 | 0 | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |

## Latest-Version Promotion Wave

| # | Chart | Current | Candidate | Status |
| --- | --- | --- | --- | --- |
| 1 | argo-cd/argo-cd | 9.5.15 | 9.5.17 | root-path-promoted-review-required |
| 2 | bitnami/mongodb | 19.0.7 | 19.0.9 | root-path-promoted-review-required |
| 3 | bitnami/nginx | 24.0.2 | 24.0.4 | root-path-promoted-review-required |
| 4 | bitnami/postgresql | 18.6.7 | 18.6.10 | root-path-promoted-review-required |
| 5 | bitnami/redis | 25.5.3 | 27.0.0 | root-path-promoted-review-required |
| 6 | prometheus-community/kube-prometheus-stack | 85.3.3 | 86.1.0 | root-path-promoted-review-required |
| 7 | prometheus-community/prometheus | 29.8.0 | 29.9.0 | root-path-promoted-review-required |

## Variant Build Wave

| # | Chart | Proposed variants | Blocking questions |
| --- | --- | --- | --- |
| 1 | traefik/traefik | default;external-crds;internal-clusterip-dashboard-off;cloud-loadbalancer | catalog support still requires comparing default against the new user-shaped variants;confirm exact Traefik chart value for CRD creation versus CRD provider enablement;cloud-specific annotations must be target/variant-owned |
| 2 | external-dns/external-dns | route53-irsa;cloudflare-existing-secret;dry-run-txt-registry | confirm chart-supported secret/env shape |
| 3 | vmware-tanzu/velero | aws-s3-existing-secret;azure-blob-existing-secret;filesystem-backup-node-agent | proof recipe uses velero/velero source; source alias must stay clear in catalog;daemonset privileges need production disposition |
| 4 | istio-official/istiod | revisioned-control-plane;external-ca;minimal-profile | confirm exact chart values and secret shape |
| 5 | kyverno/kyverno | default-admission;external-crds;ha-admission-reports | confirm exact chart CRD ownership values;webhook rollout and disruption policy must be dispositioned |

## Production Disposition Wave

| # | Chart | Accepted | Open |
| --- | --- | --- | --- |
| 1 | bitnami/redis | generated fact ownership;hook and lifecycle phase policy;scan/gate warning disposition;target fact preflight | - |
| 2 | bitnami/nginx | extension slot provenance and scan policy;generated fact ownership;scan/gate warning disposition;target fact preflight | - |
| 3 | metrics-server/metrics-server | cluster RBAC review;generated fact ownership;hook and lifecycle phase policy;scan/gate warning disposition;target fact preflight | - |
| 4 | prometheus-community/prometheus | cluster RBAC review;extension slot provenance and scan policy;scan/gate warning disposition | - |
| 5 | bitnami/postgresql | generated fact ownership;hook and lifecycle phase policy;scan/gate warning disposition;storage backup restore and rollback policy;target fact preflight | - |

## Import Prototype Wave

| # | Case | Route | Status |
| --- | --- | --- | --- |
| 1 | public-chart-redis | cub helm install can inspect quickly; recipe import creates maintained cub installer package | complete |
| 2 | managed-overlay-external-dns | managed overlay import; user choices are classified before render | complete |
| 3 | post-render-promotion | cub variant create over cloned Spaces and Units | complete |
