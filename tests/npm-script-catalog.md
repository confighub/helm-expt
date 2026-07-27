# NPM Script Catalog

This generated page summarizes the current `package.json` script surface.
The detailed one-row-per-script index is [npm-script-catalog.csv](./npm-script-catalog.csv).

Use [NPM Test And Verification Scripts](./npm-scripts.md) for the human runbook.
Use this page when you need to audit whether a command is a verifier, a
generator, a live test, or a user-side tutorial check.

## Summary

```text
scripts: 596
```

## By Category

| Category | Scripts |
| --- | ---: |
| `other` | 180 |
| `top20-chart-proof` | 123 |
| `catalog-data` | 58 |
| `production-support` | 58 |
| `hook-lifecycle` | 29 |
| `evidence-workdown` | 25 |
| `live-parity-gitops` | 25 |
| `latest-version-refresh` | 18 |
| `confighub-proof` | 16 |
| `repo-integrity` | 15 |
| `derived-variants` | 11 |
| `confighub-catalog-org` | 9 |
| `local-live-evidence` | 8 |
| `scale-proof` | 8 |
| `user-install-verification` | 7 |
| `adversarial-live` | 2 |
| `catalog-readiness` | 2 |
| `pilot-variant-model` | 2 |

## By Mode

| Mode | Scripts |
| --- | ---: |
| `verify` | 285 |
| `generate-or-run` | 242 |
| `run` | 56 |
| `summary` | 7 |
| `self-test` | 5 |
| `full-corpus-verify` | 1 |

## By External State

| External state | Scripts |
| --- | ---: |
| `none-for-verify` | 549 |
| `confighub-or-live-cluster` | 19 |
| `local-kubernetes` | 14 |
| `network-or-helm-repo` | 9 |
| `user-supplied-cluster-or-confighub` | 5 |

## Regenerate

```sh
npm run npm-scripts:catalog
npm run npm-scripts:catalog:verify
```
