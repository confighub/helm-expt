# External Secrets ConfigHub Proof

## Purpose

This proof lane shows the current ConfigHub path for `external-secrets/external-secrets@2.5.0`
using real commands only: `cub install`, `cub variant`, `cub unit`,
`cub function`, and `cub changeset`.

The selected happy-path install variant is `default`.

## Package Bases

| Base | Default | Description |
| --- | --- | --- |
| `default` | yes | external-secrets default variant rendered from external-secrets/external-secrets@2.5.0 |
| `no-crds` | no | external-secrets CRDs disabled variant rendered from external-secrets/external-secrets@2.5.0 |

## Acceptance Contract

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | pass |
| ConfigHub upload | Pass; 42 proof Units |
| Server-side variant | Pass; 43 cloned Units |
| ConfigHub function scan | pass |
| Safe operations | pass |

## Receipts

```text
../../../runs/external-secrets-confighub-proof/latest/confighub-proof-receipt.yaml
../../../runs/external-secrets-confighub-proof/latest/function-scan-receipt.yaml
../../../runs/external-secrets-confighub-proof/latest/safe-ops-receipt.yaml
```
