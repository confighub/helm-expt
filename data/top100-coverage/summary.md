# Top-100 Coverage

This generated report applies the top-100 coverage contract to every maintained
chart. It shows where the corpus is complete and where the next work is
required.

## Summary

~~~text
charts: 122
covered: 20
partial: 102
average coverage: 84%
~~~

## Coverage By Item

| Item | Requirement | Pass | Todo | N/A |
| --- | --- | ---: | ---: | ---: |
| a | pinned chart version | 122 | 0 | 0 |
| b | reviewed named base variant | 122 | 0 | 0 |
| c | render parity receipt | 122 | 0 | 0 |
| d | pain report and quirk axes | 107 | 15 | 0 |
| e | facts declared | 122 | 0 | 0 |
| f | scan and production disposition | 20 | 102 | 0 |
| g | live witness or routed reason | 79 | 43 | 0 |
| h | catalog and site entry | 122 | 0 | 0 |

## Coverage By Bucket

| Bucket | Charts |
| --- | ---: |
| `try-from-public-catalog` | 20 |
| `needs-useful-variant` | 46 |
| `promote-after-review` | 34 |
| `limitation-decision-first` | 7 |
| `not-ready` | 15 |

## Lowest Coverage Rows

| Chart | Coverage | Bucket | Next action |
| --- | ---: | --- | --- |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `cloudnative-pg/cloudnative-pg@0.29.0` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `dra-driver-nvidia/dra-driver-nvidia-gpu@0.5.0` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `kai-scheduler/kai-scheduler@v0.16.9` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `kyverno/kyverno-policies@3.9.0` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `kyverno/kyverno@3.9.0` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `nvidia/gpu-operator@v26.7.1` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `nvidia/k8s-nim-operator@3.1.2` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `nvidia/nodewright@v0.19.0` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `nvidia/nvsentinel@v1.26.0` | 63% | `not-ready` | review chart analysis and create a recipe candidate |
| `percona/psmdb-operator@1.23.0` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `prometheus-community/prometheus-blackbox-exporter@11.18.0` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `stakater/reloader@2.2.16` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `traefik/traefik@41.4.0` | 63% | `needs-useful-variant` | add at least one user-shaped variant before catalog promotion |
| `aws-controllers-k8s/ec2-chart@1.18.4` | 75% | `not-ready` | review chart analysis and create a recipe candidate |

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
