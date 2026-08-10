# Top-100 Coverage Work Queue

This generated file turns the strict top-100 coverage contract into the next
work queues. It is not a production support claim. It says which missing
evidence or product decision would move a partial row toward covered.

## Summary

~~~text
partial rows: 89
promotion-review: 39
user-shaped-variant: 37
limitation-decision: 7
supported-refresh: 0
~~~

## Queues

| Queue | Rows | First step | Done when |
| --- | ---: | --- | --- |
| `limitation-decision` | 7 | decide whether to support, disclose, defer, or block: named limitation | the limitation has a recorded support, disclosure, deferral, or blocker decision |
| `promotion-review` | 39 | run catalog promotion review, choose one supported base, then add selected live evidence | scan/disposition evidence exists and at least one selected base has live witness or routed deferral |
| `user-shaped-variant` | 37 | design one realistic base variant a Helm user would actually choose | a realistic named base variant exists and the chart moves to promotion or limitation review |
| `supported-refresh` | 0 | refresh target-scoped production support evidence | fresh target-scoped receipts support the current claim |
| `review` | 6 | review row and choose the next evidence lane | the row has a concrete next action and evidence path |

## First Rows

| Priority | Queue | Chart | Coverage | Missing | First step |
| ---: | --- | --- | ---: | --- | --- |
| 1 | `limitation-decision` | `bitnami/apache@11.4.29` | 88% | f | decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle) |
| 1 | `limitation-decision` | `bitnami/contour@21.1.4` | 88% | f | decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle) |
| 1 | `limitation-decision` | `bitnami/elasticsearch@22.1.6` | 88% | f | decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle) |
| 1 | `limitation-decision` | `bitnami/phpmyadmin@20.0.0` | 88% | f | decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle) |
| 1 | `limitation-decision` | `bitnami/spark@10.0.3` | 88% | f | decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle) |
| 1 | `limitation-decision` | `bitnami/zookeeper@13.8.7` | 88% | f | decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle) |
| 1 | `limitation-decision` | `grafana/pyroscope@2.0.2` | 88% | f | decide whether to support, disclose, defer, or block: existing-secret (chart ships no Secret toggle) |
| 2 | `promotion-review` | `aqua/trivy-operator@0.32.1` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `argo-cd/argo-events@2.4.21` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `argo-cd/argo-rollouts@2.40.9` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `argo-cd/argo-workflows@1.0.14` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `autoscaler/cluster-autoscaler@9.57.0` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `autoscaler/vertical-pod-autoscaler@0.9.0` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `cloudnative-pg/cloudnative-pg@0.28.2` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `elastic/eck-operator@3.4.0` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `elastic/logstash@8.5.1` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `external-dns/external-dns@1.21.1` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `fairwinds-stable/vpa@4.11.0` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `gatekeeper/gatekeeper@3.22.2` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |
| 2 | `promotion-review` | `grafana/alloy@1.8.2` | 88% | f | run catalog promotion review, choose one supported base, then add selected live evidence |

## Files

| File | Use |
| --- | --- |
| [work-queue.csv](./work-queue.csv) | Spreadsheet queue with every partial row. |
| [decisions-needed.md](./decisions-needed.md) | Human decision memos for limitation-decision rows. |
| [coverage.csv](./coverage.csv) | Strict item-by-item coverage contract. |
| [../top100-readiness/summary.md](../top100-readiness/summary.md) | Broader top-100 readiness view. |

Regenerate:

~~~sh
npm run top100:coverage
npm run top100:coverage:verify
~~~
