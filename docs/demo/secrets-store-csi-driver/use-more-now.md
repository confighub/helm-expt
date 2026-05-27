# Secrets Store CSI Driver Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0`
using real commands only: `cub install`, `cub variant`, `cub unit`,
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
| ConfigHub upload | Pass; 11 proof Units |
| Server-side variant | Pass; 12 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/secrets-store-csi-driver-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/secrets-store-csi-driver-use-more-now/latest/function-scan-receipt.yaml
../../../runs/secrets-store-csi-driver-use-more-now/latest/safe-ops-receipt.yaml
```
