# kube-prometheus-stack ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `prometheus-community/kube-prometheus-stack@85.3.3`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | kube-prometheus-stack default with Grafana password bound variant rendered from prometheus-community/kube-prometheus-stack@85.3.3 |
| `no-crds` | no | kube-prometheus-stack CRDs disabled variant rendered from prometheus-community/kube-prometheus-stack@85.3.3 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 124 ConfigHub Units (123 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 124 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/kube-prometheus-stack-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/kube-prometheus-stack-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/kube-prometheus-stack-confighub-proof/latest/safe-ops-receipt.yaml
```
