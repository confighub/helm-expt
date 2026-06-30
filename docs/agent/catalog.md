# Catalog Read-Only Guide For Agents

**UNOFFICIAL/EXPERIMENTAL**

The first AX pass does not redesign the catalog. Treat the catalog and chart
pages as evidence to read, not as pages to rewrite.

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
| What compact render config exists for a real base? | `data/helm-render-intents/summary.md` and `data/helm-render-intents/intents.csv` |
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
- render-intent row for the compact base config;
- matrix row for lane status.

## Read A Render Intent

Start with:

```sh
rg -n "bitnami/redis|redis" data/helm-render-intents/intents.csv
```

Then open the matching YAML under `data/helm-render-intents/intents/`.

A render intent is not a production promise. It records the chart version,
base, values profile, namespace, release name, capability profile, source lock,
known lifecycle routes, target prerequisites, and evidence links for a real
base row.

## How To Report Catalog Findings

When summarizing a chart, include:

- chart and version;
- recommended or inspected base;
- current route: use now, review, improve base, blocked, or refused;
- strongest evidence lane;
- known target prerequisites or lifecycle routes;
- next action and source file.

Do not claim more than the source row claims.

