# Redis 25.5.3 default configuration

## Exact record

- Chart: `bitnami/redis`, version `25.5.3`, base variant `default`.
- Installer package: `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:a216ce212424e05b341ef5000f1798e6014b72b8bc3dce9f315285871037af2a`.
- Namespace and release: `redis` / `redis`.
- Render context: Kubernetes 1.30 capability profile; revision `default/r001`.
- Saved exact source record: `default-record.yaml`; render intent: `default-render-intent.yaml`; values: `effective-values.yaml`; rendered output: `default-release-objects.yaml`.

## What it installs

The saved render contains 14 Kubernetes objects: NetworkPolicy `redis`; PodDisruptionBudgets `redis-master` and `redis-replicas`; ServiceAccounts `redis-master` and `redis-replica`; Secret `redis`; ConfigMaps `redis-configuration`, `redis-health`, and `redis-scripts`; Services `redis-headless`, `redis-master`, and `redis-replicas`; and StatefulSets `redis-master` and `redis-replicas`. The Redis container image is pinned to `registry-1.docker.io/bitnami/redis@sha256:6e7a020f1f6504698a7272c58783bdc2c23588c49febbae5aca1bb8dfa10af25`.

The default profile renders `auth.password: confighub-redis-password` into the Redis Secret. The page explicitly recommends reviewing `reuse-existing-secret` first because the default stores a sensitive value directly in the rendered output.

## Where settings come from

The chart source is the pinned Bitnami OCI chart `oci://registry-1.docker.io/bitnamicharts/redis:25.5.3`, from `https://charts.bitnami.com/bitnami`. The effective values profile records the image digest as catalog policy and the password as a generated-fact receipt. The catalog base has no ConfigHub changes and no separate install work. Future environment edits belong in a ConfigHub variant / Unit revision history (or a newly recorded base variant when the Helm values define a reusable starting configuration); review overlapping Helm and ConfigHub edits before promotion.

## Checked and untested

Recorded as passed: Helm render output, ConfigHub scan operations, local kind evidence, GitOps/OCI live evidence, live Helm comparison, and variant promotion. The package publication and publisher signature are recorded and verified. No separate hooks, CRDs, or setup route are required for this default base, and the support review recorded no separate target prerequisite in its stated test scope.

Still untested or limited: the two-cluster lane is `todo`; exact destination acceptance and post-deployment health/rollback are not claimed by the base record; delivery receipts for this exact base (literal config OCI, current ConfigHub release OCI, Argo CD, Flux, or direct delivery) are not recorded. The catalog check reports four advisory findings (two critical, two warnings), including a sensitive environment value and possible PVC orphaning during StatefulSet release lifecycle operations. Hook execution, CRD readiness, target Secrets/cloud services, admission behavior, workload health, and rollback are outside that check.

## Decision and next step

This helped me decide that the default is a reproducible, digest-pinned render suitable for inspection and controlled testing, but it needs a production suitability decision because of the embedded password and the outstanding live deployment evidence. I would next review the rendered Secret and StatefulSet/PVC behavior, choose `reuse-existing-secret` where appropriate, then check the exact destination and record the missing live/two-cluster evidence.
