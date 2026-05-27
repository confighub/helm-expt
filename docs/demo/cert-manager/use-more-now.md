# cert-manager Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `jetstack/cert-manager@v1.20.2`
using real commands only: `cub install`, `cub variant`, `cub unit`,
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
| ConfigHub upload | Pass; 43 proof Units |
| Server-side variant | Pass; 44 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/cert-manager-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/cert-manager-use-more-now/latest/function-scan-receipt.yaml
../../../runs/cert-manager-use-more-now/latest/safe-ops-receipt.yaml
```
