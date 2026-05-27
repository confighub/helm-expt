# Agreed Execution Plan

This is the current agreement for the Helm/ConfigHub proof.

## One-Line Mission

```text
Use Helm charts. Ship ConfigHub variants.
```

The user-facing promise:

```text
Helm generates Kubernetes objects. ConfigHub captures those objects as
immutable variant revisions. You approve the exact rendered objects, scan them
before install, promote the same revision to prod, see why environments differ,
and get receipts proving what changed and what was observed.
```

Phase 1 scope:

```text
Public Helm chart catalog proof.
Not enterprise Helm archaeology.
```

Lead with the value, not the noun ladder:

```text
Approve the Kubernetes objects Helm produced,
not the values you hope produced them.
```

"Never have Helm pain again" is the ambition. The near-term proof must be more
precise: ConfigHub makes Helm output easier to review, safer to apply, and
provably correct versus Helm where equivalence is expected.

The sharper product triangle:

```text
correct variants
safe operations
immediate proof
```

## Canonical Object Model

Use this model consistently in docs, demos, labels, attributes, receipts, and
repo artifacts:

```text
Chart = upstream source.
Recipe = reusable cub installer mapping for that source.
Variant = named install shape from a recipe.
VariantRevision = exact rendered object set at a point in time.
Deployment = a variant revision assigned or applied to a target.
Receipt = proof of a render, scan, gate, apply, or observation.
```

Use friendlier public language in demos and sales materials:

| Internal term | Public phrase |
| --- | --- |
| `VariantRevision` | Approved Rendered Revision |
| `HelmPlan` | Chart Readiness Plan |
| `ChartDossier` | Chart Operating Notes |
| `Receipt` | Proof Receipt |
| `Deployment` | Target Assignment or Apply Record |

Internal artifact names can stay precise. Public UX should not force users to
learn the internal nouns before they see value.

Default cardinality:

```text
1 Helm chart version -> 1 core recipe -> N variants -> M variant revisions
```

Create multiple recipes only when the chart source, chart version, umbrella
composition, import strategy, or recipe semantics materially differ. Normal
differences such as namespace, replica count, HA mode, TLS, cloud profile,
customer overrides, or environment policy are variants and revisions, not new
recipes.

The product must expose the short path first, while keeping the full model
available as proof:

```text
The model is complex.
The UX must not be.
```

## Adoption Ladder

The current product proof is not a pure serverless architecture. The fast path
uses real `cub install`, the real ConfigHub service, and ConfigHub's OCI
endpoint for publishable install artifacts.

Current ladder:

| Stage | Status | Shape |
| --- | --- | --- |
| Public catalog and proof repo | Current focus | Recipes, HelmPlans, dossiers, examples, top-500 evidence, and reproducible scripts live on the public ConfigHub GitHub surface, currently `confighub/helm-expt`. |
| Fast install | Current focus | `cub install` uses verified catalog content and ConfigHub's OCI endpoint to create/publish install artifacts that existing delivery tools can consume. |
| Managed variants | Current focus | ConfigHub Server stores and governs recipes, variants, variant revisions, receipts, approvals, scans, gates, and operation history. |
| Pure serverless `cub install` | Deferred option | A future/no-commitment path where the full install chain runs client-side without ConfigHub Server. Track as an issue; do not execute it in this proof. |

This keeps the demo honest:

```text
Fast install depends on ConfigHub's OCI endpoint.
GitHub is the public catalog/proof surface.
Pure serverless is optional future work, not part of the current proof.
```

## Main Pathway Boundary

The current plan does not execute through the removed top-20 render-and-vendor
payload or the old top-500 spreadsheet.

Main pathway:

```text
new chart proof repos
  -> new HelmPlan / ChartDossier / recipe artifacts
  -> new variants and variant revisions
  -> new rendered-object scans, gates, OCI artifact receipts
  -> new generated spreadsheets as evidence maps
```

Reference-only material:

```text
outputs/helm_top500_matrix/
```

The old render-and-vendor top-20 payload has been removed from the active tree.
The remaining old matrix is useful history, but it must be excluded from
reviews of whether the current plan works. It does not count as recipe
candidates, managed variants, variant revisions, scan receipts, install gates,
OCI receipts, or the new spreadsheet proof system.

## Issue Gates

The written plan is tied to the GitHub backlog in
[docs/issue-backlog.md](issue-backlog.md).

Rules:

```text
P0 issues are gates before credible 20/100/500 chart proof.
P1 issues are strong next proof.
P2 issues preserve important design depth without blocking the first proof.
```

Do not judge the plan as ready for at-scale proof while open P0 gates remain.
Do not let planning docs hide or bypass open P0 issues.

Immediate execution order:

1. **Build the verifier first**: [#24](https://github.com/confighub/helm-expt/issues/24).
   Schemas and receipt verification prevent decorative evidence.
2. **Make Redis courtroom-grade**: [#10](https://github.com/confighub/helm-expt/issues/10),
   supported by [#5](https://github.com/confighub/helm-expt/issues/5),
   [#6](https://github.com/confighub/helm-expt/issues/6),
   [#7](https://github.com/confighub/helm-expt/issues/7),
   [#8](https://github.com/confighub/helm-expt/issues/8), and
   [#9](https://github.com/confighub/helm-expt/issues/9).
3. **Prove the five-minute happy path continuously**:
   [#26](https://github.com/confighub/helm-expt/issues/26).
4. **Scale to 20 full public-chart proofs**:
   [#25](https://github.com/confighub/helm-expt/issues/25).
   The target is not a spreadsheet plus selected deep dives. It is 20 full
   recipe/variant/revision proof slices with `cub install` package/setup,
   Helm equivalence, scans, gates, and receipts.

Current execution status:

```text
Redis proof slice: complete for first-install/default and reuse-existing-secret.
Five-minute UX proof: present under docs/demo/redis/.
Adversarial 10 foundation: present under data/adversarial10/.
First promoted adversarial row: metrics-server/metrics-server@3.13.0.
Second promoted adversarial row: ingress-nginx/ingress-nginx@4.15.1.
Third promoted adversarial row: jetstack/cert-manager@v1.20.2.
Fourth promoted adversarial row: external-secrets/external-secrets@2.5.0.
Fifth promoted adversarial row: argo-cd/argo-cd@9.5.15.
Sixth promoted adversarial row: bitnami/postgresql@18.6.7.
Seventh promoted adversarial row: bitnami/rabbitmq@16.0.14.
Eighth promoted adversarial row: prometheus-community/kube-prometheus-stack@85.3.3.
Ninth promoted adversarial row: grafana/loki@7.0.0.
Tenth promoted adversarial row: longhorn/longhorn@1.11.2.
Eleventh promoted adversarial row: bitnami/mysql@14.0.3.
Twelfth promoted adversarial row: grafana/grafana@10.5.15.
Thirteenth full proof row: hashicorp/vault@0.32.0.
Fourteenth full proof row: secrets-store-csi-driver/secrets-store-csi-driver@1.6.0.
Fifteenth full proof row: prometheus-community/prometheus@29.8.0.
Sixteenth full proof row: bitnami/mongodb@19.0.7.
Seventeenth full proof row: bitnami/nginx@24.0.2.
Eighteenth full proof row: grafana/tempo@1.24.4.
Nineteenth full proof row: hashicorp/consul@2.0.0.
```

The adversarial 10 foundation does not close the scale proof. It gives us the
first generated chart corpus lock, readiness CSV, per-chart HelmPlans, render
receipts, stored rendered manifests for successful attempts, and blocker receipt
for a default-values render failure. The next step is to promote rows from
readiness evidence into full recipe/variant/revision proofs until the repo has
20 complete public-chart proof slices. The target list and per-chart contract
live in [top20-full-proof-target.md](top20-full-proof-target.md).

The first such promotion is metrics-server. It adds the repeatable pattern for a
small but non-trivial public chart: source/dependency locks, two variants,
target Secret facts, APIService and cluster RBAC gates, Helm equivalence
receipts, and deterministic `cub install` package/setup proof.

The second such promotion is ingress-nginx. It adds the repeatable pattern for
an admission-webhook chart: source/dependency locks, `default` and
`admission-disabled` variants, admission webhook and Helm hook lifecycle gates,
cluster RBAC gates, Helm equivalence receipts, and deterministic
`cub install` package/setup proof.

The third such promotion is cert-manager. It adds the repeatable pattern for a
CRD-heavy control-plane chart: source/dependency locks, `default` and
`crds-enabled` variants, CRD lifecycle and upgrade gates, admission webhook
observation gates, Helm startup hook lifecycle gates, cluster RBAC gates, Helm
equivalence receipts, and deterministic `cub install` package/setup proof.

The fourth such promotion is external-secrets. It adds the repeatable pattern
for a CRD-heavy controller chart with a disabled dependency and separated
webhook Secret: source/dependency locks, `default` and `no-crds` variants,
capability profile gates, CRD lifecycle and upgrade gates, admission webhook
observation gates, webhook Secret/cert-controller observation, cluster RBAC
gates, Helm equivalence receipts, and deterministic `cub install`
package/setup proof.

The fifth such promotion is Argo CD. It adds the repeatable pattern for a
GitOps controller chart: source/dependency locks, `default` and `no-crds`
variants, capability profile gates, CRD lifecycle and upgrade gates, Helm hook
lifecycle gates, generated Secret ownership gates, StatefulSet policy, GitOps
handoff policy, cluster RBAC gates, Helm equivalence receipts, and
deterministic `cub install` package/setup proof.

The sixth such promotion is PostgreSQL. It adds the repeatable pattern for a
nondeterministic generated-credential chart: source/dependency locks,
`generated-passwords` and `existing-secret` variants, generated fact binding,
target fact binding, Helm hook lifecycle gates, StatefulSet/PVC policy, `tpl`
extension-slot review, Helm equivalence receipts, and deterministic
`cub install` package/setup proof.

The seventh such promotion is RabbitMQ. It adds the repeatable pattern for a
stateful generated-credential chart with RabbitMQ-specific clustering material:
source/dependency locks, `generated-passwords` and `existing-secret` variants,
generated fact binding for password and Erlang cookie, target fact binding for
both external Secrets, StatefulSet/PVC policy, clustering policy, `tpl`/raw
extension-slot review, Helm equivalence receipts, and deterministic
`cub install` package/setup proof.

The eighth such promotion is kube-prometheus-stack. It adds the repeatable
pattern for a large umbrella monitoring stack: source/dependency locks,
`default` and `no-crds` variants, generated fact binding for Grafana admin
password, 10 Prometheus Operator CRDs, admission webhook observation gates,
cluster RBAC gates, dashboard ConfigMap normalization, `tpl`/raw monitoring
extension-slot review, Helm equivalence receipts, and deterministic
`cub install` package/setup proof.

The ninth such promotion is Loki. It adds the repeatable pattern for a chart
whose default path is blocked before render: source/dependency locks,
`single-binary-filesystem` and `simple-scalable-minio` variants, required
storage/schema binding, bundled MinIO object-store fixture, cluster RBAC gates,
StatefulSet/PVC policy, classified Loki ConfigMap normalization, `tpl`/raw
extension-slot review, Helm equivalence receipts, and deterministic
`cub install` package/setup proof.

The tenth such promotion is Longhorn. It adds the repeatable pattern for a
storage control-plane chart: source/dependency locks, `default` and
`ui-ingress` variants, 22 Longhorn CRDs, pre-upgrade hook policy,
admission/recovery observation, cluster RBAC gates, privileged storage workload
policy, StorageClass/default-setting policy, UI ingress policy, Helm
equivalence receipts, and deterministic `cub install` package/setup proof.

The eleventh such promotion is MySQL. It adds the repeatable pattern for
another stateful generated-credential chart: source/dependency locks,
`generated-passwords` and `existing-secret` variants, generated fact binding
for root/user/replication passwords, target fact binding for external Secret,
StatefulSet/PVC policy, hook lifecycle policy, `tpl`/configuration
extension-slot review, Helm equivalence receipts, and deterministic
`cub install` package/setup proof.

The twelfth such promotion is Grafana. It adds the repeatable pattern for a
dashboard/control-plane app chart with a deprecated upstream chart marker:
source/dependency locks, `generated-passwords` and `existing-secret-ingress`
variants, generated admin password binding, target Secret binding, UI ingress
policy, RBAC review, provisioning/dashboard/plugin/sidecar extension-slot
review, Helm equivalence receipts, and deterministic `cub install`
package/setup proof.

The thirteenth such promotion is Vault. It adds the repeatable pattern for a
security-sensitive stateful control-plane chart: source/dependency locks,
`default` and `ha-raft-ui` variants, TLS posture review, injector admission
webhook review, Vault StatefulSet storage and HA Raft policy, init/unseal
operate-policy gates, service exposure review, RBAC review, Secret/env
extension-slot review, Helm equivalence receipts, and deterministic
`cub install` package/setup proof.

The fourteenth such promotion is Secrets Store CSI Driver. It adds the
repeatable pattern for a node-level CSI driver chart: source/dependency locks,
`default` and `sync-secret-rotation` variants, SecretProviderClass CRD
lifecycle, CSIDriver kubelet integration, Linux DaemonSet and hostPath policy,
cluster RBAC review, synced Secret ownership, rotation/provider-health policy,
provider identity integration gates, Helm equivalence receipts, and
deterministic `cub install` package/setup proof.

The fifteenth such promotion is Prometheus. It adds the repeatable pattern for
a bundled monitoring stack chart: source/dependency locks, `default` and
`server-only-ephemeral` variants, Alertmanager/exporter/pushgateway component
selection, Prometheus scrape ConfigMap review, server PVC/storage retention
policy, cluster RBAC review, remote read/write and exposure extension slots,
Helm equivalence receipts, and deterministic `cub install` package/setup proof.

The sixteenth such promotion is MongoDB. It adds the repeatable pattern for a
stateful database chart with topology variants: source/dependency locks,
`generated-passwords` and `existing-secret-replicaset` variants, generated root
password binding, target Secret binding, replica-set and arbiter StatefulSets,
persistent storage, NetworkPolicy/PDB policy, Helm hook lifecycle review, `tpl`
configuration slots, Helm equivalence receipts, and deterministic `cub install`
package/setup proof.

The seventeenth such promotion is Nginx. It adds the repeatable pattern for a
simple web-service chart whose default render is still painful: source and
dependency locks, `http-clusterip` and `existing-tls-ingress` variants,
self-signed TLS generation made explicit, declared backend and ingress TLS
target Secrets, ingress exposure, NetworkPolicy/PDB policy, static-site
supply-chain slots, metrics add-ons, raw/template extension-slot review, Helm
equivalence receipts, and deterministic `cub install` package/setup proof.

The eighteenth such promotion is Tempo. It adds the repeatable pattern for a
deprecated-but-still-public observability chart: source and empty dependency
locks, `local-persistent` and `s3-query-observability` variants, local versus
S3 storage backend policy, target Secret binding for S3 credentials, query
ingress policy, ServiceMonitor target capability, NetworkPolicy review,
StatefulSet/headless-Service runtime risk, chart deprecation review,
raw/template extension-slot review, Helm equivalence receipts, and
deterministic `cub install` package/setup proof.

The nineteenth such promotion is Consul, completing the 20-chart milestone. It
adds the repeatable pattern for a service-mesh/control-plane chart: source and
empty dependency locks, `default-control-plane` and
`secure-mesh-existing-secrets` variants, 28 rendered CRDs, cluster RBAC,
injector admission webhooks, TLS/ACL/gossip target Secret binding, gateway
topology, UI ingress, lifecycle Job policy, rendered Secret ownership,
StatefulSet/storage policy, raw/template extension-slot review, Helm
equivalence receipts, and deterministic `cub install` package/setup proof.

## Installer Boundary

This repo does not implement `confighub/installer`. For now, `helm-expt`
defines the public-chart proof contracts, schemas, examples, readiness cards,
and verifier behavior.

Installer-facing runtime concepts should stay small:

```text
Package with Helm source metadata
Variant as named inputs/selection
Render receipt with manifest-set digest and provenance
```

Catalog/proof concepts such as Chart Readiness Plans, Chart Operating Notes,
control-point summaries, and top-N spreadsheets live in `helm-expt` unless and
until the installer or ConfigHub Server needs a first-class runtime object.

## Helm Plan and Dossier Artifacts

Add two maintained artifacts to keep the plan executable and chart knowledge
durable:

```text
Process: HelmPlan
Knowledge: ChartDossier
Proof: Receipts
```

### HelmPlan

`HelmPlan` is the canonical checklist and work plan every chart follows
on the journey from upstream chart to live deployment.

Publicly, present this as a **Chart Readiness Plan**. The first view must be
clear, not audit-shaped:

```text
Chart: bitnami/redis 25.5.3
Status: ready with controls
Variants: default, reuse-existing-secret, HA
Objects: 14
Helm match: 14/14, plus explained ConfigHub support object
Scan: pass with warnings
Publish: ready for ConfigHub OCI
Risks handled: generated password, StatefulSet/PVC, secret separation
Needs decision: none
Proof: render receipt, equivalence receipt, scan receipt
```

Rule:

```text
First screen: Can I use this safely?
Second screen: Why?
Third screen: Raw receipts.
```

It must be both human-readable and machine-executable enough to drive:

- a future chart-analysis UX
- `cub install plan ...`
- repo scripts and CI checks
- ConfigHub GUI/porcelain journeys
- AI/council instructions
- optional future workflow or skill surfaces

Canonical journey stages:

| Stage | Purpose | Typical proof |
| --- | --- | --- |
| Source lock | Pin chart bytes and provenance. | `SourceLock` |
| Dependency lock | Pin subcharts, library charts, and remote repos. | `DependencyLock` |
| Recipe import | Create reusable cub installer recipe/package mapping. | import receipt |
| Control-point classification | Explain Helm weirdness before install. | `ControlPoints` |
| Chart dossier update | Preserve maintained chart-specific knowledge. | `ChartDossier` revision |
| Variant catalog | Define bounded install shapes. | `Variant` records |
| Render context selection | Bind values, overlays, facts, capability profile, phase. | render context receipt |
| Variant revision render | Produce exact rendered object set. | `VariantRevision`, render receipt |
| Helm equivalence check | Compare regular Helm output to `cub install` output. | equivalence receipt |
| Output correctness checks | Validate schema, graph, intent, policies, scans. | scan/check receipts |
| Install gate | Decide whether exact revision can apply. | `InstallGate` |
| ConfigHub upload | Store Units, attributes, labels, receipts. | upload/operation receipt |
| Apply/deploy | Apply approved revision to target. | apply receipt |
| Observe freshness | Record observed live/applied state. | `ObservationReceipt` |
| Upgrade/rollback readiness | Prove safe propagation and scoped rollback. | upgrade/rollback plan receipts |

The Helm plan is the thing a checklist, script, ConfigHub GUI, or AI agent
executes. It should not be invented separately for each chart.

### ChartDossier

`ChartDossier` is the maintained per-chart memory. It records chart-specific
weirdness and operating knowledge that remains useful across revisions and
deployments.

Example location:

```text
recipes/bitnami/redis/25.5.3/chart-dossier.yaml
```

It should capture:

- lookup behavior and target fact requirements
- generated passwords, certs, random/time behavior, and secret policy
- required values, dead-value traps, and known unsafe values
- hooks, tests, lifecycle phases, and unsupported procedures
- CRDs, webhooks, APIService, RBAC, namespace, and cluster-scope concerns
- `tpl`, raw manifest slots, post-renderers, and extension policy
- umbrella/subchart value propagation and library chart influence
- upgrade, downgrade, rollback, PVC, and CRD gotchas
- recommended variants and render contexts
- known scan exceptions, policy findings, and operator notes
- upstream chart notes such as `NOTES.txt` instructions

The dossier is not a receipt. A receipt proves one operation or revision. The
dossier is maintained knowledge about the chart.

### Helm Pain Absorption

Ideally all detected Helm weirdness is absorbed into the ConfigHub model before
a production-ready deployment manifest is published. "Absorbed" does not always
mean "put in the recipe"; it means the weirdness has a named home, a policy, a
status, and proof.

The recipe should absorb as much chart behavior as possible: structure,
validation, defaults, control points, extension slots, target fact
requirements, and reusable policies. Weirdness that depends on the install
shape, target fact values, operation, scanner, or live observation should be
absorbed by later ConfigHub model elements instead of left as informal notes.

If a pain point cannot be absorbed into any model element, it is not acceptable
to silently continue. It becomes an operator decision, an explicit unknown, or a
blocker.

| Helm pain | ConfigHub home | If not absorbed |
| --- | --- | --- |
| Source drift | `SourceLock` / dependency lock | block until pinned |
| Missing or ignored values | recipe validation and `ValueModel` | warning plus render-diff proof requirement |
| `required` / `fail` | recipe validation | block invalid variant |
| `tpl` | recipe extension slot with policy | operator decision or reject |
| Raw/extra manifests | explicit recipe extension slot | scan/gate or disable |
| `lookup` | recipe-declared target fact requirement | bind target fact values, render synthetic variants, or fail |
| Random password/cert/time | generated fact or secret handle policy | generate once before render or block |
| `.Capabilities` branching | named capability profile | require render-context selection |
| Hooks/tests | lifecycle/test policy | operator decision or unsupported blocker |
| CRDs/webhooks/RBAC | operate policy and scan/gate rules | install phase gate |
| Mutable image tags | image digest resolution policy | warning or gate |
| Scanner DB/policy drift | scan receipt policy | rescan required |
| Admission behavior | target admission/dry-run receipt | target gate or block |
| Live state | observation receipt policy | stale/unknown until observed |

The `HelmPlan` should report every detected pain point and its disposition:

```text
absorbed-into-recipe
absorbed-into-recipe-target-facts
absorbed-into-value-model
handled-by-variant
handled-by-target-fact-values
handled-by-generated-facts
handled-by-capability-profile
handled-by-lifecycle-policy
handled-by-scan-or-gate
handled-by-admission-check
handled-by-observation
needs-operator-decision
blocked
unknown
```

This is the answer to "Helm hides too much": ConfigHub does not pretend Helm is
clean. It reports every detected pain point, shows where it was absorbed or
handled, and links the outcome to artifacts and receipts. A production-ready
deployment manifest is publishable only when the `HelmPlan` has no unhandled
pain points.

## Repos and Roles

| Repo / system | Role |
| --- | --- |
| `confighub/installer` | Implementation substrate for `cub install`: packages, `installer.yaml`, Kustomize bases/components, inputs, selection, facts, function chains, validators, dependency locks, OCI artifacts, sign/verify, render/upload/day-2 lifecycle. |
| `confighub/helm-expt` | Current public GitHub catalog/proof surface: Redis end-to-end proof, top-500 control-point matrix, example schemas, HelmPlans, dossiers, receipts, rendered objects, scan/gate examples, and reproducible scripts. |
| ConfigHub Server | Workerless system of record for recipes, variants, variant revisions, target assignments, desired state, operation records, receipts, approvals, initiatives, scan/gate result aggregation, and the OCI endpoint used by the fast install path. |
| `cub-scout` / external observers | Live observation receipts with observer, method, timestamp, result, and freshness. |

## Defaults

Working folder:

```text
/Users/alexis/code/helm-expt
```

Default ConfigHub organization for demos and proofs:

```text
ConfigHub Helm
```

Do not use `ConfighubOps` for this project. That org is for internal
operations/infrastructure, not Helm demos, proofs, Redis examples, top-500
evidence, or installer experiments.

## Execution Rule

Every step in the product flow must be executable through `cub` CLI, ConfigHub
Server UI/API, or an external observer integration.

No step should require a hand-maintained spreadsheet, a Slack instruction, or
an undocumented CI script.

This is the target execution contract. The current executable installer CLI
includes real subcommands such as `cub install setup`, `cub install upload`,
`cub install plan`, `cub install package`, `cub install push`,
`cub install pull`, `cub install doc`, `cub install render`,
`cub install wizard`, `cub install vet`, and `cub install verify`. Shorter
phrases such as `cub install redis`, `cub diff redis`, `cub publish redis`,
and `cub variant redis ha` are candidate future porcelain verbs only until
those commands exist. If the short UX is needed, propose those verbs
deliberately as Cub plugins/extensions; do not write them as current executable
docs.

As of May 27, 2026, `cub variant create <variant-name> <upstream-space>` is a
real ConfigHub server-side command. It clones an upstream space and its units
into a downstream space, stamps the `Variant` label, can set environment,
region, target, space metadata, and unit gates, and preserves links to the
upstream units. This is the post-upload/server-side variant layer.

We expect users of `cub install` recipes to use ConfigHub server-side variants
when that is simpler and safer than making another package base. The decision
rule is:

```text
Use recipe/package variants when a Helm render input changes the object set.
Use cub variant create when a reviewed ConfigHub space should be cloned and
varied by target, environment, region, metadata, gates, or post-clone actions.
```

In other words, server-side variants do not replace Helm-derived recipe
variants; they sit above them and should be preferred for downstream
operational variation when no new Helm render is needed.

The upstream installer docs usually show the standalone binary name
`installer`. In this repo, those commands are written as `cub install ...`
because the installer is used through the Cub plugin.
The important rule is that every durable input, decision, output, and
observation is produced by one of the supported surfaces and leaves a receipt
or addressable artifact.

| Flow step | Primary execution surface | Durable output |
| --- | --- | --- |
| Resolve chart source | `cub` / installer | `SourceLock`, chart digest |
| Resolve chart dependencies | `cub` / installer | `DependencyLock` |
| Import chart to recipe | `cub` / installer | `Recipe` |
| Classify Helm complexity | `cub` / installer | `ControlPoints` |
| Create/edit install variant | `cub` or ConfigHub Server UI/API | `Variant` |
| Provide overlays, values, umbrella selections, or Kustomize pieces | `cub` or ConfigHub Server UI/API | explicit variant inputs / extension slots |
| Bind capability profile and target/generated fact values | `cub`, installer collectors, ConfigHub Server UI/API, or observer integration | fact profiles / fact receipts satisfying recipe requirements |
| Render exact objects | `cub` / installer | `VariantRevision`, `RenderedReleaseObjects`, `RenderReceipt` |
| Scan rendered objects | `cub` function chain, CI, or ConfigHub initiative | `ScanReceipt` |
| Gate install | `cub` or ConfigHub Server UI/API | `InstallGate` |
| Approve/promote revision | ConfigHub Server UI/API or `cub` | approval / promotion receipt |
| Publish revision | `cub`, ConfigHub OCI endpoint, GitOps handoff, or CI/CD | OCI artifact receipt |
| Direct apply revision | `cub` or CI/CD, for local/test paths | apply operation receipt |
| Observe live/applied state | `cub-scout`, GitOps report, CI/CD, customer observer, or human-triggered `cub` | `ObservationReceipt` with freshness |

## Happy Path UX

The default Redis demo should feel like three short user actions:

```text
install
review/plan
publish
```

This is the most important proof requirement. ConfigHub must feel simpler and
more valuable than plain Helm before the user learns the deeper object model.

The visible experience should be:

```text
install
review/diff
publish to ConfigHub OCI for GitOps pickup
```

The current executable Redis proof uses the real installer surface:

```sh
cub install setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir <work> --non-interactive --namespace redis
cub install setup --pull packages/bitnami/redis/25.5.3 --base reuse-existing-secret --work-dir <work> --non-interactive --namespace redis
cub install package packages/bitnami/redis/25.5.3 -o <tmp>/bitnami-redis-25.5.3.tgz
```

Shorter porcelain may be proposed later, but current executable docs must use
real `cub install` commands until those verbs exist.

The hidden work should be automatic:

```text
lock source
build/update recipe
classify Helm pain
render exact objects
compare to Helm where relevant
scan/gate
write receipts
publish through ConfigHub OCI by default
```

Acceptance rule:

```text
No happy-path demo may require the user to understand every artifact in order
to get value. Artifacts explain and prove the result after the simple command
works.
```

Non-negotiable product rule:

```text
Users will not adopt this if it appears harder than Helm, riskier than Helm,
or wrong compared with Helm.
```

The proof must therefore show three things on the happy path:

| Requirement | What the user sees |
| --- | --- |
| Easier than Helm | fewer decisions before a useful install/review result |
| Safer than Helm | exact rendered objects, scan/gate status, receipts, and a safe next action |
| Correct versus Helm | Helm-equivalent output where expected, with every intentional difference explained |

The install action should do the boring work automatically:

```text
resolve source
create/update recipe
create default install variant
render immutable variant revision
scan exact rendered objects
prepare Verified Install Gate
write receipts
```

The publish action should:

```text
publish the approved rendered revision through ConfigHub's OCI endpoint
write OCI artifact receipt
preserve ConfigHub identity and proof links for GitOps pickup
```

A direct apply action may exist for local kind tests, CI smoke tests, or
customers who explicitly choose direct apply. It is not the default public
handoff story.

The detailed subcommands may exist for advanced users and CI, but the happy path
must not require eight visible steps.

## Compensating Guardrails

These rules compensate for the ways the plan can accidentally become "Helm,
but with more ceremony":

1. **Prove easier, safer, correct UX first.** The first screen and first command
   must feel easier than Helm, safer than Helm, and correct versus Helm. Any
   added proof must appear automatically rather than becoming user homework.
2. **Prove simple UX first.** The first screen and first command must deliver
   obvious value: exact rendered objects, diff/review, scan/gate status, and
   next action. The deeper receipts and control points are proof on demand.
3. **Expose the short path first.** Install, review/plan, and publish are the
   default user experience. Source locks, control points, variant revisions,
   scans, and receipts appear automatically as proof. Future Cub porcelain
   verbs may be proposed as plugins/extensions, but do not document shorthand
   as executable CLI until it exists.
4. **Keep the recipe/variant boundary hard.** One chart version normally creates
   one core recipe. Install shapes become variants. Rendered outputs become
   immutable variant revisions.
5. **Present object sets as deployments.** ConfigHub may store many Units, but
   the UI and docs should lead with `Redis/default`, then show the Kubernetes
   objects underneath.
6. **Use labels, attributes, and receipts for different jobs.** Labels identify
   and group. Attributes expose queryable facts from rendered objects. Receipts
   prove source, render, scan, apply, and observe events.
7. **Keep variant count bounded.** Curate meaningful install variants such as
   `default`, `ha`, `tls`, `reuse-existing-secret`, and `restricted`. Do not turn
   every possible values permutation into a named variant.
8. **Make Helm weirdness explicit.** `lookup`, hooks, generated values,
   `.Capabilities`, `tpl`, CRDs, raw manifests, post-renderers, and umbrella
   value propagation must map to control points or blockers.
9. **Treat Secrets as a policy boundary.** Secret material should be separated
   by default. Receipts record secret shape, handling policy, and apply outcome
   without casually uploading secret values.
10. **Scan exact rendered object sets.** Scan receipts must bind scanner version,
   policy bundle or database version, target manifest digest, and result.
11. **Keep live truth receipt-based.** ConfigHub Server stores desired state and
   submitted receipts. It does not imply fresh live state without a current
   observation receipt.
12. **Prove Helm equivalence first.** For every Helm-derived proof, compare
    regular Helm output to `cub install` output and classify every difference.

## First-Two-Problems Coverage

The attached "first two problems" note says the missing object is always:

```text
managed variant + known operation + proof
```

Problem 1 / 1b is "install config correctly". The Helm proof must therefore
show:

- exact rendered Kubernetes objects, not just values files
- dead or ignored values detected where possible
- regular Helm output compared to `cub install` output
- source/dependency locks and importer receipts
- explicit handling for generated facts, recipe-declared target fact
  requirements, bound target fact values, capabilities, hooks, CRDs, Secrets,
  raw manifests, and post-renderers
- rendered-manifest policy and misconfiguration scans
- a reviewable receipt for what was rendered, scanned, gated, and applied
- export or handoff paths for existing GitOps tools without losing receipts

Problem 2 is "manage related variants as apps and constraints change". The Helm
proof must therefore show:

- variant families, not independent environment files
- base update propagation from a chart/recipe change into affected variants
- local deltas preserved or flagged during upgrades
- promotion of an approved variant revision without re-rendering
- operation receipts for install, upgrade, promote, remediate, and rollback
- target assignment and freshness-aware observation receipts
- rollback scoped to a variant revision and target, not a broad Git revert

Current Redis proof covers the happy-path object-set story and an easy variant.
The next proof increments must cover ignored values, scan receipts, upgrade
conflict detection, scoped rollback, and intended/applied/observed receipts.

## Known Gaps and Mitigations

The first Redis proof is not enough by itself. Treat these as acceptance checks
for the next proof increments:

| Missing piece | Why it matters | Mitigation in the plan |
| --- | --- | --- |
| Real recipe artifacts | Archived render-and-vendor examples do not prove the new model. | Create `recipes/bitnami/redis/25.5.3/` with `Recipe`, locks, control points, variants, revisions, receipts, scans, gates, and installer package proof. |
| Dead or ignored values | Helm can accept a values file while silently ignoring the user's intended path. | Add recipe validation, values-schema extraction, unknown/dead-key checks where detectable, and render-diff proof that intended values affected output. |
| Field provenance | Users need to know which input created a rendered field. | Store recipe/variant input provenance and derived attributes for rendered object facts. |
| Scan receipts and install gates | Scans are only trustworthy if bound to the exact rendered object set. | Run scans against rendered manifest digests and store `ScanReceipt` plus `InstallGate`. |
| Upgrade propagation | Vendor chart updates can break only some variants. | Simulate old chart plus local deltas to new chart; flag auto-merge, conflict, and review-required variants. |
| Scoped rollback | Git revert or Helm rollback can pull unrelated changes. | Roll back by variant revision and target assignment, with an operation receipt. |
| Intended/applied/live freshness | Workerless ConfigHub cannot imply live truth. | Store intended state, apply receipts, and external observation receipts with observer, method, timestamp, and freshness. |
| GitOps handoff | Users should not have to abandon Argo CD, Flux, Git, OCI, or YAML. | Emit handoff artifacts while preserving ConfigHub variant/revision/receipt identity. |
| Field ownership conflicts | Helm, GitOps controllers, operators, and ConfigHub edits can fight over fields. | Add ownership/conflict checks to operate/reconcile policy, separate intended/applied/observed diffs. |
| CRD and hook lifecycle | CRDs and hooks are procedural and cluster-impacting. | Map CRDs to phase/ownership/schema policy; map hooks to test actions, install phases, or unsupported blockers. |

This list is not the full edge-case universe. The broader watchlist remains:

- Helm notes and operator instructions.
- Image digest resolution for mutable tags.
- Scanner database and policy-bundle drift.
- CRD-schema validation and admission-controller dry-run failures.
- Secret-shape validation without leaking secret material.
- Cross-resource reference graph checks.
- Umbrella chart subvalue propagation.
- Library chart representation.
- Post-renderer and plugin pinning.
- Remote/generated values capture or rejection.
- Namespace and cluster-scope collisions.
- Registry availability and mirroring.
- Operator override governance for `tpl` and raw manifest slots.
- Receipt UX that normal Helm users can actually read.

## Current Analysis Snapshot

Current doctrine captured in the repo:

- The README should open with the sales pitch and core doctrine: Helm produces
  objects, ConfigHub records exact variant revisions and receipts.
- The canonical model is `Chart -> Recipe -> Variant -> VariantRevision ->
  Deployment -> Receipt`.
- The happy path must stay short while receipts, scans, locks, and control
  points are generated as proof.
- Most Helm pain should be absorbed into the recipe, including target fact
  requirements. Residual pain must stay explicit in `HelmPlan` as target fact
  values, generated facts, variant choices, lifecycle policy, gates,
  observations, operator decisions, or blockers.
- The ten missing pieces are now tracked as acceptance checks with mitigations,
  not left as loose concerns.
- Output correctness is layered: source lock, Helm equivalence, variant intent,
  Kubernetes validity, object graph, policy/misconfig scans, target admission,
  apply receipt, and live observation freshness.
- Complete chart analysis requires richer internal representations than the
  spreadsheet: `HelmPlan`, `ChartDossier`, `ChartSource`,
  `DependencyClosure`, `TemplateFeatureIndex`, `ValueModel`,
  `ControlPointPlan`, `SuggestedVariantCatalog`, `RenderContextSet`,
  `RenderedObjectInventory`, `AttributeFacts`, and `Receipts`.

Legacy top-500 evidence summary:

```text
500 requested
495 scanned
5 failed
159 P0 including source failures
165 P1
174 P2
2 P3
```

Notable scanned-chart feature counts:

```text
lookup: 244
generated/random/time/cert facts: 282
capabilities: 375
tpl: 362
raw/extra manifest knobs: 254
hooks: 54
CRDs: 131
cluster RBAC: 250
webhooks: 77
notes files: 430
```

This old spreadsheet is retained as design input only. The current plan requires
new generated spreadsheets sourced from new chart proof artifacts and receipts.
In light of the new doctrine, the new spreadsheet should become a
proof/workflow surface with:

```text
Summary
Chart Analysis
Control Points
Proof Readiness
Failures
```

## Easy Variant UX

Default to HA:

```text
create HA variant
review diff against default
publish approved HA revision
```

Reuse existing secret:

```text
create reuse-existing-secret variant
bind redis-password fact or secret handle
publish approved reuse-existing-secret revision
```

The point is not "better values files". The point is:

```text
create named install variant
render exact objects
compare to another variant/revision
scan/gate
publish/promote approved revision
```

## First Detailed Proof

Use `bitnami/redis` as the first complete, usable proof of concept.

Redis is small enough to demo, but rich enough to prove:

- Generated passwords/secrets.
- Stateful/PVC behavior.
- Default vs HA variants.
- Reuse existing secret vs generated secret.
- Capability/profile checks.
- Bitnami-style chart complexity.
- Realistic production knobs.
- Obvious user value.

Target Redis artifacts:

```text
recipes/bitnami/redis/25.5.3/
  README.md
  helm-plan.yaml
  chart-dossier.yaml
  recipe.yaml
  source-lock.yaml
  dependency-lock.yaml
  control-points.yaml
  value-model.yaml
  effective-values.yaml
  effective-values-reuse-existing-secret.yaml
  diffs/default-to-reuse-existing-secret.yaml
  publication/installer-package-receipt.yaml

  variants/
    default/variant.yaml
    reuse-existing-secret/variant.yaml

  revisions/
    default/r001/
      variant-revision.yaml
      rendered/release-objects.yaml
      render-receipt.yaml
      scan-receipt.yaml
      install-gate.yaml

    reuse-existing-secret/r001/
      variant-revision.yaml
      rendered/release-objects.yaml
      render-receipt.yaml
      scan-receipt.yaml
      install-gate.yaml

packages/bitnami/redis/25.5.3/
  installer.yaml
  bases/default/upstream.yaml
  bases/reuse-existing-secret/upstream.yaml
```

The `ha` variant is a later Redis slice, not a blocker for the first
two-variant proof.

## New Spreadsheet and Matrix Evidence

The old top-500 matrix stays in the background as design input only. It is not
on the main execution pathway.

The new matrix work has a different job:

```text
show that new chart repos can move through the HelmPlan journey and produce
traceable recipe, variant, revision, scan, gate, and receipt evidence
```

Target files:

```text
data/top500/
  chart-corpus-lock.yaml
  raw-feature-scan.json
  control-point-summary.csv
  helm-top500-control-point-matrix.xlsx
  proof-readiness.csv
  methodology.md
```

The generated summary should answer:

- Core recipe viable?
- Base/install variants needed?
- Primary control point?
- Secondary control point?
- Can bulk scan rendered variants?
- Install readiness?
- Which underlying artifact/receipt proves the answer?

It should not lead with ten intimidating feature columns.

In light of the recipe/variant/revision doctrine, the spreadsheet should be
treated as a source-feature scan, not a proof of product flow. It should evolve
toward a small executive summary plus drill-down sheets:

| Sheet | Purpose |
| --- | --- |
| `Summary` | Counts by recipe viability, control-point class, and install readiness. |
| `Chart Analysis` | One row per chart with source lock status, recipe viability, primary/secondary control points, suggested variants, and next action. |
| `Control Points` | Drill-down evidence for lookup, generated facts, capabilities, hooks, tpl, raw manifests, CRDs, RBAC, webhooks, dependencies, and lifecycle issues. |
| `Proof Readiness` | Which charts have recipe artifacts, variants, rendered revisions, scans, gates, and receipts. |
| `Failures` | Source acquisition or malformed chart failures. |

Recommended headline columns:

```text
rank
chart
version
source_status
core_recipe_viability
suggested_variants
primary_control_point
secondary_control_points
bulk_scan_readiness
install_readiness
proof_readiness
next_action
```

The long feature matrix can remain as a drill-down tab, but it should not be the
first thing a skeptical Helm user sees.

### Spreadsheet-as-Proof Doctrine

The spreadsheet is not proof by itself. It becomes useful proof only when it is
a generated, reproducible index over underlying evidence.

```text
Spreadsheet = proof index / evidence map.
Receipts and artifacts = proof.
```

For the top-500 work, every summary cell or chart row should be traceable back
to raw scan data, chart source metadata, control-point evidence, and eventually
recipe/variant/revision receipts.

Spreadsheet quality rules:

- The first tab should tell the executive story: viability, control points,
  proof readiness, and next action.
- Drill-down tabs may be wide and technical, but each column must map to a
  named control point or proof-readiness check.
- Generated counts must be reproducible from raw JSON or receipt artifacts.
- Rows should distinguish `source-feature scan`, `recipe candidate exists`,
  `variant revisions rendered`, `scans/gates passed`, and `live observed`.
- A green row must never mean "this chart is safe" unless the exact rendered
  variants were scanned/gated and the result is linked to receipts.
- The sheet should be a work queue as well as evidence: each chart needs an
  owner/status/next-action path through `HelmPlan`.

## Complete Chart Analysis

A complete chart analysis should be easy for a user to request, but the current
`cub install` plugin does not have a chart-analysis command. Until it does, the
executable proof should use repo scripts and real installer subcommands, then
produce the same human-readable explanation plus machine-readable artifacts. To
make that possible, keep richer internal representations than the spreadsheet
shows:

- `HelmPlan`: canonical checklist/work plan stages, status, owner,
  detected pain points, mitigation disposition, evidence links, and next
  action.
- `ChartDossier`: durable maintained notes about chart-specific weirdness and
  operating knowledge.
- `ChartSource`: chart ref, archive digest, repository, signature/provenance.
- `DependencyClosure`: subcharts, library charts, locks, remote repos, digests.
- `TemplateFeatureIndex`: lookup, generated functions, capabilities, hooks,
  tpl, raw manifest slots, notes, post-renderers, `.Files.Get`.
- `ValueModel`: values files, values schema, known paths, unknown/dead paths
  where detectable, subchart value propagation.
- `ControlPointPlan`: each risky feature mapped to source lock, recipe
  validation, recipe-declared target fact requirements, generated facts,
  capability profile, lifecycle policy, scan, gate, or blocker.
- `SuggestedVariantCatalog`: default, HA, TLS, reuse-existing-secret, restricted,
  cloud/provider, and upgrade/fresh-install variants where appropriate.
- `RenderContextSet`: named capability profiles, target fact values that
  satisfy recipe requirements, generated facts, release name, namespace,
  install/upgrade phase.
- `RenderedObjectInventory`: resource IDs, kinds, namespaces, images, replicas,
  PVCs, RBAC, CRDs, webhooks, Services, Secrets, owner/reference graph.
- `AttributeFacts`: queryable facts extracted from rendered objects.
- `Receipts`: source, import, render, scan, gate, apply, and observation
  receipts with digest bindings.

The spreadsheet should be generated from these internal representations, not be
the internal representation itself.

## Removed Legacy Top-20 Archive

The old top-20 render-and-vendor archive proved an earlier compatibility path,
but it is not on the main pathway for executing this plan and has been removed
from the active tree. Current proof must come from `recipes/`, `packages/`,
rendered revision receipts, scan/gate receipts, catalog status, and generated
review outputs.

## Control Points

Every Helm complexity should map to a control point:

| Helm complexity | Control point |
| --- | --- |
| Mutable chart source | Source lock / digest / signature |
| Chart dependencies | Dependency lock |
| `lookup` | Recipe-declared target fact requirements plus bound target fact values |
| Random/cert/time/password functions | Generated facts or secret handles |
| `.Capabilities.*` | Named capability profile |
| `required` / `fail` | Recipe validation |
| Hooks | Lifecycle policy: test hook, install phase, or unsupported |
| `tpl` | Explicit extension slot or reject |
| Raw/extra manifests | Explicit extension slot plus scans |
| CRDs/webhooks/APIService/RBAC | Operate policy and rendered-object scans |
| Mutable image tags | Optional image digest resolution receipt |
| Scanner DB/policy drift | Scanner/policy bundle receipt |
| Live cluster truth | External observation receipt with freshness |

Control-point categories are canonical. The evidence inside them is
chart-specific, and the proof outcome is revision-specific.

```text
Canonical doctrine -> chart-specific findings -> revision-specific proof
```

Metadata rule:

```text
Control points are the questions.
Labels help find the affected recipes, variants, and revisions.
Attributes expose the rendered-object facts.
Receipts prove how each question was answered.
```

Examples:

| Control point | Label guidance | Attribute guidance | Receipt / gate |
| --- | --- | --- | --- |
| Source lock | `SourceType=HelmChart`, `HelmChart=bitnami-redis`, `ChartVersion=25.5.3` | chart ref, chart digest, repository, app version | `SourceLock` / import receipt |
| Recipe import | `ImportMode=symbolic` or `ImportMode=render-and-vendor` | importer version, import policy, extracted chart features | import receipt |
| Target fact requirements | `NeedsTargetFacts=true` only when useful for filtering | recipe-required facts such as `lookup Secret redis` or CRD/API presence; bound values live in render context | target fact profile receipt |
| Generated facts | `SecretPolicy=separated` or `GeneratedFacts=required` | generated fact refs/counts, secret refs, cert refs | generated fact receipt / render receipt |
| Capability profile | `CapabilityProfile=k8s-1.30` | kube version and API versions used | render receipt binds profile digest |
| Variant revision | `Component=Redis`, `Variant=default`, `VariantKind=base` | replicas, images, namespaces, resource kinds, PVC facts, RBAC facts | `VariantRevision` and render receipt |
| Lifecycle policy | `HookPolicy=no-hooks` or `HookPolicy=tests-only` | hook count and hook types | lifecycle/gate receipt |
| Rendered scan | optional `ScanStatus=pass/warn/fail` for filtering | finding counts and policy facts | scan receipt bound to manifest digest |
| Observation | `LiveCluster=kind-demo-roundtrip` only for demo grouping | observed status and freshness | observation receipt |

Do not encode proof as labels. Do not encode rendered-manifest facts manually as
labels. Labels are navigation; attributes are analysis; receipts are trust.

## Workerless Server Rule

ConfigHub Server stores desired/config truth and submitted receipts.

It does not claim fresh runtime truth unless a current observation receipt says
so.

Example UI language:

```text
Observed by cub-scout 4m ago.
Argo report 17m old.
No runtime receipt yet.
```

## Target Runnable Examples

The proof repo should eventually expose runnable examples like:

```sh
npm run redis:proof
npm run top500:summary
npm run verify
```

`redis:proof` should generate or verify the Redis recipe candidate, variants,
variant revisions, rendered release objects, scan receipt, and install gate.

`top500:summary` should regenerate the control-point summary from raw scan data.

`verify` should verify hashes and references for receipts and fail on missing or
changed content.

## Legacy Reference Redis Demo

`docs/old-cub-helm-model.md` retains a legacy reference script that uses real
`cub install` commands from `confighub/installer`, not target command names.

This path is retained for reference only:

```sh
go install sigs.k8s.io/kustomize/kustomize/v5@v5.8.1
export PATH="$PATH:$(go env GOPATH)/bin"
cub plugin install confighub/installer --source-repo --name install --force
make -C ~/.confighub/plugins/install build
cub install doc ./packages/bitnami/redis/25.5.3
cub install setup \
  --pull ./packages/bitnami/redis/25.5.3 \
  --work-dir /tmp/confighub-helm-redis \
  --non-interactive \
  --namespace redis
npm run redis:compare
cub install upload \
  --work-dir /tmp/confighub-helm-redis \
  --space helm-redis-proof \
  --component Redis \
  --environment Demo \
  --variant default
```

This demo proves the current Redis `cub install` compatibility path:

```text
Helm render
  -> Redis installer package
  -> installer.yaml package
  -> cub install setup
  -> exact rendered Kubernetes objects
  -> ConfigHub package/OCI publication path
  -> ConfigHub Units, revisions, and diffs
```

The older direct `cub helm install` concept is preserved in
`docs/old-cub-helm-model.md` as background only.

The current proof must be built from new chart repos and new artifacts under
the planned recipe/variant/revision model. Do not use this legacy demo as the
acceptance standard for the current plan.

## Helm Equivalence Doctrine

Every Helm-derived proof must investigate 100% of the rendered manifests and
installed ConfigHub configs against the equivalent regular Helm output.

Known-good deterministic cases must prove:

- Regular Helm renders from captured inputs.
- The Helm render matches the recorded import receipt.
- `cub install setup` preserves every Helm object.
- Any installer normalization is semantic-only, not object-changing.
- Secret handling is explicit and verified.
- Installer-added support objects are listed and justified.
- After `cub install upload`, ConfigHub Units match the local installer output.

Other paths must not be waved through. They need a diff/risk classification:

```text
OK: semantic YAML normalization only
OK: intentional installer support object
Needs control point: generated fact, target fact requirement, capability profile, hook policy
Needs operator decision: Secret handling, raw manifest slot, lifecycle action
Blocked: source drift, unresolved renderer/plugin, unsafe nondeterminism
```

This is the trust story for Helm users: use regular Helm as the reference
renderer where it is deterministic, then make every ConfigHub difference
visible, classified, and auditable.

## Output Correctness Doctrine

Within reason, every output should be checkable. "Correct" must be split into
several checks rather than treated as one vague claim:

| Correctness layer | Question | Check |
| --- | --- | --- |
| Source correctness | Did we render the intended chart bytes and dependency closure? | source lock, dependency lock, digest verification |
| Helm equivalence | Did `cub install` preserve regular Helm output? | object inventory comparison and semantic YAML diff |
| Variant intent | Did the chosen values, facts, overlays, and policies produce the intended fields? | values validation, dead-key checks, field provenance, variant diff |
| Kubernetes validity | Are the rendered objects valid for the selected API profile? | kubeconform/schema validation, CRD schema sources, capability profile |
| Object graph | Do references resolve within the set or to declared external facts? | ConfigHub links, Secret/PVC/ServiceAccount/IngressClass/RBAC graph checks |
| Policy/misconfig | Does the exact rendered manifest set pass policy? | Trivy/Snyk/Kubescape/Checkov/ConfigHub scans bound to manifest digest |
| Target admission | Would the target cluster accept it? | optional server-side dry-run/admission check with target receipt |
| Apply result | Did the selected revision get applied? | apply operation receipt |
| Live observation | Is it still true now? | external observation receipt with freshness |

We cannot prove every runtime behavior statically. Controllers mutate objects,
cloud services fail, admission policies vary, images move unless pinned, and
observations go stale. The doctrine is to classify what was checked, bind it to
the exact variant revision, and make unchecked or stale claims visible.

## Corpus Boundary Doctrine

Over time, ConfigHub should build a long-lived corpus of high-value config
evidence for matrix comparisons across:

- vendor chart versions
- upstream project/app versions
- Kubernetes versions and capability profiles
- install addons and optional components
- values options, overlays, edits, and organization policies
- rendered manifests, scans, gates, diffs, and outcomes

That corpus is product data, not a public repo artifact.

The public `helm-expt` repo may contain:

- methodology
- schemas
- redacted examples
- open-source chart examples
- synthetic examples
- scripts that prove the comparison approach

The public repo must not contain:

- customer configs
- secrets or secret-derived material
- private environment facts
- private policy results
- proprietary corpus rows
- non-public roadmap or packaging details

Public docs should describe the doctrine and the controls, not expose the
protected corpus itself.

## Agreed Target Artifacts

Minimum Redis proof artifacts:

- `HelmPlan`.
- `ChartDossier`.
- `Recipe`.
- `SourceLock`.
- `DependencyLock`.
- `ControlPoints`.
- `Variant`.
- `VariantRevision`.
- `RenderedReleaseObjects`.
- `HelmEquivalenceReceipt`.
- `RenderReceipt`.
- `ScanReceipt`.
- `InstallGate`.
- `InstallerPackage`.
- `InstallerPackageReceipt`.
- `ObservationReceipt` when a live target is involved.

Minimum new top-500 artifacts:

- Corpus/source lock.
- Raw source feature scan generated by the new pipeline.
- Human-friendly summary.
- Spreadsheet-as-proof index with `Summary`, `Chart Analysis`,
  `Control Points`, `Proof Readiness`, and `Failures`.
- Control-point matrix drill-down.
- Methodology note.

Minimum docs:

- 60-second skeptical engineer walkthrough.
- Happy path.
- Easy variants.
- Control points.
- Workerless observation boundary.
- What this repo proves today vs what it does not prove yet.

## Current Agreement

1. Redis is the first detailed, usable proof of concept.
2. The old top-500 matrix stays as background design input only.
3. The implementation should extend `confighub/installer`.
4. The happy path should be `cub`-first and simple.
5. ConfigHub variants are the product spine.
6. Variant revision is the object users approve, scan, promote, deploy, and roll back.
7. ConfigHub Server is workerless and does not claim fresh live truth without external observation receipts.
8. External observers can participate, but should not make the happy path feel heavy.
9. The old top-20 render-and-vendor payload is removed from the active tree; current proof lives in recipes, packages, receipts, and generated reviews.
10. Every maintained chart needs a `HelmPlan` and `ChartDossier`.
11. The new top-20 milestone is 20 full chart proofs. The top-20 spreadsheet
    must be a generated evidence map over those proofs, not a substitute for
    them.
12. The new top-100/top-500 spreadsheets must be generated proof
    indexes / evidence maps, not proof by themselves.
13. The P0 gates in `docs/issue-backlog.md` must be complete or deliberately
    reclassified before claiming credible 20/100/500 chart proof.
14. The target proof is:

```text
Helm complexity
  -> explicit ConfigHub control point
  -> deterministic variant revision
  -> scanned/gated rendered objects
```
