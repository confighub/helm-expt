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

## Archived Render-And-Vendor Reference

These commands are retained only for reproducing the old Redis reference:

```sh
go install sigs.k8s.io/kustomize/kustomize/v5@v5.8.1
export PATH="$PATH:$(go env GOPATH)/bin"
cub plugin install confighub/installer --source-repo --name install --force
make -C ~/.confighub/plugins/install build

export REDIS_PACKAGE=./archive/render-and-vendor-top20/charts/06-bitnami-redis
export WORK_DIR=/tmp/confighub-helm-redis

cub install doc "$REDIS_PACKAGE"
cub install setup \
  --pull "$REDIS_PACKAGE" \
  --work-dir "$WORK_DIR" \
  --non-interactive \
  --namespace redis

npm run redis:compare

cub auth login \
  --server https://hub.confighub.com \
  --organization "ConfigHub Helm"
cub install upload \
  --work-dir "$WORK_DIR" \
  --space helm-redis-proof \
  --component Redis \
  --environment Demo \
  --variant default
```

Again: this is historical compatibility evidence, not the current proof path.
