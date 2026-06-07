# Helm Pain Point Coverage

This generated report maps the 15 common Helm pain points to the current
helm-expt catalog, the ConfigHub desired-state graph, `cub installer`, and
`cub-scout`.

The purpose is not to claim every pain is fully solved today. The purpose is to
show where each pain is handled now, where it is a handoff, and what evidence or
work remains.

## Status Counts

- partial: 5
- partial-doctrine: 1
- partial-handoff: 1
- partial-known-gap: 1
- partial-live-dependent: 1
- partial-live-lane: 1
- partial-product-lane: 1
- partial-strong-on-redis: 1
- strong-current-proof: 1
- strong-for-supported-bases: 1
- strong-static-partial-operational: 1

## Root Cause Model

Helm is a 1-to-many generator. One chart plus one values set can produce many
objects, and one high-density value can touch many fields across those objects.
After render, Helm loses the inverse: the output no longer explains which input
produced each field. Multiple generators such as Helm, Kustomize, GitOps
controllers, and agents multiply the problem unless their outputs and provenance
enter one graph.

## What To Open

| File | Purpose |
| --- | --- |
| [pain-points.csv](./pain-points.csv) | One row per pain point with current answer, handoff, evidence, and remaining gap. |
| [../../docs/user/helm-pain-points.md](../../docs/user/helm-pain-points.md) | User-facing explanation of the same matrix. |
| [../outcome-coverage/summary.md](../outcome-coverage/summary.md) | Outcome and proof-lane status per chart/base/feature. |
| [../variant-path-coverage/summary.md](../variant-path-coverage/summary.md) | Per chart/base/path proof status. |

## Regenerate

~~~sh
npm run pain-points:generate
npm run pain-points:verify
~~~
