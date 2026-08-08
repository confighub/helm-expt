# postgresql switch-effect map

Classified by rendering, not by hand. Every switch below was auto-extracted
from the chart's own values (`oci://registry-1.docker.io/bitnamicharts/postgresql@18.6.10`), flipped, and the
rendered object set compared against the baseline (7 objects).
A switch that changes the object set is **structural** and belongs in a base
variant. A switch that only changes field values is a **data edit** on a
derived variant. The verdict is the diff, not an opinion.

## Structural switches (change the object set)

| Switch | Objects | Adds | Removes |
| --- | --- | --- | --- |
| `architecture=replication` | 12 | `networking.k8s.io/v1/NetworkPolicy/postgresql-primary`<br>`networking.k8s.io/v1/NetworkPolicy/postgresql-read`<br>`policy/v1/PodDisruptionBudget/postgresql-primary`<br>`policy/v1/PodDisruptionBudget/postgresql-read`<br>`v1/Service/postgresql-primary-hl`<br>`v1/Service/postgresql-primary`<br>`v1/Service/postgresql-read-hl`<br>`v1/Service/postgresql-read`<br>`apps/v1/StatefulSet/postgresql-primary`<br>`apps/v1/StatefulSet/postgresql-read` | `networking.k8s.io/v1/NetworkPolicy/postgresql`<br>`policy/v1/PodDisruptionBudget/postgresql`<br>`v1/Service/postgresql-hl`<br>`v1/Service/postgresql`<br>`apps/v1/StatefulSet/postgresql` |
| `backup.enabled=true` | 10 | `networking.k8s.io/v1/NetworkPolicy/postgresql-pgdumpall`<br>`v1/PersistentVolumeClaim/postgresql-pgdumpall`<br>`batch/v1/CronJob/postgresql-pgdumpall` | - |
| `passwordUpdateJob.enabled=true` | 9 | `v1/Secret/postgresql-new-secret`<br>`batch/v1/Job/postgresql-password-update` | - |
| `serviceBindings.enabled=true` | 8 | `v1/Secret/postgresql-svcbind-postgres` | - |
| `metrics.enabled=true` | 8 | `v1/Service/postgresql-metrics` | - |

## Data-edit switches (values only, no object-set change)

| Switch | Objects |
| --- | --- |
| `diagnosticMode.enabled=true` | 7 (unchanged set) |
| `ldap.enabled=true` | 7 (unchanged set) |
| `shmVolume.enabled=false` | 7 (unchanged set) |
| `volumePermissions.enabled=true` | 7 (unchanged set) |

## Switches that failed to render when flipped

| Switch | Error |
| --- | --- |
| `tls.enabled=true` | Command failed: helm template postgresql oci://registry-1.docker.io/bitnamicharts/postgresql --version 18.6.10 --namespace postgresql --values <tmp> --kube-version 1.30.0 Pulled: registry-1.docker.io/ |

A flip that breaks the render is itself a finding: the chart requires more than the toggle to enable that feature.

## What this means

Of 10 switches tested, 5 are structural,
4 are data edits, and 1 refuse to render without more inputs.
Naming the structural axes as base variants and leaving the rest as data
edits avoids both the values-file sprawl and the combinatorial explosion.
Switches were tested independently; a generated variant renders the actual
combination and proves parity, so interaction effects are caught at
generation, not assumed here.

