# Three pillars brief

**UNOFFICIAL/EXPERIMENTAL.** A brief for Codex, for review before execution. Make three
properties of the catalog explicit and consistent across the website, the catalog pages, the
project README, and the planning docs. Write everything in the house voice
(`docs/planning/house-voice.md`) and lead with value and evidence, not with cub commands.

## Why

Teams that install Helm charts, and teams that install OCI packages such as AICR, share the same
three problems: too many settings to get right, no proof it is safe before it ships, and a pile of
imperative steps (hooks, CRDs, setup jobs) that may or may not work. The catalog already answers all
three. It just does not say so plainly. This brief names the three answers and puts them everywhere a
reader looks, so someone who finds cub installer confusing can still see the value in one read.

The catalog is not Helm-only. An AICR package is another source in the same shape: it is an OCI
package that is already hardened at build time with a small install-time surface. It belongs in the
catalog beside Helm charts, under the same three pillars.

## The three pillars

Each pillar is a promise, then the catalog data that already backs it.

### 1. Most choices are made and checked before you install

Almost every setting is fixed and reviewed at build time. What is left to set is small, typed, and
cannot be misused. You install a reviewed package, not a pile of knobs.

Backed by: the base variant and its render intent record the fixed choices (chart version, values
profile, source lock, capability profile). The install-time surface is the short typed set already
named in the model — namespace, target facts, image overrides, and an existing-secret name. This is
the same shape AICR uses, so the pillar reads true for both sources.

### 2. You can read the proof before you ship

Every package carries evidence that it works, recorded as receipts you can open. Problems are caught
on the config as data, before anything reaches a cluster.

Backed by: render parity and local-cluster lanes run per base variant where their receipts are present.
A separate routed-hook fixture proves that the same ConfigHub release OCI can be consumed through
Argo, Flux, and direct apply. That mechanism receipt is not a delivery receipt for every base variant.
Checks run on the Unit data before apply, including schema and placeholder gates, object diffs, blast
radius, and target capability checks. A team can inspect the evidence attached to its chosen base
instead of assuming that another row's result applies.

### 3. The messy parts are named and proven, never hidden

Hooks, CRDs, ordering, and generated secrets do not disappear. Each one is a named route with a
recorded contract, a receipt under every delivery path, and an honest marker for whether it is safe
to run automatically.

Backed by: the route model (`observe → execute → emit`, `automatic: false` until earned) and the
committed proofs. The CRD-ordering receipt shows plain bundle-order apply failing and
CRD-first-with-wait succeeding on the recorded direct path. The routed-hook fixture separately ran
through Argo, Flux, and direct apply. The config change stays declarative; only the work that must run
at delivery time is handled separately, observed, and recorded.

## Where each pillar lands

### Website

Add one page, `site/pillars.html` (generated in `scripts/generate-public-site.mjs`), titled around
the three promises. Open with one plain paragraph on the shared problem, then a section per pillar:
the promise first, then the catalog evidence that backs it, then a link to a real example
(a chart page and the CRD-ordering proof). Name Helm and AICR as two sources in the same shape. Close
with one line that says cub installer is how you get a package, not something you must learn first.

Link the page from the homepage (a fourth promise line or a card) and from How it works. Keep it
vendor-neutral in the sense the house rule means: name the open source tools (Helm, OCI, AICR, cub
installer) freely, but do not describe anyone as a partner and do not name companies.

### Catalog

On each chart page, group what already renders under the three pillar headings, using that chart's
own data. Pillar 1 shows the typed install surface. Pillar 2 shows the receipts and lane results.
Pillar 3 shows the routes and their dispositions. Charts with no routes (such as redis) say so
plainly under pillar 3, which is itself the honest answer.

### Project

State the three pillars as the project thesis at the top of `README.md`, and add a short doctrine
note under `docs/` that ties each pillar to the model term that backs it (base variant, render
intent, proof lane, route). Mention AICR once, as the second source that already fits the shape.

### Plans

This brief is the plan. The strategy summary that frames the wider OCI direction is kept separately
and is not part of this repo.

## Constraints

- House voice throughout. No verbless colon headlines, no colon-then-list drum rolls, no em-dash
  asides, no drum-roll openers.
- Lead with value and evidence. cub commands appear second, as the way to get a package.
- Name Helm, OCI, AICR, and cub installer freely. Do not use partner language and do not name
  companies.
- Add nothing the evidence does not already back. Every pillar claim points at committed data.

## Verification for Codex

- `npm run site:generate` with `HELM_EXPT_SITE_GENERATED_AT` pinned, so the diff is content-only.
- `npm run site:verify` and `npm run site:ux:verify` pass. Add `site/pillars.html` to the UX
  contract checks and the human-split list in `scripts/verify-site-ux-contract.mjs`, with pin terms
  drawn from the three pillar headings.
- Read the rendered page end to end before opening the PR.
