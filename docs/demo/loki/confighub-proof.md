# Loki ConfigHub Proof

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

## Purpose

This proof lane shows the current ConfigHub path for `grafana/loki@7.0.0`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `single-binary-filesystem`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `single-binary-filesystem` | yes | loki single binary filesystem variant rendered from grafana/loki@7.0.0 |
| `simple-scalable-minio` | no | loki simple scalable with MinIO variant rendered from grafana/loki@7.0.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 21 ConfigHub Units (20 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 21 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/loki-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/loki-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/loki-confighub-proof/latest/safe-ops-receipt.yaml
```
