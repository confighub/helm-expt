# Secrets Store CSI Driver ConfigHub Proof

## Purpose

This example records `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

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
