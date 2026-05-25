# ConfigHub Helm Demo

This README is current-state only. Every demo step below uses real `cub`
commands and the real ConfigHub service.

Default ConfigHub org:

```text
ConfigHub Helm
```

Do not use `ConfighubOps` for this work.

## What This Demo Shows

Today, with existing `cub` and ConfigHub, this repo demonstrates:

- Render a Helm chart locally with `cub helm template`.
- Render a second Redis shape and diff the exact YAML.
- Install Helm-rendered Redis objects into ConfigHub units with `cub helm install`.
- Review those units, revisions, and diffs in ConfigHub.

The files in `docs/` are background notes. This README is the demo script.

## Prerequisites

- `cub`
- Access to the `ConfigHub Helm` org on `https://hub.confighub.com`

Optional repo integrity check:

```sh
npm run verify
```

That command verifies the archived top-20 render-and-vendor receipts. It is not
part of the ConfigHub demo flow.

## CLI Demo

Render Redis locally:

```sh
mkdir -p out/redis
cub helm template redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis \
  --output-dir out/redis
```

Inspect the rendered objects:

```sh
ls -lh out/redis
sed -n '1,80p' out/redis/redis.yaml
```

Render a second Redis shape:

```sh
mkdir -p out/redis-ha
cub helm template redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis \
  --set architecture=replication \
  --set replica.replicaCount=2 \
  --output-dir out/redis-ha
```

Diff the exact rendered objects:

```sh
diff -u out/redis/redis.yaml out/redis-ha/redis.yaml || true
```

## ConfigHub Demo

Log in to the demo org:

```sh
cub auth login \
  --server https://hub.confighub.com \
  --organization "ConfigHub Helm"
```

Create the Redis demo space once:

```sh
cub space create helm-redis-proof --set-context
```

If the space already exists, use it:

```sh
cub context set --space helm-redis-proof
```

Install Redis into ConfigHub units:

```sh
cub helm install redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis
```

List the units:

```sh
cub unit list --space helm-redis-proof
```

Open ConfigHub:

```text
https://hub.confighub.com
```

In the UI:

1. Switch to the `ConfigHub Helm` org.
2. Open the `helm-redis-proof` space.
3. Review the Redis units created by `cub helm install`.
4. Use unit revisions and diffs to inspect what changed.

## Supporting Files

Top-500 source scan:

```text
outputs/helm_top500_matrix/helm_top500_import_feature_matrix.xlsx
outputs/helm_top500_matrix/helm_top500_import_feature_matrix.raw.json
```

Archived top-20 render-and-vendor artifacts:

```text
archive/render-and-vendor-top20/charts/
```

Background notes:

```text
docs/
```
