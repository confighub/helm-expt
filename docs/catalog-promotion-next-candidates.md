# Catalog Promotion Next Candidates

Redis is the first explicit `catalog-supported` entry. The next promotion
reviews should prove breadth without making the happy path feel heavy.

Recommended next five:

| Chart | Why it matters | Review focus |
| --- | --- | --- |
| `bitnami/nginx` | Simple, familiar workload | Prove shortest possible happy path and low ceremony. |
| `bitnami/postgresql` | Stateful chart | Storage, secrets, upgrade/rollback, and backup expectations. |
| `metrics-server/metrics-server` | Small cluster component | APIService, target facts, and production readiness. |
| `ingress-nginx/ingress-nginx` | Common edge component | Webhooks, hooks, cluster RBAC, and admission-disabled variant. |
| `jetstack/cert-manager` | CRD-heavy infrastructure | CRD lifecycle, webhook readiness, and hook policy. |

Promotion review should answer:

```text
Is this the best, simplest, safest way for a Helm user to install and vary it?
Are the supported variants obvious?
Are deferred variants explicit?
Are scan/gate warnings acceptable for the declared support scope?
Can cub install output be compared cleanly with regular Helm output?
```
