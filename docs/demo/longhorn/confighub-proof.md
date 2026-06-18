# Longhorn ConfigHub Proof

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

## Purpose

This proof lane shows the current ConfigHub path for `longhorn/longhorn@1.11.2`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | Longhorn default storage control plane variant rendered from longhorn/longhorn@1.11.2 |
| `ui-ingress` | no | Longhorn UI ingress enabled variant rendered from longhorn/longhorn@1.11.2 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 43 ConfigHub Units (42 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 43 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/longhorn-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/longhorn-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/longhorn-confighub-proof/latest/safe-ops-receipt.yaml
```
