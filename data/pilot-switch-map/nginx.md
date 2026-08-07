# nginx switch-effect map

Classified by rendering, not by hand. Every switch below was auto-extracted
from the chart's own values (`oci://registry-1.docker.io/bitnamicharts/nginx@24.0.2`), flipped, and the
rendered object set compared against the baseline (6 objects).
A switch that changes the object set is **structural** and belongs in a base
variant. A switch that only changes field values is a **data edit** on a
derived variant. The verdict is the diff, not an opinion.

## Structural switches (change the object set)

| Switch | Objects | Adds | Removes |
| --- | --- | --- | --- |
| `tls.enabled=false` | 5 | - | `v1/Secret/nginx-tls` |
| `autoscaling.enabled=true` | 7 | `autoscaling/v2/HorizontalPodAutoscaler/nginx` | - |
| `networkPolicy.enabled=false` | 5 | - | `networking.k8s.io/v1/NetworkPolicy/nginx` |
| `httpRoute.enabled=true` | 7 | `gateway.networking.k8s.io/v1/HTTPRoute/nginx` | - |
| `ingress.enabled=true` | 7 | `networking.k8s.io/v1/Ingress/nginx` | - |
| `healthIngress.enabled=true` | 7 | `networking.k8s.io/v1/Ingress/nginx-health` | - |

## Data-edit switches (values only, no object-set change)

| Switch | Objects |
| --- | --- |
| `diagnosticMode.enabled=true` | 6 (unchanged set) |
| `podSecurityContext.enabled=false` | 6 (unchanged set) |
| `containerSecurityContext.enabled=false` | 6 (unchanged set) |
| `startupProbe.enabled=true` | 6 (unchanged set) |
| `livenessProbe.enabled=false` | 6 (unchanged set) |
| `readinessProbe.enabled=false` | 6 (unchanged set) |
| `backendTLSPolicy.enabled=true` | 6 (unchanged set) |
| `metrics.enabled=true` | 6 (unchanged set) |

## Switches that failed to render when flipped

| Switch | Error |
| --- | --- |
| `cloneStaticSiteFromGit.enabled=true` | Command failed: helm template nginx oci://registry-1.docker.io/bitnamicharts/nginx --version 24.0.2 --namespace nginx --values <tmp> --kube-version 1.30.0
Pulled: registry-1.docker.io/bitnamicharts/ng |

A flip that breaks the render is itself a finding: the chart requires more than the toggle to enable that feature.

## What this means

Of 15 switches tested, 6 are structural,
8 are data edits, and 1 refuse to render without more inputs.
Naming the structural axes as base variants and leaving the rest as data
edits avoids both the values-file sprawl and the combinatorial explosion.
Switches were tested independently; a generated variant renders the actual
combination and proves parity, so interaction effects are caught at
generation, not assumed here.

