# Vault Use-More-Now Proof

## Purpose

This proof lane shows the current ConfigHub path for `hashicorp/vault@0.32.0`
using real commands only: `cub install`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | vault default server with injector variant rendered from hashicorp/vault@0.32.0 |
| `ha-raft-ui` | no | vault HA Raft with UI variant rendered from hashicorp/vault@0.32.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 13 proof Units |
| Server-side variant | Pass; 14 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/vault-use-more-now/latest/use-more-now-receipt.yaml
../../../runs/vault-use-more-now/latest/function-scan-receipt.yaml
../../../runs/vault-use-more-now/latest/safe-ops-receipt.yaml
```
