# bitnami/redis 25.5.3 Installer Package

This is the current executable Redis installer package proof.

It contains two real `cub install setup --base` variants:

- `default`
- `reuse-existing-secret`, which declares the existing Redis Secret through
  installer `externalRequires` and records the target-fact binding in
  `out/spec/facts.yaml` through the package collector.

The existing-Secret variant expects:

```text
Secret redis/redis-existing-secret
key redis-password
```

By default the collector records this binding without probing a live cluster,
so deterministic render tests still work offline. To force a live check during
setup, set:

```sh
TARGET_FACT_CHECK_MODE=live
```

Generate and verify it from the repository root:

```sh
npm run redis:generate-package
npm run redis:verify-package
```
