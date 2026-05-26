# ConfigHub Helm Installer Demo

## Why This Exists

Helm is great at producing Kubernetes objects. It is not a durable operating
record of what was approved, changed, scanned, promoted, applied, and observed.

ConfigHub's Helm mission is:

```text
Use Helm charts.
Ship ConfigHub variants.
Never have Helm pain again.
```

Phase 1 scope:

```text
Public Helm chart catalog proof.
Not enterprise Helm archaeology.
```

Lead with the immediate value:

```text
Approve the Kubernetes objects Helm produced,
not the values you hope produced them.
```

Treat "Never have Helm pain again" as the ambition. The proof claim starts
smaller and sharper: ConfigHub shows the exact objects, differences, checks,
and proof before publish.

We use AI to accelerate Helm chart analysis and recipe creation. We use
`cub install` to prove the resulting recipes produce correct, Helm-equivalent,
reviewable ConfigHub variants.

The product promise is:

```text
correct variants
safe operations
immediate proof
```

The missing object is:

```text
managed variant + known operation + proof
```

Helm owns chart rendering. Git owns files. Argo CD and Flux own sync.
Kubernetes owns live objects. Scanners own findings. CI owns logs. None of them
owns this complete record:

```text
this variant revision was approved,
this exact object set was scanned,
this exact revision was applied,
this target observed it fresh,
this rollback, promotion, or upgrade happened with proof.
```

ConfigHub is the missing operational record around Helm output. The goal is not
"better Helm values". The goal is exact, reviewable, scannable, promotable
variant revisions with receipts.

```text
Chart -> Recipe -> Variant -> VariantRevision -> Deployment -> Receipt
```

Default rule:

```text
1 Helm chart version -> 1 core recipe -> N variants -> M variant revisions
```

The model is complex. The intended product UX is short:

```text
install
review/plan
publish
```

Above all, the proof must show that this is simpler than living in Helm
directly. A user should get immediate value before they understand the full
model:

```text
one simple install command
one clear diff/review path
one safe publish/promote path
automatic receipts, scans, gates, and rendered-object proof in the background
```

If the demo feels like "Helm plus homework", the plan has failed.

Harder than Helm, riskier than Helm, or less correct than Helm are all product
failures. The first experience must feel:

```text
easier: fewer decisions before a useful result
safer: exact objects, scans, gates, and rollback/promote proof
more correct: Helm-equivalent when expected, with every difference explained
```

## Current Pathway Boundary

Default ConfigHub org:

```text
ConfigHub Helm
```

Do not use `ConfighubOps` for this work.

This README describes the current mission and proof plan. The current main
pathway is:

```text
new chart proof repos
  -> new HelmPlan / ChartDossier / recipe artifacts
  -> new variants and variant revisions
  -> new rendered-object scans, gates, OCI artifact receipts
  -> new generated spreadsheets as evidence maps
```

The fast install story for this project uses ConfigHub's OCI endpoint. The
public catalog/proof surface is the ConfigHub GitHub repo for this work,
currently `confighub/helm-expt`. A fully serverless `cub install` path is a
deferred option and is not part of this executable demo.

## Legacy Reference Only

The old render-and-vendor material has been deliberately archived:

```text
archive/render-and-vendor-top20/
outputs/helm_top500_matrix/
```

Those files are reference evidence only. They should not be reviewed as the
main pathway for this plan.

The archived material can still show that:

- rendered Helm YAML can be wrapped by `confighub/installer`
- `cub install setup` can preserve a Helm-rendered object set
- `cub install upload` can create ConfigHub Units from that output
- the old source-feature spreadsheet helped design the control-point taxonomy

But the current plan must be judged against new chart repos, new recipes, new
variants, new receipts, and new generated proof spreadsheets.

Planning/backlog sync:

```text
docs/issue-backlog.md
```

Open P0 issues in that file are gates before credible 20/100/500 chart proof.

The next milestone is 20 full public-chart proofs, not a broad spreadsheet
with only a few deep examples. The target list and acceptance contract live in
[docs/top20-full-proof-target.md](docs/top20-full-proof-target.md).

## Current CLI Boundary

As of May 26, 2026, the real `cub install` surface is the
`confighub/installer` plugin. Commands relevant to this proof include:

```text
cub install doc
cub install pull
cub install setup
cub install render
cub install upload
cub install plan
cub install package
cub install push
cub install inspect
cub install list
cub install sign
cub install verify
cub install vet
cub install wizard
```

The upstream installer docs usually show the standalone binary name
`installer`. In this repo, the same command surface is invoked through the Cub
plugin as `cub install`.

The plugin also exposes package-authoring and registry helper commands such as
`init`, `new`, `edit`, `deps`, `login`, `logout`, `tag`, and `transformer`.
`preflight` appears in help as not yet implemented, so do not use it in proof
docs until it ships.

Do not present shorthand such as `cub install redis`, `cub diff redis`,
`cub publish redis`, or `cub variant redis ha` as current executable commands.
Those are candidate future porcelain verbs, not the current CLI. If we need
them to make the happy path obvious, propose them explicitly as Cub
plugins/extensions and keep executable docs on real commands until they ship.

## Planned Proof Files

New proof work should produce files such as:

```text
recipes/bitnami/redis/25.5.3/
packages/bitnami/redis/25.5.3/
recipes/metrics-server/metrics-server/3.13.0/
packages/metrics-server/metrics-server/3.13.0/
recipes/ingress-nginx/ingress-nginx/4.15.1/
packages/ingress-nginx/ingress-nginx/4.15.1/
recipes/jetstack/cert-manager/v1.20.2/
packages/jetstack/cert-manager/v1.20.2/
recipes/external-secrets/external-secrets/2.5.0/
packages/external-secrets/external-secrets/2.5.0/
recipes/argo-cd/argo-cd/9.5.15/
packages/argo-cd/argo-cd/9.5.15/
recipes/bitnami/postgresql/18.6.7/
packages/bitnami/postgresql/18.6.7/
recipes/bitnami/rabbitmq/16.0.14/
packages/bitnami/rabbitmq/16.0.14/
recipes/prometheus-community/kube-prometheus-stack/85.3.3/
packages/prometheus-community/kube-prometheus-stack/85.3.3/
recipes/grafana/loki/7.0.0/
packages/grafana/loki/7.0.0/
recipes/longhorn/longhorn/1.11.2/
packages/longhorn/longhorn/1.11.2/
recipes/bitnami/mysql/14.0.3/
packages/bitnami/mysql/14.0.3/
recipes/grafana/grafana/10.5.15/
packages/grafana/grafana/10.5.15/
recipes/hashicorp/vault/0.32.0/
packages/hashicorp/vault/0.32.0/
recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
recipes/prometheus-community/prometheus/29.8.0/
packages/prometheus-community/prometheus/29.8.0/
recipes/bitnami/mongodb/19.0.7/
packages/bitnami/mongodb/19.0.7/
recipes/bitnami/nginx/24.0.2/
packages/bitnami/nginx/24.0.2/
data/adversarial10/
data/top500/
docs/top20-full-proof-target.md
schemas/
runs/
```

Legacy reference files remain here:

```text
archive/render-and-vendor-top20/charts/
outputs/helm_top500_matrix/
```

## Verification

The proof method is deliberately simple:

```text
1. Render the public Helm chart with regular Helm under pinned inputs.
2. Record the rendered objects, object inventory, digests, and control points.
3. Build the chart-derived installer recipe/package.
4. Run the real cub install path.
5. Compare the cub install output with the regular Helm output.
6. Explain every intentional difference, such as the Namespace support object.
```

The adversarial harness is the repo's local test harness for step 1. It renders
public charts with regular Helm under pinned chart version, Helm version,
Kubernetes version, flags, and values. Full chart proofs then verify our work
by comparing the resulting `cub install` path with that Helm baseline.

The default verifier is now the artifact-chain verifier:

```sh
npm run verify
npm run redis:compare
npm run redis:verify-package
npm run metrics-server:compare
npm run ingress-nginx:compare
npm run cert-manager:compare
npm run external-secrets:compare
npm run argo-cd:compare
npm run postgresql:compare
npm run rabbitmq:compare
npm run kube-prometheus-stack:compare
npm run loki:compare
npm run longhorn:compare
npm run mysql:compare
npm run grafana:compare
npm run vault:compare
npm run secrets-store-csi-driver:compare
npm run prometheus:compare
npm run mongodb:compare
npm run nginx:compare
```

It checks the archived reference receipts against their referenced files, then
checks the current Redis proof artifacts, Helm-equivalence evidence, scan/gate
receipts, variant diff evidence, promoted metrics-server, ingress-nginx,
cert-manager, external-secrets, Argo CD, PostgreSQL, RabbitMQ,
kube-prometheus-stack, Loki, Longhorn, MySQL, Grafana, Vault,
Secrets Store CSI Driver, Prometheus, MongoDB, and Nginx proof/package
artifacts, deterministic `cub install` packaging, and negative golden
self-tests.

The old hash-only archive check is still available for comparison:

```sh
npm run verify:legacy
```

## Redis Proof

The current executable proof is:

```text
recipes/bitnami/redis/25.5.3/
```

Five-minute demo artifacts:

```text
docs/demo/redis/demo-script.md
docs/demo/redis/cli-transcript.txt
docs/demo/redis/ux-acceptance.md
```

It contains Redis readiness cards for the `default` and
`reuse-existing-secret` variants, recipe/variant/revision artifacts, rendered
object inventories, Helm equivalence receipts, render receipts, scan receipts,
install gates, and a readable diff from `default` to
`reuse-existing-secret`.

Useful commands:

```sh
npm run redis:generate-proof
npm run redis:generate-package
npm run redis:verify-proof
npm run redis:verify-package
npm run redis:compare
```

`redis:verify-proof` is local and deterministic. `redis:verify-package`
rebuilds the Redis installer package twice, checks byte-identical package
output, and verifies both package bases through real `cub install setup`.
`redis:compare` re-renders Redis with Helm and `cub install setup` to prove the
Helm-equivalence claim.

What it proves today:

- `default`: Helm renders 14 Redis objects; `cub install setup` preserves all
  14 and adds only the Namespace support object while separating the rendered
  Secret.
- `reuse-existing-secret`: Helm renders 13 Redis objects; `cub install setup`
  preserves all 13 and adds only the Namespace support object.
- The variant diff is recomputed from the rendered objects: one Secret removed,
  two StatefulSets changed, one target Secret requirement added.
- The local scan warns and blocks production, so the proof stays honest rather
  than pretending the chart is production-ready.

Optional live local e2e:

```sh
npm run redis:local-e2e
npm run redis:verify-local-e2e
npm run redis:local-e2e:reuse-existing-secret
npm run redis:verify-local-e2e:reuse-existing-secret
```

This uses a dedicated kind cluster named `helm-expt-redis`, writes a local
observation receipt under `runs/redis-local-kind/`, and does not change the
production scan gate.

Default handoff is a pinned ConfigHub OCI artifact for GitOps consumption.
Direct apply is an alternate path, not the default proof story.

Optional OCI publication, when a registry endpoint and credentials are
available:

```sh
REDIS_INSTALLER_OCI_REF=oci://<registry>/<repo>:<tag> npm run redis:publish-package
```

Publication is not simulated. Without an explicit registry ref, the package
proof remains a local deterministic package and setup proof.

Current ConfigHub upload/OCI evidence:

```text
runs/redis-confighub/latest/upload-oci-receipt.yaml
```

In Kubara, the current Redis package has been uploaded to:

```text
helm-redis-default
helm-redis-reuse-existing-secret
```

The receipt verifies both spaces and confirms ConfigHub's hosted OCI endpoint
returns unit-level OCI manifests for representative Redis StatefulSet Units.

## Metrics Server Proof

The first chart promoted from the adversarial harness into a full proof slice
after Redis is:

```text
recipes/metrics-server/metrics-server/3.13.0/
packages/metrics-server/metrics-server/3.13.0/
```

It has two install variants:

```text
default
external-tls-ca
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: generated certificate helpers, Helm
`lookup`, Kubernetes capability branching, APIService readiness, cluster RBAC,
and external TLS target facts.

Useful commands:

```sh
npm run metrics-server:generate-proof
npm run metrics-server:generate-package
npm run metrics-server:verify-proof
npm run metrics-server:verify-package
npm run metrics-server:compare
```

## Ingress NGINX Proof

The second chart promoted from the adversarial harness is:

```text
recipes/ingress-nginx/ingress-nginx/4.15.1/
packages/ingress-nginx/ingress-nginx/4.15.1/
```

It has two install variants:

```text
default
admission-disabled
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also
makes the chart's awkward parts visible: Kubernetes capability branching,
admission webhook objects, Helm hook lifecycle policy, `tpl` extension points,
and cluster RBAC.

Useful commands:

```sh
npm run ingress-nginx:generate-proof
npm run ingress-nginx:generate-package
npm run ingress-nginx:verify-proof
npm run ingress-nginx:verify-package
npm run ingress-nginx:compare
```

## Cert Manager Proof

The third chart promoted from the adversarial harness is:

```text
recipes/jetstack/cert-manager/v1.20.2/
packages/jetstack/cert-manager/v1.20.2/
```

It has two install variants:

```text
default
crds-enabled
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: optional CRD rendering, CRD lifecycle and
upgrade policy, admission webhooks, the Helm startup API check hook,
`tpl` extension slots, and cluster RBAC.

Useful commands:

```sh
npm run cert-manager:generate-proof
npm run cert-manager:generate-package
npm run cert-manager:verify-proof
npm run cert-manager:verify-package
npm run cert-manager:compare
```

## External Secrets Proof

The fourth chart promoted from the adversarial harness is:

```text
recipes/external-secrets/external-secrets/2.5.0/
packages/external-secrets/external-secrets/2.5.0/
```

It has two install variants:

```text
default
no-crds
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: Kubernetes capability branching, 23 optional
CRDs, a disabled locked dependency, validating webhooks, an empty webhook Secret
filled later by the cert-controller, `tpl` extension slots, and cluster RBAC.

Useful commands:

```sh
npm run external-secrets:generate-proof
npm run external-secrets:generate-package
npm run external-secrets:verify-proof
npm run external-secrets:verify-package
npm run external-secrets:compare
```

## Argo CD Proof

The fifth chart promoted from the adversarial harness is:

```text
recipes/argo-cd/argo-cd/9.5.15/
packages/argo-cd/argo-cd/9.5.15/
```

It has two install variants:

```text
default
no-crds
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: Kubernetes capability branching, three
optional CRDs, Helm hook lifecycle policy, a disabled locked `redis-ha`
dependency, generated/operational Secrets, `tpl` extension slots, the
application-controller StatefulSet, GitOps handoff policy, and cluster RBAC.

Useful commands:

```sh
npm run argo-cd:generate-proof
npm run argo-cd:generate-package
npm run argo-cd:verify-proof
npm run argo-cd:verify-package
npm run argo-cd:compare
```

## PostgreSQL Proof

The sixth chart promoted from the adversarial harness is:

```text
recipes/bitnami/postgresql/18.6.7/
packages/bitnami/postgresql/18.6.7/
```

It has two install variants:

```text
generated-passwords
existing-secret
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: default Helm password generation,
generated-fact binding, target Secret binding, Helm hook lifecycle policy, the
Bitnami common dependency, StatefulSet/PVC policy, `tpl` extension slots, and
upgrade/rollback risk.

Useful commands:

```sh
npm run postgresql:generate-proof
npm run postgresql:generate-package
npm run postgresql:verify-proof
npm run postgresql:verify-package
npm run postgresql:compare
```

## RabbitMQ Proof

The seventh chart promoted from the adversarial harness is:

```text
recipes/bitnami/rabbitmq/16.0.14/
packages/bitnami/rabbitmq/16.0.14/
```

It has two install variants:

```text
generated-passwords
existing-secret
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: default Helm password and Erlang-cookie
generation, generated-fact binding, target Secret binding, the Bitnami common
dependency, StatefulSet/PVC policy, RabbitMQ clustering policy, `tpl`/raw
extension slots, and upgrade/rollback risk.

Useful commands:

```sh
npm run rabbitmq:generate-proof
npm run rabbitmq:generate-package
npm run rabbitmq:verify-proof
npm run rabbitmq:verify-package
npm run rabbitmq:compare
```

## Kube Prometheus Stack Proof

The eighth chart promoted from the adversarial harness is:

```text
recipes/prometheus-community/kube-prometheus-stack/85.3.3/
packages/prometheus-community/kube-prometheus-stack/85.3.3/
```

It has two install variants:

```text
default
no-crds
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: umbrella dependencies, 10 Prometheus
Operator CRDs, admission webhooks, generated Grafana admin password, cluster
RBAC, dashboard ConfigMap normalization, and `tpl`/raw monitoring extension
slots.

Useful commands:

```sh
npm run kube-prometheus-stack:generate-proof
npm run kube-prometheus-stack:generate-package
npm run kube-prometheus-stack:verify-proof
npm run kube-prometheus-stack:verify-package
npm run kube-prometheus-stack:compare
```

## Loki Proof

The ninth chart promoted from the adversarial harness is:

```text
recipes/grafana/loki/7.0.0/
packages/grafana/loki/7.0.0/
```

It has two install variants:

```text
single-binary-filesystem
simple-scalable-minio
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object and the
classified Loki ConfigMap leading-blank-line normalization. It also makes the
chart's awkward parts visible: default render is blocked until storage
bucket/schema values are supplied, storage mode selection, object-store bucket
policy, bundled MinIO dependency, cluster RBAC, StatefulSet/PVC policy, and
`tpl`/raw extension slots.

Useful commands:

```sh
npm run loki:generate-proof
npm run loki:generate-package
npm run loki:verify-proof
npm run loki:verify-package
npm run loki:compare
```

## Longhorn Proof

The tenth chart promoted from the adversarial harness is:

```text
recipes/longhorn/longhorn/1.11.2/
packages/longhorn/longhorn/1.11.2/
```

It has two install variants:

```text
default
ui-ingress
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: 22 Longhorn CRDs, pre-upgrade hook policy,
admission/recovery observation, cluster RBAC, privileged storage workloads,
StorageClass/default-setting policy, and explicit UI ingress exposure.

Useful commands:

```sh
npm run longhorn:generate-proof
npm run longhorn:generate-package
npm run longhorn:verify-proof
npm run longhorn:verify-package
npm run longhorn:compare
```

## MySQL Proof

The eleventh chart promoted from the adversarial harness is:

```text
recipes/bitnami/mysql/14.0.3/
packages/bitnami/mysql/14.0.3/
```

It has two install variants:

```text
generated-passwords
existing-secret
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: multiple generated password fields,
existing Secret target facts, the Bitnami common dependency, hook lifecycle
policy, StatefulSet/PVC policy, NetworkPolicy/PDB objects, and
`tpl`/configuration extension slots.

Useful commands:

```sh
npm run mysql:generate-proof
npm run mysql:generate-package
npm run mysql:verify-proof
npm run mysql:verify-package
npm run mysql:compare
```

## Grafana Proof

The twelfth chart promoted from the adversarial harness is:

```text
recipes/grafana/grafana/10.5.15/
packages/grafana/grafana/10.5.15/
```

It has two install variants:

```text
generated-passwords
existing-secret-ingress
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
the chart's awkward parts visible: deprecated upstream chart status, generated
admin password, external admin Secret, explicit UI ingress exposure, cluster
RBAC, deployment rollout policy, and dashboard/datasource/plugin/sidecar/env
extension slots.

Useful commands:

```sh
npm run grafana:generate-proof
npm run grafana:generate-package
npm run grafana:verify-proof
npm run grafana:verify-package
npm run grafana:compare
```

## Vault Proof

The thirteenth chart promoted into a full proof is:

```text
recipes/hashicorp/vault/0.32.0/
packages/hashicorp/vault/0.32.0/
```

It has two install variants:

```text
default
ha-raft-ui
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
Vault-specific risk visible: TLS-disabled listener config, injector admission
webhook, cluster RBAC, StatefulSet storage, init/unseal operating policy, HA
Raft service discovery, UI service exposure, and Secret/env extension slots.

Useful commands:

```sh
npm run vault:generate-proof
npm run vault:generate-package
npm run vault:verify-proof
npm run vault:verify-package
npm run vault:compare
```

## Secrets Store CSI Driver Proof

The fourteenth chart promoted into a full proof is:

```text
recipes/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
packages/secrets-store-csi-driver/secrets-store-csi-driver/1.6.0/
```

It has two install variants:

```text
default
sync-secret-rotation
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
CSI-driver-specific risk visible: SecretProviderClass CRDs, privileged-node
DaemonSet behavior, CSIDriver kubelet integration, cluster RBAC, synced Secret
ownership, rotation settings, provider health checks, and provider identity
inputs.

Useful commands:

```sh
npm run secrets-store-csi-driver:generate-proof
npm run secrets-store-csi-driver:generate-package
npm run secrets-store-csi-driver:verify-proof
npm run secrets-store-csi-driver:verify-package
npm run secrets-store-csi-driver:compare
```

## Prometheus Proof

The fifteenth chart promoted into a full proof is:

```text
recipes/prometheus-community/prometheus/29.8.0/
packages/prometheus-community/prometheus/29.8.0/
```

It has two install variants:

```text
default
server-only-ephemeral
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It also makes
monitoring-stack risk visible: bundled dependencies, scrape configuration,
server PVC/storage retention, Alertmanager/exporter ownership, cluster RBAC,
workload rollout policy, remote read/write, ingress, network policy, PDB, and
extra-manifest extension slots.

Useful commands:

```sh
npm run prometheus:generate-proof
npm run prometheus:generate-package
npm run prometheus:verify-proof
npm run prometheus:verify-package
npm run prometheus:compare
```

## MongoDB Proof

The sixteenth chart promoted into a full proof is:

```text
recipes/bitnami/mongodb/19.0.7/
packages/bitnami/mongodb/19.0.7/
```

It has two install variants:

```text
generated-passwords
existing-secret-replicaset
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It makes
MongoDB-specific risk visible: generated root password, target Secret handling,
replica-set topology, arbiter StatefulSet, persistent storage, NetworkPolicy,
PDB, hook lifecycle, and `tpl` configuration slots.

Useful commands:

```sh
npm run mongodb:generate-proof
npm run mongodb:generate-package
npm run mongodb:verify-proof
npm run mongodb:verify-package
npm run mongodb:compare
```

## Nginx Proof

The eighteenth chart promoted into a full proof is:

```text
recipes/bitnami/nginx/24.0.2/
packages/bitnami/nginx/24.0.2/
```

It has two install variants:

```text
http-clusterip
existing-tls-ingress
```

The proof shows that regular Helm output is preserved by real
`cub install setup`, plus the explained Namespace support object. It makes
Nginx-specific Helm pain visible: default self-signed TLS generation,
externally managed TLS Secrets, ingress exposure, NetworkPolicy, PDB, service
exposure, static-site supply-chain slots, metrics add-ons, and raw/template
extension slots.

Useful commands:

```sh
npm run nginx:generate-proof
npm run nginx:generate-package
npm run nginx:verify-proof
npm run nginx:verify-package
npm run nginx:compare
```

## Adversarial 10 Harness

The first scale-out harness is:

```text
data/adversarial10/
```

It uses 10 pinned public Helm charts, renders chart-default values twice with
real Helm, stores rendered object sets for successful attempts, records blocker
receipts for failures, and generates a proof-readiness CSV:

```text
data/adversarial10/corpus.yaml
data/adversarial10/corpus.lock.yaml
data/adversarial10/summary.md
data/adversarial10/proof-readiness.csv
data/adversarial10/charts/*/helm-plan.yaml
data/adversarial10/charts/*/render-receipt.yaml
data/adversarial10/charts/*/rendered/object-inventory.yaml
```

Useful commands:

```sh
npm run adversarial10:generate
npm run adversarial10:verify
npm run adversarial10:verify:self-test
```

This is not certification. It is the first generated evidence map showing where
public-chart Helm pain appears: nondeterministic renders, required values,
CRDs, hooks, capability branching, `lookup`, generated facts, `tpl`, raw
extension slots, RBAC, webhooks, APIService, stateful workloads, and PVCs.

Rows must trace to receipts and rendered object digests. Blocked or
nondeterministic rows are useful findings, not swept-away failures.

## Legacy Redis Reference

Detailed legacy commands are intentionally not the root README experience.
They are retained in [docs/old-cub-helm-model.md](docs/old-cub-helm-model.md)
for reference only.

Background notes:

```text
docs/
```
