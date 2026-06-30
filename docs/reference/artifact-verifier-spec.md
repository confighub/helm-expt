# Artifact Verifier Spec

This is the executable proof contract for `helm-expt`.

The verifier checks the current recipe/package artifact chain, the Redis
recipe/variant/revision proof, the durable Redis installer package proof, the
promoted metrics-server, ingress-nginx, cert-manager, external-secrets, Argo CD,
PostgreSQL, RabbitMQ, kube-prometheus-stack, Loki, Longhorn, MySQL, Grafana,
Vault, Secrets Store CSI Driver, Prometheus, MongoDB, Nginx, Tempo, and Consul
proofs, and the adversarial public-chart harnesses.

## Scope

The current artifact-chain verifier checks every recipe/package pair:

```text
recipes/*/*/*/recipe.yaml
recipes/*/*/*/publication/installer-package-receipt.yaml
packages/*/*/*/installer.yaml
packages/*/*/*/bases/*/upstream.yaml
recipes/*/*/*/revisions/*/r001/rendered/release-objects.yaml
recipes/*/*/*/revisions/*/r001/receipts/*.yaml
```

It proves that current executable fixtures point at `packages/`, package
receipts match package source files by SHA256/byte length, rendered revision
digests bind to inventories, equivalence receipts, scan receipts, and install
gates, and negative self-tests catch tampering.

The Redis proof verifier checks:

```text
recipes/bitnami/redis/25.5.3/
packages/bitnami/redis/25.5.3/
```

That includes HelmPlan, ChartDossier, source/dependency locks, control points,
effective values, variants, variant revisions, rendered objects, object
inventories, Helm equivalence receipts, render receipts, scan receipts, install
gates, variant diff evidence, the installer package receipt, and the package
source tree. Remote ConfigHub upload/OCI evidence is recorded separately under
`runs/redis-confighub/latest/` because it depends on hosted ConfigHub auth.

The adversarial public-chart harness verifier checks:

```text
data/adversarial10/corpus.yaml
data/adversarial10/corpus.lock.yaml
data/adversarial10/proof-readiness.csv
data/adversarial10/charts/*/helm-plan.yaml
data/adversarial10/charts/*/render-receipt.yaml
data/adversarial10/charts/*/rendered/default.yaml
data/adversarial10/charts/*/rendered/object-inventory.yaml
```

This is the first scale-out proof index. It is not a full recipe/variant proof
for all 10 charts. It proves that the corpus is pinned, every row has a
machine-readable HelmPlan and render receipt, successful render attempts bind
stored manifests by SHA256, failed attempts record blocker receipts, and the CSV
is generated from those artifacts.

The metrics-server proof verifier checks:

```text
recipes/metrics-server/metrics-server/3.13.0/
packages/metrics-server/metrics-server/3.13.0/
```

That proof is the first promoted row from the adversarial harness. It checks two
variants, `default` and `external-tls-ca`, including source/dependency locks,
control points, effective values, target fact requirements, rendered object
inventories, render receipts, Helm equivalence receipts, scan receipts, install
gates, and deterministic `cub installer` package/setup behavior.

The ingress-nginx proof verifier checks:

```text
recipes/ingress-nginx/ingress-nginx/4.15.1/
packages/ingress-nginx/ingress-nginx/4.15.1/
```

That proof is the second promoted row from the adversarial harness. It checks
two variants, `default` and `admission-disabled`, including source/dependency
locks, control points, effective values, rendered object inventories, render
receipts, Helm equivalence receipts, scan receipts, install gates, and
deterministic `cub installer` package/setup behavior.

The cert-manager proof verifier checks:

```text
recipes/jetstack/cert-manager/v1.20.2/
packages/jetstack/cert-manager/v1.20.2/
```

That proof is the third promoted row from the adversarial harness. It checks two
variants, `default` and `crds-enabled`, including source/dependency locks,
control points, effective values, rendered object inventories, render receipts,
Helm equivalence receipts, scan receipts, install gates, and deterministic
`cub installer` package/setup behavior.

The external-secrets proof verifier checks:

```text
recipes/external-secrets/external-secrets/2.5.0/
packages/external-secrets/external-secrets/2.5.0/
```

That proof is the fourth promoted row from the adversarial harness. It checks
two variants, `default` and `no-crds`, including source/dependency locks,
control points, effective values, rendered object inventories, render receipts,
Helm equivalence receipts, scan receipts, install gates, separated Secret
handling, and deterministic `cub installer` package/setup behavior.

The Longhorn proof verifier checks:

```text
recipes/longhorn/longhorn/1.11.2/
packages/longhorn/longhorn/1.11.2/
```

That proof is the tenth promoted row from the adversarial harness. It checks
two variants, `default` and `ui-ingress`, including source/dependency locks, 22
Longhorn CRDs, pre-upgrade hook policy, admission/recovery observation, cluster
RBAC, privileged storage workload policy, StorageClass/default-setting policy,
UI ingress exposure, rendered object inventories, render receipts, Helm
equivalence receipts, scan receipts, install gates, and deterministic
`cub installer` package/setup behavior.

The MySQL proof verifier checks:

```text
recipes/bitnami/mysql/14.0.3/
packages/bitnami/mysql/14.0.3/
```

That proof is the eleventh promoted row from the adversarial harness. It checks
two variants, `static-passwords` and `existing-secret`, including
source/dependency locks, generated fact binding for root, user, and replication
passwords, target Secret binding, rendered object inventories, render receipts,
Helm equivalence receipts, scan receipts, install gates, separated Secret
handling, and deterministic `cub installer` package/setup behavior.

The Grafana proof verifier checks:

```text
recipes/grafana/grafana/10.5.15/
packages/grafana/grafana/10.5.15/
```

That proof is the twelfth promoted row from the adversarial harness. It checks
two variants, `static-passwords` and `existing-secret-ingress`, including
source/dependency locks, upstream deprecation status, generated admin password
binding, target Secret binding, UI ingress exposure, rendered object
inventories, render receipts, Helm equivalence receipts, scan receipts,
install gates, separated Secret handling, and deterministic `cub installer`
package/setup behavior.

The Vault proof verifier checks:

```text
recipes/hashicorp/vault/0.32.0/
packages/hashicorp/vault/0.32.0/
```

That proof is the thirteenth full public-chart proof row. It checks two
variants, `default` and `ha-raft-ui`, including source/dependency locks, TLS
posture, injector admission webhook, StatefulSet storage, init/unseal
operating policy, HA Raft and UI service exposure, rendered object
inventories, render receipts, Helm equivalence receipts, scan receipts,
install gates, and deterministic `cub installer` package/setup behavior.

The Secrets Store CSI Driver proof verifier checks:

```text
recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
```

That proof is the fourteenth full public-chart proof row. It checks two
variants, `default` and `sync-secret-rotation`, including source/dependency
locks, SecretProviderClass CRDs, CSIDriver kubelet integration, Linux DaemonSet
workload policy, cluster RBAC, synced Secret ownership, rotation/provider
health settings, rendered object inventories, render receipts, Helm
equivalence receipts, scan receipts, install gates, and deterministic
`cub installer` package/setup behavior.

The Prometheus proof verifier checks:

```text
recipes/prometheus-community/prometheus/29.8.0/
packages/prometheus-community/prometheus/29.8.0/
```

That proof is the fifteenth full public-chart proof row. It checks two
variants, `default` and `server-only-ephemeral`, including source/dependency
locks for the bundled monitoring subcharts, Prometheus server scrape config,
Alertmanager/exporter/pushgateway component selection, server PVC/storage
policy, cluster RBAC, rendered object inventories, render receipts, Helm
equivalence receipts, scan receipts, install gates, and deterministic
`cub installer` package/setup behavior.

The MongoDB proof verifier checks:

```text
recipes/bitnami/mongodb/19.0.7/
packages/bitnami/mongodb/19.0.7/
```

That proof is the sixteenth full public-chart proof row. It checks two
variants, `static-passwords` and `existing-secret-replicaset`, including
source/dependency locks, generated root password binding, target Secret
binding, replica-set and arbiter StatefulSets, persistent storage,
NetworkPolicy/PDB policy, Helm hook lifecycle review, rendered object
inventories, render receipts, Helm equivalence receipts, scan receipts,
install gates, and deterministic `cub installer` package/setup behavior.

The Nginx proof verifier checks:

```text
recipes/bitnami/nginx/24.0.2/
packages/bitnami/nginx/24.0.2/
```

That proof is the seventeenth full public-chart proof row. It checks two
variants, `http-clusterip` and `existing-tls-ingress`, including source and
dependency locks, generated TLS mitigation, declared backend and ingress TLS
target Secrets, ingress exposure, NetworkPolicy/PDB policy, service exposure,
static-site supply-chain slots, metrics add-ons, raw/template extension-slot
review, rendered object inventories, render receipts, Helm equivalence
receipts, scan receipts, install gates, and deterministic `cub installer`
package/setup behavior.

The Tempo proof verifier checks:

```text
recipes/grafana/tempo/1.24.4/
packages/grafana/tempo/1.24.4/
```

That proof is the eighteenth full public-chart proof row. It checks two
variants, `local-persistent` and `s3-query-observability`, including source and
empty dependency locks, deprecated chart marker, local/S3 storage backend
policy, target S3 credential Secret, query ingress, ServiceMonitor target
capability, NetworkPolicy, StatefulSet/headless-Service runtime risk,
raw/template extension-slot review, rendered object inventories, render
receipts, Helm equivalence receipts, scan receipts, install gates, and
deterministic `cub installer` package/setup behavior.

The Consul proof verifier checks:

```text
recipes/hashicorp/consul/2.0.0/
packages/hashicorp/consul/2.0.0/
```

That proof is the nineteenth full public-chart proof row and twentieth target
chart. It checks two variants, `default-control-plane` and
`secure-mesh-existing-secrets`, including source and empty dependency locks,
28 rendered CRDs, cluster RBAC, injector admission webhooks, TLS/ACL/gossip
target Secret binding, gateway topology, UI ingress, lifecycle Job policy,
rendered Secret ownership, StatefulSet/storage policy, raw/template
extension-slot review, rendered object inventories, render receipts, Helm
equivalence receipts, scan receipts, install gates, and deterministic
`cub installer` package/setup behavior.

The Argo CD proof verifier checks:

```text
recipes/argo-cd/argo-cd/9.5.15/
packages/argo-cd/argo-cd/9.5.15/
```

That proof is the fifth promoted row from the adversarial harness. It checks
two variants, `default` and `no-crds`, including source/dependency locks,
control points, effective values, rendered object inventories, render receipts,
Helm equivalence receipts, scan receipts, install gates, separated Secret
handling, and deterministic `cub installer` package/setup behavior.

The PostgreSQL proof verifier checks:

```text
recipes/bitnami/postgresql/18.6.7/
packages/bitnami/postgresql/18.6.7/
```

That proof is the sixth promoted row from the adversarial harness. It checks
two variants, `static-passwords` and `existing-secret`, including
source/dependency locks, generated fact binding, target fact binding, rendered
object inventories, render receipts, Helm equivalence receipts, scan receipts,
install gates, separated Secret handling, and deterministic `cub installer`
package/setup behavior.

The RabbitMQ proof verifier checks:

```text
recipes/bitnami/rabbitmq/16.0.14/
packages/bitnami/rabbitmq/16.0.14/
```

That proof is the seventh promoted row from the adversarial harness. It checks
two variants, `static-passwords` and `existing-secret`, including
source/dependency locks, generated fact binding for password and Erlang cookie,
target fact binding for both Secrets, rendered object inventories, render
receipts, Helm equivalence receipts, scan receipts, install gates, separated
Secret handling, and deterministic `cub installer` package/setup behavior.

The kube-prometheus-stack proof verifier checks:

```text
recipes/prometheus-community/kube-prometheus-stack/85.3.3/
packages/prometheus-community/kube-prometheus-stack/85.3.3/
```

That proof is the eighth promoted row from the adversarial harness. It checks
two variants, `default` and `no-crds`, including umbrella dependency locks,
generated fact binding for Grafana admin password, rendered object inventories,
render receipts, Helm equivalence receipts, scan receipts, install gates,
separated Secret handling, dashboard ConfigMap normalization, and deterministic
`cub installer` package/setup behavior.

The Loki proof verifier checks:

```text
recipes/grafana/loki/7.0.0/
packages/grafana/loki/7.0.0/
```

That proof is the ninth promoted row from the adversarial harness. It checks
two variants, `single-binary-filesystem` and `simple-scalable-minio`, including
the blocked default render receipt, source/dependency locks, required
storage/schema values, bundled MinIO object-store fixture, rendered object
inventories, render receipts, Helm equivalence receipts, scan receipts,
install gates, classified Loki ConfigMap normalization, separated Secret
handling, and deterministic `cub installer` package/setup behavior.

## Required Invariants

For every current recipe/package directory:

1. Required recipe files exist: HelmPlan, ChartDossier, source/dependency locks,
   control points, value model, recipe, and installer package receipt.
2. `recipe.spec.currentExecutableFixture.installerPackage` points at the
   current `packages/` tree.
3. The installer package receipt points at the same package path.
4. Every package source file listed in the receipt exists and matches its
   SHA256 and byte count.
5. Every recipe variant path exists.
6. Every variant revision has rendered objects, object inventory, Helm
   equivalence receipt, render receipt, scan receipt, and install gate.
7. Rendered object SHA256 is identical across the variant revision digest
   inputs, object inventory, render receipt, scan receipt, and install gate.
8. Helm equivalence receipt result is `pass` and points at the same rendered
   object SHA256.

For the adversarial public-chart harness:

1. The corpus lock has one row for every chart in `corpus.yaml`.
2. Every chart row has a HelmPlan, render receipt, and object inventory.
3. Successful render receipts point at a stored rendered manifest.
4. Stored rendered manifest SHA, byte count, and resource count match the
   receipt.
5. Failed render receipts do not claim a rendered manifest and record an
   `errorSHA256`.
6. CSV status, readiness, feature flags, primary control point, paths, counts,
   and rendered manifest SHA match the receipt.
7. Chart identity, version, render context, and package SHA are present in the
   receipt.

For the promoted metrics-server proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `external-tls-ca` binds `tls.existingSecret.lookup=false`, an explicit
   `apiService.caBundle`, and the target Secret requirement
   `kube-system/metrics-server-tls`.
3. Each variant has exactly 9 Helm objects and a rendered APIService.
4. `cub installer package` produces byte-identical bundles across two local runs.
5. `cub installer setup --base default` and
   `cub installer setup --base external-tls-ca` match Helm semantically, plus only
   `v1|Namespace||kube-system`.
6. Semantic comparison prunes null fields, because `cub installer`/kustomize
   drops `metadata.annotations: null` from the APIService.

For the promoted ingress-nginx proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `default` renders exactly 11 Helm objects, including the admission Service
   and ValidatingWebhookConfiguration.
3. `admission-disabled` renders exactly 9 Helm objects and deliberately omits
   the admission Service and ValidatingWebhookConfiguration.
4. Both variants render the controller Deployment and `nginx` IngressClass.
5. `cub installer package` produces byte-identical bundles across two local runs.
6. `cub installer setup --base default` and
   `cub installer setup --base admission-disabled` match Helm semantically, plus
   only `v1|Namespace||ingress-nginx`.
7. Scan/gate receipts flag admission webhook observation, Helm hook lifecycle
   policy, and cluster RBAC where applicable.

For the promoted cert-manager proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `default` renders exactly 42 Helm objects and zero CRDs.
3. `crds-enabled` renders exactly 48 Helm objects, including the six
   cert-manager CRDs.
4. Both variants render the controller, cainjector, webhook Deployment, webhook
   Service, MutatingWebhookConfiguration, and ValidatingWebhookConfiguration.
5. `cub installer package` produces byte-identical bundles across two local runs.
6. `cub installer setup --base default` and
   `cub installer setup --base crds-enabled` match Helm semantically, plus only
   `v1|Namespace||cert-manager`.
7. Scan/gate receipts flag CRD lifecycle, admission webhook observation, Helm
   startup hook lifecycle policy, and cluster RBAC.

For the promoted external-secrets proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `default` renders exactly 42 Helm objects, including 23 CRDs and one
   webhook Secret.
3. `no-crds` renders exactly 19 Helm objects, including zero CRDs and one
   webhook Secret.
4. Both variants render the controller, cert-controller, webhook Deployment,
   webhook Service, and both ValidatingWebhookConfigurations.
5. The disabled `bitwarden-sdk-server` dependency is recorded in
   `dependency-lock.yaml`.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup --base default` and
   `cub installer setup --base no-crds` match Helm semantically, plus only
   `v1|Namespace||external-secrets`, while preserving the separated webhook
   Secret.
8. Scan/gate receipts flag CRD lifecycle, admission webhook observation,
   webhook Secret/cert-controller observation, dependency lock review, and
   cluster RBAC.

For the promoted Argo CD proof:

1. Both variants render deterministically with Helm under the pinned capability
   profile.
2. `default` renders exactly 49 Helm objects, including three Argo CD CRDs and
   two Secrets.
3. `no-crds` renders exactly 46 Helm objects, including zero CRDs and two
   Secrets.
4. Both variants render the server, repo-server, applicationset-controller,
   Redis Deployment, application-controller StatefulSet, server Service, Redis
   Service, `argocd-secret`, and `argocd-notifications-secret`.
5. The disabled `redis-ha` dependency is recorded in `dependency-lock.yaml`.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup --base default` and
   `cub installer setup --base no-crds` match Helm semantically, plus only
   `v1|Namespace||argocd`, while preserving separated Secrets.
8. Scan/gate receipts flag CRD lifecycle, Helm hook lifecycle, generated Secret
   ownership, dependency lock review, StatefulSet policy, GitOps handoff, and
   cluster RBAC.

For the promoted PostgreSQL proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `static-passwords` renders exactly 7 Helm objects, including one Secret
   and one StatefulSet.
3. `existing-secret` renders exactly 6 Helm objects, including zero Secrets and
   one StatefulSet.
4. `static-passwords` binds `auth.postgresPassword` before render.
5. `existing-secret` declares target Secret `postgresql/postgresql-auth`.
6. The Bitnami `common` dependency is recorded in `dependency-lock.yaml`.
7. `cub installer package` produces byte-identical bundles across two local runs.
8. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||postgresql`, while preserving separated Secret behavior.
9. Scan/gate receipts flag generated facts, target facts, Helm hook lifecycle,
   dependency lock review, StatefulSet/PVC policy, and extension-slot review.

For the promoted RabbitMQ proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `static-passwords` renders exactly 10 Helm objects, including the
   credential Secret, the config Secret, and one StatefulSet.
3. `existing-secret` renders exactly 9 Helm objects, including only the config
   Secret and one StatefulSet.
4. `static-passwords` binds `auth.password` and `auth.erlangCookie` before
   render.
5. `existing-secret` declares target Secrets `rabbitmq/rabbitmq-auth` and
   `rabbitmq/rabbitmq-erlang-cookie`.
6. The Bitnami `common` dependency is recorded in `dependency-lock.yaml`.
7. `cub installer package` produces byte-identical bundles across two local runs.
8. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||rabbitmq`, while preserving separated Secret behavior.
9. Scan/gate receipts flag generated facts, target facts, dependency lock
   review, StatefulSet/PVC policy, clustering policy, and extension-slot
   review.

For the promoted kube-prometheus-stack proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `default` renders exactly 124 Helm objects, including 10 Prometheus Operator
   CRDs, Grafana, kube-state-metrics, node-exporter, and admission webhooks.
3. `no-crds` renders exactly 114 Helm objects and zero CRDs.
4. Both variants bind `grafana.adminPassword` before render.
5. The CRD, kube-state-metrics, node-exporter, Grafana, and windows-exporter
   dependencies are recorded in `dependency-lock.yaml`.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||monitoring`, while preserving separated Secret behavior.
8. Semantic comparison prunes null fields and empty metadata maps, because
   `cub installer`/kustomize drops empty annotations on Grafana dashboard
   ConfigMaps.
9. Scan/gate receipts flag CRD lifecycle, admission webhook observation,
   generated Grafana credential ownership, umbrella dependency review, cluster
   RBAC, and extension-slot review.

For the promoted Loki proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. The default chart render is recorded as blocked because
   `loki.storage.bucketNames.chunks` and storage/schema values are missing.
3. `single-binary-filesystem` renders exactly 19 Helm objects, including one
   Loki StatefulSet, cache StatefulSets, and zero Secrets.
4. `simple-scalable-minio` renders exactly 36 Helm objects, including read,
   write, backend, cache, and MinIO workloads plus one rendered Secret.
5. The MinIO, grafana-agent-operator, and rollout-operator dependencies are
   recorded in `dependency-lock.yaml`.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||loki`, while preserving separated Secret behavior.
8. Semantic comparison classifies the single Loki ConfigMap leading blank-line
   normalization introduced by `cub installer`/kustomize.
9. Scan/gate receipts flag blocked default render, storage/schema selection,
   object-store Secret ownership, dependency review, cluster RBAC, StatefulSet
   policy, lifecycle policy, and extension-slot review.

For the promoted Longhorn proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `default` renders exactly 41 Helm objects, including 22 Longhorn CRDs, the
   manager DaemonSet, driver deployer, UI Deployment, cluster RBAC, and no
   Secrets.
3. `ui-ingress` renders exactly 42 Helm objects by adding
   `networking.k8s.io/v1|Ingress|longhorn-system|longhorn-ingress`.
4. Both variants render the Longhorn CRDs as ordinary digest-bound objects.
5. `cub installer package` produces byte-identical bundles across two local runs.
6. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||longhorn-system`.
7. Scan/gate receipts flag CRD lifecycle, pre-upgrade hook lifecycle,
   admission/recovery observation, cluster RBAC, privileged storage workload
   policy, StorageClass/default-setting policy, and UI ingress policy.

For the promoted MySQL proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `static-passwords` renders exactly 8 Helm objects, including one Secret
   and one StatefulSet.
3. `existing-secret` renders exactly 7 Helm objects, including zero Secrets and
   one StatefulSet.
4. `static-passwords` binds `auth.rootPassword`, `auth.password`, and
   `auth.replicationPassword` before render.
5. `existing-secret` declares target Secret `mysql/mysql-auth`.
6. The Bitnami `common` dependency is recorded in `dependency-lock.yaml`.
7. `cub installer package` produces byte-identical bundles across two local runs.
8. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||mysql`, while preserving separated Secret behavior.
9. Scan/gate receipts flag generated facts, target facts, dependency lock
   review, hook lifecycle, StatefulSet/PVC policy, and extension-slot review.

For the promoted Grafana proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `static-passwords` renders exactly 9 Helm objects, including one Secret
   and one Deployment.
3. `existing-secret-ingress` renders exactly 9 Helm objects, including zero
   Secrets, one Deployment, and one Ingress.
4. `static-passwords` binds `adminPassword` before render.
5. `existing-secret-ingress` declares target Secret `grafana/grafana-admin`.
6. The chart has no subchart dependencies and records an empty dependency
   closure.
7. `cub installer package` produces byte-identical bundles across two local runs.
8. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||grafana`, while preserving separated Secret behavior.
9. Scan/gate receipts flag generated facts, target facts, deprecated chart
   status, RBAC review, UI ingress policy, deployment policy, and
   provisioning/sidecar/Secret extension slots.

For the promoted Vault proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `default` renders exactly 12 Helm objects, including the Vault StatefulSet,
   injector Deployment, injector MutatingWebhookConfiguration, and zero
   Secrets.
3. `ha-raft-ui` renders exactly 18 Helm objects, including HA discovery RBAC,
   PodDisruptionBudget, active/standby services, UI Service, and zero Secrets.
4. Source lock records `hashicorp/vault@0.32.0`, app `1.21.2`, package SHA,
   and non-deprecated upstream status.
5. The chart has no subchart dependencies and records an empty dependency
   closure.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||vault`, while preserving separated Secret behavior.
8. Scan/gate receipts flag TLS posture, injector webhook, RBAC, service
   exposure, Vault StatefulSet storage/init/unseal operations, and Secret/env
   extension slots.

For the promoted Secrets Store CSI Driver proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `default` renders exactly 10 Helm objects, including two CRDs, one
   DaemonSet, one CSIDriver object, cluster RBAC, and zero Secrets.
3. `sync-secret-rotation` renders exactly 12 Helm objects by adding synced
   Secret RBAC and driver args for rotation and provider health checks.
4. Source lock records `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0`,
   app `1.6.0`, package SHA, and non-deprecated upstream status.
5. The chart has no subchart dependencies and records an empty dependency
   closure.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||kube-system`, while preserving separated Secret behavior.
8. Scan/gate receipts flag CRD lifecycle, CSIDriver lifecycle, privileged-node
   DaemonSet behavior, RBAC, synced Secret ownership, rotation, provider health
   checks, and provider identity inputs.

For the promoted Prometheus proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `default` renders exactly 23 Helm objects, including Prometheus server,
   Alertmanager, kube-state-metrics, node-exporter, pushgateway, server PVC,
   services, and cluster RBAC.
3. `server-only-ephemeral` renders exactly 6 Helm objects by disabling bundled
   components and the server PVC.
4. Source lock records `prometheus-community/prometheus@29.8.0`, app
   `v3.11.3`, package SHA, and non-deprecated upstream status.
5. Dependency lock records the four bundled subcharts: alertmanager,
   kube-state-metrics, prometheus-node-exporter, and prometheus-pushgateway.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||monitoring`, while preserving separated Secret behavior.
8. Scan/gate receipts flag bundled component ownership, scrape config, storage
   retention, workload rollout, cluster RBAC, remote read/write, ingress,
   network policy, PDB, and extra-manifest extension slots.

For the promoted MongoDB proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `static-passwords` renders exactly 8 Helm objects, including one Secret,
   Deployment, PVC, NetworkPolicy, and PDB.
3. `existing-secret-replicaset` renders exactly 10 Helm objects, including no
   Secret, a primary StatefulSet, an arbiter StatefulSet, and headless services.
4. Dependency lock records the Bitnami `common` subchart.
5. `cub installer package` produces byte-identical bundles across two local runs.
6. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||mongodb`, while preserving separated Secret behavior.
7. Scan/gate receipts flag generated facts, target facts, replica-set topology,
   storage, NetworkPolicy/PDB, hook lifecycle, dependency lock, and extension
   slots.

For the promoted Nginx proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `http-clusterip` renders exactly 5 Helm objects, including Deployment,
   Service, ServiceAccount, NetworkPolicy, and PDB, with no rendered Secret.
3. `existing-tls-ingress` renders exactly 6 Helm objects, adding Ingress while
   still rendering no Secret because TLS material is a target fact.
4. Dependency lock records the Bitnami `common` subchart.
5. `cub installer package` produces byte-identical bundles across two local runs.
6. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||nginx`.
7. Scan/gate receipts flag generated TLS handling, target TLS Secrets, ingress
   exposure, NetworkPolicy/PDB, service exposure, static-site supply-chain,
   metrics add-ons, and raw/template extension slots.

For the promoted Tempo proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `local-persistent` renders exactly 4 Helm objects: StatefulSet, ConfigMap,
   ServiceAccount, and Service.
3. `s3-query-observability` renders exactly 8 Helm objects, adding
   NetworkPolicy, query ConfigMap, Ingress, and ServiceMonitor while rendering
   no Secret because S3 credentials are a target fact.
4. Source lock records `grafana/tempo@1.24.4`, app `2.9.0`, package SHA, and
   deprecated upstream status.
5. Dependency lock records an empty dependency closure.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||tempo`.
8. Scan/gate receipts flag chart deprecation, storage backend policy, target
   S3 credentials, query ingress, ServiceMonitor capability, NetworkPolicy,
   StatefulSet/headless-Service runtime risk, and raw/template extension slots.

For the promoted Consul proof:

1. Both promoted variants render deterministically with Helm under the pinned
   inputs.
2. `default-control-plane` renders exactly 70 Helm objects, including 28 CRDs,
   server StatefulSet, injector/webhook-cert-manager Deployments, injector
   webhooks, services, PDBs, and cluster RBAC.
3. `secure-mesh-existing-secrets` renders exactly 99 Helm objects, including
   28 CRDs, one rendered auth-method Secret, ACL init Job, mesh/ingress/
   terminating gateway Deployments, and UI Ingress.
4. Source lock records `hashicorp/consul@2.0.0`, app `2.0.0`, package SHA, and
   non-deprecated upstream status.
5. Dependency lock records an empty dependency closure.
6. `cub installer package` produces byte-identical bundles across two local runs.
7. `cub installer setup` matches Helm semantically, plus only
   `v1|Namespace||consul`, with the explicit scalar normalization
   `trim-leading-command-block-newline`.
8. Scan/gate receipts flag CRD ownership, cluster RBAC, admission webhooks,
   TLS/ACL/gossip target Secrets, gateway topology, UI ingress, lifecycle Job,
   rendered Secret ownership, StatefulSet storage, and raw/template extension
   slots.

## Negative Golden Check

The verifier must include self-tests that corrupt known-good fixtures and prove
verification fails for the expected reason.

Current self-tests include:

- corrupt the Redis installer package source and require a package source SHA
  mismatch;
- corrupt the Redis rendered object digest and require rejection;
- remove the namespace support classification and require rejection;
- claim false scan success and require rejection;
- reintroduce the old `standalone` variant shape and require rejection;
- tamper with the reuse-existing-secret target fact and require rejection;
- lie about the variant diff and require rejection;
- corrupt the metrics-server rendered object set and require rejection;
- corrupt the ingress-nginx rendered object set and require rejection;
- corrupt the cert-manager rendered object set and require rejection;
- corrupt the external-secrets rendered object set and require rejection;
- corrupt the Argo CD rendered object set and require rejection;
- corrupt the PostgreSQL rendered object set and require rejection;
- corrupt the RabbitMQ rendered object set and require rejection;
- corrupt the kube-prometheus-stack rendered object set and require rejection;
- corrupt the Loki rendered object set and require rejection;
- corrupt the Longhorn rendered object set and require rejection;
- corrupt the MySQL rendered object set and require rejection;
- corrupt the Grafana rendered object set and require rejection;
- corrupt the Vault rendered object set and require rejection;
- corrupt the Secrets Store CSI Driver rendered object set and require
  rejection;
- corrupt the Prometheus rendered object set and require rejection;
- corrupt the MongoDB rendered object set and require rejection;
- corrupt the Nginx rendered object set and require rejection;
- corrupt the Tempo rendered object set and require rejection;
- corrupt the Consul rendered object set and require rejection;
- corrupt an adversarial harness rendered manifest and require a rendered
  manifest SHA mismatch.

The Redis installer package verifier must also prove:

- every package source file SHA and byte count matches the package receipt;
- `cub installer package` produces byte-identical bundles across two local runs;
- the package bundle SHA matches the receipt;
- `cub installer setup --base default` matches the default Helm-equivalent
  variant, plus only `v1|Namespace||redis`;
- `cub installer setup --base reuse-existing-secret` matches the existing-secret
  Helm-equivalent variant, plus only `v1|Namespace||redis`.

## Non-Scope For V0

The current verifier does not prove:

- source chart archive bytes beyond the recorded source locks and package
  receipts;
- hosted ConfigHub upload/OCI state in the default local `npm run verify`, even
  though the latest remote receipt is recorded under
  `runs/redis-confighub/latest/upload-oci-receipt.yaml`;
- upload receipts, upgrade simulation receipts, or rollback simulation
  receipts;
- full JSON Schema enforcement, because the immediate gate is hash/reference
  integrity over existing artifacts.
- full recipe/variant/revision proofs for every chart in
  `data/adversarial10/`; that harness is the first generated readiness and
  blocker map, not the final product proof for those charts.

## Extension Rule

Every new proof artifact family must add:

```text
schema or contract file
positive fixture or generated corpus
negative golden check
receipt/reference/digest verification
npm script entry point
```

Do not add a new chart proof stage unless its verifier contract lands first.
