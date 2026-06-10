# Retained Candidate Promotion Readiness

This file is generated from retained update candidate proofs and the current
top-20 production-disposition table.

It does not promote newer chart versions. It shows whether the generated
candidate artifacts are complete, whether root catalog paths are present, and
whether the public catalog support decision still points at the current
supported versions.

## Result

```text
Retained candidates checked: 7
Complete candidate artifact sets: 7 / 7
Not yet promoted to root catalog paths: 0 / 7
Root catalog paths present: 7 / 7
Ready for root-path promotion work: 0 / 7
```

## Candidates

| Chart | Current supported version | Candidate version | Variants | Candidate artifacts | Catalog promotion | Readiness |
| --- | --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `default`, `no-crds` | complete | root-path-present | root-path-promoted-review-required |
| `bitnami/mongodb` | `19.0.7` | `19.1.0` | `generated-passwords`, `existing-secret-replicaset` | complete | root-path-present | root-path-promoted-review-required |
| `bitnami/nginx` | `24.0.2` | `25.0.0` | `http-clusterip`, `existing-tls-ingress` | complete | root-path-present | root-path-promoted-review-required |
| `bitnami/postgresql` | `18.6.7` | `18.7.0` | `generated-passwords`, `existing-secret` | complete | root-path-present | root-path-promoted-review-required |
| `bitnami/redis` | `25.5.3` | `27.0.0` | `default`, `reuse-existing-secret` | complete | root-path-present | root-path-promoted-review-required |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `default`, `no-crds` | complete | root-path-present | root-path-promoted-review-required |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `default`, `server-only-ephemeral` | complete | root-path-present | root-path-promoted-review-required |

## Closed Proof Lanes

The work-order report records these proof lanes for each retained candidate:

- ConfigHub proof receipt
- live e2e observation receipt
- live parity receipt
- production disposition
- catalog status
- root catalog
- top-100 analysis
- top-500 analysis

The previous supported version remains the supported catalog version until a
target-scoped replacement decision explicitly chooses to replace, defer, or keep
both versions.

The generated lane work orders are:

[promotion-work-orders.md](./promotion-work-orders.md)

## Verify

```sh
npm run top20:latest-promotion-readiness:verify
```
