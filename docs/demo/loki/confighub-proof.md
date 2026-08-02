# Loki ConfigHub Proof

## Purpose

This example records `grafana/loki@7.0.0` in ConfigHub. It shows
the exact commands used to render the selected package, upload its
Kubernetes objects, create a variant, run checks, and review changes.

The selected happy-path install variant is `single-binary-filesystem`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `single-binary-filesystem` | yes | loki single binary filesystem variant rendered from grafana/loki@7.0.0 |
| `simple-scalable-minio` | no | loki simple scalable with MinIO variant rendered from grafana/loki@7.0.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 21 ConfigHub Units (20 Kubernetes Units plus installer record) |
| Server-side variant | Pass; 21 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/loki-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/loki-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/loki-confighub-proof/latest/safe-ops-receipt.yaml
```
