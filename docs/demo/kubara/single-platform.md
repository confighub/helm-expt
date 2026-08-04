# Adopt Kubara with ConfigHub: a reproducible four-cluster mini-IDP

**ConfigHub simplifies Kubara without making it fundamentally different.** This
primary example uses Kubara v0.13.0, four clusters, seven platform roles, and
two applications, with no AI rewrite or platform-model migration.

An existing Kubara user can adopt it by updating normal catalog references,
`config.yaml`, and values overrides. The official Kubara `bootstrap:1.1.0` and
`general:1.1.0` catalogs remain valid inputs, and no permanent chart fork is
part of the path.

The boundary is intentionally simple:

> **Kubara composes; ConfigHub governs; Argo reconciles.**

- Kubara's catalogs, `ServiceDefinition`s, wrappers, `config.yaml`, and
  `values-*.yaml` overlays continue to describe the platform.
- ConfigHub retains and reviews exact component versions, records the resulting
  configuration and its relationships, applies policy, and gives promotion and
  rollback a durable history.
- Argo CD continuously reconciles the approved result, either from the familiar
  Kubara hub or from an optional small local reconciler on each cluster.

The source is
[`examples/kubara/current-platform`](../../../examples/kubara/current-platform/README.md).
The older Kubara v0.12.0 material is retained as
[historical compatibility evidence](local-platform.md); it is no longer the
recommended starting point.

## The platform you will reproduce

The same checked-in Kubara config describes one hub and three spokes:

| Cluster | Kubara role | Environment | Selected platform services |
| --- | --- | --- | --- |
| `hx-app-dev` | hub | development | Argo CD, cert-manager, External Secrets, Homer, kube-prometheus-stack, Metrics Server, Traefik |
| `hx-app-staging` | spoke | staging | cert-manager, Traefik |
| `hx-app-prod-a` | spoke | production | cert-manager, Traefik |
| `hx-app-prod-b` | spoke | production | cert-manager, Traefik |

This is 13 component instances: one hub Argo CD, cert-manager and Traefik on all
four clusters, and four additional services on the hub. The selected versions
are exact:

| Kubara role | Exact selected component and ConfigHub candidate |
| --- | --- |
| Argo CD | `argo-cd/argo-cd@10.2.1` |
| cert-manager | `jetstack/cert-manager@v1.21.0` |
| External Secrets | `external-secrets/external-secrets@2.8.0` |
| Homer | Kubara first-party wrapper `0.1.0` |
| monitoring | `kube-prometheus-stack@87.19.2` plus `prometheus-blackbox-exporter@11.15.1` |
| Metrics Server | `metrics-server/metrics-server@3.13.1` |
| Traefik | `traefik/traefik@41.0.2` |

Two applications are defined to use those services on the same four targets:

- **hx-web** is the smallest useful proof: a digest-pinned nginx Deployment and
  Service, plus a cert-manager Certificate and Traefik Ingress.
- **cubbychat** is a three-tier application: digest-pinned Postgres, backend,
  and frontend workloads, plus a Certificate and Ingress. Its upstream commit
  and every image digest are recorded in
  [`apps/source-lock.yaml`](../../../examples/kubara/current-platform/apps/source-lock.yaml).

The committed cubbychat credential is deliberately demo-only. A real adopter
must replace it with an ExternalSecret or another target-owned Secret.

## The two delivery lanes preserve the same Kubara shape

The example proves two ways to operate one generated platform. They are delivery
choices, not competing platform definitions.

### Faithful lane: keep Kubara's hub and spokes

```text
Kubara catalogs + config.yaml + values overrides
  -> kubara generate --helm
  -> platform-components/ + platform-configs/ in Git
  -> ConfigHub review, approval, and revision attestation
  -> existing hub Argo CD + ApplicationSets
  -> registered spoke clusters
```

The hub stays the management cluster. Kubara's generated AppProjects,
ApplicationSets, cluster labels, Git paths, and `kubara cluster add` workflow
remain recognizable. ConfigHub adds a governed decision around the Git revision;
Git merge remains the enforceable release decision until a repository requires
the ConfigHub status. The faithful proof explicitly records that required-status
integration as not enforced rather than implying otherwise.

### Simplified lane: ConfigHub takes the hub role

```text
the same Kubara-generated desired state
  -> ConfigHub base Units + target variants
  -> checks, approval, promotion, and immutable release
  -> one small local Argo CD reconciler per cluster
  -> hub and spoke targets
```

Here ConfigHub is the fleet control plane and release authority. Each cluster
keeps a local reconciler, so promotion and rollback can be isolated by cluster.
The selected components, namespaces, target differences, and dependency order
still come from Kubara. An adopter may keep the faithful topology indefinitely
or move to this lane one target at a time.

## Catalog mapping: component first, platform composition preserved

Kubara and ConfigHub use the word *catalog* at different levels. Alignment keeps
both levels instead of flattening one into the other. Kubara's
[catalog documentation](https://docs.kubara.io/latest-stable/2_concepts/catalogs/)
describes the reusable package of service definitions, platform components, and
platform configurations; that package remains intact here.

| Layer | Owner | What it contains |
| --- | --- | --- |
| Exact reusable component | ConfigHub Catalog | One reviewed chart or first-party component version, its source digest, rendered bases, lifecycle routes, target facts, and retained history. Deployable variants and configurations follow the component; they do not replace it. |
| Kubara compatibility profile | Kubara plus the deterministic adapter | The matching `ServiceDefinition`, wrapper templates, defaults, additions, and `platform-configs` templates needed to reproduce Kubara behavior from that exact component. |
| Per-platform package, selection, and wiring | Kubara | The effective ordered catalogs and `config.yaml` select services for each hub or spoke and specialize them with normal values overrides. |
| Fleet state and change history | ConfigHub | Definition and instance Units, releases, checks, approvals, promotions, rollbacks, departures, matrix cells, and wiring links. |

The adapter retains all four Kubara catalog surfaces: `Catalog.yaml`,
`services/`, `platform-components/`, and `platform-configs/`. The current 1.1.0
release contains 18 ServiceDefinitions. Seven selected platform roles are
deeply mapped, `bootstrap-crds` remains a separate non-user-selectable bootstrap
concern, and the other ten services are retained byte-for-byte as explicitly
unreviewed pass-through content. Nothing is silently dropped or upgraded.

Most importantly, the two source lanes now produce the same result:

```text
same config.yaml and values overrides
  |-- Kubara official 1.1.0 release snapshot -----------|
  `-- ConfigHub-aligned, byte-preserving catalog export -|
                                                        v
                                          kubara v0.13.0 generate
                                                        |
                                      131 identical files, no diffs
```

The
[`catalog-parity-receipt.yaml`](../../../examples/kubara/current-platform/catalog-parity-receipt.yaml)
records path-and-byte-for-byte equality across all 131 generated files. The
adapter receipt separately proves that the complete catalog export matches the
pinned upstream release tree. This is a deterministic export, not an AI
translation. The committed source config continues to name Kubara's official
OCI catalogs; only temporary generation copies are repointed for the comparison.

ConfigHub's exact-version policy is `fail-if-missing` and retention is
`additive-only`. A missing exact mapping never turns into a nearby-version
substitution. New versions are added after qualification; older recipes,
packages, receipts, and public paths remain available.

### What an existing Kubara user edits

Adoption is a bounded data update, not a translation project:

| Existing Kubara surface | Adoption action |
| --- | --- |
| Catalog references | Keep the official or organization-owned references for the faithful lane. Add an aligned ConfigHub export only after its parity check passes. |
| `config.yaml` | Keep the same schema and service selections. Add the desired hub and spoke entries or start with one existing cluster. |
| `values-*.yaml` | Copy supported customizations into the canonical `source/overrides/<cluster>/helm/<service>/` hierarchy. |
| Custom wrapper or external catalog | Retain its ServiceDefinition, wrapper, defaults, and config templates as a compatibility profile; do not reduce it to the upstream chart version. |
| Exact chart pins | Add missing versions to `component-artifacts.yaml`, generate candidates, live-qualify them, and promote additively. Never replace an unavailable pin silently. |
| Git and Argo settings | Keep current repositories, revisions, AppProjects, ApplicationSets, and registrations in faithful mode. Repoint only a target deliberately moved to ConfigHub delivery. |
| Cluster prerequisites | Record issuers, secret stores, storage classes, load balancers, and kind-only differences as target facts. |
| Applications | Keep application source independent of the platform contract; bind each target instance to the platform capabilities it consumes. |

Generated trees, checksums, matrices, wiring graphs, and receipts are outputs.
Regenerate them after changing the inputs; do not maintain a second hand-edited
copy.

## From Kubara's Git revision to ConfigHub in six deterministic steps

This is the approved general adoption architecture. It starts from Kubara's
normal Git workflow and adds a deterministic ConfigHub import boundary; it does
not ask an AI or a migration project to rediscover the platform.

```text
config.yaml + Kubara catalogs
  -> generated platform, add-ons, ApplicationSets, overrides, and wiring
  -> one immutable Git revision with locks and checksums
  -> deterministic ConfigHub import and component resolution
  -> per-config OCI artifacts + digest-pinned platform bundle
  -> explicit ConfigHub organization with topology and target bindings
  -> ConfigHub promotion; Argo CD reconciliation
```

### 1. Select and wire the platform in Kubara

The platform team keeps using `config.yaml` to name the hub and spokes, enable
or disable services, select per-cluster configuration, and express the wiring
Kubara understands. Kubara's effective ordered catalog set and normal
`values-*.yaml` overrides remain authoring inputs. ConfigHub does not choose a
different platform.

### 2. Let Kubara generate the complete platform tree

Kubara generates `platform-components/`, `platform-configs/`, add-ons,
AppProjects, ApplicationSets, documented overrides, and wiring. The generated
tree is treated as one coherent platform revision, while each deployable
component instance remains separately identifiable.

### 3. Commit the source and generated evidence to Git

Commit `config.yaml`, the generated tree, exact artifact and dependency locks,
documented overrides, source checksums, the generation receipt with effective
render checksums and object counts, and the wiring ledger together. The import
request names one immutable commit SHA and one selected path; a moving branch
name is not an acceptable source identity.

Git remains the auditable hand-off from Kubara. A checkout with changed files,
a ref that resolves to a different commit, a missing lock, or a checksum drift
must fail before ConfigHub state is planned.

### 4. Import that exact revision and package deployable configuration

A deterministic importer reads the clean checkout at the requested SHA and
resolves every selected Kubara component against ConfigHub's component-first
Catalog. Resolution includes canonical identity, exact version and digest, the
Kubara compatibility profile, and lifecycle facts. A missing exact match,
duplicate provider, unexpected secret value, or conflicting identity fails;
the importer never picks a nearby version.

The compiler cross-checks every component-instance render digest and object
count, and every dependency SHA, against the committed generation receipt. It
also requires the wiring graph's component, version, and object inventories to
match those same instances. A self-consistent-looking but stale subset cannot
be imported.

The importer produces three deliberately separate outputs:

- one configuration Unit and one immutable deployable-configuration OCI
  package/release for each component instance, so a cluster or component can be
  reviewed, promoted, and rolled back independently;
- one digest-pinned platform bundle that indexes those exact OCI digests and
  their platform revision, rather than hiding the fleet in one opaque YAML
  blob;
- separate topology and wiring facts for hub/spoke placement, enabled and
  disabled services, upgrade lineage, and consumer-to-provider edges.

Target Secret values and environment-owned target facts do not enter Git or
those OCI artifacts. They are declared as requirements and bound at target or
apply time.

The present laptop proof has one explicit test-only departure: its kind fake
provider and demo Grafana value are committed under `target-facts/` so the
fixture can be reproduced without a real secret backend. The generalized
importer must not ingest or publish that file. Its production proof must supply
the target fact and secret value through the separately authorized target
binding.

### 5. Materialize the plan in an explicit ConfigHub organization

The user selects the destination organization explicitly; the importer must not
guess from an ambient default. It may initialize a new empty organization, or
reconcile an importer-owned platform with the same platform digest. An
unrelated object, conflicting owner, changed source revision, or ambiguous
partial cluster state fails without deletion.

The plan creates component-definition and per-cluster component-instance
Spaces, Units and Variants, ClusterTargets, UpgradeUnit lineage, and visible
`NeedsProvides` Links. Target facts and secret references bind here, outside the
Git and OCI payloads. Repeating the same revision and request yields the same
plan and no semantic changes.

### 6. Promote applications through ConfigHub; let Argo reconcile

Applications are a subsequent hand-off, not something the platform importer
silently invents. Teams create or retain application bases and target variants,
promote approved revisions across development, staging, and production, and
keep target departures and rollback history. ConfigHub governs those revisions
and publishes their exact releases; Argo CD remains the continuous reconciler.

### What is proved now, and what the generalized importer must still prove

| Surface | Current four-cluster proof | Generalized Git importer capability |
| --- | --- | --- |
| Kubara selection and generation | Current v0.13.0 config generates 131 byte-identical files from both catalog lanes and 13 deterministic effective renders. | Accept an arbitrary supported Kubara tree without changing its selections or wiring. |
| Git evidence | The fixture retains source locks, checksums, generated files, effective renders, and wiring data. | Require a clean checkout at one immutable SHA and emit a receipt bound to that revision; do not fake such a receipt while the fixture is uncommitted. |
| Component resolution and packaging | Exact component candidates, additive Catalog retention, catalog OCI publication, and purpose-built per-Space releases are separately gated. | Compile one general plan, emit one deployable configuration OCI per component instance, and emit a digest-pinned platform bundle without an opaque fleet blob. |
| Target facts and Secrets | The kind fixture commits a fake-provider target fact with demo-only data for reproducibility; it is an explicit test departure. | Keep target facts and all Secret values outside the imported Git tree and OCI artifacts, then bind them through separately authorized target inputs. |
| ConfigHub shape | The purpose-built mini-IDP reconciler plans the explicit `Kubara` organization, definition and instance Units, targets, upgrade lineage, and `NeedsProvides` Links. Its live claim depends on its receipt. | Support an explicitly selected new-empty or same-import-owned organization with deterministic conflict and no-delete rules. |
| Applications and reconciliation | hx-web and cubbychat, promotion, approval, rollback, departures, and Argo reconciliation are acceptance-gated in the current mini-IDP lane; older v0.12 receipts remain historical evidence. | Hand off to the ordinary ConfigHub application workflow after platform import; never synthesize applications from guesses. |

The accepted shared importer interface is an offline plan compiler and
byte-for-byte verifier. Start with its
[request contract and walkthrough](../../../examples/kubara/git-import/README.md),
then run the adversarial fixture test:

```bash
npm run kubara-git-import:self-test
```

For a real detached checkout, copy the
[`request.example.yaml`](https://github.com/confighub/helm-expt/blob/main/examples/kubara/git-import/request.example.yaml),
replace every example identity, and keep the output outside the checkout:

```bash
node scripts/import-kubara-git-revision.mjs --compile \
  --request /absolute/path/to/request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /absolute/path/to/import-plan

node scripts/import-kubara-git-revision.mjs --verify \
  --request /absolute/path/to/request.yaml \
  --checkout /absolute/path/to/clean-checkout \
  --output /absolute/path/to/import-plan
```

`--plan` prints the same deterministic plan without writing it. The compiler
scans the complete selected Git path and refuses `target-facts/`, symlinks,
untracked or dirty input, non-exact locks, and credential-shaped material. The
self-test first proves that the current fixture's fake-provider test departure
and cubbychat application credential are rejected, then externalizes target
facts and apps and proves one hub, three spokes, seven deployable definitions,
and 13 component-instance release plans.

`--package` and `--apply` deliberately fail: generic OCI publication and
explicit-organization reconciliation are not shipped yet. The four-cluster
reconciler remains the concrete current implementation until an immutable-Git
importer receipt, OCI package set, platform-bundle digest, target binding, and
clean-room organization reconciliation all pass. Faithful Kubara-hub execution
also remains the separate topology proof lane; this compiler currently accepts
only the ConfigHub-managed Argo delivery plan.

## Prepare the deterministic inputs

Complete this preparation from the repository root before entering the ordered
release gates below. These commands generate or verify repository artifacts;
they do not qualify a live release or publish catalog packages.

### Prepare the pinned Kubara catalog bridge

Generate the byte-preserving export from the immutable snapshots, then verify
it offline:

```bash
node scripts/generate-kubara-catalog-adapter.mjs --generate
node scripts/generate-kubara-catalog-adapter.mjs --verify
```

Review
[`data/kubara-catalog-adapter/receipt.yaml`](../../../data/kubara-catalog-adapter/receipt.yaml)
before changing a catalog reference. The release snapshot and a later observed
Git head are separate sources even though both say `1.1.0`; their 16 changed
files are not treated as interchangeable.

### Prepare the exact component candidates

The current candidate set reuses four byte-identical retained versions and adds
only the three versions that changed in Kubara v0.13.0: Argo CD 10.2.1,
External Secrets 2.8.0, and kube-prometheus-stack 87.19.2.

```bash
node scripts/run-kubara-catalog-candidates.mjs --generate
node scripts/run-kubara-catalog-candidates.mjs --verify

node scripts/run-kubara-current-catalog-candidates.mjs --generate
node scripts/run-kubara-current-catalog-candidates.mjs --verify
```

The
[`candidate-set.yaml`](../../../data/kubara-catalog-refresh/current-candidates/candidate-set.yaml)
binds every candidate to its exact public artifact and SHA-256 digest. Candidate
status means offline render and package checks passed; it does not by itself
mean live qualification or root-catalog promotion passed.

### Generate the four-cluster platform from both catalog sources

Download the Kubara v0.13.0 release binary for your platform and verify it
against
[`source-lock.yaml`](../../../examples/kubara/current-platform/source-lock.yaml).
Then run:

```bash
KUBARA_BIN=/absolute/path/to/kubara \
  node scripts/generate-kubara-current-example.mjs --generate

node scripts/generate-kubara-current-example.mjs --verify
```

Generation checks the Kubara binary, both pinned catalog trees, all seven public
artifacts, documented overrides, 131 generated files, and 13 effective renders.
It renders each component twice and requires deterministic bytes. Verification
is network-free and does not require Kubara, Helm, a registry, ConfigHub, or a
cluster. The complete outcome is in
[`generation-receipt.yaml`](../../../examples/kubara/current-platform/generation-receipt.yaml).

The normal overrides remain in the familiar Kubara hierarchy:
`source/overrides/<cluster>/helm/<service>/values-*.yaml`. They record the kind
self-signed issuer, the Metrics Server kind TLS setting, the Homer links, and
the hub Git/AppProject paths. These are authoring inputs, not hidden
post-render patches.

### Materialize the current matrix and wiring views

```bash
node scripts/generate-kubara-effective-renders.mjs --verify --profile current

node scripts/generate-kubara-wiring.mjs --generate --profile current
node scripts/generate-kubara-wiring.mjs --verify --profile current
node scripts/generate-kubara-wiring.mjs --self-test

node scripts/generate-kubara-platform-matrix.mjs --generate --profile current
node scripts/generate-kubara-platform-matrix.mjs --verify --profile current
node scripts/generate-kubara-platform-matrix.mjs --self-test
```

Open the
[colored component × cluster matrix](../../../data/kubara-platform-matrix/matrix.html)
to see exact selected versions, placement, sync state, and departures in one
view. Open the
[wiring graph](../../../data/kubara-wiring/graph.html)
to see component-to-component needs and provides, including ApplicationSet to
cluster-registration edges, CRD dependencies, Secret production, issuer and
IngressClass references, and unresolved target facts. Machine-readable CSV and
JSON live beside both HTML reports.

These views are stronger than a static platform diagram because they are
regenerated from the committed platform data. They also stay honest: a desired
render is not a live observation. Until a receipt records an observed version,
sync state, or workload state for an exact cell, the matrix says `unknown`.
The [evidence guide](platform-evidence.md) explains every status.

## Run the audited release sequence exactly in this order

The
[`KubaraConfigHubReleaseAcceptance` contract](../../../data/kubara-release-acceptance/contract.yaml)
binds this order to the expected inputs, receipts, catalog additions, published
artifacts, topology proofs, mini-IDP state, and website. The faithful topology
proof follows catalog publication; the mini-IDP receipt follows that proof;
the live matrix and final catalog/site release follow the receipt.

The live steps require Docker, kind, Kubernetes tools, a signed-in `cub` CLI,
and access to the `Kubara` ConfigHub organization. Qualification runners own
only their explicitly named temporary resources. The mini-IDP reconciler
preserves and updates the four persistent `hx-app-*` targets.

### 1. Pass the offline acceptance gate

```bash
npm run kubara-release:verify-static
```

This gate proves the committed snapshots, candidates, current example, parity,
effective renders, matrix, and wiring. It does not turn a missing live receipt
into a pass.

### 2. Run and verify the historical live qualification

```bash
npm run kubara-live-qualification:preflight
npm run kubara-live-qualification:run
npm run kubara-live-qualification:verify
```

The v0.12-selected set remains a required compatibility root. All 13 bases must
pass before those seven exact versions can be promoted.

### 3. Run and verify the current live qualification

```bash
npm run kubara-current-live-qualification:preflight
npm run kubara-current-live-qualification:run
npm run kubara-current-live-qualification:verify
```

The current set reuses four identical qualified versions and runs the changed
Argo CD 10.2.1, External Secrets 2.8.0, and kube-prometheus-stack 87.19.2 lanes.
Do not convert a `watch` or `blocked` lane into a pass from prose. Large CRDs,
target facts, hooks, and existing-Secret requirements remain explicit in the
receipts.

### 4. Promote the seven historical versions additively

```bash
npm run kubara-catalog-promotion:dry-run
npm run kubara-catalog-promotion:stage
npm run kubara-catalog-promotion:stage:verify
npm run kubara-catalog-promotion:promote
npm run kubara-catalog-promotion:verify
```

### 5. Promote the three current additions additively

```bash
npm run kubara-current-catalog-promotion:dry-run
npm run kubara-current-catalog-promotion:stage
npm run kubara-current-catalog-promotion:stage:verify
npm run kubara-current-catalog-promotion:promote
npm run kubara-current-catalog-promotion:verify
```

Both promotion gates refuse a pre-existing destination, preserve the immutable
110-version baseline, and only add the ten qualified versions. The expected
root total is 120; no older recipe, package, receipt, or path is removed.

### 6. Publish and verify the ten exact catalog OCI additions

```bash
npm run kubara-catalog-oci:dry-run
npm run kubara-catalog-oci:publish
npm run kubara-catalog-oci:verify
```

Publication is deliberately after both root promotions. It addresses the exact
ten approved packages and records immutable digests; a local candidate or root
path alone is not a publication claim.

### 7. Prove the faithful Kubara hub-and-spoke lane

```bash
export KUBARA_BIN=/absolute/path/to/kubara
npm run kubara-faithful-hub-spoke:rehearse
npm run kubara-faithful-hub-spoke:run
npm run kubara-faithful-hub-spoke:generate
npm run kubara-faithful-hub-spoke:verify
```

This lane keeps one Git source, Kubara's hub Argo CD, its AppProject and
ApplicationSet, an External Secrets-backed spoke registration, and the spoke
cert-manager workload. It proves the recognizable topology before the optional
simplified lane. The current
[machine-generated summary](../../../data/kubara-faithful-hub-spoke/summary.md)
records a pass for Kubara v0.13.0, catalog 1.1.0, ConfigHub plan approval,
OpenBao-to-External-Secret registration, Synced/Healthy cert-manager delivery,
and exact cleanup. The receipt also states that a ConfigHub approval
attestation is not yet an enforced GitHub required status.

### 8. Reconcile and verify the complete ConfigHub mini-IDP

```bash
npm run kubara-mini-idp:plan
npm run kubara-mini-idp:apply
npm run kubara-mini-idp:apply
npm run kubara-mini-idp:verify
npm run kubara-mini-idp:receipt-verify
```

The reconciler is scoped to the `Kubara` organization and the exact 53-Space
allowlist. It creates missing owned objects and converges changed owned objects,
but performs no deletion. Clean-room safety is strict: any Space outside that
allowlist, or any unexpected Unit or Link inside a managed Space, makes the run
refuse rather than coexist, delete, or recreate. Re-running the accepted state
at the desired revision produces no semantic changes. Apply refuses to start
unless all prior qualification,
promotion, publication, and faithful-lane gates pass. The first apply writes a
pending-idempotence receipt. The immediately repeated apply must record zero
actions before receipt verification can pass. A restarted apply also compares
every Unit's head revision with its last applied revision, so an interrupted
run cannot mistake an older existing release for the current desired state.

The result includes every selected platform role, lifecycle and target facts,
the platform contract, catalog-alignment evidence, matrix and wiring evidence,
and both apps on all four targets. ConfigHub-managed Argo CD already supplies
the adapted delivery role, so this lane does not also install the Kubara hub
Argo chart on the same targets. Large CRD Applications use
`ServerSideApply=true`; `Replace=true` is forbidden. External Secrets owns the
Grafana admin Secret through the dev fake-provider target fact. Every adapted
Argo Application also retains Kubara's generated destination namespace (the
service name unless Kubara declares an override), so namespace-less Helm
objects resolve exactly as they do under Kubara's ApplicationSet template.

The accepted desired plan is explicit: 53 Spaces, 60 managed Units, 27
deployments, 25 `NeedsProvides` Links, and 53 source/evidence payloads before
the faithful-lane receipt exists. That receipt becomes the 54th governed
payload in the apply-ready plan. Those are plan and allowlist counts, not a
substitute for the live mini-IDP receipt.

The final state must show more than pods:

1. hx-web and cubbychat have definition and per-cluster instance Spaces.
2. Both apps use shared cert-manager and Traefik services on every target.
3. A base change promotes through development and staging to production.
4. Production publish is refused until every Unit in scope is approved.
5. One production target can roll back without rolling back its peer.
6. A staging-only departure survives a later base promotion.
7. Platform, application, lifecycle, target, and wiring roles are queryable.
8. Wiring Links expose consumer-to-provider relationships while the generated
   wiring ledger remains their deterministic source.

On a clean, unmarked fleet the reconciler executes that operation sequence and
writes its scenario marker only after every check passes. Later runs reconcile
the same final state and verify retained history without manufacturing duplicate
promotions. The receipt distinguishes `executed` from
`retained-proven-history`. Do not claim this lane passed unless
`runs/kubara-mini-idp-reconcile/receipt.yaml` reports `pass` and receipt
verification succeeds.

### 9. Regenerate the matrix from the exact live receipt

```bash
npm run kubara-platform-matrix:generate
npm run kubara-platform-matrix:verify
```

Generation happens after the mini-IDP receipt so each component-by-cluster cell
can use exact observed evidence where it exists and remain `unknown` where it
does not. The generated JSON, CSV, Markdown, and colored HTML must agree.

### 10. Regenerate and verify every catalog and website release surface

```bash
npm run kubara-catalog-release:generate
npm run kubara-catalog-release:verify
```

This refreshes the catalog status, chart catalogs, root catalog, promotion
review, installer OCI index, npm command catalog, and public site from the
promoted, published, reconciled, and freshly generated matrix state.

### 11. Pass the umbrella release verifier

```bash
npm run kubara-release:verify
```

This is the only final release gate. It fails unless the static contract, both
live qualification sets, both additive promotions, exact OCI publications,
faithful lane, mini-IDP reconciliation and idempotence, live-aware matrix,
catalog-release surfaces, and public site all verify.

## What ConfigHub keeps, adapts, and deliberately does not replace

| Kubara concept | Kept unchanged | ConfigHub addition or explicit adaptation |
| --- | --- | --- |
| Catalogs | Built-in and external Kubara catalogs remain valid sources. | Exact component-first retention plus a Kubara compatibility profile can export a byte-identical external catalog. |
| `config.yaml` | Still selects clusters, stages, services, and service configuration. | Mirrored as a non-targeted contract Unit with provenance and revision history. |
| `platform-components/` | Still generated and valid in Git. | Reviewed component definitions and immutable release content. |
| `platform-configs/<cluster>/` | Still carries Kubara's per-cluster specialization. | Target variants, semantic diffs, promotion, rollback, and departure tracking. |
| `values-*.yaml` | Still the durable authoring mechanism for supported overrides. | Their effects are visible in Units and the matrix; no silent post-render owner is introduced. |
| Hub Argo CD and ApplicationSets | Preserved exactly in the faithful lane. | ConfigHub review and attestation around the Git revision. |
| Reconciliation | Argo CD remains the continuous reconciler. | Optional per-cluster Argo makes release and rollback state independently governable. |
| Git review | Remains the platform-authoring review in faithful mode. | ConfigHub adds object-aware checks, approvals, release evidence, and an optional required-status integration. |
| Secrets | External secret systems remain value owners. | ConfigHub stores references and prerequisites; the kind demo uses a clearly labeled fake provider. |
| Day-2 update | Update catalog/config/overrides and regenerate as Kubara documents. | Inspect semantic change, approve, promote, preserve target departures, and roll back an exact revision. |
| Exit path | Generated Git state and Argo topology remain intelligible without ConfigHub. | ConfigHub is an adoptable operating layer, not a mandatory rewrite boundary. |

## Evidence boundaries

- The current generation and catalog-source parity receipts are complete offline
  evidence. They prove deterministic desired state, not cluster health.
- The wiring graph includes rendered and controller-declared relationships.
  `resolved-runtime` means a controller contract exists; it does not claim the
  controller created the object in a live cluster.
- The platform matrix leaves current live fields unknown unless an exact live
  receipt supplies them.
- The current
  [faithful-lane summary](../../../data/kubara-faithful-hub-spoke/summary.md)
  passes the unchanged Kubara hub-and-spoke delivery proof. GitHub
  required-status enforcement remains a named gap.
- The simplified lane is a deliberate delivery adaptation. It must never be
  described as Kubara's native Argo ownership model.
- The fake External Secrets provider, self-signed kind issuer, kind-only Metrics
  Server TLS setting, and Traefik LoadBalancer behavior are test-target facts,
  not production recommendations.
- The v0.12.0
  [single-platform](../../../runs/kubara-single-platform-proof/receipt.yaml) and
  [app-rollout](../../../runs/kubara-app-rollout-proof/receipt.yaml) receipts
  remain useful historical live evidence. They do not establish current v0.13.0
  versions or faithful delivery.

For the detailed machine-generated views, start with
[Kubara wiring and platform evidence](platform-evidence.md). For the older
promotion narrative, see the [historical app rollout](app-rollout.md).
