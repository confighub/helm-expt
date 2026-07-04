# Redis switch-effect map

Classified by rendering, not by hand. Each switch below was flipped on the
redis chart and the rendered object set compared against the baseline
(14 objects). A switch that changes the object set is
**structural** and belongs in a base variant. A switch that only changes
field values is a **data edit** on a derived variant. The verdict is the
diff, not an opinion.

## Structural switches (change the object set)

| Switch | Objects | Adds | Removes |
| --- | --- | --- | --- |
| `architecture=standalone` | 10 | - | `policy/v1/PodDisruptionBudget/redis-replicas`<br>`v1/ServiceAccount/redis-replica`<br>`v1/Service/redis-replicas`<br>`apps/v1/StatefulSet/redis-replicas` |
| `sentinel.enabled` | 10 | `policy/v1/PodDisruptionBudget/redis-node`<br>`v1/ServiceAccount/redis`<br>`v1/Service/redis`<br>`apps/v1/StatefulSet/redis-node` | `policy/v1/PodDisruptionBudget/redis-master`<br>`policy/v1/PodDisruptionBudget/redis-replicas`<br>`v1/ServiceAccount/redis-master`<br>`v1/ServiceAccount/redis-replica`<br>`v1/Service/redis-master`<br>`v1/Service/redis-replicas`<br>`apps/v1/StatefulSet/redis-master`<br>`apps/v1/StatefulSet/redis-replicas` |
| `metrics.enabled` | 15 | `v1/Service/redis-metrics` | - |
| `tls.enabled` | 15 | `v1/Secret/redis-crt` | - |
| `networkPolicy.enabled=false` | 13 | - | `networking.k8s.io/v1/NetworkPolicy/redis` |
| `serviceBindings.enabled` | 15 | `v1/Secret/redis-svcbind` | - |

## Data-edit switches (values only, no object-set change)

| Switch | Objects |
| --- | --- |
| `podSecurityPolicy.enabled` | 14 (unchanged set) |
| `volumePermissions.enabled` | 14 (unchanged set) |
| `replica.replicaCount=5` | 14 (unchanged set) |
| `master.count=2` | 14 (unchanged set) |

## What this means

Of 10 switches tested, 6 are structural and
4 are data edits. Naming the structural axes as base variants
and leaving the rest as data edits avoids both the values-file sprawl and the
combinatorial explosion. The switches were tested independently; a generated
variant renders the actual combination and proves parity, so interaction
effects are caught at generation, not assumed here.

