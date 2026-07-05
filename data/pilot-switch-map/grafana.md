# grafana switch-effect map

Classified by rendering, not by hand. Every switch below was auto-extracted
from the chart's own values (`https://grafana.github.io/helm-charts#grafana@10.5.15`), flipped, and the
rendered object set compared against the baseline (12 objects).
A switch that changes the object set is **structural** and belongs in a base
variant. A switch that only changes field values is a **data edit** on a
derived variant. The verdict is the diff, not an opinion.

## Structural switches (change the object set)

| Switch | Objects | Adds | Removes |
| --- | --- | --- | --- |
| `autoscaling.enabled=true` | 13 | `autoscaling/v2/HorizontalPodAutoscaler/grafana` | - |
| `testFramework.enabled=false` | 9 | - | `v1/ServiceAccount/grafana-test`<br>`v1/ConfigMap/grafana-test`<br>`v1/Pod/grafana-test` |
| `service.enabled=false` | 11 | - | `v1/Service/grafana` |
| `serviceMonitor.enabled=true` | 13 | `monitoring.coreos.com/v1/ServiceMonitor/grafana` | - |
| `ingress.enabled=true` | 13 | `networking.k8s.io/v1/Ingress/grafana` | - |
| `persistence.enabled=true` | 13 | `v1/PersistentVolumeClaim/grafana` | - |
| `imageRenderer.enabled=true` | 15 | `networking.k8s.io/v1/NetworkPolicy/grafana-image-renderer-ingress`<br>`v1/Service/grafana-image-renderer`<br>`apps/v1/Deployment/grafana-image-renderer` | - |
| `networkPolicy.enabled=true` | 13 | `networking.k8s.io/v1/NetworkPolicy/grafana` | - |

## Data-edit switches (values only, no object-set change)

| Switch | Objects |
| --- | --- |
| `initChownData.enabled=false` | 12 (unchanged set) |
| `ldap.enabled=true` | 12 (unchanged set) |

## What this means

Of 10 switches tested, 8 are structural,
2 are data edits.
Naming the structural axes as base variants and leaving the rest as data
edits avoids both the values-file sprawl and the combinatorial explosion.
Switches were tested independently; a generated variant renders the actual
combination and proves parity, so interaction effects are caught at
generation, not assumed here.

