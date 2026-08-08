# Successor Track Full Proofs

This corpus holds full proofs for maintained successor charts. Each entry
replaces an affected catalog component and declares its chart and image
licenses in the chart dossier.

Each row has:

- `recipes/<publisher>/<chart>/<version>/` with Recipe, HelmPlan, ChartDossier, control points, Variant, VariantRevision, rendered objects, and receipts.
- `packages/<publisher>/<chart>/<version>/` with a `cub installer` package.
- A Helm equivalence receipt proving regular Helm output matches `cub installer setup`, aside from allowed installer support objects.
- A render receipt, scan receipt, install gate, and installer package receipt.
- A licenses block in chart-dossier.yaml carrying the chart SPDX id, its evidence, and the image component licenses.

Selection rule:

```text
regular helm template output
  == cub installer setup output
  plus the allowed Namespace support object
```

Charts that render with Helm but change semantics through the installer/Kustomize
round trip are excluded from this passing lane until the difference is classified
and mitigated.

Summary:

```text
charts: 4
rendered Helm objects: 17
CRDs: 0
charts with cluster RBAC: 0
charts with webhooks: 0
charts with source hooks: 2
charts with capabilities logic: 3
```

Verification:

```sh
node scripts/generate-successor-track.mjs --verify
node scripts/generate-successor-track.mjs --verify-packages
```
