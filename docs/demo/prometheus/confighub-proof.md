# Prometheus ConfigHub Proof

## Purpose

This example records `prometheus-community/prometheus@29.8.0` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected happy-path install variant is `server-only-ephemeral`.

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
| ConfigHub upload | Pass; 8 ConfigHub Units (7 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 8 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/prometheus-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/prometheus-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/prometheus-confighub-proof/latest/safe-ops-receipt.yaml
```
