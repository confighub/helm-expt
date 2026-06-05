# Target-Bound Derived Variants

Generated from committed receipts under `runs/derived-variant-target-bound/`.

This table is about derived ConfigHub variants after a reviewed base has already
been uploaded. It is separate from the chart-recipe-variant lane matrix, which
tracks base variants.

```text
receipts: 6
pass: 5
blocked: 1
watch: 0
```

| Chart | Base | Derived variant | Result | Target | Runtime | Blockers | Receipt |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `bitnami/nginx@24.0.2` | `http-clusterip` | `customer-acme-prod` | pass | `helm-expt-derived-nginx-cust-0605-cluster/oci` | pass | - | [receipt](../../runs/derived-variant-target-bound/nginx-customer-acme-prod/receipt.yaml) |
| `bitnami/nginx@24.0.2` | `http-clusterip` | `prod-us-east` | pass | `helm-expt-derived-nginx-0605-cluster/oci` | pass | - | [receipt](../../runs/derived-variant-target-bound/nginx-prod-us-east/receipt.yaml) |
| `bitnami/redis@25.5.3` | `default` | `staging-eu-west` | blocked | `<target-space>/oci` | not-attempted | namespace-mutation-not-yet-modeled;redis-secret-delivery-not-yet-modeled | [receipt](../../runs/derived-variant-target-bound/redis-staging-eu-west/receipt.yaml) |
| `metrics-server/metrics-server@3.13.0` | `default` | `prod-us-east` | pass | `helm-expt-derived-ms-0605-cluster/oci` | pass | - | [receipt](../../runs/derived-variant-target-bound/metrics-server-prod-us-east/receipt.yaml) |
| `prometheus-community/prometheus@29.8.0` | `server-only-ephemeral` | `prod-us-east` | pass | `helm-expt-derived-prometheus-0605-cluster/oci` | pass | - | [receipt](../../runs/derived-variant-target-bound/prometheus-server-only-prod-us-east/receipt.yaml) |
| `prometheus-community/prometheus@29.8.0` | `server-only-ephemeral` | `staging-eu-west` | pass | `helm-expt-derived-prom-stg-0605-cluster/oci` | pass | - | [receipt](../../runs/derived-variant-target-bound/prometheus-server-only-staging-eu-west/receipt.yaml) |
