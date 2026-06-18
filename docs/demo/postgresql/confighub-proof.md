# PostgreSQL ConfigHub Proof

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

## Purpose

This proof lane shows the current ConfigHub path for `bitnami/postgresql@18.6.7`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `generated-passwords`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `generated-passwords` | yes | postgresql generated passwords variant rendered from bitnami/postgresql@18.6.7 |
| `existing-secret` | no | postgresql existing Secret variant rendered from bitnami/postgresql@18.6.7 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 8 ConfigHub Units (7 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 8 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/postgresql-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/postgresql-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/postgresql-confighub-proof/latest/safe-ops-receipt.yaml
```
