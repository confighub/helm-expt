# Model Support Report (Level 2)

Generated from recipe / pain-report / receipt / catalog-status artifacts. A chart is **supported (Level 2)**
when all 6 support criteria pass — every Helm quirk modeled or explicitly disclosed (`needs-operator-decision`
/ `blocked` are honest dispositions, not gaps).

This is a model-support report, not the whole live outcome. Full chart-choice support still needs the
lane-test matrix: Helm-equivalence, ConfigHub proof, local live observation, ConfigHub OCI/Argo or Flux,
and live Helm-vs-ConfigHub parity for each supported default or declared main choice.

**Variant richness is a separate enhancement metric** until a choice is declared supported. Once declared
supported, that choice must be tracked as its own chart-recipe-variant row in `data/lane-test-matrix/`.

## Headline

```text
charts: 100
supported (Level 2, all 6): 100
not yet supported: 0
variant-rich (enhancement, >1 variant): 54
```

## Per-criterion coverage (the 6 support criteria)

- `render_equivalent`: 100/100
- `behaviorally_complete`: 100/100
- `readable`: 100/100
- `usable`: 100/100
- `verifiable`: 100/100
- `honestly_scoped`: 100/100
- _enhancement_ `variant_complete`: 54/100  (not a support criterion)

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
- **`variant_complete` is an ENHANCEMENT for the Level-2 model report.** A default-only chart can have a
  complete model for its declared scope, but it is not fully live-supported for unbuilt or undeclared
  main choices. Once a non-default choice is declared supported, it must get its own lane evidence.
- Re-run `npm run completeness:generate` after any chart's pain report, receipts, or catalog-status change.
