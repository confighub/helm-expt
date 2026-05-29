# gatekeeper/gatekeeper 3.22.2 Proof

This is one of the next 80 public-chart full proofs.

Variant:

- `default`: chart defaults under Kubernetes 1.30.0; 30 Helm objects, 31 `cub installer` objects including allowed support objects.

What this proves:

- regular Helm output is preserved by `cub installer setup`;
- the rendered object set is digest-bound in the variant revision and receipts;
- scan/gate findings are attached to the exact rendered object digest;
- the installer package bundles deterministically with `cub installer package`.

Current gate:

```text
high: 0
medium: 22
low: 0
semantic match: 30/30
```

Useful commands:

```sh
npm run next80:verify
npm run next80:verify-packages
```
