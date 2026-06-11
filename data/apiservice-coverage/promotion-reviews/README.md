# APIService Promotion Review Packets

Generated. Do not edit by hand.

These packets are review inputs for APIService charts that have enough runtime
evidence to discuss promotion scope. They are not catalog status changes.

## Current Packets

| Chart | Version | Selected base | Decision state | Catalog support claim allowed | APIService condition | Aggregated query | Packet |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `kedacore/keda` | 2.19.0 | default | `review-input-only` | false | yes | yes | [kedacore-keda-2.19.0.yaml](./kedacore-keda-2.19.0.yaml) |

## Rule

An APIService promotion packet means the selected chart/base has enough evidence
to review catalog scope. It does not claim production support. Promotion still
needs selected base scope, CRD ownership, webhook readiness, scan/gate
disposition, and evidence freshness decisions.

Regenerate:

~~~sh
npm run apiservice:coverage
npm run apiservice:coverage:verify
~~~
