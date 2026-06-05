# Derived Variant Live Proof

This note tracks the first live ConfigHub execution receipts for the derived
variant expansion wave.

The executed slice starts from the reviewed NGINX `http-clusterip` base Space:

```text
helm-nginx-confighub-proof
```

It proves that the current `cub variant create` substrate can create downstream
ConfigHub variants without re-rendering Helm:

```text
helm-nginx-confighub-proof
  -> NGINX-prod-us-east
  -> NGINX-customer-acme-prod
```

The two live receipts are:

```text
runs/derived-variant-execution/nginx-prod-us-east/variant-create-receipt.yaml
runs/derived-variant-execution/nginx-customer-acme-prod/variant-create-receipt.yaml
```

Both receipts prove:

- 7 cloned Units.
- 7 preserved upstream Unit links.
- same ConfigHub data-hash set as the reviewed base.
- production delete and destroy gates on all cloned Units.
- no Helm re-render.

The active ConfigHub context did not have the desired work-order targets
`web-targets/prod-us-east` or `web-targets/customer-acme-prod`, so these
receipts intentionally stop before target binding and live apply. They are live
ConfigHub intended-state proofs, not live Kubernetes deployment proofs.

The verifier is:

```text
npm run derived-variants:verify
```
