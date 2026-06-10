# Top-100 Coverage

This generated report applies the top-100 coverage contract to every maintained
chart. It shows where the corpus is complete and where the next work is
required.

## Summary

~~~text
charts: 100
covered: 20
partial: 80
average coverage: 83%
~~~

## Coverage By Item

| Item | Requirement | Pass | Todo | N/A |
| --- | --- | ---: | ---: | ---: |
| a | pinned chart version | 100 | 0 | 0 |
| b | reviewed named base variant | 100 | 0 | 0 |
| c | render parity receipt | 100 | 0 | 0 |
| d | pain report and quirk axes | 100 | 0 | 0 |
| e | facts declared | 100 | 0 | 0 |
| f | scan and production disposition | 20 | 80 | 0 |
| g | live witness or routed reason | 43 | 57 | 0 |
| h | catalog and site entry | 100 | 0 | 0 |

## Coverage By Bucket

| Bucket | Charts |
| --- | ---: |
| `try-from-public-catalog` | 20 |
| `limitation-decision-first` | 7 |
| `promote-after-review` | 27 |
| `needs-useful-variant` | 46 |

## Lowest Coverage Rows

| Chart | Coverage | Bucket | Next action |
| --- | ---: | --- | --- |
| `aqua/trivy-operator@0.32.1` | 75% | `promote-after-review` | run catalog promotion review |
| `argo-cd/argo-events@2.4.21` | 75% | `promote-after-review` | run catalog promotion review |
| `argo-cd/argo-rollouts@2.40.9` | 75% | `promote-after-review` | run catalog promotion review |
| `argo-cd/argo-workflows@1.0.14` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `autoscaler/cluster-autoscaler@9.57.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | 75% | `promote-after-review` | run catalog promotion review |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `bitnami/opensearch@2.0.10` | 75% | `promote-after-review` | run catalog promotion review |
| `coredns/coredns@1.45.2` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `crossplane-stable/crossplane@2.3.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `descheduler/descheduler@0.36.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `dex/dex@0.24.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `elastic/filebeat@8.5.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `elastic/kibana@8.5.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `elastic/metricbeat@8.5.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |

## Files

| File | Use |
| --- | --- |
| [contract.md](./contract.md) | Human-readable definition of covered. |
| [coverage.csv](./coverage.csv) | One row per top-100 chart with item statuses and evidence paths. |
| [work-queue.md](./work-queue.md) | Human-readable queue for the remaining 80 partial rows. |
| [work-queue.csv](./work-queue.csv) | Spreadsheet queue: promotion review, user-shaped variants, and limitation decisions. |
| [decisions-needed.md](./decisions-needed.md) | Human decision memos for limitation-decision rows. |

Regenerate:

~~~sh
npm run top100:coverage
npm run top100:coverage:verify
~~~
