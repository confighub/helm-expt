# Catalog Read-Only Guide For Agents

**UNOFFICIAL/EXPERIMENTAL**

This guide does not redesign the catalog. Treat the catalog and chart pages as
evidence to read, not as pages to rewrite.

## Product Boundary

The public front door supports `work -> OCI`, `OCI -> work`, and
`OCI -> work -> OCI` without requiring a ConfigHub account. ConfigHub begins when a
user claims the configuration so it can be saved, changed, approved, promoted, or
rolled out.

Treat `work` as a reusable operation, not a product or a mandatory first step. It may
mean render, inspect, explain, test, scan, compare, or edit. The operation may sit
before an OCI is built, after one is pulled, or between an input OCI and an output
OCI. Local and GitHub Actions use are proven. A hosted anonymous service is planned
and must not be described as available.

Inside an existing delivery flow, distinguish ConfigHub's three roles:

- congruent pass-through: keep the specs and user-supplied metadata, add only the
  recorded `confighub.com/origin` provenance annotation, and publish a new OCI
  artifact;
- transformation: create a reviewed variant and publish the changed objects;
- fan-out: publish specific outputs or deliver one reviewed release to several
  targets.

Require input and output digests and a field comparison for each pass-through claim.
Do not infer congruent output from a successful import, or fleet rollout from one
controller becoming healthy.

Do not treat every OCI artifact as interchangeable. Check whether a link is a source
or installer package, a literal bundle for `cub variant upload`, a portable deployment
bundle, or a ConfigHub release. The consumer and receipt must match the artifact.

For source-neutral examples, start with `config-catalog/program.yaml` and
`docs/reference/config-catalog-doctrine.md`. The AICR example keeps separate receipts
for generation, OCI packaging, ConfigHub upload, required-approval behavior, and
promotion. Do not use one of those receipts to claim a later stage.

For the no-account boundary, use
`runs/serverless-oci-gitops-proof/receipt.yaml`. It proves one public installer OCI
input, isolated local rendering, one temporary output OCI, and Flux reconciliation.
It does not prove hosted output or ConfigHub operations.

For the CI execution mode, use
`runs/anonymous-oci-ci-proof/receipt.yaml`. It proves anonymous public OCI pull,
rendering, object inspection, local OCI-layout creation, and pull-back comparison in
GitHub Actions. The output is a workflow artifact, not a public registry package.

For the first continuous upgrade path, use
`runs/redis-upgrade-app-proof/receipt.yaml`. It proves one Redis package upgrade,
one retained post-render replica change, two sequential environment promotions, and
the same portable OCI digest on two Argo CD clusters. Keep its three product limits:
the promotion dry-run printed no mutations, the portable registry was temporary, and
the observations were not submitted to ConfigHub observation storage.

## What Not To Touch In This Pass

Do not edit these unless the user explicitly asks for catalog work:

- `site/charts/*.html`
- `site/charts/index.html`
- `data/master-catalog-matrix/*`
- `recipes/*/*/*/CATALOG.md`
- `packages/*/*/*/README.md`
- generated chart evidence under `data/`

If a catalog output is wrong, fix the source generator or source data in a
separate catalog task.

## Fast Read-Only Routes

| Question | Start with |
| --- | --- |
| Can I use this chart today? | `data/chart-use-guide/summary.md` |
| Where are this chart's evidence files? | `data/chart-evidence-router/summary.md` and `data/chart-evidence-router/router.csv` |
| What is the broad row status? | `data/master-catalog-matrix/matrix.html` or `data/master-catalog-matrix/matrix.csv` |
| What render-intent file exists for a real base? | `data/helm-render-intents/summary.md` and `data/helm-render-intents/intents.csv` |
| Which claims are backed or refused? | `data/claims-register/summary.md` |
| What known gaps affect the row? | `data/model-gap-workdown/summary.md`, `data/target-prerequisite-workdown/summary.md`, and `data/live-parity-decisions/summary.md` |

## Inspect One Chart From The Terminal

Use `rg` before opening large files:

```sh
rg -n "bitnami/redis|redis" data/chart-use-guide data/chart-evidence-router data/helm-render-intents
```

Then open the smallest matching source:

- chart-use row for the short recommendation;
- evidence-router row for paths to receipts and decisions;
- render-intent row for the base config;
- matrix row for lane status.

## Read A Render Intent

Start with:

```sh
rg -n "bitnami/redis|redis" data/helm-render-intents/intents.csv
```

Then open the matching YAML under `data/helm-render-intents/intents/`.

A render intent records the chart version, base, values profile, namespace,
release name, capability profile, source lock, lifecycle routes, target
prerequisites, and evidence links for a real base row. It is not a production
promise.

## How To Report Catalog Findings

When summarizing a chart, include:

- chart and version;
- recommended or inspected base;
- current route: use now, review, improve base, blocked, or refused;
- strongest evidence lane;
- known target prerequisites or lifecycle routes;
- next action and source file.

Do not claim more than the source row claims.
