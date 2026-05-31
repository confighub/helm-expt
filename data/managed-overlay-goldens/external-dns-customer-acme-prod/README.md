# ExternalDNS Managed Overlay Golden

This generated golden models a Kubara-style managed app using ExternalDNS as the
first concrete example.

The managed import unit is:

```text
managed wrapper chart + platform values + customer overlay values + dependency closure + render context
```

The golden separates two decisions before rendering:

- values that change Kubernetes objects go through `cub installer`;
- operating labels, targets, approvals, and observation requirements go through
  the post-render Variant Creator contract.

This is not a claim that all Kubara applications are imported. It is a
verification target for the managed-overlay boundary.

Generated files:

- `wrapper-chart/Chart.yaml`
- `values/platform-values.yaml`
- `values/customer-acme-prod-values.yaml`
- `overlay-classification.yaml`
- `creator-contract.yaml`
- `preview.yaml`
- `receipts/overlay-classification-receipt.yaml`
- `receipts/render-boundary-receipt.yaml`
- `receipts/check-receipt.yaml`
