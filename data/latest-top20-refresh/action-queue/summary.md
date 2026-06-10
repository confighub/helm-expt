# Latest Refresh Action Queue

This generated queue turns upstream Helm chart movement into concrete work.

It separates four cases:

- a retained candidate still matches latest upstream and needs a replacement
  decision;
- a retained candidate is proof-complete but already behind a newer upstream
  chart version and needs refresh work;
- no retained candidate exists yet, so the proof chain must be created first;
- a retained render/package candidate exists and needs root-path promotion plus
  the remaining ConfigHub and live lanes.

## Result

```text
update rows: 7
replacement decisions ready: 4
retained candidates needing refresh: 3
render candidates needing root/live work: 0
new retained candidates needed: 0
p0 rows: 4
p1 rows: 3
```

## Queue

| Chart | Current supported | Latest upstream | Retained candidate | Action | Priority | First step |
| --- | --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `9.5.17` | write-replacement-decision | p1 | review target-scoped replacement decision for argo-cd/argo-cd@9.5.17 |
| `bitnami/mongodb` | `19.0.7` | `19.1.0` | `19.0.9` | refresh-retained-candidate | p0 | refresh retained bitnami/mongodb@19.0.9 proof to upstream 19.1.0 |
| `bitnami/nginx` | `24.0.2` | `25.0.0` | `24.0.4` | refresh-retained-candidate | p0 | refresh retained bitnami/nginx@24.0.4 proof to upstream 25.0.0 |
| `bitnami/postgresql` | `18.6.7` | `18.7.0` | `18.6.10` | refresh-retained-candidate | p0 | refresh retained bitnami/postgresql@18.6.10 proof to upstream 18.7.0 |
| `bitnami/redis` | `25.5.3` | `27.0.0` | `27.0.0` | write-replacement-decision | p1 | review target-scoped replacement decision for bitnami/redis@27.0.0 |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `86.1.0` | write-replacement-decision | p0 | review target-scoped replacement decision for prometheus-community/kube-prometheus-stack@86.1.0 |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `29.9.0` | write-replacement-decision | p1 | review target-scoped replacement decision for prometheus-community/prometheus@29.9.0 |

## Why This Exists

The refresh lane should not collapse into a single vague "upgrade charts" task.
Each row has a different safe next action. The queue keeps the supported catalog
pinned while making the next proof work visible.

## Files

| File | Role |
| --- | --- |
| [queue.csv](./queue.csv) | Spreadsheet work queue. |
| [queue.yaml](./queue.yaml) | Machine-readable work queue. |
| [../replacement-decisions/summary.md](../replacement-decisions/summary.md) | Replacement-decision queue for retained proof-complete candidates. |
| [../../refresh-survival/summary.md](../../refresh-survival/summary.md) | Refresh status across the top-20. |

## Verify

```sh
npm run top20:latest-action-queue:verify
```
