# Next 80 Full Proofs

This corpus adds 80 public Helm charts beyond the first 20 bespoke proofs.

Each row has:

- `recipes/<repo>/<chart>/<version>/` with Recipe, HelmPlan, ChartDossier, control points, Variant, VariantRevision, rendered objects, and receipts.
- `packages/<repo>/<chart>/<version>/` with a `cub install` package.
- A Helm equivalence receipt proving regular Helm output matches `cub install setup`, aside from allowed installer support objects.
- A render receipt, scan receipt, install gate, and installer package receipt.

Selection rule:

```text
regular helm template output
  == cub install setup output
  plus the allowed Namespace support object
```

Charts that render with Helm but change semantics through the installer/Kustomize
round trip are excluded from this passing lane until the difference is classified
and mitigated.

Summary:

```text
charts: 80
rendered Helm objects: 1090
CRDs: 223
charts with cluster RBAC: 48
charts with webhooks: 11
charts with source hooks: 27
charts with capabilities logic: 53
```

Verification:

```sh
npm run next80:verify
npm run next80:verify-packages
```
