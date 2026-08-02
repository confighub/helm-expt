# PostgreSQL ConfigHub Proof

## Purpose

This example records `bitnami/postgresql@18.6.7` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected proof install variant is `static-passwords`. The package default is now `existing-secret`, which uses an existing Secret instead of the static demo password.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `static-passwords` | no | postgresql static password demo variant rendered from bitnami/postgresql@18.6.7 |
| `existing-secret` | yes | postgresql existing Secret default variant rendered from bitnami/postgresql@18.6.7 |

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
