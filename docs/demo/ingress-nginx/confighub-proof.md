# Ingress NGINX ConfigHub Proof

## Purpose

This example records `ingress-nginx/ingress-nginx@4.15.1` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected happy-path install variant is `internal-clusterip`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | ingress-nginx default variant rendered from ingress-nginx/ingress-nginx@4.15.1 |
| `admission-disabled` | no | ingress-nginx admission webhook disabled variant rendered from ingress-nginx/ingress-nginx@4.15.1 |
| `internal-clusterip` | no | ingress-nginx internal ClusterIP controller variant rendered from ingress-nginx/ingress-nginx@4.15.1 |

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
../../../runs/ingress-nginx-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/ingress-nginx-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/ingress-nginx-confighub-proof/latest/safe-ops-receipt.yaml
```
