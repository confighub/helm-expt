# Working agreement for coding agents

**UNOFFICIAL/EXPERIMENTAL**

This file is the first thing a coding agent reads in this repository. It says
who owns which surfaces, which gates every change runs, and the traps that have
already cost time. The operating detail lives in [docs/agent](docs/agent/README.md);
read that next. Do not copy this file into other docs.

## What the repository is

A public catalog of tested Kubernetes configuration (Helm, AICR, Timoni, YAML,
OCI) plus the evidence behind it, and the generator for the website at
`site/`. The website is what a user reads and runs. Everything else is the
Catalog backend: proofs, receipts, recipes, and lane records, which the site
links to on GitHub rather than rendering.

## Two workstreams, one boundary

Two agents work here at the same time. Each owns its surfaces and stays out of
the other's.

| Stream | Owns | Does not touch |
| --- | --- | --- |
| Website | `site/`, `scripts/generate-public-site.mjs`, `scripts/verify-site-ux-contract.mjs`, `docs/user/`, the home and hub page prose | `data/`, `recipes/`, `packages/`, `runs/`, lane generators |
| Catalog backend | `data/`, `recipes/`, `packages/`, `runs/`, `tests/`, `knowledge/`, `examples/`, the lane and proof generators under `scripts/`, `docs/planning/`, `docs/reference/` | `site/` prose, the site generator, the UX contract, `docs/user/` |

Both streams write to `docs/README.md` (the doc map) when they add a doc, and
both regenerate `site/` when their change moves generated data. A conflict in
a generated file is resolved by regenerating it, never by hand-merging it.

The website shows catalog counts, entry pages, verdict tables, and the chart
index straight from the data, so backend work reaches the site without anyone
editing prose.

## Gates every change runs

```sh
npm run verify
```

That is the whole chain. CI runs it as six shards plus one shard for commands
that need a command-line tool (`.github/workflows/full-verify.yml`). Lanes the
repository already knows are red are declared in
`tests/verify-chain-known-red.yaml`; a pull request that fixes one of them
fails until the entry is removed, on purpose. Three Kubara live lanes are red
on `main` today (shards 3, 4, and 6; see #1759); a pull request that only
touches other surfaces is not judged on them.

Narrower gates, run first:

| Changed | Run |
| --- | --- |
| Any Markdown | `npm run docs:verify` |
| A doc added, renamed, or removed under `docs/` | `npm run doc-freshness` (the freshness snapshot must list every authored doc), then the site regeneration below, because the docs index on `site/docs.html` is generated from `docs/`. Commit what both produce. Two pull requests failed the chain in one morning for skipping this. |
| Anything under `site/` or the site generator | `HELM_EXPT_SITE_GENERATED_AT="$(cat site/generated-at.txt)" npm run site:generate` then `npm run site:ux:verify` and `npm run site:verify` |
| Catalog data or a chart page claim | `npm run chart-claim-integrity:verify` |
| A `cub installer` example | `npm run installer:command-surface:verify` |
| A `cub variant` example | `npm run variant:command-surface:verify` |
| Anything at all | `npm run verify:no-personal-names` and `npm run verify:no-temp-paths` |

## Rules

1. Run `git status --short --branch` first. Do not revert work that is not yours.
2. Never edit a generated file. Fix the generator or the source data, then regenerate. `site/` is generated in full.
3. Treat catalog data as evidence. A row that says `watch`, `blocked`, or `refused` stays that way until a receipt changes it. Prose never turns a lane green.
4. Before claiming a proof lane changed, name the receipt or verifier that changed it.
5. Run live lanes one at a time, on one machine. They need Docker, a kind cluster, and the local ConfigHub server; live promotion is limited by the Unit quota; recording a live result cascades into about forty generated surfaces. Two agents running live lanes at once corrupt each other's receipts.
6. Use `git grep`, not `grep`. Plain `grep` is ripgrep here and skips the gitignored, force-added files under `runs/`.
7. Receipts under `runs/` are force-added. When a chart's digest changes, run `node scripts/resync-package-receipts.mjs` rather than editing SHAs by hand.
8. No personal names anywhere in the repository: not in commits, issues, pull requests, paths, or docs. Say "a colleague" or cite the issue number. Home directories are written `$HOME`.
9. Work on a branch, open a pull request, and let a person merge. Never push to `main`. Pull requests are squash-merged, so never stack a branch on another branch.
10. Commit subjects read `area: what changed` in plain words. Put the reasoning in the body. Long bodies go through `--body-file`.
11. A backgrounded run dies when the machine sleeps. Long lanes run in the foreground or on a machine that stays awake.

## Where to look

- [Agent and operator notes](docs/agent/README.md), then [task recipes](docs/agent/tasks.md) and [recovery](docs/agent/recovery.md)
- [Documentation map](docs/README.md)
- [Generated data index](data/README.md)
- [Knowledge layer](knowledge/index.md), with its [schema](knowledge/SCHEMA.md) and authority order
- [What we refuse to claim](docs/user/what-we-refuse-to-claim.md)
