# ConfigHub Helm Experiment

Use Helm charts. Ship ConfigHub variants.

This repo shows how popular public Helm charts can become `cub install`
packages with named variants, exact rendered Kubernetes objects, scans, gates,
receipts, and live proof.

The short version:

```text
Helm chart
-> cub install recipe/package
-> named ConfigHub variants
-> exact rendered Kubernetes objects
-> Helm-equivalence proof, scans, gates, receipts
-> ConfigHub / OCI / GitOps handoff
```

## The Idea

Pre-rendering Helm makes the real deployment object set visible before anyone
has to approve, promote, or operate it.

In this experiment, AI helps analyze public Helm charts and draft deterministic
`cub install` recipes. The proof pipeline then checks the work mechanically:

```text
public Helm chart
-> deterministic installer recipe
-> deterministic rendered object set
-> ConfigHub variants
-> scans, gates, receipts, and live observations
```

That matters because many Helm problems are not just install-time problems.
They show up later as upgrade surprises, hidden value interactions, environment
drift, unclear ownership, unreviewed YAML changes, or uncertainty about what
actually reached a cluster.

The catalog is meant to show a better path:

```text
Day 0: install from a known recipe and inspect the exact objects.
Day 1: create variants deliberately and compare the rendered results.
Day 2: scan, promote, observe, upgrade, and audit with receipts.
```

## Why

Helm is good at producing Kubernetes objects. The pain starts when teams need
to answer ordinary operational questions:

```text
What exactly did this values file produce?
Is prod getting the same objects that staging reviewed?
Which variant changed, and why?
Did we scan the exact objects we are about to deploy?
Can we prove what was rendered, checked, uploaded, and observed?
```

ConfigHub is the proof and variant layer around those Helm-generated objects.
The goal is not to replace Helm. The goal is to make Helm output reviewable,
comparable, scannable, promotable, and auditable.

We use AI to accelerate Helm chart analysis and recipe creation. We use
`cub install` to prove the resulting recipes produce correct, Helm-equivalent,
reviewable ConfigHub variants.

## What Is Proven Today

```text
20 popular Helm charts have catalog entries.
20/20 have passing local kind live/e2e receipts.
20/20 have ConfigHub use-more-now proof receipts.
100 charts have recipe/package proof artifacts.
Top-500 chart analysis exists as catalog-planning data.
```

The current top-20 live proof means:

```text
rendered ConfigHub/cub-install objects
-> kubectl apply to local kind
-> rollout/object checks pass
-> observation receipt is committed and verified
```

It does not yet mean:

```text
Argo CD or Flux pulled ConfigHub OCI and synced the cluster
```

That GitOps lane is the intended delivery path, but it needs its own live proof
before we claim it as tested end to end.

Start here:

```text
data/live-e2e/summary.md
data/production-disposition/summary.md
```

## Try It

You need Node.js to run the proof scripts. There are no npm dependencies and no
`npm install` step.

```sh
git clone https://github.com/confighub/helm-expt.git
cd helm-expt
npm run top20:verify-local-e2e
```

Expected result:

```text
verified 20 top20 local kind e2e receipt(s)
```

Run the full repository verifier:

```sh
npm run verify
```

That checks recipe/package structure, Helm equivalence, rendered object
digests, receipts, catalog status, target facts, local live/e2e receipts,
production disposition, and top-500 analysis.

## Five-Minute Redis Demo

Redis is the happy-path demo because it is small, familiar, and still exercises
the important proof chain.

Read the runnable script:

```text
docs/demo/redis/demo-script.md
```

The demo uses real commands, including:

```sh
cub install setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis

npm run redis:compare
npm run verify
```

The full ConfigHub upload command is in `docs/demo/redis/demo-script.md`; it is
longer because it records labels such as component, layer, owner, chart version,
variant, and proof.

The key Redis proof files are:

```text
recipes/bitnami/redis/25.5.3/CATALOG.md
packages/bitnami/redis/25.5.3/installer.yaml
recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml
runs/redis-local-kind/latest/observation-receipt.yaml
```

## How A Chart Is Organized

For every chart, read the catalog page first:

```text
recipes/<repo>/<chart>/<version>/CATALOG.md
```

That page links the chart source, recipe, variants, package, rendered objects,
receipts, scans, and current support status.

The main folders are:

```text
recipes/
  Chart analysis, variants, rendered objects, receipts, and catalogs.

packages/
  Executable cub install packages.

docs/demo/
  Plain-English per-chart walkthroughs and transcripts.

runs/
  Receipts from ConfigHub, local kind, and proof runs.

data/live-e2e/
  Top-20 local kind live/e2e summary.

data/production-disposition/
  What is still required before production support.

data/top500-catalog-analysis/
  Current top-500 analysis and proof index.
```

## ConfigHub And GitOps

To use the ConfigHub proof path, you need a ConfigHub account, an organization,
and an authenticated `cub` CLI:

```sh
cub auth login --server https://hub.confighub.com
```

The intended GitOps path is:

1. Choose a chart from `recipes/*/*/*/CATALOG.md`.
2. Choose a catalog variant.
3. Verify the rendered objects and receipts.
4. Upload or publish the rendered ConfigHub objects to ConfigHub OCI.
5. Point Argo CD or Flux at that ConfigHub OCI artifact.
6. Let GitOps sync the cluster.
7. Record or inspect an observation receipt.

Today this repo proves the chart -> recipe -> variant -> rendered objects path
for the top 20, and proves local kind deployment for those rendered objects. A
public Argo CD / Flux live proof is still a separate lane to add.

## Current Commands Used

These are real commands used by the current proof path:

```text
cub install doc
cub install setup
cub install render
cub install package
cub install vet
cub install plan
cub install upload
cub variant create
cub unit list
cub unit data
cub unit diff
cub function vet
cub changeset create
```

## The Pitch

```text
You can keep using public Helm charts,
but stop approving guesses.

ConfigHub gives you named variants,
exact rendered objects,
checks,
receipts,
and a safer path from test to production.
```

Helm gives you charts. ConfigHub gives you managed, reviewable, scannable,
promotable variants from those charts.
