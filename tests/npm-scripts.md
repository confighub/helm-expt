# NPM Test And Verification Scripts

The `npm` scripts are the repository's proof harness. They answer three
questions:

```text
Are the committed artifacts internally consistent?
Do the installer packages still render what the receipts say they render?
Which catalog/data files need to be regenerated after a change?
```

Most scripts use Node.js built-ins and do not need `npm install`. Some scripts
shell out to `cub`, `cub installer`, `helm`, `kubectl`, `kind`, or ConfigHub
when they are exercising installer, upload, or live-cluster paths.

## Script Naming Rules

| Pattern | Meaning | Mutates files? |
| --- | --- | --- |
| `*:verify` | Recompute expected output in memory and fail if committed files are stale. | No |
| `*:generate` or bare generator name | Rewrite generated files. | Yes |
| `*:self-test` | Prove a verifier rejects tampered data. | No committed changes |
| `<chart>:compare` | Compare regular Helm output with `cub installer` output for one chart. | Usually no |
| `<chart>:generate-*` | Rebuild one chart's proof or package artifacts. | Yes |
| `top20:local-e2e` | Run live local-kind tests and write receipts. | Yes |
| `verify-install:*` | Check a user's own Redis install. | Writes receipts under `.tmp/` |

## Common Commands

| Command | What it checks | When to run |
| --- | --- | --- |
| `npm run top20:verify-local-e2e` | The committed top-20 local-kind observation receipts exist and pass schema/content checks. | Quick public proof check. |
| `npm run verify` | Full repository verification chain: proof contracts, docs, command surface, recipes, packages, receipts, catalog data, site data, scans, and model completeness. | Before merging broad changes. |
| `npm run p0:contracts` | P0 proof contracts: schemas, capability profiles, freshness SLO, corpus invariants, and scale data. | When changing schemas, proof model, or scale/corpus data. |
| `npm run docs:verify` | Markdown files live in expected locations and links resolve. | When adding, moving, or renaming docs. |
| `npm run installer:command-surface:verify` | Docs and scripts use `cub installer`, not stale `cub install` language or old variant space patterns. | When touching docs/scripts with CLI examples. |
| `npm run site:verify` | Generated static site files match current catalog data. | When changing catalog data surfaced by `site/`. |

## User-Install Verification

These scripts are for an outside user who followed the Redis demo and wants to
prove their own result matches the catalog.

| Command | Stage | What it proves |
| --- | --- | --- |
| `npm run verify-install:render -- --chart bitnami/redis/25.5.3 --base default --work-dir <dir> --namespace redis` | After `cub installer setup` | The user's rendered Redis objects semantically match the canonical catalog render. |
| `npm run verify-install:cluster -- --chart bitnami/redis/25.5.3 --base default --context <ctx> --namespace redis` | After `kubectl apply` | The user's cluster has the expected Redis StatefulSets, PVCs, and Redis PING behavior. |
| `npm run verify-install:confighub -- --chart bitnami/redis/25.5.3 --base default --space <space>` | After `cub installer upload` | ConfigHub has the expected Redis Units and labels. |

These currently ship for Redis only. Other charts should get the same user-side
checks after their own `install-checks.yaml` files are added.

## Per-Chart Proof Scripts

The top-20 curated charts have chart-specific scripts:

```text
<chart>:compare
<chart>:verify-proof
<chart>:verify-proof:self-test
<chart>:verify-package
<chart>:generate-proof
<chart>:generate-package
```

Use them when working on one curated chart. For example:

```sh
npm run prometheus:compare
npm run prometheus:verify-proof
npm run prometheus:verify-package
```

For non-curated charts, the broader generators and verifiers own the proof
surface:

```sh
npm run next80:verify
npm run next80:verify:self-test
npm run verify:artifact-chain
```

The top-100 data keeps proof state separate from remaining capability work:

```text
catalog_status       whether the chart has a maintained proof surface
not_yet_enabled      which recommended capabilities still have hard gaps
```

## Catalog And Data Scripts

These keep the generated catalog/data surfaces current.

| Command | Purpose |
| --- | --- |
| `npm run catalog:pain-reports` / `catalog:pain-reports:verify` | Per-chart Helm pain reports. |
| `npm run chart-facts` / `chart-facts:verify` | One-row-per-chart facts for the 100 maintained recipes. |
| `npm run top100:catalog` / `top100:catalog:verify` | Top-100 maintained recipe/package proof surface. |
| `npm run top500:catalog` / `top500:catalog:verify` | Top-500 source/catalog evidence map. |
| `npm run completeness:generate` / `completeness:verify` | Level-2 support and variant-rich counts. |
| `npm run variant-backlog:generate` / `variant-backlog:verify` | Recommended-but-not-built variant backlog. |
| `npm run quirk-queue:generate` / `quirk-queue:verify` | Quirks disclosed but still needing review or follow-up. |
| `npm run catalog:index` / `catalog:index:verify` | Root `CATALOG.md`. |
| `npm run catalog:maps` / `catalog:maps:verify` | Per-chart catalog and artifact index maps. |

For the current regeneration order, see `data/README.md`.

## Live And Runtime Scripts

These require a cluster or ConfigHub state. They are not part of the simple
fresh-clone check unless they are run in verify-only mode against committed
receipts.

| Command | Purpose |
| --- | --- |
| `npm run top20:local-e2e` | Run the top-20 local-kind test lane and write observation receipts. |
| `npm run top20:local-e2e:summary` | Regenerate the local-kind summary table. |
| `npm run top20:verify-confighub-proof` | Verify committed ConfigHub proof receipts for the top-20. |
| `npm run top20:confighub-proof` | Run ConfigHub proof for selected charts. |
| `npm run external-scan` | Run the external scan lane and write results. |

Standalone runtime tests live beside this file:

```text
tests/chart-install-test
tests/chart-install-sweep
tests/existing-secret-proof
```

Those are for `cub` + cluster execution. The `npm` scripts are the repo
verification and artifact-generation layer.

## Recommended Checks By Change Type

| Change | Minimum checks |
| --- | --- |
| Documentation only | `npm run docs:verify` and `npm run installer:command-surface:verify` |
| Generated data or catalog | Relevant `*:verify`, then `npm run site:verify` if the site reads it |
| Recipe or package | Chart-specific verify scripts if curated, plus `npm run verify:artifact-chain` |
| Top-20 chart proof | `<chart>:compare`, `<chart>:verify-proof`, `<chart>:verify-package`, and `npm run top20:verify-local-e2e` if receipts changed |
| Chart-facts/top100/top500 data | `npm run chart-facts:verify`, `npm run top100:catalog:verify`, `npm run top500:catalog:verify` |
| Broad proof-model change | `npm run p0:contracts`, focused `*:verify` checks for changed surfaces, and `npm run verify` |

## Current Top-100 Reading

The top-100 is not a single readiness state.

```text
100 charts have recipe/package proof artifacts.
20 charts are catalog-supported for the declared local-test scope.
80 charts are proof-grade, but not yet catalog-supported.
54 charts are variant-rich.
46 charts are default-only.
26 charts have at least one hard gap for a recommended extra capability.
37 charts have buildable variant backlog where the path is known but not run.
```

Use `data/top100-catalog-analysis/summary.md`,
`data/chart-facts/summary.md`, and `data/model-completeness/summary.md`
together:

```text
top100 summary       = what proof surface exists
chart facts          = what quirks and hard gaps each chart has
model completeness   = whether the chart has Level-2 support under declared scope
variant backlog      = which useful variants still need build work
```
