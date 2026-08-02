# Argo CD ConfigHub Proof

## Purpose

This example records `argo-cd/argo-cd@9.5.15` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | argo-cd default variant rendered from argo-cd/argo-cd@9.5.15 |
| `no-crds` | no | argo-cd CRDs disabled variant rendered from argo-cd/argo-cd@9.5.15 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 49 ConfigHub Units (48 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 49 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/argo-cd-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/argo-cd-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/argo-cd-confighub-proof/latest/safe-ops-receipt.yaml
```
