# Ingress NGINX Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `ingress-nginx/ingress-nginx@4.15.1`
using real commands only: `cub install`, `cub variant`, `cub unit`,
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
| ConfigHub upload | Pass; 12 proof Units |
| Server-side variant | Pass; 13 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/ingress-nginx-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/ingress-nginx-use-more-now/latest/function-scan-receipt.yaml
../../../runs/ingress-nginx-use-more-now/latest/safe-ops-receipt.yaml
```
