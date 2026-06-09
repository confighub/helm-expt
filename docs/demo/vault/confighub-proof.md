# Vault ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `hashicorp/vault@0.32.0`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `dev-mode`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `dev-mode` | yes | vault dev server without init/unseal variant rendered from hashicorp/vault@0.32.0 |
| `default` | no | vault default server with injector variant rendered from hashicorp/vault@0.32.0 |
| `ha-raft-ui` | no | vault HA Raft with UI variant rendered from hashicorp/vault@0.32.0 |

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
../../../runs/vault-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/vault-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/vault-confighub-proof/latest/safe-ops-receipt.yaml
```
