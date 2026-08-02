# MongoDB ConfigHub Proof

## Purpose

This example records `bitnami/mongodb@19.0.7` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected proof install variant is `static-passwords`. The package default is now `existing-secret-replicaset`, which uses an existing Secret instead of the static demo password.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `static-passwords` | no | mongodb static password demo variant rendered from bitnami/mongodb@19.0.7 |
| `existing-secret-replicaset` | yes | mongodb existing Secret default variant rendered from bitnami/mongodb@19.0.7 |

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
