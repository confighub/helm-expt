# Grafana ConfigHub Proof

## Purpose

This example records `grafana/grafana@10.5.15` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected proof install variant is `static-passwords`. The package default is now `existing-secret-ingress`, which uses an existing Secret instead of the static demo password.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `static-passwords` | no | grafana static password demo variant rendered from grafana/grafana@10.5.15 |
| `existing-secret-ingress` | yes | grafana existing Secret default variant rendered from grafana/grafana@10.5.15 |

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
