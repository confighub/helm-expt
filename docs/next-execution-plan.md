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
1 explicit catalog-supported recipe: bitnami/redis@25.5.3
19 catalog candidates
80 proof-grade recipes
```

Important boundary:

```text
Machine proof is not catalog support.
Catalog support must be explicit in catalog-status.yaml.
```

## P0 Gates

### P0.1 Merge The Archive Cleanup / Catalog Status PR

Purpose:

```text
Make the active repo match the current story.
```

Acceptance:

- old top-20 archive is removed from active tree
- Redis points at `packages/bitnami/redis/25.5.3`
- `catalog-status.yaml` exists for all 100 recipes
- `npm run verify` passes
- `data/catalog-promotion-review/summary.md` reports:
  - `machine checks pass: 100`
  - `catalog-supported: 1`
  - `recipes with non-current executable fixture path: 0`

### P0.2 Make Chart -> Recipe -> Variant Obvious

Problem:

The current structure is mechanically coherent but hard to read. A new reader
does not immediately see:

```text
chart -> recipe -> variants -> revisions -> package bases -> receipts
```

Action:

Add a generated per-chart map:

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

Current packages mostly use installer bases. They prove `cub install setup`
against Helm output, but they do not yet use the full installer package model.

Action:

For Redis and the next five candidates, review whether the package should use:

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

Acceptance:

- Redis has an installer-capability gap review.
- Target facts are either:
  - represented as installer-native `externalRequires` / fact requirements, or
  - explicitly documented as proof-layer-only pending installer support.
- At least one promoted candidate uses installer-native inputs or components,
  not only bases.

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
- Redis/ConfigHub demo should include a simple server-side clone when useful,
  for example from a reviewed Redis base space to a staging or regional space.
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
  review.xlsx
  summary.md
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

## P1 Execution

### P1.1 Promote The Next Five Catalog Candidates

Recommended order:

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

1. Merge the archive-cleanup/catalog-status PR.
2. Add Redis `CATALOG.md` + `artifact-index.yaml` to make the chart -> recipe
   -> variant path obvious.
3. Use the now-available `cub variant create` in the Redis/ConfigHub demo after
   a reviewed upstream Redis space exists, so users can see when server-side
   cloning is simpler than another Helm-derived package base.
