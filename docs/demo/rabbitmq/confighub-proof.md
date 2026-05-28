# RabbitMQ ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `bitnami/rabbitmq@16.0.14`
using real commands only: `cub install`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `generated-passwords`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `generated-passwords` | yes | rabbitmq generated passwords variant rendered from bitnami/rabbitmq@16.0.14 |
| `existing-secret` | no | rabbitmq existing Secret variant rendered from bitnami/rabbitmq@16.0.14 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 9 proof Units |
| Server-side variant | Pass; 10 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/rabbitmq-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/rabbitmq-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/rabbitmq-confighub-proof/latest/safe-ops-receipt.yaml
```
