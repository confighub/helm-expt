# Top-100 Catalog Analysis

This is the generated proof-surface view for the 100 maintained public Helm
chart recipes in this repo.

It is different from the top-500 matrix:

```text
top-100 = maintained recipe/package proof artifacts in this repo
top-500 = source-feature reconnaissance plus any matching recipe proof
```

## Summary

```text
rows: 100
top-20 catalog-supported entries: 20
next-80 proof-grade entries: 80
catalog-supported: 20
proof-grade: 80
multi-variant entries: 20
default-only entries: 80
top-20 current with latest upstream: 14
top-20 update candidates: 6
production-blocked entries: 20
entries matched to top-500 source rows: 65
```

## Interpretation

- The top-20 entries are the public catalog-supported lane for the declared
  `local-test` scope.
- The next-80 entries are proof-grade. They have deterministic recipe/package
  proof artifacts, but they still need user-shaped variants and promotion review
  before support is claimed.
- Latest-version currentness is tracked only for the top-20 catalog-supported
  lane at the moment. The broader top-100 currentness lane should wait until
  the current top-20 update candidates are promoted or explicitly deferred.

## Top-20 Update Candidates

| Chart | Supported version | Latest version | Variants | Required action |
| --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | default;no-crds | Run full promotion lanes before replacing the supported version. |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | generated-passwords;existing-secret-replicaset | Run full promotion lanes before replacing the supported version. |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | http-clusterip;existing-tls-ingress | Run full promotion lanes before replacing the supported version. |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | generated-passwords;existing-secret | Run full promotion lanes before replacing the supported version. |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | default;no-crds | Run full promotion lanes before replacing the supported version. |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | default;server-only-ephemeral | Run full promotion lanes before replacing the supported version. |

## High-Rank Next-80 Promotion Candidates

These rows already have proof-grade artifacts and appear high in the source
catalog reconnaissance. They need real variants before catalog support.

| Proof rank | Top-500 rank | Chart | Version | Source features |
| ---: | ---: | --- | --- | --- |
| 21 | 8 | `traefik/traefik` | `40.2.0` | lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage |
| 22 | 18 | `external-dns/external-dns` | `1.21.1` | tpl;crds;cluster-rbac |
| 23 | 21 | `gitlab/gitlab-runner` | `0.89.0` | generated-facts;tpl;capabilities |
| 24 | 38 | `kyverno/kyverno` | `3.8.1` | lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage |
| 25 | 41 | `cloudnative-pg/cloudnative-pg` | `0.28.2` | generated-facts;tpl;crds;cluster-rbac;webhooks |
| 26 | 42 | `fluent/fluent-bit` | `0.57.6` | tpl;capabilities;hooks;cluster-rbac |
| 27 | 45 | `runix/pgadmin4` | `1.62.0` | tpl;capabilities;stateful-storage |

## Outputs

```text
data/top100-catalog-analysis/raw.json
data/top100-catalog-analysis/review.csv
data/top100-catalog-analysis/summary.md
```
