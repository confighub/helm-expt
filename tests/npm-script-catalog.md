# NPM Script Catalog

This generated page summarizes the current `package.json` script surface.
The detailed one-row-per-script index is [npm-script-catalog.csv](./npm-script-catalog.csv).

Use [NPM Test And Verification Scripts](./npm-scripts.md) for the human runbook.
Use this page when you need to audit whether a command is a verifier, a
generator, a live test, or a user-side tutorial check.

## Summary

```text
scripts: 745
```

## By Category

| Category | Scripts |
| --- | ---: |
| `other` | 241 |
| `top20-chart-proof` | 123 |
| `catalog-data` | 67 |
| `production-support` | 65 |
| `latest-version-refresh` | 38 |
| `live-parity-gitops` | 37 |
| `evidence-workdown` | 32 |
| `confighub-proof` | 30 |
| `hook-lifecycle` | 29 |
| `repo-integrity` | 18 |
| `confighub-catalog-org` | 11 |
| `derived-variants` | 11 |
| `local-live-evidence` | 8 |
| `scale-proof` | 8 |
| `user-install-verification` | 7 |
| `oci-evidence` | 6 |
| `oci-inspection` | 4 |
| `oci-transformation` | 4 |
| `adversarial-live` | 2 |
| `catalog-readiness` | 2 |
| `pilot-variant-model` | 2 |

## By Mode

| Mode | Scripts |
| --- | ---: |
| `verify` | 335 |
| `generate-or-run` | 286 |
| `run` | 92 |
| `self-test` | 22 |
| `summary` | 9 |
| `full-corpus-verify` | 1 |

## By External State

| External state | Scripts |
| --- | ---: |
| `none-for-verify` | 668 |
| `confighub-or-live-cluster` | 33 |
| `network-or-helm-repo` | 15 |
| `local-kubernetes` | 14 |
| `public-oci-registry` | 5 |
| `user-supplied-cluster-or-confighub` | 5 |
| `user-supplied-oci` | 2 |
| `authenticated-oci-registry` | 1 |
| `local-kubara-binary` | 1 |
| `network-or-git-source` | 1 |

## Regenerate

```sh
npm run npm-scripts:catalog
npm run npm-scripts:catalog:verify
```
