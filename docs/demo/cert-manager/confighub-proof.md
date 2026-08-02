# cert-manager ConfigHub Proof

## Purpose

This example records `jetstack/cert-manager@v1.20.2` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected happy-path install variant is `crds-enabled`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | cert-manager default variant rendered from jetstack/cert-manager@v1.20.2 |
| `crds-enabled` | no | cert-manager CRDs enabled variant rendered from jetstack/cert-manager@v1.20.2 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 50 ConfigHub Units (49 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 50 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/cert-manager-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/cert-manager-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/cert-manager-confighub-proof/latest/safe-ops-receipt.yaml
```
