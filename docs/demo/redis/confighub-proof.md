# Redis ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `bitnami/redis@25.5.3`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | Redis default variant rendered from bitnami/redis@25.5.3 |
| `reuse-existing-secret` | no | Redis variant that uses an existing Secret target fact |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 15 ConfigHub Units (14 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 15 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/redis-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/redis-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/redis-confighub-proof/latest/safe-ops-receipt.yaml
```
