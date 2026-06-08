# Top-100 Readiness

This is the shortest chart-by-chart answer for the maintained top-100 corpus.
It joins the catalog analysis with the outcome evidence so readers can see what
works now, what works with help, and what still needs product or operator work.

## Summary

~~~text
charts: 100
top-20 catalog-supported: 20
next-80 proof-grade: 80
charts with live evidence on at least one variant: 20
charts with named hard gaps: 25
~~~

## User Status

| Status | Count | Meaning |
| --- | ---: | --- |
| `catalog-supported-with-live-evidence` | 20 | Top-20 catalog entry with at least one live proof lane. |
| `proof-grade-needs-user-shaped-variant` | 46 | Proof-grade chart whose current path is too default-only for catalog promotion. |
| `proof-grade-ready-for-promotion-review` | 27 | Recipe/package proof exists and variants exist; needs human catalog promotion review. |
| `proof-grade-with-named-limitation` | 7 | Proof-grade chart with a named capability gap or operator decision. |

## Strongest Evidence Per Chart

| Evidence | Count | Meaning |
| --- | ---: | --- |
| `live-helm-vs-confighub-parity` | 10 | Plain Helm and ConfigHub delivery reached equivalent live outcomes for at least one variant. |
| `local-kubernetes-live` | 10 | Rendered objects were applied to Kubernetes and observed for at least one variant. |
| `render-parity` | 80 | Regular Helm and cub installer setup render-equivalent objects. |

## How To Read This

- Every row in this file has a maintained recipe/package proof path.
- `render-parity` means regular Helm and `cub installer setup` produce the same
  Kubernetes object set under recorded inputs, apart from declared installer
  support objects.
- Live evidence is intentionally counted separately. A chart can be proof-grade
  without every base variant having live Kubernetes, GitOps, or live parity
  evidence yet.
- Hard gaps are capability gaps, not necessarily chart failure. They usually mean
  a useful path such as an existing-secret, HA, no-CRDs, or production lifecycle
  path still needs a supported variant or operator decision.

## First Rows

| Chart | User status | Evidence | Variants | Next action |
| --- | --- | --- | ---: | --- |
| `argo-cd/argo-cd@9.5.15` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | resolve or document: ha (curated proof lane - bespoke teaching needed) |
| `bitnami/mongodb@19.0.7` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | promote a declared production scope when gates pass |
| `bitnami/mysql@14.0.3` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | resolve or document: ha (curated proof lane - bespoke teaching needed) |
| `bitnami/nginx@24.0.2` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | resolve or document: existing-secret (chart ships no Secret toggle - #113) |
| `bitnami/postgresql@18.6.7` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | resolve or document: ha (curated proof lane - bespoke teaching needed) |
| `bitnami/rabbitmq@16.0.14` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | resolve or document: ha (curated proof lane - bespoke teaching needed) |
| `bitnami/redis@25.5.3` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | promote a declared production scope when gates pass |
| `external-secrets/external-secrets@2.5.0` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | promote a declared production scope when gates pass |
| `grafana/grafana@10.5.15` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | promote a declared production scope when gates pass |
| `grafana/loki@7.0.0` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | promote a declared production scope when gates pass |
| `grafana/tempo@1.24.4` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | resolve or document: ha (tempo single-binary chart; HA is the separate t...) |
| `hashicorp/consul@2.0.0` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | resolve or document: ha (curated proof lane - bespoke teaching needed) |
| `hashicorp/vault@0.32.0` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | promote a declared production scope when gates pass |
| `ingress-nginx/ingress-nginx@4.15.1` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | promote a declared production scope when gates pass |
| `jetstack/cert-manager@v1.20.2` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | promote a declared production scope when gates pass |
| `longhorn/longhorn@1.11.2` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | promote a declared production scope when gates pass |
| `metrics-server/metrics-server@3.13.0` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | resolve or document: existing-secret (chart ships no Secret toggle - #113) |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `catalog-supported-with-live-evidence` | `local-kubernetes-live` | 2 | resolve or document: existing-secret (chart ships no Secret toggle - #113) |
| `prometheus-community/prometheus@29.8.0` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | resolve or document: ha (curated proof lane - bespoke teaching needed) |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | `catalog-supported-with-live-evidence` | `live-helm-vs-confighub-parity` | 2 | promote a declared production scope when gates pass |
| `traefik/traefik@40.2.0` | `proof-grade-with-named-limitation` | `render-parity` | 2 | review limitation before promotion: existing-secret (chart ships no Secret toggle - #113) |
| `external-dns/external-dns@1.21.1` | `proof-grade-ready-for-promotion-review` | `render-parity` | 2 | run catalog promotion review |
| `gitlab/gitlab-runner@0.89.0` | `proof-grade-needs-user-shaped-variant` | `render-parity` | 1 | add at least one user-shaped variant before catalog promotion |
| `kyverno/kyverno@3.8.1` | `proof-grade-with-named-limitation` | `render-parity` | 2 | review limitation before promotion: existing-secret (chart ships no Secret toggle - #113) |
| `cloudnative-pg/cloudnative-pg@0.28.2` | `proof-grade-ready-for-promotion-review` | `render-parity` | 2 | run catalog promotion review |

## Files

| File | Use |
| --- | --- |
| `data/top100-readiness/readiness.csv` | One row per top-100 chart: user status, strongest evidence, lane counts, gap, next action. |
| `data/top100-catalog-analysis/review.csv` | Catalog analysis and promotion surface. |
| `data/outcome-coverage/chart-outcomes.csv` | Detailed outcome counts per chart. |
| `data/outcome-coverage/base-outcomes.csv` | Per base-variant proof lane status. |

Regenerate:

~~~sh
npm run top100:readiness
npm run top100:readiness:verify
~~~
