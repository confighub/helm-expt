# ConfigHub Helm Proof

```text
Use Helm charts. Ship ConfigHub variants.
```

This repo is the working proof for making Helm less painful with ConfigHub:
render exact Kubernetes objects, review them, scan them, store receipts, and
promote approved revisions instead of re-running a chart and hoping.

Default ConfigHub org for this project:

```text
ConfigHub Helm
```

Do not use `ConfighubOps` for this work.

## What Is Here

| Path | Purpose |
| --- | --- |
| `docs/agreed-execution-plan.md` | The current product and execution plan. |
| `docs/chart-recipe-manifest-flow.md` | Deeper architecture notes for chart to recipe to rendered objects. |
| `outputs/helm_top500_matrix/` | Background evidence from the top 500 Helm chart source scan. |
| `archive/render-and-vendor-top20/` | Archived compatibility evidence for the old render-and-vendor experiment. |

The first full product proof is Redis. The goal is a small set of realistic
Redis install variants, then exact rendered objects, scans, gates, and receipts.

## Local CLI Proof

Prerequisites:

- `node`
- `cub`
- Access to the `ConfigHub Helm` org

Verify the archived top-20 receipts:

```sh
npm run verify
```

Render Redis locally with `cub`:

```sh
mkdir -p out/redis
cub helm template redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis \
  --output-dir out/redis
```

Inspect the exact rendered objects:

```sh
ls -lh out/redis
sed -n '1,80p' out/redis/redis.yaml
```

Render a simple HA-style variant by changing Helm inputs deliberately:

```sh
mkdir -p out/redis-ha
cub helm template redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis \
  --set architecture=replication \
  --set replica.replicaCount=2 \
  --output-dir out/redis-ha

diff -u out/redis/redis.yaml out/redis-ha/redis.yaml || true
```

That is the minimum CLI loop we want to preserve:

```text
choose chart inputs
render exact objects
compare exact objects
scan/gate exact objects
store receipts
```

## ConfigHub Proof

Log in directly to the demo org:

```sh
cub auth login \
  --server https://hub.confighub.com \
  --organization "ConfigHub Helm"
```

Create the Redis proof space once:

```sh
cub space create helm-redis-proof --set-context
```

If the space already exists, set it as the current default:

```sh
cub context set --space helm-redis-proof
```

Install Redis rendered from the chart into ConfigHub units:

```sh
cub helm install redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis
```

Confirm the units exist:

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
4. Use unit diffs and revisions to inspect exactly what changed.
5. Keep all Redis demo/proof work in this org and space unless the README says otherwise.

## Evidence

Top-500 matrix:

```text
outputs/helm_top500_matrix/helm_top500_import_feature_matrix.xlsx
outputs/helm_top500_matrix/helm_top500_import_feature_matrix.raw.json
```

The matrix is a source feature scan. It is background evidence for the control
points, not proof that every chart has a finished recipe.

Archived top-20 render-and-vendor proof:

```text
archive/render-and-vendor-top20/charts/
```

These folders prove that rendered Helm output can be wrapped and verified. They
are not the main Redis variant proof.

## Next Milestone

Add the Redis proof artifacts:

```text
recipes/bitnami/redis/25.5.3/
  recipe-candidate.yaml
  source-lock.yaml
  dependency-lock.yaml
  control-points.yaml
  variants/
  revisions/
```

The finished Redis proof should make this true:

```text
Helm chart
  -> ConfigHub recipe candidate
  -> named install variants
  -> immutable rendered variant revisions
  -> scan and install receipts
  -> ConfigHub review and promotion
```
