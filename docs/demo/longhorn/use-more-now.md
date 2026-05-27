# Longhorn Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `longhorn/longhorn@1.11.2`
using real commands only: `cub install`, `cub variant`, `cub unit`,
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
| ConfigHub upload | Pass; 42 proof Units |
| Server-side variant | Pass; 43 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/longhorn-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/longhorn-use-more-now/latest/function-scan-receipt.yaml
../../../runs/longhorn-use-more-now/latest/safe-ops-receipt.yaml
```
