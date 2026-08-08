# NPM Script Catalog

This generated page summarizes the current `package.json` script surface.
The detailed one-row-per-script index is [npm-script-catalog.csv](./npm-script-catalog.csv).

Use [NPM Test And Verification Scripts](./npm-scripts.md) for the human runbook.
Use this page when you need to audit whether a command is a verifier, a
generator, a live test, or a user-side tutorial check.

## Summary

```text
scripts: 874
```

## By Category

| Chain role | Scripts |
| --- | ---: |
| `not-a-gate` | 462 |
| `in-verify-chain` | 393 |
| `gate-shaped-outside-chain` | 19 |

A lane whose role is `gate-shaped-outside-chain` is named like a gate and is
not run by `npm run verify`. Each one needs a recorded reason, which
[npm-lane-roles.md](./npm-lane-roles.md) carries.

| Category | Scripts |
| --- | ---: |
| `other` | 369 |
| `top20-chart-proof` | 123 |
| `catalog-data` | 67 |
| `production-support` | 65 |
| `latest-version-refresh` | 38 |
| `live-parity-gitops` | 37 |
| `evidence-workdown` | 32 |
| `confighub-proof` | 30 |
| `hook-lifecycle` | 29 |
| `repo-integrity` | 19 |
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
| `verify` | 382 |
| `generate-or-run` | 335 |
| `run` | 101 |
| `self-test` | 46 |
| `summary` | 9 |
| `full-corpus-verify` | 1 |

## By External State

| External state | Scripts |
| --- | ---: |
| `none-for-verify` | 797 |
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
