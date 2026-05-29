# bitnami/spark 10.0.3 Proof

This is one of the next 80 public-chart full proofs.

Variant:

- `default`: chart defaults under Kubernetes 1.30.0; 10 Helm objects, 11 `cub installer` objects including allowed support objects.

What this proves:

- regular Helm output is preserved by `cub installer setup`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with `cub installer package`.

Current gate:

```text
high: 0
medium: 1
low: 0
semantic match: 10/10
```

Useful commands:

```sh
npm run next80:verify
npm run next80:verify-packages
```
