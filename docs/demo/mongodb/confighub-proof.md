# MongoDB ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `bitnami/mongodb@19.0.7`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `generated-passwords`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `generated-passwords` | yes | mongodb generated passwords variant rendered from bitnami/mongodb@19.0.7 |
| `existing-secret-replicaset` | no | mongodb existing Secret replica set variant rendered from bitnami/mongodb@19.0.7 |

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
../../../runs/mongodb-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/mongodb-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/mongodb-confighub-proof/latest/safe-ops-receipt.yaml
```
