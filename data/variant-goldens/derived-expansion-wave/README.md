# Derived Variant Expansion Wave

This generated wave starts the work tracked in
[helm-expt#144](https://github.com/confighub/helm-expt/issues/144): derived
ConfigHub variants need to be visible across the catalog, not only Redis.

The wave uses only the current command surface:

```text
cub variant create
```

Each work order starts from a reviewed uploaded base Space, creates a downstream
Space and cloned Units, preserves upstream links, and records route-back
guidance for changes that must return to `cub installer`.

Summary:

```text
source bases: 5
derived variants: 10
current command: cub variant create,cub variant promote,cub variant upload
receipt targets: 30
```

| Work order | Source base | Derived variant | Environment | Region | Target |
| --- | --- | --- | --- | --- | --- |
| redis-prod-us-east | Redis/default | prod-us-east | Prod | us-east | redis-targets/prod-us-east |
| redis-staging-eu-west | Redis/default | staging-eu-west | Staging | eu-west | redis-targets/staging-eu-west |
| prometheus-prod-us-east | Prometheus/default | prod-us-east | Prod | us-east | monitoring-targets/prod-us-east |
| prometheus-staging-eu-west | Prometheus/default | staging-eu-west | Staging | eu-west | monitoring-targets/staging-eu-west |
| nginx-prod-us-east | NGINX/http-clusterip | prod-us-east | Prod | us-east | web-targets/prod-us-east |
| nginx-customer-acme-prod | NGINX/http-clusterip | customer-acme-prod | Prod | us-west | web-targets/customer-acme-prod |
| grafana-prod-us-east | Grafana/static-passwords | prod-us-east | Prod | us-east | observability-targets/prod-us-east |
| grafana-customer-acme-prod | Grafana/static-passwords | customer-acme-prod | Prod | us-east | observability-targets/customer-acme-prod |
| vault-regulated-prod-us-east | Vault/default | regulated-prod-us-east | Prod | us-east | security-targets/regulated-prod-us-east |
| vault-staging-us-east | Vault/default | staging-us-east | Staging | us-east | security-targets/staging-us-east |

Generated files:

- `work-orders.yaml`
- `work-orders.csv`
- `receipts/wave-check-receipt.yaml`
- `receipts/<work-order>/clone-receipt.yaml`
- `receipts/<work-order>/mutation-receipt.yaml`
- `receipts/<work-order>/check-receipt.yaml`

The per-work-order receipts are golden targets, not live execution receipts.
They make the required clone, mutation, and check outcomes explicit before the
live ConfigHub execution step.

Live execution receipts, where available, are tracked separately under
`runs/derived-variant-execution/`. The first live wave covers all five source
bases and is documented in `docs/reference/derived-variant-live-proof.md`.
