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

Product support split:

- free/out-of-box catalog configs are reviewed base shapes that are common
  enough to publish;
- ConfigHub customization creates derived variants over a reviewed base;
- managed or potentially paid complexity includes private wrapper charts,
  private values, GitOps import, fleet variants, full stacks, production
  receipts, support SLAs, and old-version patch work.

This is not a claim that all Kubara applications are imported. It is a
verification target for the managed-overlay boundary.

Status: current generated classification golden. It is not a live import,
ConfigHub delivery, or production-readiness receipt.

Source base: ExternalDNS/managed-aws-acme.
Derived operating variant: ExternalDNS/customer-acme-prod.

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
