# Redis 25.5.3 default configuration

## Exact record

- Component/version: `bitnami/redis@25.5.3`
- Base: `default`, revision `r001`
- Exact installer package: `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:a216ce212424e05b341ef5000f1798e6014b72b8bc3dce9f315285871037af2a`
- Namespace/release: `redis` / `redis`
- Variant revision digest: `b72dbea967a115c140b00b124ac7facf66178d27383041e0938b11df75ab58d4`
- Canonical object-set digest: `sha256:175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e`
- Exact files saved locally: [default-record.yaml](./default-record.yaml), [effective-values.yaml](./effective-values.yaml), [default.yaml](./default.yaml)

## What it installs

The default render contains 14 Kubernetes objects: NetworkPolicy `redis`; PodDisruptionBudgets `redis-master` and `redis-replicas`; ServiceAccounts `redis-master` and `redis-replica`; Secret `redis`; ConfigMaps `redis-configuration`, `redis-health`, and `redis-scripts`; Services `redis-headless`, `redis-master`, and `redis-replicas`; and StatefulSets `redis-master` and `redis-replicas`. The rendered Redis image is `registry-1.docker.io/bitnami/redis@sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25`.

No separate install work is recorded for the `default` base. A storage decision/StorageClass, target facts at variant time, and mandatory chart inputs still belong to the target before applying it. The chart page notes generated credentials and storage/lifecycle quirks.

## Where settings come from

The default Helm settings are in `recipes/bitnami/redis/25.5.3/effective-values.yaml` (saved locally). It records `image.digest` from catalog policy and `auth.password` from a generated-fact receipt; `mergedValuesCaptured: false`. There are no ConfigHub changes in the catalog base. Later environment edits belong in ConfigHub Unit revision history or a derived variant.

If new Helm values define another reusable starting configuration, record a new base variant with its own inputs and checks. If one environment changes a field after rendering, make that change in a ConfigHub variant/Unit revision.

## Checked and untested

Checked: pinned source/package and publication/signature receipts; Helm render and render parity; ConfigHub proof; local live; GitOps/OCI live; Helm-vs-ConfigHub live parity; supplied-values diagnostics; and the advisory `cub check` result dated 2026-08-24 (4 findings: 2 critical and 2 warnings, including sensitive environment value handling and possible PVC orphaning).

The page says hooks, CRD readiness, target Secrets/cloud services, admission behavior, workload health, and rollback are not checked by the local configuration check. The exact configuration has no destination acceptance or post-deployment result recorded in the four-question assessment, and the proof matrix marks two-cluster kind as missing. Version-string upstream byte drift is also not checked. The overall readiness is `render-only` / “ready to try,” so this is not a production claim.

## What this helped decide and next step

It helped decide that the immutable package and exact default object set are inspectable, but the default’s generated Secret and storage/lifecycle warnings require a target-specific review before use. Next, choose a disposable or real target, resolve storage and mandatory inputs, verify target APIs/prerequisites/policies, and decide whether the default is suitable. For hardened customer use, create separate existing-secret, backup/restore, failover, storage-class, SLO, or availability bases as needed.
