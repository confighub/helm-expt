# Next Execution Plan

This plan captures the backlog from the question:

```text
Are the top 20 the best, simplest, safest way for a Helm user to install and vary it?
```

through the current repo-structure, installer-capability, target-facts, and
`cub variant` discussion.

## Mission

Prove this claim for public Helm charts:

```text
correct variants
safe operations
immediate proof
```

In Helm-user language:

```text
Use the charts you already trust.
Install and vary them with less pain.
See exactly what changed and why before you ship.
```

## Current Baseline

The repo now has:

```text
100 machine-proof recipes
100 cub install packages
20 bespoke multi-variant proofs
80 generated full default proofs
20 explicit catalog-supported recipes for local-test scope
0 top-20 catalog candidates remaining
80 proof-grade recipes
```

Important boundary:

```text
Top-20 catalog presence is mandatory because these charts are popular.
Machine proof decides support scope; it does not erase production review.
Catalog support scope must be explicit in catalog-status.yaml.
```

## Roadmap Integration: Real Cub And ConfigHub Capabilities

The capability doctrine turns into two roadmap tracks:

```text
Use existing verbs now.
Ask Brian for missing verbs only where the current product surface is awkward,
manual, or script-only.
```

### Use Current ConfigHub Capabilities

These existing verbs should move into the proof path wherever they make the
result simpler, safer, or more provable.

| Lane | Existing verbs | Roadmap home | Acceptance |
| --- | --- | --- | --- |
| Installer proof | `cub install doc/setup/render/package/push/sign/verify/vet/plan/upload/inspect/list` | P0.4, P1.1 | Redis and each promoted catalog candidate shows package docs, deterministic setup/render, deterministic bundle, vet/plan output where useful, upload or publish evidence, and ConfigHub Unit reconciliation where available. |
| Server variants | `cub variant create` | P0.5 | Redis demo clones a reviewed uploaded base space when server-side variation is simpler than another Helm render. |
| Review and diff | `cub unit diff`, `cub revision data/list`, `cub unit data/tree/list` | P1.6 | Demo shows exact Unit data, revision history, tree view, and object-level differences for at least Redis. |
| Safe operations | `cub changeset create/list/update`, `cub unit approve/apply/destroy/cancel` | P1.7 | Local/test operation lane creates a changeset, records approval/apply intent, and shows how unsafe operations are gated or cancelled. |
| Scanning and misconfig | `cub function vet`, `cub function get/set`, `cub run ...` | P1.8 | Rendered objects or uploaded Units get ConfigHub function checks with scan/gate receipts. |
| Target and live facts | `cub target create/get/list`, `cub k8s collect`, `cub k8s source`, `cub unit livestate/livedata/refresh` | P1.3, P1.4 | Local kind target proves target facts, source tracing, and freshness/unknown status where available. |
| GitOps adoption | `cub gitops discover/import` | P2.5 | Separate compatibility proof shows ConfigHub can discover/import existing Argo/Flux resources without confusing this with the installer package path. |
| Metadata model | `cub tag`, `cub attribute`, `cub filter`, `cub view`, `cub link` | P1.9 | Catalog entries become searchable by chart, recipe, variant, target, risk, support status, and dependencies. |

### Missing Verb Asks

These are product/installer asks, not blockers for continuing the public proof.
Where repo scripts already perform the job, the ask is to turn a proven pattern
into a reusable `cub` capability.

| Priority | Ask | Why |
| --- | --- | --- |
| P0 ask | `cub install import helm` | Makes chart -> installer recipe/package a product capability, not an AI/script-only step. |
| P0 ask | `cub install analyze` | Makes HelmPlan / chart weirdness visible before install. |
| P0 ask | implemented `cub install preflight` | Turns target facts and `externalRequires` into live checks. |
| P0 ask | `cub install compare` or `cub install prove` | Turns Helm-vs-`cub install` equivalence into a product receipt. |
| P1 ask | `cub install scan` | Gives rendered-object scan receipts without hand-wiring scripts. |
| P1 ask | `cub variant list/diff/promote/update` | Completes the server-side variant lifecycle after `create`. |
| P1 ask | `cub observe` or `cub target observe` | Gives workerless ConfigHub a clean observation receipt path. |
| P2 ask | `cub catalog search/show/install` | Makes the public catalog first-run UX simple after the proof shape is stable. |

## P0 Gates

### P0.1 Keep Archive Cleanup / Catalog Status Green

Purpose:

```text
Keep the active repo matched to the current story.
```

Status:

```text
completed as a baseline; keep verified
```

Acceptance:

- old top-20 archive is removed from active tree
- Redis points at `packages/bitnami/redis/25.5.3`
- `catalog-status.yaml` exists for all 100 recipes
- `npm run verify` passes
- `data/catalog-promotion-review/summary.md` reports:
  - `machine checks pass: 100`
  - `catalog-supported: 20`
  - `recipes with non-current executable fixture path: 0`

### P0.2 Make Chart -> Recipe -> Variant Obvious

Problem:

The current structure is mechanically coherent but hard to read. A new reader
does not immediately see:

```text
chart -> recipe -> variants -> revisions -> package bases -> receipts
```

Action:

Maintain generated per-chart maps:

```text
recipes/<repo>/<chart>/<version>/CATALOG.md
recipes/<repo>/<chart>/<version>/artifact-index.yaml
```

Acceptance:

- Every current recipe has a one-page artifact map.
- The map links:
  - source chart
  - recipe
  - variants
  - variant revisions
  - rendered object sets
  - package bases
  - scan/gate/equivalence receipts
  - catalog status
- A naive Helm user can answer: "which variant do I install, and what will it
  create?"

### P0.3 Decide What A "Best, Simplest, Safest" Recipe Means

Problem:

A recipe can be Helm-equivalent without being the best recommended path for a
Helm user.

Action:

Turn catalog promotion into a stricter product review:

```text
not harder than Helm
not riskier than Helm
not wrong compared with Helm
obvious variants are present
deferred variants are explicit
scan/gate warnings have a disposition
```

Acceptance:

- `docs/catalog-promotion-review.md` has this checklist.
- `catalog-status.yaml` records:
  - supported variants
  - deferred variants
  - supported scopes
  - production readiness
  - warning disposition
- Redis passes this review for local-test scope.

### P0.4 Use More Of Real `cub install`

Problem:

The proof must not leave Helm pain in prose when a real installer, `cub`, or
ConfigHub capability can carry it better. Current packages prove
`cub install setup` against Helm output and now synchronize required Secret
target facts into installer packages, but the catalog must keep moving toward
executable capabilities instead of documentation-only notes.

Action:

For Redis and each promoted catalog candidate, review whether the package
should use:

```text
components
inputs
externalRequires
provides
clusterSingleton
transformers
validators
collector facts
preflight, when implemented
```

Use the capability when it exists, fits the chart behavior, and makes the
result simpler, safer, or more provable. If no suitable product capability
exists yet, mark the control point as a capability gap and link it to an issue
instead of pretending the docs solved it.

Acceptance:

- Redis has an installer-capability gap review.
- Redis has a `docs/demo/redis/confighub-proof-transcript.md` proof using current
  `cub install doc/setup/render/package/vet/plan/upload`.
- The top-20 set has live ConfigHub proof receipts generated by
  `scripts/run-top20-confighub-proof.mjs` and verified by
  `scripts/verify-top20-confighub-proof.mjs`.
- Large-chart runs may use `--cleanup-spaces` because the Kubara demo org has
  a finite Link quota. This is not a proof shortcut: the runner still uploads
  to ConfigHub, creates the server-side variant, runs ConfigHub functions,
  records safe-ops behavior, writes receipts, and only then removes temporary
  spaces.
- Target facts are either:
  - represented as installer-native `externalRequires` / fact requirements, or
  - explicitly documented as proof-layer-only pending installer support.
- At least one promoted candidate uses installer-native inputs or components,
  not only bases.
- Documentation-only mitigations are allowed only when the matching product
  capability is missing, inferior, or would make the happy path harder.

### P0.5 Integrate Real `cub variant`

Finding:

`cub variant create` has landed in `confighubai/confighub`:

```text
PR #4444: feat(cli): add cub variant create
PR #4450: scope cub variant create metadata flags
```

Status:

```text
completed locally on 2026-05-27
```

Evidence:

- `cub` was rebuilt from `origin/main` commit
  `f5e876f123bdd963baaf50b99a6a388f854cd92f`
- local installed binary is now `~/.confighub/bin/cub`
- `cub variant --help` works
- `cub variant create --help` works

Recomputed meaning:

`cub variant create` is a ConfigHub server-side operation. It clones an
upstream space and its units into a downstream space, applies a `Variant`
label, can set `Environment`, `Region`, target annotation, space metadata, and
unit gates, and preserves links to the upstream units.

It is an expected part of the workflow when it is the simpler path. It does not
replace Helm-derived recipe variants for changes that require a different Helm
render, but it should be preferred for downstream operational variation when a
reviewed ConfigHub space can be cloned safely.

The model is now:

```text
Helm chart version
  -> recipe
  -> install variants / package bases
  -> rendered variant revisions
  -> ConfigHub spaces and units
  -> cub variant create for downstream server-side space variants when useful
```

Decision rule:

```text
Use recipe/package variants for render-time choices:
  CRDs on/off, generated Secret vs existing Secret, HA mode, storage mode,
  ingress/TLS shape, cloud-specific values, or anything that changes the
  Kubernetes object set.

Use cub variant create for server-side choices:
  staging/prod clone, region clone, target binding, space metadata, gates,
  policy labels, post-clone trigger inputs, or other changes that can be made
  after a reviewed rendered revision has become ConfigHub units.
```

Acceptance:

- Keep chart-import variants in `helm-expt` as recipe/package-base variants.
- Use `cub variant create <variant-name> <upstream-space>` when the upstream
  ConfigHub space exists and server-side cloning is the easiest safe path.
- Redis and the top-20 ConfigHub proof lanes include simple server-side clone
  evidence from reviewed uploaded spaces to staging spaces.
- The top-20 receipts verify this with
  `npm run top20:verify-confighub-proof`.
- Catalog maps should continue linking pre-publish recipe variants separately
  from post-upload ConfigHub server variants.

### P0.6 Recalculate The Top-500 Matrix In The New Shape

Problem:

The old matrix is source-feature reconnaissance. It is not proof.

Action:

Build new outputs under:

```text
data/top500-catalog-analysis/
  raw.json
  review.csv
  drilldown.csv
  review.xlsx
  summary.md
```

Status:

```text
completed as generated catalog-analysis output
```

Acceptance:

- rows trace to current artifacts where they exist
- rows distinguish:
  - no recipe yet
  - proof-grade
  - catalog-candidate
  - catalog-supported
  - blocked
- front sheet has no intimidating 60-column wall
- drill-down has all control-point evidence
- top-500 output can answer:

```text
What is proved?
What is recommended?
What remains risky or unreviewed?
```

Verification:

```text
npm run top500:catalog:verify
```

The generated matrix currently shows 100 current proof recipes in the repo, 91
matched to the old top-500 source rows, 20 catalog-supported for local-test
scope, 71 proof-grade/default rows that need user-shaped variants, and 409
rows that remain source reconnaissance only.

### P0.7 Select The Next Real-Variant Promotion Wave

Problem:

The 80 generated default proofs are valuable but not enough to persuade a Helm
user that this is the best, simplest, safest install path. The next wave must
add real variants for charts where the variants are obvious user choices.

Action:

Maintain generated outputs under:

```text
data/catalog-promotion-wave2/
  candidates.yaml
  review.csv
  summary.md
```

Status:

```text
started with five proof-grade/default charts selected
```

Selected charts:

```text
traefik/traefik
external-dns/external-dns
vmware-tanzu/velero
istio-official/istiod
kyverno/kyverno
```

Acceptance:

- each selected chart is proof-grade and exact-version matched in the top-500
  catalog analysis
- each selected chart is default-only today, so the next work is genuine
  variant promotion
- each proposed variant must become a real recipe variant, package base,
  rendered revision, scan/gate receipt, and Helm-equivalence receipt before
  catalog support is claimed

Verification:

```text
npm run catalog:wave2:verify
```

## P1 Execution

### P1.1 Promote The Top-20 Catalog Candidates

Status:

```text
complete for local-test scope
```

The top-20 bespoke charts now have explicit `catalog-supported` status for
local-test scope. This includes the first five promoted after Redis:

```text
bitnami/nginx
bitnami/postgresql
metrics-server/metrics-server
ingress-nginx/ingress-nginx
jetstack/cert-manager
```

Why:

- Nginx proves simple happy path.
- PostgreSQL proves stateful install concerns.
- Metrics Server proves APIService and target-fact shape.
- Ingress Nginx proves hooks, webhooks, RBAC, and an obvious variant.
- Cert Manager proves CRDs and webhook lifecycle.

Acceptance per chart:

- artifact map exists
- catalog promotion review completed
- `catalog-status.yaml` updated
- supported variants and deferred variants are explicit
- Helm-vs-`cub install` comparison passes
- scan/gate warnings have production or local-test disposition

Production support is still blocked for these recipes until scan, gate, and
operating-policy findings have explicit dispositions.

### P1.2 Generate Per-Chart Weirdness And Mitigations

Problem:

Helm pain is hidden unless each chart has a readable operating note.

Action:

Generate or maintain:

```text
recipes/<repo>/<chart>/<version>/weirdness-and-mitigations.md
```

Acceptance:

- every catalog-supported or catalog-candidate chart has the note
- note covers:
  - hooks
  - CRDs
  - webhooks
  - lookup
  - generated secrets/certs
  - required values
  - raw/tpl extension slots
  - RBAC
  - stateful storage
  - upgrade/rollback concerns

### P1.3 Improve Target Facts

Current state:

Target facts are now synchronized into executable installer packages for every
current chart variant that declares `targetFacts`.

Implemented invariant:

```text
recipe variant targetFacts.requiredSecrets
  -> matching installer package base externalRequires
  -> package collector records targetFacts into out/spec/facts.yaml
  -> installer package receipt records targetFactMode/targetFactsBound
  -> npm run installer:target-facts:verify runs cub install setup and checks facts
```

Current coverage:

```text
10 charts
10 target-fact variants
all current target facts are required Secret facts
```

The 10 charts are Redis, MongoDB, MySQL, NGINX, PostgreSQL, RabbitMQ, Grafana,
Tempo, Consul, and Metrics Server.

Next action:

Extend the canonical mapping beyond required Secrets:

```text
existing CRD
API availability
namespace exists
storage class exists
ingress class exists
runtime class exists
```

Acceptance:

- top 10 target facts are documented
- required Secret target facts stay represented by installer
  `externalRequires` plus collector facts in every current package
- non-Secret target facts map to installer-native `externalRequires`,
  `provides`, `clusterSingleton`, collector facts, or explicit blocked status

### P1.4 Add Live E2E Confidence For Promoted Charts

Action:

For catalog-supported and near-supported charts, run disposable local kind tests:

```text
cub install setup
kubectl apply / dry-run / server-side validation where reasonable
observation receipt
cleanup
```

Acceptance:

- Redis stays green
- next promoted charts have live or dry-run evidence
- live evidence is clearly separated from machine proof

Current lane:

```text
data/production-disposition/
  top20.csv
  summary.md
```

Status:

```text
started
```

Current facts:

```text
20 catalog-supported local-test charts
20 passing ConfigHub proof receipt sets
1 live/e2e observed chart
0 production-supported charts
20 production-blocked pending disposition
```

Verification:

```text
npm run production:disposition:verify
```

### P1.5 Old-Version Patch Lane

Action:

Start with Redis old versions and prove the paid patch shape:

```text
old version source lock
old version recipe
patch diff
scan/gate result
upgrade receipt
rollback receipt
support window
```

Acceptance:

- first Redis old-version patch scenario exists
- generated `data/legacy-patch-review/` identifies selected versions
- paid feature can be discussed without exposing private customer data

### P1.6 Add Review And Diff Demo

Status:

```text
complete for the Redis baseline; repeat or deepen for future catalog-supported charts
```

Action:

Use existing ConfigHub review verbs against the Redis proof spaces:

```text
cub unit tree
cub unit data
cub revision list
cub revision data
cub unit diff
```

Acceptance:

- Redis demo shows the exact uploaded Unit tree.
- At least one Unit's config data is shown from ConfigHub, not just from local
  files.
- Revision history is visible.
- A change or variant difference is shown with `cub unit diff`.
- Current Redis evidence lives in `docs/demo/redis/confighub-proof-transcript.md`.

### P1.7 Add Safe Operation Lane

Status:

```text
complete for the top-20 ConfigHub proof receipt set; repeat with a target-backed
local-kind lane before claiming live deploy proof
```

Action:

Use existing safe-operation verbs in local/test scope:

```text
cub changeset create/list/update
cub unit approve
cub unit apply
cub unit cancel
```

Acceptance:

- Local/test apply path is explicit and separate from production readiness.
- Approval and apply intent are recorded.
- Gated or unsafe operations are shown as blocked/cancelled rather than
  silently skipped.
- Current Redis evidence lives in:
  - `docs/demo/redis/safe-ops-lane.md`
  - `runs/redis-confighub-proof/latest/safe-ops-receipt.yaml`
- Current NGINX evidence lives in:
  - `docs/demo/nginx/confighub-proof-transcript.md`
  - `runs/nginx-confighub-proof/latest/safe-ops-receipt.yaml`
- Current Metrics Server evidence lives in:
  - `docs/demo/metrics-server/confighub-proof-transcript.md`
  - `runs/metrics-server-confighub-proof/latest/safe-ops-receipt.yaml`
- Current PostgreSQL evidence lives in:
  - `docs/demo/postgresql/confighub-proof-transcript.md`
  - `runs/postgresql-confighub-proof/latest/safe-ops-receipt.yaml`
- Current Ingress NGINX evidence lives in:
  - `docs/demo/ingress-nginx/confighub-proof-transcript.md`
  - `runs/ingress-nginx-confighub-proof/latest/safe-ops-receipt.yaml`
- Current cert-manager evidence lives in:
  - `docs/demo/cert-manager/confighub-proof-transcript.md`
  - `runs/cert-manager-confighub-proof/latest/safe-ops-receipt.yaml`
- The complete top-20 receipt set is verified by
  `npm run top20:verify-confighub-proof`.

### P1.8 Add ConfigHub Function Scan Lane

Status:

```text
complete for the top-20 ConfigHub proof receipt set; expand to future promoted
charts
```

Action:

Use existing function verbs to run misconfiguration checks against rendered
objects or uploaded Units:

```text
cub function vet
cub function get
cub function set
cub run vet-...
```

Acceptance:

- Every top-20 supported local-test chart has a ConfigHub function-based scan
  receipt.
- Scan/gate results are bound to the rendered object set or Unit revision.
- This lane coexists with external scanners such as Trivy/Snyk/kube-linter.
- Current Redis evidence binds 14 uploaded Redis Unit heads and DataHashes to
  passing `vet-format`, `vet-placeholders`, and `vet-merge-keys` results:
  - `docs/demo/redis/function-scan-lane.md`
  - `runs/redis-confighub-proof/latest/function-scan-receipt.yaml`
- Current NGINX evidence binds 6 uploaded NGINX Unit heads and DataHashes to
  passing `vet-format`, `vet-placeholders`, and `vet-merge-keys` results:
  - `docs/demo/nginx/confighub-proof-transcript.md`
  - `runs/nginx-confighub-proof/latest/function-scan-receipt.yaml`
- Current Metrics Server evidence binds 10 uploaded Metrics Server Unit heads
  and DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/metrics-server/confighub-proof-transcript.md`
  - `runs/metrics-server-confighub-proof/latest/function-scan-receipt.yaml`
- Current PostgreSQL evidence binds 7 uploaded PostgreSQL Unit heads and
  DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/postgresql/confighub-proof-transcript.md`
  - `runs/postgresql-confighub-proof/latest/function-scan-receipt.yaml`
- Current Ingress NGINX evidence binds uploaded Ingress NGINX Unit heads and
  DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/ingress-nginx/confighub-proof-transcript.md`
  - `runs/ingress-nginx-confighub-proof/latest/function-scan-receipt.yaml`
- Current cert-manager evidence binds uploaded cert-manager Unit heads and
  DataHashes to passing `vet-format`, `vet-placeholders`, and
  `vet-merge-keys` results:
  - `docs/demo/cert-manager/confighub-proof-transcript.md`
  - `runs/cert-manager-confighub-proof/latest/function-scan-receipt.yaml`
- The complete top-20 receipt set is verified by
  `npm run top20:verify-confighub-proof`.

### P1.9 Add Catalog Metadata And Views

Action:

Use existing metadata verbs to make the catalog searchable and explainable:

```text
cub tag
cub attribute
cub filter
cub view
cub link
```

Acceptance:

- Standard labels/tags cover chart, recipe, variant, target, risk, support
  status, and proof tier.
- Catalog views can answer:

```text
Which Redis variants are supported?
Which charts require target facts?
Which charts are catalog candidates but not supported?
Which units depend on a Secret, CRD, or target?
```

## P2 / Side Projects

### P2.1 Paid Private Chart Diagnostics

Shape:

```text
private chart intake
AI-assisted Helm pain report
recipe and variant suggestions
misconfig scan
patch/upgrade recommendations
```

Keep this out of public proof outputs unless sanitized.

### P2.2 AI-Assisted Recipe Maintenance

Shape:

```text
new upstream chart version detected
render old variants against new chart
classify conflicts
suggest variant updates
produce review packet
```

This supports paid maintenance SLAs.

### P2.3 Pilot / Adversarial Runs

Use Pilot for adversarial validation after the core proof shape is stable.

Acceptance:

- Pilot attacks current claims
- reports are written under `runs/pilot/`
- Pilot does not become part of the happy path

### P2.4 Public Catalog UX

Shape:

```text
small public catalog page
one line per chart
status, variants, proof, install command, known caveats
```

Do this after the first few catalog promotions, not before.

### P2.5 GitOps Adoption Proof

Action:

Use existing GitOps verbs as a compatibility lane:

```text
cub gitops discover
cub gitops import
```

Acceptance:

- Demonstrates discovery/import for an Argo CD or Flux estate.
- Keeps GitOps adoption separate from the Helm-derived installer package path.
- Explains how ConfigHub OCI/published artifacts can fit existing delivery
  tools without claiming ConfigHub replaces Argo or Flux.

## Operating Rule

For each task:

```text
write the acceptance check first
make the change
run the check
only then start the next task
```

This matters because the project is otherwise prone to accumulating impressive
artifacts that do not prove the user-facing claim.

## Immediate Next Three Moves

1. Pick 3-5 proof-grade charts from the generated/default set and add
   user-shaped variants.
2. Generate per-chart weirdness-and-mitigations notes for every supported
   chart.
3. Start the new top-500 catalog-analysis output shape.
