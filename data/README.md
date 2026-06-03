# Catalog data — current data and how to regenerate it

Every file under `data/` is **generated** from the recipes + the source scan. This is the index of
what each artifact is, which is canonical, and the one command that refreshes it. All generators have a
`*:verify` twin that regenerates in memory and fails if the committed file is stale.

## Per-chart facts — the row-by-row view

| File | What it is |
| --- | --- |
| `data/chart-facts/chart-facts.csv` | **One row per chart** (100): post-deploy/other hooks, secrets, CRDs, webhooks, required-values, values-schema, install-vs-upgrade, NOTES, extension-slots, variants built, buildable backlog, and `not_yet_enabled` (the hard gap). |
| `data/chart-facts/summary.md` | Headline counts + the table of charts with an open gap. |
| `data/chart-facts/chart-facts.json` | Machine map (consumed by the top-500/100 analyses). |

```bash
npm run chart-facts          # regenerate
npm run chart-facts:verify   # fail if stale
```

Column reference: [`docs/reference/quirk-coverage.md`](../docs/reference/quirk-coverage.md).

## Top-500 catalog analysis

| File | What it is |
| --- | --- |
| `data/top500-catalog-analysis/review.csv` | **Canonical** front sheet — one row per top-500 chart (incl. `not_yet_enabled`). |
| `data/top500-catalog-analysis/drilldown.csv` | Wide per-chart evidence (control-point counts, proof columns). |
| `data/top500-catalog-analysis/summary.md` | Human summary + promotion candidates. |
| `data/top500-catalog-analysis/raw.json` | Machine report. |
| `data/top500-catalog-analysis/source/` | Historical source-feature scan input. |

```bash
npm run top500:catalog        # regenerate (reads chart-facts.json — run chart-facts first)
npm run top500:catalog:verify
```

> No `.xlsx` here on purpose: `review.csv` is the canonical front sheet. The old `review.xlsx`
> export depended on a workbook builder that isn't in this repo's toolchain, so it drifted stale and
> was removed. Open `review.csv` in any spreadsheet; rebuild a workbook from it if you need `.xlsx`.

## Top-100 proof surface

`data/top100-catalog-analysis/{review.csv,summary.md,raw.json}` — the proof-surface ranking of the
100 charts with recipes (also carries `not_yet_enabled`).

Use this with `data/chart-facts/summary.md` when asking "what works, what works
with help, and what is not enabled yet":

```text
top100 summary       proof surface and catalog status
chart facts          per-chart quirks and hard gaps
model completeness   Level-2 support under declared scope
variant backlog      recommended variants still to build
```

```bash
npm run top100:catalog && npm run top100:catalog:verify
```

## Coverage, backlog, and waves

| Path | What it is | Regenerate |
| --- | --- | --- |
| `data/model-completeness/` | supported (Level 2) + variant-rich counts | `npm run completeness:generate` |
| `data/variant-backlog/backlog.csv` | what each chart still needs (recommended − built) | `npm run variant-backlog:generate` |
| `data/variant-backlog/wave-plans/<wave>.json` | per-wave build plan (ha, no-crds, …) | hand-authored |
| `data/variant-backlog/wave-results/<wave>.json` | per-wave results (promoted / declined + reason) | `node scripts/run-variant-wave.mjs <wave>` |
| `data/quirk-review-queue/` | the Level-2 residue, made actionable | `npm run quirk-queue:generate` |
| `data/attack-plan-workdown/` | generated next-action index for import, gaps, variants, production, runtime/GitOps, latest candidates, and image digests | `npm run attack-plan:generate` |
| `data/runtime-gitops/` | first-wave Argo/Flux OCI live-proof plan and required receipt index | `npm run runtime-gitops:wave` |
| `data/image-digest-workdown/` | rendered image digest review queue by chart and variant | `npm run image-digests:workdown` |
| `data/next-ten-waves/` | compact first rows for gaps, latest promotion, variants, production disposition, and import examples | `npm run next-ten:waves` |

Per-chart dispositions live next to each recipe: `recipes/<chart>/helm-pain-report.yaml`
(`npm run catalog:pain-reports`) and `recipes/<chart>/control-points.yaml`.

## Regenerate everything, in dependency order

```bash
npm run catalog:pain-reports        # per-chart dispositions (from control-points)
npm run variant-backlog:generate    # what each chart still needs
npm run completeness:generate       # Level-2 + variant-rich counts
npm run quirk-queue:generate        # residue
npm run chart-facts                 # per-chart facts (reads the above + the source scan)
npm run catalog:status && npm run catalog:maps   # catalog-status + per-chart artifact-index (maps last)
npm run top500:catalog              # reads chart-facts.json
npm run top100:catalog              # reads top500 + chart-facts.json
npm run catalog:index               # CATALOG.md
npm run attack-plan:generate        # reads the refreshed data and emits the workdown index
npm run runtime-gitops:wave         # first GitOps/OCI receipt wave from the sweep
npm run image-digests:workdown      # image pinning review queue
npm run next-ten:waves              # compact execution queues for the next work
```

The dependency that matters most: **`chart-facts` before `top500`/`top100`** (they read
`chart-facts.json` for the `not_yet_enabled` column), and **`catalog:maps` last** among the catalog
generators (the per-chart `artifact-index.yaml` reads `catalog-status.yaml`).
