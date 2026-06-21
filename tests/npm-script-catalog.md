# NPM Script Catalog

This generated page summarizes the current `package.json` script surface.
The detailed one-row-per-script index is [npm-script-catalog.csv](./npm-script-catalog.csv).

Use [NPM Test And Verification Scripts](./npm-scripts.md) for the human runbook.
Use this page when you need to audit whether a command is a verifier, a
generator, a live test, or a user-side tutorial check.

## Summary

```text
scripts: 476
```

## By Category

| Category | Scripts |
| --- | ---: |
| `top20-chart-proof` | 123 |
| `other` | 90 |
| `catalog-data` | 57 |
| `production-support` | 55 |
| `hook-lifecycle` | 29 |
| `live-parity-gitops` | 25 |
| `evidence-workdown` | 23 |
| `latest-version-refresh` | 18 |
| `repo-integrity` | 14 |
| `derived-variants` | 8 |
| `local-live-evidence` | 8 |
| `scale-proof` | 8 |
| `confighub-proof` | 7 |
| `user-install-verification` | 7 |
| `adversarial-live` | 2 |
| `catalog-readiness` | 2 |

## By Mode

| Mode | Scripts |
| --- | ---: |
| `verify` | 238 |
| `generate-or-run` | 194 |
| `run` | 34 |
| `summary` | 7 |
| `self-test` | 2 |
| `full-corpus-verify` | 1 |

## By External State

| External state | Scripts |
| --- | ---: |
| `none-for-verify` | 437 |
| `local-kubernetes` | 14 |
| `confighub-or-live-cluster` | 13 |
| `network-or-helm-repo` | 7 |
| `user-supplied-cluster-or-confighub` | 5 |

## Regenerate

```sh
npm run npm-scripts:catalog
npm run npm-scripts:catalog:verify
```
