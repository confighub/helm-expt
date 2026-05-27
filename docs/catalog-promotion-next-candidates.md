# Catalog Promotion Next Candidates

Six recipes are now explicit `catalog-supported` entries for the declared
`local-test` scope:

```text
bitnami/redis
bitnami/nginx
bitnami/postgresql
metrics-server/metrics-server
ingress-nginx/ingress-nginx
jetstack/cert-manager
```

They are not production-supported yet. Production remains blocked until the
scan, gate, and operating-policy findings have dispositions.

The next promotion reviews should prove breadth without making the happy path
feel heavy.

Recommended next candidates:

| Chart | Why it matters | Review focus |
| --- | --- | --- |
| `argo-cd/argo-cd` | Common GitOps control plane | Raw/tpl slots, RBAC, CRDs, and GitOps compatibility story. |
| `external-secrets/external-secrets` | Secret integration chart | CRDs, webhooks, SecretStore expectations, and target facts. |
| `grafana/grafana` | Familiar app with many knobs | Ingress/TLS, persistence, dashboards, and admin Secret handling. |
| `hashicorp/vault` | Security-sensitive stateful chart | Seal/init expectations, storage, RBAC, and production blockers. |
| `prometheus-community/prometheus` | Monitoring baseline | RBAC, PVCs, alerting config, scrape extensions, and safe variants. |

Promotion review should answer:

```text
Is this the best, simplest, safest way for a Helm user to install and vary it?
Are the supported variants obvious?
Are deferred variants explicit?
Are scan/gate warnings acceptable for the declared support scope?
Can cub install output be compared cleanly with regular Helm output?
```
