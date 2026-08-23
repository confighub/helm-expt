# Timoni Redis 8.10.1

This is the first Timoni source retained in the Config Workshop Catalog. It exists so a user can compare a typed Timoni module with the Helm Redis configurations already in the Catalog without pretending that the two sources have the same inputs or lifecycle.

## What was selected

- Module version: `8.10.1`
- Immutable module digest: `sha256:7f24e8f7e49132c90789464dcf5b82eb137e378c97735eec36efbe0d1caeb872`
- Instance and namespace: `redis`
- Values: the module defaults, recorded in [selected-values.cue](./selected-values.cue)
- Typed options and defaults: [config-schema.cue](./config-schema.cue)

## What it produced

The local, cluster-free build produced **7 Kubernetes objects**: ConfigMap x1, Deployment x2, PersistentVolumeClaim x1, Service x2, ServiceAccount x1. The Redis image is pinned by digest. The default includes an 8 Gi persistent volume claim using the `standard` StorageClass, one read-only replica, health probes, and hardened pod and container security settings.

Read the [exact YAML](./rendered/release-objects.yaml), [object inventory](./rendered/object-inventory.json), and [generation receipt](./generation-receipt.yaml).

The same seven objects are also available in a [public configuration OCI](../../../runs/timoni-redis-catalog-proof/public-oci-receipt.yaml). An anonymous pull reproduced the exact object set. ConfigHub retains those objects in `timoni-redis-8-10-1-base` and links them into `timoni-redis-8-10-1-dev` without changing a Kubernetes field. The source and helper records remain on the base instead of being copied into every environment.

## What plain YAML would miss

The source workflow applies the master objects first, waits for the master, and then applies the read-only replica. It can also run a Redis PING Job when tests are enabled. Those steps are not represented by the seven default Kubernetes objects alone. The [lifecycle route intent](./lifecycle-route-intent.yaml) keeps that work beside the objects, and the [flattening verdict](./flattening-safety-verdict.yaml) requires those routes if the objects are retained as literal configuration.

The selected destination must provide the `redis` namespace, Kubernetes 1.20 or newer, and a `standard` StorageClass. Route resolution and live execution have not been run for this entry.

## Current status

This entry proves immutable source selection, local materialization, public OCI publication and anonymous pull, and exact ConfigHub retention as a base and linked development variant. It does not prove Kubernetes admission, lifecycle execution, workload health, upgrade, rollback, or GitOps delivery. The output labels say `0.0.0-devel`; use the recorded source version and digest above as the source identity.
