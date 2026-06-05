# Grafana ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `grafana/grafana@10.5.15`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `generated-passwords`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `generated-passwords` | yes | grafana generated passwords variant rendered from grafana/grafana@10.5.15 |
| `existing-secret-ingress` | no | grafana existing Secret with ingress variant rendered from grafana/grafana@10.5.15 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 10 ConfigHub Units (9 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 10 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/grafana-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/grafana-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/grafana-confighub-proof/latest/safe-ops-receipt.yaml
```
