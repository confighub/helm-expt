# Redis 25.5.3 default configuration

I selected `bitnami/redis` version `25.5.3`, base `default`, revision `r001`.
The exact installer package is `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:a216ce212424e05b341ef5000f1798e6014b72b8bc3dce9f315285871037af2a`.

The complete lookup envelope is in `record.json`. Its identity is `CatalogRecordLookup/bitnami-redis-25-5-3-default`; status is `found`; the Catalog index is `data/base-variant-records/records.json`. The hashes are:

- Catalog: `sha256:faf5d12d7222da1c278bd6f93f7e2725f0d3f716b275c31bfc4806327a0274f0`
- selected record: `sha256:729b2fb0f054818af26a5d31b0f13d6b476c014ed21f85bb84674c317d9af858`
- canonical rendered object set: `175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e`

It renders 14 Kubernetes objects in namespace `redis`: 1 NetworkPolicy, 2 PodDisruptionBudgets, 2 ServiceAccounts, 1 Secret, 3 ConfigMaps, 3 Services, and 2 StatefulSets (master and replicas). The chart source and version, `default` values profile (`recipes/bitnami/redis/25.5.3/effective-values.yaml`), namespace, release name `redis`, and Kubernetes 1.30 capability profile were fixed at build time. No install-time values are declared.

The recorded render/materialization passed, with render parity, ConfigHub scan operations, local kind evidence, live dual parity, and historical GitOps OCI evidence. The local shared check found four advisory findings (two critical and two warnings), including a sensitive environment value stored directly and possible PVC orphaning during Helm StatefulSet lifecycle operations. The page marks the catalog as “Ready to try” and the default base as `unsafe-to-flatten`; the package is signed and its publication receipt is recorded.

This record does not establish destination acceptance or post-deployment success for this exact configuration. It does not check hook execution, CRD readiness, target Secrets or cloud services, admission behavior, workload health, or rollback. It also says a StorageClass/storage decision, target facts at variant time, and mandatory chart inputs must be supplied for a real target. The page records generated values, lookup, generated facts, `tpl`, capabilities, storage, and install-vs-upgrade divergence as chart quirks.

What did this help you decide and what next?

It helped me decide that the default is a reproducible, inspectable starting point, but not a production approval: I would review the two critical findings and choose storage and target facts before applying it. An edit to the shared catalog starting point belongs in a new base variant with a new Helm values profile, render intent, rendered YAML, checks, and receipt. An environment-specific post-render change belongs in a ConfigHub variant/revision, preserving this base record and digest relationship. The page’s next action is to decide whether `default` is suitable for production and resolve or document its outstanding live deployment check.
