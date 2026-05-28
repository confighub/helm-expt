# ConfigHub Helm Experiment

This project shows how standard Helm charts map into ConfigHub

```text
Upstream Helm charts map into installer recipes
ConfigHub creates a set of usable variants
Deploy these using Argo or Flux
```

Helm is good at producing Kubernetes objects. Any pain usually comes after
that: people make changes, values may be hard to reason about, environments drift, 
and more.  Suddenly nobody is completely sure whether production received the same 
objects that were reviewed.

ConfigHub provides a place to store configs that can be customised, reasoned about
and changed into 'variants' for specific deployment scenarios.  In this repo we
use AI to analyse public Helm charts and create a deterministic installation.

We use https://github.com/confighub/installer 

1. start with a real Helm chart;
2. we create a `cub install` package from it;
3. render the exact Kubernetes objects;
4. compare those objects with regular Helm output;
5. store named variants and receipts;
6. scan and gate the rendered objects;
7. upload the objects to ConfigHub where they can be reviewed and varied.

In plain English: a non-magical way to use Helm safely, even if you want
to make custom changes, explicitly showing the objects, the diffs and more.

We have used AI for Helm chart analysis and recipe creation. We use
`cub install` to prove the resulting recipes produce correct, safe and
Helm-equivalent, reviewable ConfigHub variants for 'correct operations'.

## Key Areas of Work

We try to answer four questions:

| Question | Where to look |
| --- | --- |
| Can ConfigHub produce the same objects as Helm? | `recipes/*/*/*/revisions/*/r001/receipts/helm-equivalence-receipt.yaml` |
| Can the result be installed with `cub install`? | `packages/*/*/*/installer.yaml` |
| Can users choose sensible, usable, realistic variants? | `recipes/*/*/*/CATALOG.md` |
| Can we prove the Helm-ConfigHub-K8s path works? | `runs/*/latest/*.yaml`, `data/live-e2e/summary.md` |


## Five-Minute Demo

Requires local Kubernetes tooling such as kind, kubectl, and Helm.

Example: Use Redis for the happy path.

1. Open the catalog page:

   ```text
   recipes/bitnami/redis/25.5.3/CATALOG.md
   ```

2. Show the available variants:

   ```text
   default
   reuse-existing-secret
   ```

3. Show the executable `cub install` package:

   ```text
   packages/bitnami/redis/25.5.3/installer.yaml
   ```

4. Show the exact rendered objects:

   ```text
   recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/object-inventory.yaml
   recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml
   ```

5. Show proof that the objects match regular Helm:

   ```text
   recipes/bitnami/redis/25.5.3/revisions/default/r001/receipts/helm-equivalence-receipt.yaml
   ```

6. Show the local live/e2e receipt:

   ```text
   runs/redis-local-kind/latest/observation-receipt.yaml
   ```

Then close with one harder chart, such as cert-manager,
kube-prometheus-stack, Vault, or Consul. The point is not that hard charts are
risk-free. The point is that ConfigHub makes their risks visible as control
points, receipts, scans, and production dispositions.

## How A Chart Is Organized

For each chart, the path is:

```text
Helm chart
  -> recipe
  -> cub install package
  -> named variants
  -> rendered object set
  -> receipts and scans
  -> ConfigHub Units
```

The matching folders are:

```text
recipes/<repo>/<chart>/<version>/
packages/<repo>/<chart>/<version>/
runs/<chart>-use-more-now/latest/
```

The easiest file to read first is always:

```text
recipes/<repo>/<chart>/<version>/CATALOG.md
```

That file links the chart, recipe, variants, package, rendered objects, and
receipts.

## Verifying Helm is correctly used and deployed

Run the full repo verifier:

```sh
npm run verify
```

That checks the recipe/package chain, Helm equivalence, rendered object
digests, receipts, catalog status, target facts, local e2e receipts, and the
generated top-500 analysis.

For just the top-20 live/e2e receipts:

```sh
npm run top20:verify-local-e2e
```

For just the top-20 ConfigHub use-more-now receipts:

```sh
npm run top20:verify-use-more-now
```

To rebuild the top-20 local kind evidence, use:

```sh
npm run top20:local-e2e
```
That requires local Kubernetes tooling such as kind, kubectl, and Helm.

## What The Main Folders Mean

```text
recipes/
  Human and machine-readable chart proofs.

packages/
  Executable cub install packages.

docs/demo/
  Plain-English per-chart walkthroughs.

runs/
  Receipts from ConfigHub, local kind, and proof runs.

data/live-e2e/
  Top-20 local kind live/e2e summary.

data/production-disposition/
  What is still required before production support.

data/top500-catalog-analysis/
  Current top-500 analysis and proof index.
```

## How it works (state today)

We use current `cub` and ConfigHub commands:

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

Potential future commands might be:

```text
cub install import helm
cub install analyze
cub install compare
cub install scan
cub variant promote
```


## Current Repo

The repo currently contains 20 top-chart catalog entries with bespoke variants which have been live tested.  

Start with the top-20 live proof summary:

```text
data/live-e2e/summary.md
data/live-e2e/top20-local-kind.csv
```

Tell your friends:

```text
You can keep using public Helm charts,
but stop approving guesses.

ConfigHub gives you named variants,
exact rendered objects,
checks,
receipts,
and a safer path from test to production.
```

```text
Helm gives you charts.
ConfigHub gives you managed, reviewable, scannable, promotable variants from those charts.
```

```text
Use Helm charts. Ship ConfigHub variants.
```
