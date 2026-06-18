# Argo CD ConfigHub Proof

> **Where this fits:** the helm-expt [user story](../../user/user-story.md) — *Helm serverless → add server → add app → changes + variants → day-1 → day-2*, for any chart.

## Purpose

This proof lane shows the current ConfigHub path for `argo-cd/argo-cd@9.5.15`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
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
| ConfigHub upload | Pass; 49 ConfigHub Units (48 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 49 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/argo-cd-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/argo-cd-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/argo-cd-confighub-proof/latest/safe-ops-receipt.yaml
```
