# Redis Local E2E Spec

This slice proves the Redis `default` and `reuse-existing-secret` rendered
objects can run in a local Kubernetes cluster.

It is intentionally local. It does not prove ConfigHub OCI publication, GitOps
handoff, or production readiness.

## Scope

Input:

```text
recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml
```

Output:

```text
runs/redis-local-kind/latest/observation-receipt.yaml
runs/redis-local-kind/reuse-existing-secret-latest/observation-receipt.yaml
runs/redis-local-kind/latest/kubectl-objects.txt
runs/redis-local-kind/latest/redis-pong.txt
```

## Cluster Rule

Use a dedicated local kind cluster:

```text
helm-expt-redis
```

The e2e script may create this cluster if it is missing. It must not mutate any
other cluster context.

## Apply Rule

The rendered Redis release objects do not include the installer Namespace
support object. For local e2e only, apply:

```text
v1|Namespace||redis
```

before applying `release-objects.yaml`.

This is the same intentional cub-only support object already classified in the
Helm equivalence receipt.

## Required Checks

The e2e proof must:

1. Verify the rendered object SHA256 before applying.
2. Create/use only the `helm-expt-redis` kind cluster.
3. Check that a default StorageClass exists. If it does not, the script may
   install the pinned local-path provisioner for this dedicated kind cluster
   and must record that target fact in the receipt.
4. Create the `redis` Namespace support object.
5. For `reuse-existing-secret`, create the required target Secret
   `redis-existing-secret` with key `redis-password` before applying the
   release objects, and record it as a target fact.
6. Apply the exact rendered release objects.
7. Wait for:
   - `statefulset/redis-master`
   - `statefulset/redis-replicas`
8. Wait for the four Redis PVCs to be `Bound`.
9. Run a Redis client command that returns `PONG`.
10. Write an observation receipt with:
   - observer name/version
   - cluster kind/name
   - observed timestamp
   - rendered object digest
   - variant revision reference
   - result
   - freshness TTL
   - target facts, including default StorageClass
   - required Secret target fact for `reuse-existing-secret`
   - checked resources
   - bound PVC evidence
   - PONG evidence digest

## Gate Rule

Local e2e success may satisfy `local-test`.

It must not override the production block from the scan gate. Production remains
blocked until high scan findings are fixed or explicitly waived.
