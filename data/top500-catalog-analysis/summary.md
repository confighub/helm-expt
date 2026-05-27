# Top-500 Catalog Analysis

This replaces the old source-feature-only matrix with a catalog proof index.
It still keeps the old Helm source scan evidence, but it now shows which charts
have current ConfigHub/cub install proof artifacts and what remains to do.

## Summary

```text
rows: 500
source scanned: 495
source failed: 5
current proof recipes in repo: 100
current proof recipes matched to old matrix rows: 91
current proof recipes not represented in old matrix rows: 9
current recipe proofs: 91
proof matched by exact chart ref: 63
proof matched by chart name and version: 16
proof matched by chart name only: 12
exact source/current version matches: 70
current recipe version differs from old source row: 21
no current recipe proof: 409
catalog-supported: 20
proof-grade: 71
multi-variant proofs: 20
default-only proofs: 71
supported but production-blocked: 20
```

## What This Matrix Proves

- 100 current recipe/package/proof artifacts exist in this repo.
- 91 of the old top-500 source rows currently match those proofs.
- 20 matched rows are catalog-supported for the declared `local-test` scope.
- 71 matched rows are proof-grade default installs that need user-shaped variants before
  promotion.
- 409 rows still have source reconnaissance only; they are not product proof.

## Next Promotion Candidates

These are high-rank proof-grade rows that need real variants before promotion.

| Rank | Chart | Current version | Source features | Next action |
| ---: | --- | --- | --- | --- |
| 8 | `traefik/traefik` | 40.2.0 | lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage | add user-shaped variants before catalog promotion |
| 18 | `external-dns/external-dns` | 1.21.1 | tpl;crds;cluster-rbac | add user-shaped variants before catalog promotion |
| 21 | `gitlab/gitlab-runner` | 0.89.0 | generated-facts;tpl;capabilities | add user-shaped variants before catalog promotion |
| 30 | `vmware-tanzu/velero` | 12.0.1 | tpl;capabilities;crds;cluster-rbac | add user-shaped variants before catalog promotion |
| 33 | `cluster-autoscaler/cluster-autoscaler` | 9.57.0 | tpl;capabilities;cluster-rbac | add user-shaped variants before catalog promotion |
| 35 | `istio-official/istiod` | 1.30.0 | tpl;cluster-rbac;webhooks | add user-shaped variants before catalog promotion |
| 36 | `argo/argo-workflows` | 1.0.14 | tpl;capabilities;crds;cluster-rbac | add user-shaped variants before catalog promotion |
| 38 | `kyverno/kyverno` | 3.8.1 | lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage | add user-shaped variants before catalog promotion |
| 41 | `cloudnative-pg/cloudnative-pg` | 0.28.2 | generated-facts;tpl;crds;cluster-rbac;webhooks | add user-shaped variants before catalog promotion |
| 42 | `fluent/fluent-bit` | 0.57.6 | tpl;capabilities;hooks;cluster-rbac | add user-shaped variants before catalog promotion |

## First Rows Without Current Proof

| Rank | Chart | Source version | Source classification | Next action |
| ---: | --- | --- | --- | --- |
| 9 | `k8s-dashboard/kubernetes-dashboard` | 7.14.0 | P0 source/dependency risk | create recipe, package, variants, rendered digest, scans, and receipts |
| 13 | `gitlab/gitlab` | 10.0.0 | P0 source/dependency risk | create recipe, package, variants, rendered digest, scans, and receipts |
| 14 | `harbor/harbor` | 1.19.0 | P1 compiler policy needed | create recipe, package, variants, rendered digest, scans, and receipts |
| 15 | `bitnami/keycloak` | 25.2.0 | P0 source/dependency risk | create recipe, package, variants, rendered digest, scans, and receipts |
| 16 | `jenkinsci/jenkins` | 5.9.22 | P1 compiler policy needed | create recipe, package, variants, rendered digest, scans, and receipts |
| 22 | `aws/aws-load-balancer-controller` | 3.3.0 | P1 compiler policy needed | create recipe, package, variants, rendered digest, scans, and receipts |
| 23 | `bitnami/kafka` | 32.4.3 | P0 source/dependency risk | create recipe, package, variants, rendered digest, scans, and receipts |
| 25 | `bitnami/external-dns` | 9.0.3 | P0 source/dependency risk | create recipe, package, variants, rendered digest, scans, and receipts |
| 26 | `apache-airflow/airflow` | 1.21.0 | P0 source/dependency risk | create recipe, package, variants, rendered digest, scans, and receipts |
| 29 | `nextcloud/nextcloud` | 9.1.0 | P0 source/dependency risk | create recipe, package, variants, rendered digest, scans, and receipts |

## Outputs

```text
data/top500-catalog-analysis/raw.json
data/top500-catalog-analysis/review.csv
data/top500-catalog-analysis/drilldown.csv
data/top500-catalog-analysis/summary.md
data/top500-catalog-analysis/review.xlsx
```
