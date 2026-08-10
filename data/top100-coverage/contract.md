# Top-100 Coverage Contract

This file defines what "covered" means for the maintained top-100 corpus.
Coverage is stricter than render parity. A chart can be useful, proof-grade,
and still only partly covered until live evidence, production disposition, or a
routed limitation exists for the declared scope.

## Contract Items

| Item | Requirement | Meaning |
| --- | --- | --- |
| a | pinned chart version | The row names a chart version and points at a retained recipe source lock. |
| b | reviewed named base variant | At least one named base variant is present with a catalog rationale. |
| c | render parity receipt | Every declared base variant has Helm-template versus cub installer render parity. |
| d | pain report and quirk axes | The per-chart pain report and control-point notes exist. |
| e | facts declared | Target facts, generated facts, values, and control points are represented in recipe artifacts. |
| f | scan and production disposition | Scan and production-disposition evidence exists for the current support scope. |
| g | live witness or routed reason | At least one supported base has live evidence, or the deferred live route is explicit. |
| h | catalog and site entry | The row has a per-chart catalog page and appears in the generated public site data. |

## Status Values

| Value | Meaning |
| --- | --- |
| `pass` | The item has a concrete evidence path in `coverage.csv`. |
| `todo` | The item is not yet covered for the chart. Read `next_action`. |
| `n-a` | The item is not applicable to the row. Current generator rarely uses this; absence should normally be explicit work, not hidden. |

## How To Use This

Use [coverage.csv](./coverage.csv) as the work queue. A row is `covered` only
when all eight contract items are `pass` or `n-a`.

This is not a production support claim. Production support still needs a
target-scoped decision and fresh receipts.

## Current Aggregate

~~~text
charts: 109
covered: 20
partial: 89
average coverage: 87%
~~~

Regenerate:

~~~sh
npm run top100:coverage
npm run top100:coverage:verify
~~~
