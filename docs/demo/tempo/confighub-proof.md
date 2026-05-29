# Tempo ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `grafana/tempo@1.24.4`
using real commands only: `cub installer`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `local-persistent`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `local-persistent` | yes | tempo local persistent single-binary variant rendered from grafana/tempo@1.24.4 |
| `s3-query-observability` | no | tempo S3 query and observability variant rendered from grafana/tempo@1.24.4 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 5 proof Units |
| Server-side variant | Pass; 6 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/tempo-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/tempo-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/tempo-confighub-proof/latest/safe-ops-receipt.yaml
```
