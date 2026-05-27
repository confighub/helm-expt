# ConfigHub Helm Proof

This project proves a simple idea:

```text
Use Helm charts.
Ship ConfigHub variants.
Keep immediate proof.
```

Helm is good at producing Kubernetes objects. The pain usually comes after
that: values are hard to reason about, environments drift, scans happen in
different places, approvals are vague, and nobody is completely sure whether
production received the same objects that were reviewed.

This repo shows a better path for popular public Helm charts:

1. start with a real Helm chart;
2. create a `cub install` package from it;
3. render the exact Kubernetes objects;
4. compare those objects with regular Helm output;
5. store named variants and receipts;
6. scan and gate the rendered objects;
7. upload the objects to ConfigHub where they can be reviewed and varied.

In plain English:

```text
ConfigHub does not ask Helm users to trust magic.
It shows the objects, the variants, the diffs, the scans, and the receipts.
```

We use AI to accelerate Helm chart analysis and recipe creation. We use
`cub install` to prove the resulting recipes produce correct,
Helm-equivalent, reviewable ConfigHub variants.

## What This Repo Is For

Use this repo to answer four questions:

| Question | Where to look |
| --- | --- |
| Can ConfigHub produce the same objects as Helm? | `recipes/*/*/*/revisions/*/r001/receipts/helm-equivalence-receipt.yaml` |
| Can the result be installed with `cub install`? | `packages/*/*/*/installer.yaml` |
| Can users choose sensible variants? | `recipes/*/*/*/CATALOG.md` |
| Can we prove the path works? | `runs/*/latest/*.yaml`, `data/live-e2e/summary.md` |

The important claim is:

```text
correct variants, safe operations, immediate proof
```

## Current Proof

The repo currently contains:

```text
20 top-chart catalog entries with bespoke variants
20/20 local kind live/e2e receipts
20 ConfigHub use-more-now receipt sets
80 additional generated full proofs
100 cub install packages
1 top-500 catalog analysis
```

The top-20 charts are mandatory catalog entries because Helm users will expect
to find them. They are catalog-supported for the declared local/test scope.
Production support is tracked separately and remains blocked until the
production dispositions are closed.

Start with the top-20 live proof summary:

```text
data/live-e2e/summary.md
data/live-e2e/top20-local-kind.csv
```

## Quick Start

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

## Five-Minute Demo

Use Redis for the happy path.

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

## Real Commands Used Here

The proof uses current `cub` and ConfigHub commands. Useful examples include:

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

This repo also proposes future product shortcuts, but they are not used as
proof. Examples of future asks include:

```text
cub install import helm
cub install analyze
cub install compare
cub install scan
cub variant promote
```

## Catalog Status

Do not confuse catalog presence with production support.

```text
catalog entry
  The chart is visible because users will look for it.

proof-grade
  Machine proof passes for recorded variants.

catalog-supported
  ConfigHub recommends the declared variants for the declared scope.

production-supported
  Production dispositions are closed.
```

Today:

```text
top-20 catalog entries: 20
top-20 local/test supported: 20
top-20 production-supported: 0
```

That is intentional. We are proving the path first, then closing production
dispositions chart by chart.

## Why This Matters

The short version for a Helm user:

```text
You can keep using public Helm charts,
but stop approving guesses.

ConfigHub gives you named variants,
exact rendered objects,
checks,
receipts,
and a safer path from test to production.
```

The sales line:

```text
Helm gives you charts.
ConfigHub gives you managed, reviewable, scannable, promotable variants from those charts.
```

Or shorter:

```text
Use Helm charts. Ship ConfigHub variants.
```
