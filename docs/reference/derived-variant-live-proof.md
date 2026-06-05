# Derived Variant Live Proof

This note tracks the first live ConfigHub execution receipts for the derived
variant expansion wave.

The executed slice starts from two reviewed base Spaces:

```text
helm-nginx-confighub-proof
helm-redis-confighub-proof
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
```

The four live receipts are:

```text
runs/derived-variant-execution/nginx-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/nginx-customer-acme-prod/variant-create-receipt.yaml
runs/derived-variant-execution/redis-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/redis-staging-eu-west/variant-create-receipt.yaml
```

The receipts prove:

- 7 cloned NGINX Units and 15 cloned Redis Units.
- preserved upstream Unit links for every cloned Unit.
- same ConfigHub data-hash set as the reviewed base.
- production delete and destroy gates where the work order asks for them.
- no Helm re-render.

The active ConfigHub context did not have the desired work-order targets
`web-targets/prod-us-east`, `web-targets/customer-acme-prod`,
`redis-targets/prod-us-east`, or `redis-targets/staging-eu-west`, so these
receipts intentionally stop before target binding and live apply. They are live
ConfigHub intended-state proofs, not live Kubernetes deployment proofs.

The verifier is:

```text
npm run derived-variants:verify
```
