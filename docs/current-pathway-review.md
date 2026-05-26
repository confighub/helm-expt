# Current Pathway Review

This review intentionally excludes legacy reference artifacts:

```text
archive/render-and-vendor-top20/
outputs/helm_top500_matrix/
```

Those files are useful history. They are not on the main pathway for executing
the current Helm mission.

## Verdict

The mission is clear:

```text
Use Helm charts. Ship ConfigHub variants. Never have Helm pain again.
```

Lead with:

```text
Approve the Kubernetes objects Helm produced,
not the values you hope produced them.
```

The adoption bar is stricter than "works":

```text
not harder than Helm
not riskier than Helm
not wrong compared with Helm
```

Scope:

```text
public Helm chart catalog proof
not enterprise-internal broken chart archaeology
```

The plan is credible if it proves this chain with new artifacts:

```text
chart source
  -> recipe candidate
  -> install variants
  -> immutable variant revisions
  -> exact rendered release objects
  -> scans and gates
  -> ConfigHub OCI artifact receipts
  -> optional direct-apply receipts for local/test paths
  -> observation receipts with freshness
```

The repo now has one complete Redis proof slice and one first generated
adversarial harness. It is still not a 20/100/500 proof repo, but it is no
longer only a planning packet.

Current proof surface:

```text
recipes/bitnami/redis/25.5.3/
packages/bitnami/redis/25.5.3/
docs/demo/redis/
data/adversarial10/
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
```

The next step is to turn more chart rows from the top-20 target and generated
readiness evidence into full recipe/variant/revision proofs and generated
spreadsheets that are backed by receipts, not hand-maintained analysis.

Council consensus:

- Product: the first demo must feel simpler than Helm. Hide the noun ladder.
- Operator: real Helm pains are named correctly, but not yet proven with
  artifacts.
- Architecture: build schemas and verifier first, or the repo will produce
  decorative evidence.
- Benchmark: top-500 is reconnaissance, not certification. A spreadsheet
  without receipts is benchmark theater.

## What The Repo Does Well

- States the mission and sales pitch clearly.
- Defines the canonical object model: chart, recipe, variant, variant revision,
  deployment, receipt.
- Names the simple UX as the thing that must be proven first: one install,
  clear diff/review, safe publish to ConfigHub OCI, proof generated
  automatically.
- Adds the adoption standard that the flow must feel easier, safer, and more
  correct than Helm from first use.
- Separates fast install through ConfigHub's OCI endpoint from deferred
  serverless work.
- Defines `HelmPlan` and `ChartDossier` as the process and knowledge artifacts.
- Makes Helm pain absorption explicit: every weirdness needs a model home,
  policy, status, and proof.
- Keeps workerless ConfigHub honest: live truth requires external observation
  receipts with freshness.

## What Is Still Missing

Keep extending the verifier:

```text
schemas/
scripts/verify-artifact-chain.mjs
scripts/generate-adversarial10-harness.mjs --verify
```

`npm run verify` now validates Redis proof artifacts, Redis package
determinism, metrics-server proof/package artifacts, ingress-nginx
proof/package artifacts, cert-manager proof/package artifacts,
external-secrets proof/package artifacts, Argo CD proof/package artifacts,
PostgreSQL proof/package artifacts, RabbitMQ proof/package artifacts,
kube-prometheus-stack proof/package artifacts, Loki proof/package artifacts,
Longhorn proof/package artifacts, MySQL proof/package artifacts, the archived
reference corpus, and the
first adversarial harness. It still needs formal schemas and broader
publication traceability before 20/100/500 claims are credible.

The Redis proof artifacts now exist:

```text
recipes/bitnami/redis/25.5.3/
  helm-plan.yaml
  chart-dossier.yaml
  recipe.yaml
  source-lock.yaml
  dependency-lock.yaml
  control-points.yaml
  value-model.yaml
  effective-values.yaml
  variants/
  revisions/
  receipts/
  reports/

packages/bitnami/redis/25.5.3/
  installer.yaml
  bases/default/upstream.yaml
  bases/reuse-existing-secret/upstream.yaml
```

The first generated matrix output is:

```text
data/adversarial10/
  corpus.yaml
  corpus.lock.yaml
  summary.md
  proof-readiness.csv
  charts/*/helm-plan.yaml
  charts/*/render-receipt.yaml
```

It still needs larger generated matrix outputs:

```text
data/top20/
data/top100/
data/top500/
  chart-corpus-lock.yaml
  proof-readiness.csv
  control-point-summary.csv
  matrix.xlsx
  methodology.md
```

The spreadsheet must be generated from artifacts and receipts. It should be a
proof index, not the proof itself.

The first promoted row from that matrix is:

```text
metrics-server/metrics-server@3.13.0
```

It proves the next reusable shape after Redis: a public chart row can become a
recipe, two variants, rendered revisions, target fact requirements, scan/gate
receipts, and a deterministic `cub install` package/setup proof.

The second promoted row is:

```text
ingress-nginx/ingress-nginx@4.15.1
```

It proves the admission-webhook chart shape: a default variant with admission
Service and ValidatingWebhookConfiguration, an `admission-disabled` variant
that deliberately removes those objects, admission webhook and Helm hook
lifecycle gates, cluster RBAC gates, and deterministic `cub install`
package/setup proof.

The third promoted row is:

```text
jetstack/cert-manager@v1.20.2
```

It proves the CRD-heavy control-plane chart shape: a default variant with zero
CRDs, a `crds-enabled` variant with the six cert-manager CRDs, CRD lifecycle and
upgrade gates, admission webhook observation gates, Helm startup hook lifecycle
gates, cluster RBAC gates, and deterministic `cub install` package/setup proof.

The fourth promoted row is:

```text
external-secrets/external-secrets@2.5.0
```

It proves the CRD-heavy controller chart shape: a default variant with 23 CRDs,
a `no-crds` variant with zero CRDs, source and dependency locks including the
disabled `bitwarden-sdk-server` dependency, admission webhook observation
gates, webhook Secret/cert-controller observation, cluster RBAC gates, and
deterministic `cub install` package/setup proof.

The fifth promoted row is:

```text
argo-cd/argo-cd@9.5.15
```

It proves the GitOps controller chart shape: a default variant with three CRDs,
a `no-crds` variant with zero CRDs, source and dependency locks including the
disabled `redis-ha` dependency, Helm hook lifecycle gates, generated Secret
ownership gates, StatefulSet policy, GitOps handoff policy, cluster RBAC gates,
and deterministic `cub install` package/setup proof.

The sixth promoted row is:

```text
bitnami/postgresql@18.6.7
```

It proves the generated-credential stateful chart shape: a
`generated-passwords` variant that binds `auth.postgresPassword`, an
`existing-secret` variant that declares target Secret
`postgresql/postgresql-auth`, source and dependency locks including the Bitnami
`common` dependency, hook lifecycle gates, StatefulSet/PVC policy, extension
slot review, and deterministic `cub install` package/setup proof.

The seventh promoted row is:

```text
bitnami/rabbitmq@16.0.14
```

It proves the generated-credential stateful chart shape with clustering
material: a `generated-passwords` variant that binds `auth.password` and
`auth.erlangCookie`, an `existing-secret` variant that declares target Secrets
`rabbitmq/rabbitmq-auth` and `rabbitmq/rabbitmq-erlang-cookie`, source and
dependency locks including the Bitnami `common` dependency, StatefulSet/PVC and
clustering policy, extension-slot review, and deterministic `cub install`
package/setup proof.

The eighth promoted row is:

```text
prometheus-community/kube-prometheus-stack@85.3.3
```

It proves the large umbrella monitoring stack shape: a `default` variant that
binds Grafana admin password and renders 10 Prometheus Operator CRDs, a
`no-crds` variant that omits CRDs, source and dependency locks for the CRD,
kube-state-metrics, node-exporter, Grafana, and windows-exporter dependencies,
admission webhook observation gates, cluster RBAC gates, dashboard ConfigMap
normalization, extension-slot review, and deterministic `cub install`
package/setup proof.

The ninth promoted row is:

```text
grafana/loki@7.0.0
```

It proves the blocked-default storage chart shape: a default render blocker for
missing `loki.storage.bucketNames.chunks`, `single-binary-filesystem` and
`simple-scalable-minio` variants, source and dependency locks for MinIO,
grafana-agent-operator, and rollout-operator, storage/schema binding, MinIO
object-store fixture, cluster RBAC, StatefulSet/PVC policy, Loki ConfigMap
normalization, extension-slot review, and deterministic `cub install`
package/setup proof.

The tenth promoted row is:

```text
longhorn/longhorn@1.11.2
```

It proves the storage control-plane chart shape: `default` and `ui-ingress`
variants, 22 Longhorn CRDs, pre-upgrade hook policy, admission/recovery
observation, cluster RBAC gates, privileged storage workload policy,
StorageClass/default-setting policy, UI ingress policy, and deterministic
`cub install` package/setup proof.

The eleventh promoted row is:

```text
bitnami/mysql@14.0.3
```

It proves the generated-credential stateful chart shape for MySQL:
`generated-passwords` and `existing-secret` variants, generated fact binding
for root/user/replication passwords, target Secret binding for
`mysql/mysql-auth`, Bitnami `common` dependency lock, hook lifecycle policy,
StatefulSet/PVC policy, extension-slot review, and deterministic
`cub install` package/setup proof.

The twelfth promoted row is:

```text
grafana/grafana@10.5.15
```

It proves the dashboard control-plane app chart shape: a chart-deprecation
marker in the source lock, `generated-passwords` and `existing-secret-ingress`
variants, generated Grafana admin credential binding, target Secret binding
for `grafana/grafana-admin`, UI ingress policy, cluster RBAC review,
deployment/provisioning/sidecar/Secret extension gates, and deterministic
`cub install` package/setup proof.

The thirteenth full proof row is:

```text
hashicorp/vault@0.32.0
```

It proves the security-sensitive stateful control-plane chart shape: `default`
and `ha-raft-ui` variants, TLS posture review, injector admission webhook
review, StatefulSet storage and HA Raft policy, init/unseal operate-policy
gates, service exposure review, cluster RBAC review, Secret/env extension
gates, and deterministic `cub install` package/setup proof.

The fourteenth full proof row is:

```text
secrets-store-csi-driver/secrets-store-csi-driver@1.6.0
```

It proves the node-level CSI driver chart shape: `default` and
`sync-secret-rotation` variants, SecretProviderClass CRD lifecycle, CSIDriver
kubelet integration, Linux DaemonSet and hostPath policy, cluster RBAC review,
synced Secret ownership, rotation/provider-health policy, provider identity
integration gates, and deterministic `cub install` package/setup proof.

The Redis proof now contains the first courtroom-grade slice. Remaining Redis
day-2 extensions still include:

```text
upgrade-simulation-receipt.yaml
rollback-simulation-receipt.yaml
```

Current Redis package proof status:

```text
packages/bitnami/redis/25.5.3 exists
cub install package is byte-deterministic across two local runs
cub install setup --base default matches Helm semantically, plus Namespace
cub install setup --base reuse-existing-secret matches Helm semantically, plus Namespace
Kubara spaces helm-redis-default and helm-redis-reuse-existing-secret exist
ConfigHub hosted OCI returns unit-level manifests for representative StatefulSets
```

Observation is not optional for the workerless claim. A missing or stale
observation receipt must be visible as "unknown/stale", not implied live truth.

The simple UX proof artifacts now exist:

```text
demo-script.md
cli-transcript.txt
ux-acceptance.md
```

They should continue to show:

- commands a Helm user can run without learning the full model first
- the immediate value returned by each command
- where the user sees rendered objects, diffs, scans, gates, and next action
- where receipts live for proof after the simple path succeeds
- why the path is easier, safer, and correct versus Helm

Each chart readiness artifact must be easy to read. The first view should be a
readiness card, not an audit dump:

```text
Chart
Status
Variants
Objects
Helm match
Scan/gate result
Publish readiness
Risks handled
Needs decision
Proof links
```

The order is deliberate: can I use this safely, why, then raw receipts.

## 20 / 50 / 100 / 500 Proof Ladder

For 20 charts, prove depth with 20 full public-chart proof slices:

- include Redis as the first full proof;
- promote rows from `data/adversarial10/` into chart proof folders;
- add enough additional public chart rows to reach 20;
- require recipe and package directories for every chart;
- require at least the default variant per chart;
- require at least one second meaningful variant where relevant;
- run deterministic render checks;
- run `cub install package` and `cub install setup`;
- produce a Helm equivalence report;
- produce scan receipt and install gate per rendered revision;
- include explicit CRD-heavy charts in the set;
- choose the adversarial set from [known-adversarial-charts.md](known-adversarial-charts.md);
- make every generated spreadsheet row traceable to receipts, not just source scans.

The concrete target list and acceptance contract live in
[top20-full-proof-target.md](top20-full-proof-target.md).

For 50 charts, prove breadth without losing clarity:

- repeat the same readiness-card output
- include more public chart categories
- keep every row traceable to artifacts and receipts

For 100 charts, prove automation:

- run the same HelmPlan journey without bespoke manual analysis
- classify every chart as viable, viable-with-control-points, blocked, or
  unknown
- require every blocked chart to name the blocking control point
- generate proof-readiness spreadsheets from artifacts

For 500 charts, prove corpus scale:

- source locks and dependency locks
- HelmPlan pain reports
- control-point classifications
- recipe viability
- rendered variant revisions where viable
- bulk scan/gate results
- aggregate failure catalog

## At-Scale Adversarial Verification

ConfigHub should verify at scale by running chart proof jobs across a matrix of:

- chart versions
- Kubernetes capability profiles
- default, HA, TLS, reuse-existing-secret, restricted, and provider variants
- target fact value profiles
- generated secret/cert/time policies
- hooks, CRDs, webhooks, RBAC, raw manifests, and `tpl` controls
- scanner policy bundles
- upgrade and rollback paths

Each run should produce:

```text
HelmPlan result
Recipe result
VariantRevision result
HelmEquivalenceReport
RenderReceipt
ScanReceipt
InstallGate
OCIArtifactReceipt
ApplyReceipt only when the run explicitly uses a direct-apply path
ObservationReceipt when a live target is involved
```

Adversarial tests should deliberately include charts that use `lookup`, random
functions, hooks, CRDs, webhooks, raw manifest slots, non-exact dependencies,
schema gaps, unknown values, and upgrade-sensitive state.

## P0 Before Scaling

The authoritative issue list is [docs/issue-backlog.md](issue-backlog.md). The
following open P0s must be complete or deliberately reclassified before the
20/100/500 proof can be believable:

- [#24](https://github.com/confighub/helm-expt/issues/24) Artifact schema and
  receipt verifier. The current verifier is real but not complete.
- [#4](https://github.com/confighub/helm-expt/issues/4) HelmPlan pain report
  for each analyzed chart. `data/adversarial10/` is the first generated slice.
- [#5](https://github.com/confighub/helm-expt/issues/5) EffectiveValues@sha
  with value precedence and provenance.
- [#6](https://github.com/confighub/helm-expt/issues/6) Dead, unknown, or
  ignored value detection where possible.
- [#7](https://github.com/confighub/helm-expt/issues/7) Value-to-rendered-field
  explanation for key settings.
- [#29](https://github.com/confighub/helm-expt/issues/29) Capability profile
  catalog for finite, digest-bound capability profiles.
- [#28](https://github.com/confighub/helm-expt/issues/28) Generated fact
  receipt schema for passwords, certs, UUIDs, and time values.
- [#30](https://github.com/confighub/helm-expt/issues/30) Upgrade and rollback
  simulation receipts.
- [#27](https://github.com/confighub/helm-expt/issues/27) Observation
  freshness SLO for workerless proof.
- [#25](https://github.com/confighub/helm-expt/issues/25) Top-N adversarial run
  harness that can produce generated spreadsheets from artifacts. The
  10-chart foundation exists but does not yet close the issue.

## Acceptance Standard

A skeptical reviewer should be able to choose any row in the new spreadsheet
and follow it to:

```text
chart source
source lock
recipe candidate
variant
variant revision
rendered object digest
scan/gate result
receipt
next action or blocker
```

If the row cannot be traced to artifacts and receipts, it is not proof.

Separately, a skeptical Helm user should be able to run the happy-path demo and
say within five minutes:

```text
I see exactly what will be installed.
I see what changed.
I see whether it passed checks.
I can publish it safely for GitOps pickup.
I did not have to learn a new platform ceremony first.
```

If that does not happen, the proof is too complex even if the artifacts are
technically complete.

No-go criteria:

- the user must learn the full ConfigHub object model before first value
- ConfigHub output differs from Helm without an explanation
- scan/gate/receipt concepts block the first useful result instead of helping it
- the next action is less clear than Helm's next action
- rollback, promotion, or publication feels riskier than the Helm/GitOps path
