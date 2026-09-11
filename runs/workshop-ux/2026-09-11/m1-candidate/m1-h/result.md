# Redis 25.5.3 default configuration

I found `bitnami/redis@25.5.3`, base variant `default`, revision `r001`. The exact lookup envelope is in `record.json`; it includes the complete `BaseVariantRecord` plus the Catalog index hash and selected-record hash.

It installs the recorded Kubernetes YAML for 14 objects. The immutable installer package is:

`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:a216ce212424e05b341ef5000f1798e6014b72b8bc3dce9f315285871037af2a`

The configuration object-set digest is `175caf404c4a005708398d2facd696a8500ef4280c47c682b7bae6273a91272e`; the base-variant revision digest is `b72dbea967a115c140b00b124ac7facf66178d27383041e0938b11df75ab58d4`.

Settings come from the chart's recorded Helm inputs and `recipes/bitnami/redis/25.5.3/effective-values.yaml`. The catalog base has no ConfigHub changes. If I edit after upload, the change belongs in ConfigHub Unit revision history or a derived ConfigHub variant; a new reusable Helm starting choice belongs in a new base-variant record with its own render intent and checks.

The record says Helm output, ConfigHub save, local-cluster, GitOps/OCI, live Helm comparison, and promotion checks passed. The render matched Helm (14/14). The shared scan is advisory and reports 4 findings (2 critical, 2 warning), including sensitive environment material and possible PVC orphaning during StatefulSet lifecycle operations. Two-cluster kind testing is not run. Destination acceptance and post-deployment success are not established by this record; the record explicitly treats those as separate checks. The chart's flattening verdict is `unsafe-to-flatten` because the chart reaches lookups, capability branching, and generated credentials.

The page's next decision is whether the default is suitable for production, resolving or documenting its outstanding live deployment check first. This helped me decide that the default is a reproducible, inspectable starting point for local or recorded delivery, while production use still needs target-specific review and the advisory findings addressed. What next: inspect the exact YAML and effective values, then choose a target and record its acceptance and post-deployment evidence; if credential handling is the concern, evaluate the page's `reuse-existing-secret` base.

## Hashes

- Catalog index (`data/base-variant-records/records.json`): `sha256:faf5d12d7222da1c278bd6f93f7e2725f0d3f716b275c31bfc4806327a0274f0`
- Selected record (`bitnami-redis-25-5-3-default`): `sha256:729b2fb0f054818af26a5d31b0f13d6b476c014ed21f85bb84674c317d9af858`
