# NGINX ConfigHub Proof

## Purpose

This example records `bitnami/nginx@24.0.2` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected happy-path install variant is `http-clusterip`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `http-clusterip` | yes | nginx plain HTTP ClusterIP variant rendered from bitnami/nginx@24.0.2 |
| `existing-tls-ingress` | no | nginx existing TLS with ingress variant rendered from bitnami/nginx@24.0.2 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 7 ConfigHub Units (6 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 7 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/nginx-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/nginx-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/nginx-confighub-proof/latest/safe-ops-receipt.yaml
```
