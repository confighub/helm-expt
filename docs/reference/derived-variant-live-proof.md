# Derived Variant Live Proof

This note tracks the first live ConfigHub execution receipts for the derived
variant expansion wave.

The executed slice now covers all five reviewed base Spaces from the generated
derived-variant expansion wave:

```text
helm-nginx-confighub-proof
helm-redis-confighub-proof
helm-prometheus-confighub-proof
helm-grafana-confighub-proof
helm-vault-confighub-proof
```

It proves that the current `cub variant create` substrate can create downstream
ConfigHub variants without re-rendering Helm:

```text
helm-nginx-confighub-proof
  -> NGINX-prod-us-east
  -> NGINX-customer-acme-prod

helm-redis-confighub-proof
  -> Redis-prod-us-east
  -> Redis-staging-eu-west

helm-prometheus-confighub-proof
  -> Prometheus-prod-us-east
  -> Prometheus-staging-eu-west

helm-grafana-confighub-proof
  -> Grafana-prod-us-east
  -> Grafana-customer-acme-prod

helm-vault-confighub-proof
  -> Vault-regulated-prod-us-east
  -> Vault-staging-us-east
```

The ten live receipts are:

```text
runs/derived-variant-execution/nginx-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/nginx-customer-acme-prod/variant-create-receipt.yaml
runs/derived-variant-execution/redis-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/redis-staging-eu-west/variant-create-receipt.yaml
runs/derived-variant-execution/prometheus-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/prometheus-staging-eu-west/variant-create-receipt.yaml
runs/derived-variant-execution/grafana-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/grafana-customer-acme-prod/variant-create-receipt.yaml
runs/derived-variant-execution/vault-regulated-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/vault-staging-us-east/variant-create-receipt.yaml
```

The receipts prove:

- cloned Unit counts for NGINX, Redis, Prometheus, Grafana, and Vault.
- preserved upstream Unit links for every cloned Unit.
- same ConfigHub data-hash set as the reviewed base.
- production delete and destroy gates where the work order asks for them.
- no Helm re-render.

The Grafana receipts also record a corrective update on
`deployment-grafana-grafana`: the initial clone replaced one duplicated 9094
port's `name` and `protocol` with `confighubplaceholder`. The corrective update
restored the reviewed source deployment data before the final data-hash check.
That is useful product evidence, not a clean-clone claim.

The active ConfigHub context did not have the desired work-order targets, so
these receipts intentionally stop before target binding and live apply. They
are live ConfigHub intended-state proofs, not live Kubernetes deployment proofs.

The verifier is:

```text
npm run derived-variants:verify
```
