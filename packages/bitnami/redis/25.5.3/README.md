# bitnami/redis 25.5.3 Installer Package

This is the current executable Redis installer package proof.

It contains two real `cub install setup --base` variants:

- `default`
- `reuse-existing-secret`

Generate and verify it from the repository root:

```sh
npm run redis:generate-package
npm run redis:verify-package
```
