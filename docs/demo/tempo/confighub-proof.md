# Tempo ConfigHub Proof

## Purpose

This example records `grafana/tempo@1.24.4` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

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
| ConfigHub upload | Pass; 6 ConfigHub Units (5 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 6 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/tempo-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/tempo-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/tempo-confighub-proof/latest/safe-ops-receipt.yaml
```
