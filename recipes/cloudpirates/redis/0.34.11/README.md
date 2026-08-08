# cloudpirates/redis 0.34.11 Proof

This chart belongs to the successor track. It is a full proof of a maintained
successor chart for an affected catalog component.

Variant:

- `default`: chart defaults under Kubernetes 1.30.0; 5 Helm objects, 6 `cub installer` objects including allowed support objects.

The chart default generates random credential material at render time. The default variant pins auth.password to fixed demo values recorded in effective-values.yaml, so the rendered object set stays digest-bound. These demo values are identical on every install and readable from the manifest; replace them before any real use.


What this proves:

- regular Helm output is preserved by `cub installer setup`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with `cub installer package`;
- the chart and image licenses are declared in chart-dossier.yaml with their evidence.

Current gate:

```text
high: 1
medium: 1
low: 0
semantic match: 5/5
```

Useful commands:

```sh
node scripts/generate-successor-track.mjs --verify
node scripts/generate-successor-track.mjs --verify-packages
```
