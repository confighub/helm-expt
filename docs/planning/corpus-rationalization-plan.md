# Corpus rationalization plan

Planning doc. Status: ACTIVE, drafted 2026-06-11. The corpus has grown by
accretion — each work wave added a view, and nothing was ever merged or
retired — so the truth is now spread across 69 `data/` directories, ~115
CSVs, and ~150 authored docs. The verifiers keep every view *internally*
fresh, but freshness is not the same as legibility: several views answer the
same question with different columns, and a reader cannot tell which one is
authoritative. This plan names the redundancies precisely and queues the
consolidations.

## Why this happened (so the fix prevents recurrence)

1. Every mission added its own generated view; no mission was ever chartered
   to merge or retire one.
2. Verifiers gate staleness, not redundancy: two views of the same fact both
   stay green.
3. There was no rule requiring a new view to declare its granularity and its
   nearest-neighbor view before being added.

## The instruments that make consolidation safe (already in place)

- `data/master-catalog-matrix/` — the variant-granularity hub (csv + md +
  colored html). Consumers can switch to it, which is what lets narrower
  views retire.
- `data/doc-freshness/` — flags every authored doc whose linked evidence
  moves, so retirements cannot silently strand prose.
- `npm run docs:verify` — fails on broken links, so a retired path cannot
  leave dangling references.

## The redundancy map (named, column-level)

### R1. Variant-lane truth exists twice (highest value, do first)

`data/lane-test-matrix/variant-lanes.csv` and
`data/outcome-coverage/base-outcomes.csv` are the same granularity
(chart@version × variant) and carry the same five lanes under different
names:

| lane-test-matrix | outcome-coverage |
| --- | --- |
| helm_template_vs_installer_setup | render_parity |
| confighub_upload_variant_scan_safe_ops | in_confighub |
| local_kind_kubectl_apply | local_live |
| confighub_oci_argo_live | gitops_oci_live |
| live_helm_vs_confighub_dual_compare | live_helm_vs_confighub_parity |

Both also carry `complete_core_lane_set`, `recipe_path`, `package_path`,
`variant_revision`. `base-outcomes.csv` is the superset: it adds
`outcome_level` and `two_cluster_kind_parity` (+reason).

**Sharpened diagnosis (2026-06-11):** the relationship is source -> derived,
not two independent truths: `generate-outcome-coverage.mjs` reads
`variant-lanes.csv` as input and emits `base-outcomes.csv` as the superset.
The redundancy is that the *intermediate* is also published as a
reader-facing view. Re-spining the master matrix onto `base-outcomes.csv`
produced a byte-identical matrix.csv, confirming the derived view is
faithful.

**Proposal:** make `outcome-coverage/base-outcomes.csv` the single
*published* variant-lane truth. Status: the master matrix no longer reads
`variant-lanes.csv` (done; byte-identical output). Remaining (loop lane):
re-point `generate-variant-path-coverage.mjs`, then either fold
lane-test-matrix's receipt-reading logic into outcome-coverage or keep
variant-lanes as an unpublished intermediate (drop its summary/doc surface
and data-index row). One published lane view afterwards.

### R2. The hook family is six directories

`hook-coverage`, `hook-disposition`, `hook-lifecycle`,
`hook-lifecycle-review`, `hook-route-candidates`, plus the adjacent
`lifecycle-boundary` and `lifecycle-observations`. They are stages of the
same pipeline that each kept their scaffolding.

**Proposal:** two surviving homes — `hook-disposition` (the routing truth:
which charts have hooks and what we do about them, with the completeness
gate) and `hook-lifecycle` (the exercised receipts). Fold or mark historical:
`hook-coverage` (early scan, superseded by disposition), `hook-route-candidates`
(work queue that fed dispositions; archive once drained),
`hook-lifecycle-review` (review wave output; fold conclusions into
dispositions). `lifecycle-boundary`/`lifecycle-observations` stay — different
subject (CRDs/controllers, not hooks).

### R3. The readiness family is three views plus the matrix

`status-dashboard/top20-status.csv`, `top100-readiness/readiness.csv`,
`top20-base-readiness/base-readiness.csv`, and now the master matrix all
describe chart/variant readiness with overlapping columns (lane ratios,
buckets, recommended bases).

**Proposal:** one view per audience, no column overlap:
`top100-readiness/readiness.csv` keeps chart-granularity adoption truth
(tier, bucket, next action); the master matrix is the variant-granularity
truth; `status-dashboard` keeps only rollup metrics and queues (no per-chart
lane columns — link the matrix instead); `top20-base-readiness` merges its
per-base recommendation columns into the matrix or readiness and retires.

### R4. Planning docs outlive their plans

26 active planning docs, many describing completed waves. doc-freshness now
flags them when their referenced evidence moves, but completed plans should
move to `docs/planning/archive/` (the archive already exists and is excluded
from freshness tracking as frozen).

**Proposal:** sweep planning docs whose queues are drained into the archive,
with a one-line pointer to the artifact that superseded them.

## Rules going forward (the part that stops re-accretion)

1. **A new view must name its granularity** (chart / chart@version / variant /
   value-path / claim / env-cell) **and its nearest existing view**, in its
   summary header. If the nearest view has the same granularity, extend it
   instead of adding a sibling.
2. **Retire with redirects:** a retired view's summary.md is replaced by a
   one-paragraph stub pointing at the successor for one release cycle, then
   deleted (docs:verify keeps links honest both times).
3. **Every wave that adds a view must also name its retire/merge candidate**
   ("add one, look at one").
4. **The master matrix is the entry point** for "what is the state of X" —
   front doors (README, CATALOG, status dashboard) link it rather than
   re-listing per-chart status.

## Sequencing and ownership

| Step | What | Owner lane |
| --- | --- | --- |
| 1 | R1 lane-truth merge (re-point master matrix + dashboard consumers, deprecate lane-test-matrix) | automation loop (owns both generators) |
| 2 | R3 dashboard slimming + base-readiness merge | automation loop |
| 3 | R2 hook-family fold (after the current hook waves drain) | automation loop |
| 4 | R4 planning archive sweep | either lane, low risk |
| 5 | Adopt rules 1–4 in the contributing/agents guidance | repo owner decision |

None of these steps delete evidence — receipts, runs, and recipes are
untouched. Only redundant *views* over the same evidence are merged, and
every merge keeps one verifier-backed successor.
