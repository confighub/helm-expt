# NPM Script Catalog

This generated page summarizes the current `package.json` script surface.
The detailed one-row-per-script index is [npm-script-catalog.csv](./npm-script-catalog.csv).

Use [NPM Test And Verification Scripts](./npm-scripts.md) for the human runbook.
Use this page when you need to audit whether a command is a verifier, a
generator, a live test, or a user-side tutorial check.

## Summary

```text
scripts: 373
```

## By Category

| Category | Scripts |
| --- | ---: |
| `top20-chart-proof` | 123 |
| `catalog-data` | 57 |
| `production-support` | 53 |
| `hook-lifecycle` | 21 |
| `evidence-workdown` | 19 |
| `live-parity-gitops` | 19 |
| `latest-version-refresh` | 18 |
| `repo-integrity` | 13 |
| `derived-variants` | 8 |
| `local-live-evidence` | 8 |
| `other` | 8 |
| `scale-proof` | 8 |
| `confighub-proof` | 7 |
| `user-install-verification` | 7 |
| `adversarial-live` | 2 |
| `catalog-readiness` | 2 |

## By Mode

| Mode | Scripts |
| --- | ---: |
| `verify` | 186 |
| `generate-or-run` | 146 |
| `run` | 32 |
| `summary` | 6 |
| `self-test` | 2 |
| `full-corpus-verify` | 1 |

## By External State

| External state | Scripts |
| --- | ---: |
| `none-for-verify` | 339 |
| `confighub-or-live-cluster` | 11 |
| `local-kubernetes` | 11 |
| `network-or-helm-repo` | 7 |
| `user-supplied-cluster-or-confighub` | 5 |

## Regenerate

```sh
npm run npm-scripts:catalog
npm run npm-scripts:catalog:verify
```
