# Metrics Server ConfigHub Proof

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

## Purpose

This proof lane shows the current ConfigHub path for `metrics-server/metrics-server@3.13.0`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | metrics-server default variant rendered from metrics-server/metrics-server@3.13.0 |
| `external-tls-ca` | no | metrics-server external TLS with explicit CA variant rendered from metrics-server/metrics-server@3.13.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 11 ConfigHub Units (10 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 11 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/metrics-server-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/metrics-server-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/metrics-server-confighub-proof/latest/safe-ops-receipt.yaml
```
