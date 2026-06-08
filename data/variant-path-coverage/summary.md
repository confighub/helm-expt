# Variant Path Coverage

This generated report tracks proof status at the chart, base-variant, and
variant-path level. It exists because Helm quirks do not always belong to the
whole chart. Some appear only in a base variant, a diff between bases, a derived
ConfigHub variant, or an upgrade/customization path.

## Rows By Path Type

- base-to-base-diff: 1
- base-variant: 156
- derived-confighub-variant: 10
- upgrade-simulation: 2

## Rows By Live Status

- fail: 14
- missing: 130
- not-attempted: 10
- not-tested: 2
- not-tested-by-diff: 1
- pass: 12

## How To Use This Matrix

Open [coverage-matrix.csv](./coverage-matrix.csv) when asking:

- which base variants have render and installer proof;
- which diffs introduce target facts or object-shape changes;
- which derived variants are post-render ConfigHub changes;
- which upgrade or rollback paths are simulated rather than live-proven;
- which rows still need GitOps or live evidence.

This matrix does not replace per-chart receipts. It points to them.

## Regenerate

~~~sh
npm run variant-paths:generate
npm run variant-paths:verify
~~~
