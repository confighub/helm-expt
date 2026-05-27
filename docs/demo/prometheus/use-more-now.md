# Prometheus Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `prometheus-community/prometheus@29.8.0`
using real commands only: `cub install`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | prometheus default monitoring stack variant rendered from prometheus-community/prometheus@29.8.0 |
| `server-only-ephemeral` | no | prometheus server only without persistence variant rendered from prometheus-community/prometheus@29.8.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 24 proof Units |
| Server-side variant | Pass; 25 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/prometheus-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/prometheus-use-more-now/latest/function-scan-receipt.yaml
../../../runs/prometheus-use-more-now/latest/safe-ops-receipt.yaml
```
