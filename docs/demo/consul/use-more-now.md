# Consul Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `hashicorp/consul@2.0.0`
using real commands only: `cub install`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default-control-plane`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default-control-plane` | yes | consul default control plane variant rendered from hashicorp/consul@2.0.0 |
| `secure-mesh-existing-secrets` | no | consul secure mesh with existing Secrets variant rendered from hashicorp/consul@2.0.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 71 proof Units |
| Server-side variant | Pass; 72 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/consul-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/consul-use-more-now/latest/function-scan-receipt.yaml
../../../runs/consul-use-more-now/latest/safe-ops-receipt.yaml
```
