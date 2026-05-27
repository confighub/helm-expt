# ConfigHub Helm Proof

This repo is trying to prove a simple thing:

```text
Use Helm charts.
Ship ConfigHub variants.
Keep the proof.
```

Helm is good at turning charts into Kubernetes YAML. The pain starts after
that: which values were used, what changed between environments, what was
approved, what was scanned, what was actually applied, and whether the same
thing can be promoted again without guessing.

The ConfigHub story is not "learn a new templating religion". The story is:

```text
take the Helm chart
turn it into an installer recipe
render the exact objects
compare them with regular Helm
scan and review them
upload them to ConfigHub
make variants safely
keep receipts
```

In one line:

```text
correct variants, safe operations, immediate proof
```

## What We Have Proved

We now have:

```text
20 bespoke public-chart proofs
80 generated full public-chart proofs
100 cub install packages
20 live use-more-now receipt sets
```

The core check is deliberately boring:

```text
regular helm template output
  == cub install setup output
  plus any explained support object, such as a Namespace
```

That matters. It means we are not waving our hands and saying "AI made a
recipe, trust us". We use AI to speed up chart analysis and recipe creation.
Then we use `cub install` and verifier scripts to prove the generated recipe
still produces the Helm-equivalent Kubernetes objects.

The current public proof set includes:

```text
Redis
Metrics Server
Ingress NGINX
cert-manager
External Secrets
Argo CD
PostgreSQL
RabbitMQ
kube-prometheus-stack
Loki
Longhorn
MySQL
Grafana
Vault
Secrets Store CSI Driver
Prometheus
MongoDB
NGINX
Tempo
Consul
```

The top-20 set is not just a spreadsheet. Each chart has a recipe, package,
variants, rendered objects, receipts, and a human-readable proof page.

Start here:

```text
docs/top20-full-proof-target.md
docs/demo/<chart>/use-more-now.md
docs/demo/<chart>/use-more-now-transcript.md
runs/<chart>-use-more-now/latest/use-more-now-receipt.yaml
runs/<chart>-use-more-now/latest/function-scan-receipt.yaml
runs/<chart>-use-more-now/latest/safe-ops-receipt.yaml
```

## What The Flow Is

The model is:

```text
Helm chart
  -> ConfigHub recipe
  -> installer package
  -> install variant / package base
  -> rendered object set
  -> ConfigHub Units
  -> server-side variants when useful
  -> scans, gates, operations, receipts
```

The full internal model has more nouns, but this is the shape that should be
visible to a Helm user:

```text
install it
see exactly what it creates
vary it safely
prove what happened
```

Recipe/package variants are used when the chart must be rendered differently:

```text
generated Secret vs existing Secret
CRDs on or off
HA mode
storage mode
ingress/TLS shape
cloud-specific values
```

`cub variant create` is used after upload when it is simpler to clone a
reviewed ConfigHub space and vary the server-side operating context:

```text
staging vs prod
region
target
metadata
gates
post-clone changes
```

So there are two kinds of variation, and we should keep them separate:

```text
render-time variation: recipe/package base
server-side variation: cub variant create
```

## What Commands Are Real Today

The proof uses current `cub` and ConfigHub commands only.

Useful installer commands:

```text
cub install doc
cub install setup
cub install render
cub install package
cub install vet
cub install upload
cub install plan
```

Useful ConfigHub commands in the proof:

```text
cub variant create
cub unit list
cub unit data
cub unit diff
cub unit approve
cub unit apply --dry-run
cub unit cancel
cub function vet
cub changeset create
cub changeset update
```

Do not read this repo as claiming future shorthand commands already exist.
For example, these are product ideas, not current executable proof commands:

```text
cub install redis
cub install analyze
cub install compare
cub install scan
cub variant promote
```

If we want those verbs, they should be proposed clearly as product asks.

## How To Verify The Repo

The main verification command is:

```sh
npm run verify
```

It checks the artifact chain, Helm equivalence, installer packages, target
facts, top-20 proof scripts, next-80 generated proofs, catalog maps, catalog
status, promotion review, and legacy patch review.

To check the live use-more-now receipts:

```sh
npm run top20:verify-use-more-now
```

To rerun the live use-more-now lane for missing charts:

```sh
npm run top20:use-more-now
```

For the Kubara demo org, large chart runs may need:

```sh
npm run top20:use-more-now -- --cleanup-spaces
```

That still runs the real ConfigHub path. It uploads Units, creates the
server-side variant, runs function checks, records safe-ops behavior, writes
receipts, and then deletes temporary live proof spaces so the demo org does not
hit its Link quota.

## What We Learned

The good news:

```text
Public Helm charts can be turned into usable cub install packages.
The generated packages can be checked against regular Helm output.
ConfigHub can store the resulting objects as reviewable Units.
Server-side variants work for staging-style clones.
Function checks and safe-operation receipts can be applied at scale.
```

The honest caveats:

```text
Top-20 catalog inclusion is mandatory because these charts are too popular to hide.
Machine proof decides the support scope, not whether a top-20 chart appears.
A recipe can be Helm-equivalent and still need production dispositions.
Secrets are separated from ConfigHub Units and need an operating policy.
CRDs, hooks, webhooks, RBAC, PVCs, generated credentials, and target facts still need explicit disposition.
Very large charts can stress ConfigHub link quotas and upload/link performance.
```

That is fine. Those are the control points we wanted to expose.

## Catalog Support

For the top-20, catalog inclusion is not optional. Their upstream charts are
popular enough that the catalog must show a clear ConfigHub path, even when the
production answer is still "supported for local/test only".

Do not confuse these three ideas:

```text
catalog entry: visible in the catalog because users will look for it
proof-grade: the machine proof passes for recorded variants
catalog-supported: explicitly approved support scope and variants
```

Today all top-20 bespoke recipes are catalog-supported for the declared
`local-test` scope. Production support is still deliberately blocked until the
scan, gate, and operating-policy findings have dispositions.

The catalog review docs are:

```text
docs/catalog-promotion-review.md
docs/catalog-promotion-next-candidates.md
docs/maintenance-sla.md
```

## Current Folder Map

The important folders are:

```text
recipes/
  human and machine-readable chart proofs

packages/
  executable cub install packages

docs/demo/
  per-chart human walkthroughs

runs/
  receipts from live or local proof runs

data/next80-full-proofs/
  generated proof index for the next 80 charts

data/top500-catalog-analysis/
  current top-500 catalog proof index and source-scan input
```

For a chart, the easiest way to understand the chain is:

```text
recipes/<repo>/<chart>/<version>/CATALOG.md
recipes/<repo>/<chart>/<version>/artifact-index.yaml
packages/<repo>/<chart>/<version>/installer.yaml
docs/demo/<chart>/use-more-now.md
runs/<chart>-use-more-now/latest/*.yaml
```

## Work Done So Far

In this phase we:

```text
removed the old top-20 render-and-vendor archive from the active pathway
made chart -> recipe -> variant -> package -> receipt easier to trace
created 100 recipe/package proof chains
added catalog status files and promotion review
added installer-native target-fact synchronization where available
updated local cub so cub variant create is available
proved Redis, NGINX, Metrics Server, and PostgreSQL through live ConfigHub lanes
expanded the live use-more-now lane to all 20 top charts
added a reusable top-20 runner and verifier
captured the Kubara Link quota issue and added quota-aware cleanup
kept npm run verify green
```

The short version for a Helm user:

```text
We can take public Helm charts, turn them into ConfigHub installer recipes,
prove the output matches Helm, upload the objects into ConfigHub, vary them,
scan them, and keep receipts for what happened.
```

## Next Tasks

The next useful work is:

1. Promote the first few catalog candidates properly, not just mechanically.
   Good next candidates are NGINX, PostgreSQL, Metrics Server, Ingress NGINX,
   and cert-manager.
2. Tighten the "best, simplest, safest" review so a recipe is judged as a
   product recommendation, not merely a successful render.
3. Rebuild the old top-500 spreadsheet in the new shape: proof status,
   catalog status, risk disposition, variants, receipts, and next action.
4. Improve target facts and preflight behavior as soon as installer support
   exists.
5. Add richer external scanner lanes for rendered objects, alongside the
   current ConfigHub function checks.
6. Add more live e2e tests for the promoted charts, starting with local kind
   where that is cheap and safe.
7. Turn repeated script patterns into product asks for Brian:
   `cub install import helm`, `cub install analyze`, `cub install compare`,
   `cub install scan`, and fuller `cub variant` lifecycle verbs.
8. Build the old-version patch lane, because maintaining safe recipes for old
   chart versions is likely commercially valuable.

## The Sales Pitch

This is the line we should keep coming back to:

```text
Helm gives you charts.
ConfigHub gives you managed, reviewable, scannable, promotable variants from those charts.
```

Or shorter:

```text
Use Helm charts. Ship ConfigHub variants.
```
