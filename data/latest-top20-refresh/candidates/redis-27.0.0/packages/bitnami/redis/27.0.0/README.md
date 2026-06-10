# bitnami/redis 27.0.0 Installer Package

This is the current executable Redis installer package proof.

It contains two real `cub installer setup --base` variants:

- `default`
- `reuse-existing-secret`, which declares the existing Redis Secret through
  installer `externalRequires` and records the target-fact binding in
  `out/spec/facts.yaml` through the package collector.

The existing-Secret variant expects:

```text
Secret redis/redis-existing-secret
key redis-password
```

Secret handling is intentionally explicit:

- `default` renders `Secret redis/redis`, but `cub installer setup` writes
  it to `out/secrets` and `cub installer upload` does not upload it as a
  ConfigHub Unit or OCI artifact. Stage it in the target cluster through your
  normal secret path before applying the rendered workload objects.
- `reuse-existing-secret` renders no Redis Secret. The target cluster must
  already contain `Secret redis/redis-existing-secret` with key
  `redis-password`; ConfigHub records that requirement as external evidence,
  not as stored secret material.

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
