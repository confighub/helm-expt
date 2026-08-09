# Top-100 Coverage

This generated report applies the top-100 coverage contract to every maintained
chart. It shows where the corpus is complete and where the next work is
required.

## Summary

~~~text
charts: 109
covered: 20
partial: 89
average coverage: 86%
~~~

## Coverage By Item

| Item | Requirement | Pass | Todo | N/A |
| --- | --- | ---: | ---: | ---: |
| a | pinned chart version | 109 | 0 | 0 |
| b | reviewed named base variant | 109 | 0 | 0 |
| c | render parity receipt | 100 | 9 | 0 |
| d | pain report and quirk axes | 100 | 9 | 0 |
| e | facts declared | 109 | 0 | 0 |
| f | scan and production disposition | 20 | 89 | 0 |
| g | live witness or routed reason | 87 | 22 | 0 |
| h | catalog and site entry | 109 | 0 | 0 |

## Coverage By Bucket

| Bucket | Charts |
| --- | ---: |
| `try-from-public-catalog` | 20 |
| `limitation-decision-first` | 9 |
| `promote-after-review` | 37 |
| `needs-useful-variant` | 37 |
| `not-ready` | 6 |

## Lowest Coverage Rows

| Chart | Coverage | Bucket | Next action |
| --- | ---: | --- | --- |
| `aws-controllers-k8s/ec2-chart@1.18.4` | 50% | `not-ready` | review chart analysis and create a recipe candidate |
| `aws-controllers-k8s/eks-chart@1.16.3` | 50% | `not-ready` | review chart analysis and create a recipe candidate |
| `aws-controllers-k8s/iam-chart@1.7.3` | 50% | `not-ready` | review chart analysis and create a recipe candidate |
| `cloudpirates/nginx@0.16.1` | 50% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `cloudpirates/rabbitmq@0.21.13` | 50% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `cloudpirates/redis@0.34.11` | 50% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `karpenter/karpenter@1.14.0` | 50% | `not-ready` | review source/current-version drift and refresh recipe if needed |
| `nvidia/nvidia-device-plugin@0.19.3` | 50% | `not-ready` | review chart analysis and create a recipe candidate |
| `valkey/valkey@0.11.0` | 50% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `dex/dex@0.24.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `elastic/filebeat@8.5.1` | 75% | `promote-after-review` | run catalog promotion review |
| `elastic/kibana@8.5.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `elastic/metricbeat@8.5.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `gitlab/gitlab-runner@0.89.0` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |

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
