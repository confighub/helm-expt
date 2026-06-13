# Top-100 Coverage

This generated report applies the top-100 coverage contract to every maintained
chart. It shows where the corpus is complete and where the next work is
required.

## Summary

~~~text
charts: 100
covered: 20
partial: 80
average coverage: 88%
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
| g | live witness or routed reason | 83 | 17 | 0 |
| h | catalog and site entry | 100 | 0 | 0 |

## Coverage By Bucket

| Bucket | Charts |
| --- | ---: |
| `try-from-public-catalog` | 20 |
| `limitation-decision-first` | 7 |
| `promote-after-review` | 37 |
| `needs-useful-variant` | 35 |
| `not-ready` | 1 |

## Lowest Coverage Rows

| Chart | Coverage | Bucket | Next action |
| --- | ---: | --- | --- |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `bitnami/opensearch@2.0.10` | 75% | `promote-after-review` | run catalog promotion review |
| `dex/dex@0.24.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `elastic/filebeat@8.5.1` | 75% | `promote-after-review` | run catalog promotion review |
| `elastic/kibana@8.5.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `elastic/metricbeat@8.5.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `gitlab/gitlab-runner@0.89.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `hashicorp/terraform@1.1.2` | 75% | `promote-after-review` | run catalog promotion review |
| `istio/gateway@1.30.0` | 75% | `promote-after-review` | run catalog promotion review |
| `istio/istiod@1.30.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `jaegertracing/jaeger-operator@2.57.0` | 75% | `promote-after-review` | run catalog promotion review |
| `jetstack/trust-manager@v0.22.1` | 75% | `promote-after-review` | run catalog promotion review |
| `nats/surveyor@0.20.9` | 75% | `promote-after-review` | run catalog promotion review |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `opencost/opencost@2.5.21` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |

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
