# cloudpirates/nginx 0.16.1 Proof

This chart belongs to the successor track. It is a full proof of a maintained
successor chart for an affected catalog component.

Variant:

- `default`: chart defaults under Kubernetes 1.30.0; 3 Helm objects, 4 `cub installer` objects including allowed support objects.

What this proves:

- regular Helm output is preserved by `cub installer setup`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with `cub installer package`;
- the chart and image licenses are declared in chart-dossier.yaml with their evidence.

Current gate:

```text
high: 0
medium: 0
low: 0
semantic match: 3/3
```

Useful commands:

```sh
node scripts/generate-successor-track.mjs --verify
node scripts/generate-successor-track.mjs --verify-packages
```
