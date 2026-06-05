# cert-manager ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `jetstack/cert-manager@v1.20.2`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

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
| ConfigHub upload | Pass; 44 ConfigHub Units (43 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 44 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/cert-manager-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/cert-manager-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/cert-manager-confighub-proof/latest/safe-ops-receipt.yaml
```
