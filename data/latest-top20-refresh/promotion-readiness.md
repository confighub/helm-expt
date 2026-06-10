# Latest Candidate Promotion Readiness

This file is generated from the latest-version candidate proofs and the current
top-20 production-disposition table.

It does not promote newer chart versions. It shows whether the generated
candidate artifacts are complete enough to start the full catalog promotion
lanes, and whether the public catalog still points at the current supported
versions.

## Result

```text
Latest-version candidates checked: 6
Complete candidate artifact sets: 6 / 6
Not yet promoted to root catalog paths: 6 / 6
Ready for full-lane promotion work: 6 / 6
```

## Candidates

| Chart | Current supported version | Candidate version | Variants | Candidate artifacts | Catalog promotion | Readiness |
| --- | --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `default`, `no-crds` | complete | not-promoted | ready-for-full-lane-promotion |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | `generated-passwords`, `existing-secret-replicaset` | complete | not-promoted | ready-for-full-lane-promotion |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | `http-clusterip`, `existing-tls-ingress` | complete | not-promoted | ready-for-full-lane-promotion |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | `generated-passwords`, `existing-secret` | complete | not-promoted | ready-for-full-lane-promotion |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `default`, `no-crds` | complete | not-promoted | ready-for-full-lane-promotion |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `default`, `server-only-ephemeral` | complete | not-promoted | ready-for-full-lane-promotion |

## Required Lanes Before Support

Each candidate still needs these lanes before it can replace the supported
catalog version:

- ConfigHub proof receipt
- live e2e observation receipt
- live parity receipt
- production disposition
- catalog status
- root catalog
- top-100 analysis
- top-500 analysis

The previous supported version remains the catalog version until those lanes
produce receipts and the generated catalog, production-disposition, top-100, and
top-500 outputs are regenerated.

The generated lane work orders are:

[promotion-work-orders.md](./promotion-work-orders.md)

## Verify

```sh
npm run top20:latest-promotion-readiness:verify
```
