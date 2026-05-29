# nats/surveyor 0.20.9 Proof

This is one of the next 80 public-chart full proofs.

Variant:

- `default`: chart defaults under Kubernetes 1.30.0; 3 Helm objects, 4 `cub installer` objects including allowed support objects.

What this proves:

- regular Helm output is preserved by `cub installer setup`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with `cub installer package`.

Current gate:

```text
high: 0
medium: 0
low: 0
semantic match: 3/3
```

Useful commands:

```sh
npm run next80:verify
npm run next80:verify-packages
```
