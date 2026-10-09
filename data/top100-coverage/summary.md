# Top-100 Coverage

This generated report applies the top-100 coverage contract to every maintained
chart. It shows where the corpus is complete and where the next work is
required.

## Summary

~~~text
charts: 122
covered: 20
partial: 102
average coverage: 85%
~~~

## Coverage By Item

| Item | Requirement | Pass | Todo | N/A |
| --- | --- | ---: | ---: | ---: |
| a | pinned chart version | 122 | 0 | 0 |
| b | reviewed named base variant | 122 | 0 | 0 |
| c | render parity receipt | 122 | 0 | 0 |
| d | pain report and quirk axes | 113 | 9 | 0 |
| e | facts declared | 122 | 0 | 0 |
| f | scan and production disposition | 20 | 102 | 0 |
| g | live witness or routed reason | 85 | 37 | 0 |
| h | catalog and site entry | 122 | 0 | 0 |

## Coverage By Bucket

| Bucket | Charts |
| --- | ---: |
| `try-from-public-catalog` | 20 |
| `promote-after-review` | 40 |
| `needs-useful-variant` | 37 |
| `limitation-decision-first` | 7 |
| `not-ready` | 18 |

## Lowest Coverage Rows

| Chart | Coverage | Bucket | Next action |
| --- | ---: | --- | --- |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.59.0` | 63% | `not-ready` | review source/current-version drift and refresh recipe if needed |
| `dra-driver-nvidia/dra-driver-nvidia-gpu@0.4.1` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `eks/aws-efa-k8s-device-plugin@v0.5.29` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `k8s-ephemeral-storage-metrics/k8s-ephemeral-storage-metrics@1.19.2` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `kai-scheduler/kai-scheduler@v0.14.1` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `kubeflow/kubeflow-trainer@2.2.0` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `node-feature-discovery/node-feature-discovery@0.19.0` | 63% | `not-ready` | review source/current-version drift and refresh recipe if needed |
| `nvidia/nodewright@v0.17.1` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `prometheus-community/prometheus-operator-crds@28.0.1` | 63% | `not-ready` | review source/current-version drift and refresh recipe if needed |
| `aws-controllers-k8s/ec2-chart@1.18.4` | 75% | `not-ready` | review chart analysis and create a recipe candidate |
| `aws-controllers-k8s/eks-chart@1.16.3` | 75% | `not-ready` | review chart analysis and create a recipe candidate |
| `aws-controllers-k8s/iam-chart@1.7.3` | 75% | `not-ready` | review chart analysis and create a recipe candidate |
| `cloudpirates/nginx@0.16.1` | 75% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `cloudpirates/rabbitmq@0.21.13` | 75% | `promote-after-review` | run catalog promotion review |
| `cloudpirates/redis@0.34.11` | 75% | `promote-after-review` | run catalog promotion review |

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
