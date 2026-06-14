# GitOps Health Residue

This generated report classifies ConfigHub OCI/GitOps live rows where the
controller health signal is not a clean pass. It is designed for large charts
where render parity, sync, and workload readiness may pass while a controller
aggregate health bit still needs explanation.

The report does not turn a `watch` row into a `pass`. It names what the
receipt contains so the next action is specific.

```text
rows: 1
aggregate-progressing-with-blank-resource-health: 1
```

## Rows

| Chart | Base | Result | Classification | Child App | Root App | Argo tree | Resources | Blank health | Residue | Receipt | Next action |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| `hashicorp/consul@2.0.0` | secure-mesh-existing-secrets | watch | aggregate-progressing-with-blank-resource-health | Synced/Progressing | Synced/Healthy | pass | 97 | 97 | 0 | [receipt](../../runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml) | Decide the target-scoped controller-health policy: root Application is Healthy, child Application is Synced/Progressing, workloads converged, and the Argo core tree shows blank child-resource health. |

## How To Read This

- `resource-or-condition-residue` means a specific resource health value,
  sync state, or Application condition needs to be handled.
- `aggregate-progressing-with-blank-resource-health` means Argo reports the
  Application aggregate as `Progressing`, but the captured resource list does
  not identify an unhealthy child resource. This is a controller-health review
  row, not a render-parity defect.
- `blocked-before-controller-health` and `failed-before-controller-health`
  mean the lane stopped earlier and controller health is not the first problem.

The machine-readable table is [residue.csv](./residue.csv).
