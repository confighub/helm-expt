# Secrets Store CSI Driver ConfigHub Proof

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

## Purpose

This proof lane shows the current ConfigHub path for `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | secrets-store-csi-driver default Linux driver variant rendered from secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 |
| `sync-secret-rotation` | no | secrets-store-csi-driver sync Secret and rotation variant rendered from secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 12 ConfigHub Units (11 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 12 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/secrets-store-csi-driver-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/secrets-store-csi-driver-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/secrets-store-csi-driver-confighub-proof/latest/safe-ops-receipt.yaml
```
