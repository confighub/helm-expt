# redis switch-effect map

Classified by rendering, not by hand. Every switch below was auto-extracted
from the chart's own values (`oci://registry-1.docker.io/bitnamicharts/redis@25.5.3`), flipped, and the
rendered object set compared against the baseline (14 objects).
A switch that changes the object set is **structural** and belongs in a base
variant. A switch that only changes field values is a **data edit** on a
derived variant. The verdict is the diff, not an opinion.

## Structural switches (change the object set)

| Switch | Objects | Adds | Removes |
| --- | --- | --- | --- |
| `architecture=standalone` | 10 | - | `policy/v1/PodDisruptionBudget/redis-replicas`<br>`v1/ServiceAccount/redis-replica`<br>`v1/Service/redis-replicas`<br>`apps/v1/StatefulSet/redis-replicas` |
| `auth.enabled=false` | 13 | - | `v1/Secret/redis` |
| `sentinel.enabled=true` | 10 | `policy/v1/PodDisruptionBudget/redis-node`<br>`v1/ServiceAccount/redis`<br>`v1/Service/redis`<br>`apps/v1/StatefulSet/redis-node` | `policy/v1/PodDisruptionBudget/redis-master`<br>`policy/v1/PodDisruptionBudget/redis-replicas`<br>`v1/ServiceAccount/redis-master`<br>`v1/ServiceAccount/redis-replica`<br>`v1/Service/redis-master`<br>`v1/Service/redis-replicas`<br>`apps/v1/StatefulSet/redis-master`<br>`apps/v1/StatefulSet/redis-replicas` |
| `serviceBindings.enabled=true` | 15 | `v1/Secret/redis-svcbind` | - |
| `networkPolicy.enabled=false` | 13 | - | `networking.k8s.io/v1/NetworkPolicy/redis` |
| `metrics.enabled=true` | 15 | `v1/Service/redis-metrics` | - |

## Data-edit switches (values only, no object-set change)

| Switch | Objects |
| --- | --- |
| `diagnosticMode.enabled=true` | 14 (unchanged set) |
| `podSecurityPolicy.enabled=true` | 14 (unchanged set) |
| `volumePermissions.enabled=true` | 14 (unchanged set) |
| `sysctl.enabled=true` | 14 (unchanged set) |
| `useExternalDNS.enabled=true` | 14 (unchanged set) |

## Switches that failed to render when flipped

| Switch | Error |
| --- | --- |
| `tls.enabled=true` | Command failed: helm template redis oci://registry-1.docker.io/bitnamicharts/redis --version 25.5.3 --namespace redis --values <tmp> --kube-version 1.30.0 Pulled: registry-1.docker.io/bitnamicharts/re |

A flip that breaks the render is itself a finding: the chart requires more than the toggle to enable that feature.

## What this means

Of 12 switches tested, 6 are structural,
5 are data edits, and 1 refuse to render without more inputs.
Naming the structural axes as base variants and leaving the rest as data
edits avoids both the values-file sprawl and the combinatorial explosion.
Switches were tested independently; a generated variant renders the actual
combination and proves parity, so interaction effects are caught at
generation, not assumed here.

