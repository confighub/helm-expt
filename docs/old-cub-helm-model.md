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
- no `cub installer setup`
- no installer render lifecycle
- no installer upload/reconcile record
- no clear package boundary for later variants

That is why the current proof path uses:

```text
Helm-rendered Redis package -> cub installer setup -> rendered objects -> ConfigHub OCI/package publication
```

The old archived top-20 payload has been removed from the active tree. The
current Redis proof uses `packages/bitnami/redis/25.5.3` plus recipe, variant,
revision, scan, gate, and equivalence receipts.

## Current Redis Compatibility Check

Use these commands to reproduce the current Redis compatibility check:

```sh
go install sigs.k8s.io/kustomize/kustomize/v5@v5.8.1
export PATH="$PATH:$(go env GOPATH)/bin"
cub plugin install confighub/installer --source-repo --name installer --force
make -C ~/.confighub/plugins/installer build

export REDIS_PACKAGE=./packages/bitnami/redis/25.5.3
export WORK_DIR=/tmp/confighub-helm-redis

cub installer doc "$REDIS_PACKAGE"
cub installer setup \
  --pull "$REDIS_PACKAGE" \
  --work-dir "$WORK_DIR" \
  --non-interactive \
  --namespace redis

npm run redis:compare
```

The comparison verifies the `cub installer` output against the regular Helm
baseline and explains the intentional Namespace support object.
