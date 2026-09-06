# mysql/mysql-operator 2.3.0 Proof

This chart belongs to the successor track. It is a full proof of a maintained
successor chart for an affected catalog component.

Variant:

- `default`: chart defaults under Kubernetes 1.30.0; 13 Helm objects, 14 `cub installer` objects including allowed support objects.


What this proves:

- regular Helm output is preserved by `cub installer setup`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with `cub installer package`;
- the chart and image licenses are declared in chart-dossier.yaml with their evidence.

Current gate:

```text
high: 0
medium: 9
low: 0
semantic match: 13/13
```

Useful commands:

```sh
node scripts/generate-successor-track.mjs --verify
node scripts/generate-successor-track.mjs --verify-packages
```
