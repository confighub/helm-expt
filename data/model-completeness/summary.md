# Model Support Report (Level 2)

Generated from recipe / pain-report / receipt / catalog-status artifacts. A chart is **supported (Level 2)**
when all 6 support criteria pass — every Helm quirk modeled or explicitly disclosed (`needs-operator-decision`
/ `blocked` are honest dispositions, not gaps). **Variant richness is a separate enhancement metric**, never
part of the support verdict (per `docs/user/customization-decision-tree.md`: variants enrich, they don't gate support).

## Headline

```text
charts: 100
supported (Level 2, all 6): 100
not yet supported: 0
variant-rich (enhancement, >1 variant): 20
```

## Per-criterion coverage (the 6 support criteria)

- `render_equivalent`: 100/100
- `behaviorally_complete`: 100/100
- `readable`: 100/100
- `usable`: 100/100
- `verifiable`: 100/100
- `honestly_scoped`: 100/100
- _enhancement_ `variant_complete`: 20/100  (not a support criterion)

## Gap by criterion (how many charts each one blocks)

- none — every chart is supported (Level 2)

## Not yet supported (the work queue)

| Chart | Score | Missing support criteria |
| --- | ---: | --- |
| none | 6/6 | — |

## Notes

- **Supported (Level 2)** = the 6 criteria above all pass: render-equivalent · quirks accounted (pain report,
  no unknown/unhandled) · readable · usable · verifiable · honestly scoped. Quirks left as
  `needs-operator-decision` are *disclosed*, not silent — the human-review residue, tracked per chart in
  `helm-pain-report.yaml`; they do not block Level-2 support.
- **`variant_complete` is an ENHANCEMENT, not a support gap.** A chart is fully supported with just its
  default; extra base variants (no-crds, existing-secret, ha, …) enrich it and are built deliberately.
- Re-run `npm run completeness:generate` after any chart's pain report, receipts, or catalog-status change.
