# Old Direct Cub Helm Model

This note preserves the older direct Helm-to-ConfigHub idea. It is useful
background, but it is not the root demo flow for this repo.

## Shape

The old model used `cub helm` directly:

```sh
cub helm template redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis \
  --output-dir out/redis
```

Then it imported the Helm-rendered objects into ConfigHub units:

```sh
cub helm install redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis
```

## What It Proved

It proved a narrow bridge:

```text
Helm chart -> rendered YAML -> ConfigHub Units
```

That can be useful, especially for quick inspection and a familiar Helm entry
point.

## What It Did Not Prove

It did not exercise `confighub/installer`:

- no `installer.yaml`
- no installer package work directory
- no `cub install setup`
- no installer render lifecycle
- no installer upload/reconcile record
- no clear package boundary for later variants

That is why the archived reference path uses:

```text
Helm-rendered Redis package -> cub install setup -> rendered objects -> cub install upload -> ConfigHub Units
```

That archived reference is intentionally modest: it uses a render-and-vendor
Redis installer package from the archive. It is not the main pathway for the
current Helm mission, and it is not proof of recipe candidates, managed
variants, immutable variant revisions, scan gates, OCI receipts, or the new
spreadsheet proof system.
