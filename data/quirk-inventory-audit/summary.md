# Quirk Inventory Audit: Source vs Modeled vs Proof

**UNOFFICIAL/EXPERIMENTAL — hand-reviewed audit snapshot, 2026-06-10.**

Some tables mix "the source scan saw this quirk" with "the catalog models it"
and "a receipt proves it." Those are three different numbers. This audit lists
all three, per quirk, so undercounting and overclaiming are visible:
[top100-source-vs-modeled.csv](./top100-source-vs-modeled.csv).

## Method

- **source_top100_count** — charts with the quirk among the 100
  highest-ranked rows of the committed source feature scan
  (`data/top500-catalog-analysis/source/source-feature-scan.raw.json`).
  Static analysis of pinned chart archives.
- **modeled_catalog_count** — charts whose quirk is recorded in the maintained
  corpus (`data/chart-facts/chart-facts.csv` columns,
  `data/top100-readiness/readiness.csv` source-feature tokens, or the
  maintained hook queue). "Not tracked" means no maintained axis exists.
- **proof_observation_count** — receipts or observations that exercise the
  quirk specifically. "Covered by render parity, not isolated" means the
  quirk's *output* is inside a proven render but no quirk-level claim exists.

No existing generator was modified; this is an independent snapshot. Numbers
change when the sources change; re-derive before quoting.

## Where We Risk Undercounting

1. **Five quirk axes are not tracked at all in the modeled corpus:**
   APIService aggregation (5 source charts), `semverCompare` (71),
   `.Files.Get` (31), non-exact dependency constraints (26), and remote
   dependencies (47). The last two matter most: dependency ranges and remote
   subcharts are refresh-survival and provenance risks with no modeled axis.
2. **The two "top-100s" are different lists.** Source rank and modeled proof
   rank disagree on membership (the modeled corpus has 37 CRD charts; the
   source top-100 has 24). Any table comparing the columns without saying
   which list it counts is wrong by construction.
3. **Top-20 rows carry no source-feature tokens**, so modeled counts for
   lookup, capabilities, tpl, RBAC, and storage are systematically understated
   for exactly the charts with the most proof.
4. **Hook reality is wider than the queue.** 11 source-top-100 charts carry
   hooks; 5 are modeled in the maintained queue, and 5/5 maintained queue
   receipts are now observed. The reviewed delta is in
   `data/hook-lifecycle-review/`. Hook delete policies and weights are only
   tracked once a chart enters the queue — and the queue counts 4
   weight-bearing charts where the source scan counts 3, a counting
   inconsistency to reconcile.

## Where We Risk Overclaiming

1. **"Covered by render parity" is not quirk proof.** tpl (88 charts),
   `semverCompare` (71), required/fail (71), and `.Files.Get` (31) are inside
   proven renders for modeled charts, under one values profile and one pinned
   capability profile. Reading that as "tpl is proven" or "works on other
   Kubernetes versions" is an overclaim; 81 source charts touch
   `.Capabilities`.
2. **Webhook and CRD runtime lifecycle proof covers 2 charts** (cert-manager,
   External Secrets). It demonstrates the observation pattern, not webhook
   support across the 21 source charts that ship webhooks.
3. **Definitional drift can read as coverage.** chart-facts
   `extension_slots` (82) is broader than the scan's raw/extra-manifest count
   (65); the scan's generated-function count (60) is broader than modeled
   generated facts (29) and generated Secrets (23). Comparing across
   definitions inflates apparent coverage.

## Suggested Next Actions

- Add modeled axes (or an explicit "won't track" decision) for the five
  untracked quirks, starting with remote/non-exact dependencies.
- Populate source-feature tokens for the top-20 rows, or document that
  chart-facts is their only quirk source.
- Reconcile the hook-weight counting difference between the queue and scan.
- Label every cross-table count with which top-100 list it uses.
