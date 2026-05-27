# percona/pxc-operator 1.19.1 Proof

This is one of the next 80 public-chart full proofs.

Variant:

- `default`: chart defaults under Kubernetes 1.30.0; 7 Helm objects, 8 `cub install` objects including allowed support objects.

What this proves:

- regular Helm output is preserved by `cub install setup`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with `cub install package`.

Current gate:

```text
high: 0
medium: 3
low: 0
semantic match: 7/7
```

Useful commands:

```sh
npm run next80:verify
npm run next80:verify-packages
```
