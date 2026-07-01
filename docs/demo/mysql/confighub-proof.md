# MySQL ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `bitnami/mysql@14.0.3`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected proof install variant is `static-passwords`. The package default is now `existing-secret`, which uses an existing Secret instead of the static demo password.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `static-passwords` | no | mysql static password demo variant rendered from bitnami/mysql@14.0.3 |
| `existing-secret` | yes | mysql existing Secret default variant rendered from bitnami/mysql@14.0.3 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 9 ConfigHub Units (8 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 9 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/mysql-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/mysql-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/mysql-confighub-proof/latest/safe-ops-receipt.yaml
```
