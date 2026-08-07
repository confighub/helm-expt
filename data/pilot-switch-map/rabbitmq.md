# rabbitmq switch-effect map

Classified by rendering, not by hand. Every switch below was auto-extracted
from the chart's own values (`oci://registry-1.docker.io/bitnamicharts/rabbitmq@16.0.14`), flipped, and the
rendered object set compared against the baseline (10 objects).
A switch that changes the object set is **structural** and belongs in a base
variant. A switch that only changes field values is a **data edit** on a
derived variant. The verdict is the diff, not an opinion.

## Structural switches (change the object set)

| Switch | Objects | Adds | Removes |
| --- | --- | --- | --- |
| `serviceBindings.enabled=true` | 11 | `v1/Secret/rabbitmq-svcbind` | - |
| `ingress.enabled=true` | 11 | `networking.k8s.io/v1/Ingress/rabbitmq` | - |
| `networkPolicy.enabled=false` | 9 | - | `networking.k8s.io/v1/NetworkPolicy/rabbitmq` |

## Data-edit switches (values only, no object-set change)

| Switch | Objects |
| --- | --- |
| `diagnosticMode.enabled=true` | 10 (unchanged set) |
| `clustering.enabled=false` | 10 (unchanged set) |
| `loadDefinition.enabled=true` | 10 (unchanged set) |
| `tcpListenOptions.enabled=false` | 10 (unchanged set) |
| `podSecurityContext.enabled=false` | 10 (unchanged set) |
| `containerSecurityContext.enabled=false` | 10 (unchanged set) |
| `livenessProbe.enabled=false` | 10 (unchanged set) |
| `readinessProbe.enabled=false` | 10 (unchanged set) |
| `startupProbe.enabled=true` | 10 (unchanged set) |
| `persistence.enabled=false` | 10 (unchanged set) |
| `persistentVolumeClaimRetentionPolicy.enabled=true` | 10 (unchanged set) |
| `metrics.enabled=true` | 10 (unchanged set) |
| `volumePermissions.enabled=true` | 10 (unchanged set) |

## Switches that failed to render when flipped

| Switch | Error |
| --- | --- |
| `memoryHighWatermark.enabled=true` | Command failed: helm template rabbitmq oci://registry-1.docker.io/bitnamicharts/rabbitmq --version 16.0.14 --namespace rabbitmq --values <tmp> --kube-version 1.30.0
Pulled: registry-1.docker.io/bitnam |
| `ldap.enabled=true` | Command failed: helm template rabbitmq oci://registry-1.docker.io/bitnamicharts/rabbitmq --version 16.0.14 --namespace rabbitmq --values <tmp> --kube-version 1.30.0
Pulled: registry-1.docker.io/bitnam |

A flip that breaks the render is itself a finding: the chart requires more than the toggle to enable that feature.

## What this means

Of 18 switches tested, 3 are structural,
13 are data edits, and 2 refuse to render without more inputs.
Naming the structural axes as base variants and leaving the rest as data
edits avoids both the values-file sprawl and the combinatorial explosion.
Switches were tested independently; a generated variant renders the actual
combination and proves parity, so interaction effects are caught at
generation, not assumed here.

