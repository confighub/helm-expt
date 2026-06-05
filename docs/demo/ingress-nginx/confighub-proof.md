# Ingress NGINX ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `ingress-nginx/ingress-nginx@4.15.1`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | ingress-nginx default variant rendered from ingress-nginx/ingress-nginx@4.15.1 |
| `admission-disabled` | no | ingress-nginx admission webhook disabled variant rendered from ingress-nginx/ingress-nginx@4.15.1 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 13 ConfigHub Units (12 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 13 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/ingress-nginx-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/ingress-nginx-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/ingress-nginx-confighub-proof/latest/safe-ops-receipt.yaml
```
