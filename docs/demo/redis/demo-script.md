# Redis Five-Minute Demo Script

This is the current Redis happy path using only real commands. It does not use
future shorthand such as `cub install redis`.

## Claim

```text
Use the Helm chart.
Get ConfigHub variants.
See exact objects, checks, differences, and OCI proof before production.
```

## Setup

The proof package is already in this repo:

```text
packages/bitnami/redis/25.5.3
```

It contains two installer bases:

```text
default
reuse-existing-secret
```

Secret handling is intentionally different between the two bases:

```text
default
  Helm renders Secret redis/redis.
  cub install separates it to out/secrets.
  Apply out/secrets for a direct local test; ConfigHub records references,
  not the rendered secret material.

reuse-existing-secret
  Helm renders no Redis Secret.
  The workloads reference Secret redis/redis-existing-secret key redis-password.
  The installer package declares that Secret as an external requirement and
  the variant records it as a target fact.
```

For the existing-Secret path, stage the target Secret before applying the
rendered manifests:

```sh
kubectl --context <your-context> create namespace redis --dry-run=client -o yaml | kubectl --context <your-context> apply -f -
kubectl --context <your-context> -n redis create secret generic redis-existing-secret \
  --from-literal=redis-password=confighub-redis-password \
  --dry-run=client -o yaml | kubectl --context <your-context> apply -f -
```

## Path

1. Render one variant with the current installer package:

```sh
cub install setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis
```

Expected result:

```text
Base: default
Rendered 14 manifest(s)
Rendered 1 secret(s) to out/secrets (not uploaded)
```

2. Prove it still matches Helm:

```sh
npm run redis:compare
```

Expected result:

```text
default: Helm objects 14, cub install objects 15
semantic object matches: 14/14
Allowed cub-only object: v1|Namespace||redis

reuse-existing-secret: Helm objects 13, cub install objects 14
semantic object matches: 13/13
Allowed cub-only object: v1|Namespace||redis
```

3. Prove your rendered work directory matches the cataloged Redis variant:

```sh
npm run verify-install:render -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --namespace redis
```

Expected result:

```text
PASS verify-install:render bitnami/redis/25.5.3 default
semantic object matches: 14/14
```

4. Verify receipts and package determinism:

```sh
npm run verify
```

Expected result:

```text
verified Redis default and reuse-existing-secret proof artifacts
Redis installer package verification passed.
```

5. Optional local live check:

```sh
kubectl --context <your-context> apply -f .tmp/demo/redis-default/out/manifests/namespace-redis.yaml
kubectl --context <your-context> apply -f .tmp/demo/redis-default/out/secrets
kubectl --context <your-context> apply -f .tmp/demo/redis-default/out/manifests

npm run verify-install:cluster -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --context <your-context> \
  --namespace redis
```

Expected result:

```text
PASS verify-install:cluster bitnami/redis/25.5.3 default
checks: statefulsets, PVCs, Redis PING
```

For `reuse-existing-secret`, do not apply `out/secrets`; that variant renders
none. Pre-stage `redis/redis-existing-secret` as shown above, then apply the
manifest directory and verify with `--base reuse-existing-secret`.

6. Upload to ConfigHub:

```sh
cub install upload \
  --work-dir .tmp/demo/redis-default \
  --space helm-redis-default \
  --component Redis \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant default \
  --unit-label Component=Redis \
  --unit-label HelmChart=bitnami-redis \
  --unit-label HelmChartVersion=25.5.3 \
  --unit-label Variant=default \
  --unit-label Proof=redis-confighub-proof
```

Current implementation note: during the Kubara proof run, `cub install upload`
needed a temporary local wrapper so installer-spawned `cub` commands used
`CUB_CONFIG=$HOME/.confighub/config.yaml`. That is recorded as a known issue in
the receipt, not hidden from the proof.

7. Show the result in ConfigHub:

```sh
cub space list --where "Slug LIKE 'helm-redis-%'"
cub unit list --space helm-redis-default \
  --columns Unit.Slug,Unit.Labels.Component,Unit.Labels.HelmChartVersion,Unit.Labels.Variant

npm run verify-install:confighub -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --space helm-redis-default
```

Expected result:

```text
helm-redis-default: 15 Units
helm-redis-reuse-existing-secret: 15 Units

14 Kubernetes Units are labeled as the Redis variant.
1 installer-record Unit records the installer operation.

PASS verify-install:confighub bitnami/redis/25.5.3 default
```

8. Show hosted ConfigHub OCI proof:

```text
runs/redis-confighub/latest/upload-oci-receipt.yaml
```

Expected result:

```text
oci.hub.confighub.com returned OCI manifests for representative Redis StatefulSet Units.
No worker secret or bearer token is recorded.
```

## Close

The five-minute message is:

```text
Helm gave us objects.
ConfigHub gave us named variants, exact diffs, scan/gate status,
upload proof, and OCI-readable operational records.
```
