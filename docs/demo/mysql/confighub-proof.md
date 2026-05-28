# MySQL ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `bitnami/mysql@14.0.3`
using real commands only: `cub install`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `generated-passwords`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `generated-passwords` | yes | mysql generated passwords variant rendered from bitnami/mysql@14.0.3 |
| `existing-secret` | no | mysql existing Secret variant rendered from bitnami/mysql@14.0.3 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 8 proof Units |
| Server-side variant | Pass; 9 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/mysql-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/mysql-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/mysql-confighub-proof/latest/safe-ops-receipt.yaml
```
