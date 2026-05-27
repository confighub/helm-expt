# Argo CD Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `argo-cd/argo-cd@9.5.15`
using real commands only: `cub install`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

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
| ConfigHub upload | Pass; 48 proof Units |
| Server-side variant | Pass; 49 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/argo-cd-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/argo-cd-use-more-now/latest/function-scan-receipt.yaml
../../../runs/argo-cd-use-more-now/latest/safe-ops-receipt.yaml
```
