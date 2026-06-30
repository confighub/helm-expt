# Agent Task Recipes

**UNOFFICIAL/EXPERIMENTAL**

Use these recipes when you are operating the repo. They are not product install
instructions for end users.

## First Command

```sh
git status --short --branch
```

If the working tree is dirty, identify whether the changes are yours before
editing. Do not revert user work.

## Common Tasks

| Task | Read first | Commands |
| --- | --- | --- |
| Edit manual Markdown. | [Documentation Map](../README.md) | `npm run docs:verify` |
| Add a new Markdown directory. | [Documentation Map](../README.md) and `scripts/verify-doc-map.mjs` | Update `docs/README.md`, then `npm run docs:verify` |
| Edit `cub installer` command examples. | [Choosing Commands](../user/choosing-commands.md) | `npm run installer:command-surface:verify` and `npm run docs:verify` |
| Edit `cub variant` command examples. | [Creating Variants](../user/creating-variants.md) | `npm run variant:command-surface:verify` and `npm run docs:verify` |
| Explain verification status. | [Verification For Agents](./verification.md) | Usually no command; cite the relevant verifier or data summary |
| Check generated data index freshness. | [Generated Data Index](../../data/README.md) | `npm run data:index:verify` |
| Check render-intent freshness. | [Helm Render Intents](../user/helm-render-intents.md) | `npm run helm-render-intents:verify` |
| Check the master matrix. | [Reading The Matrix](../user/reading-the-matrix.md) | `npm run master-matrix:verify` |
| Check doc freshness data. | [Documentation Map](../README.md) | `npm run doc-freshness:verify` |
| Check the public site only when asked. | `site/README.md` | `npm run site:verify` and `npm run site:ux:verify` |
| Run the broad repo gate. | [NPM Test And Verification Scripts](../../tests/npm-scripts.md) | `npm run verify` |

## Product Commands Versus Repo Proof Commands

Product commands do work for a user:

```sh
cub installer setup --pull oci://ghcr.io/confighub/helm-expt/bitnami-redis:25.5.3 --base default
helm install ...
kubectl apply ...
```

Repo proof commands check committed evidence:

```sh
npm run docs:verify
npm run helm-render-intents:verify
npm run kind-parity:verify
npm run verify
```

Do not present an npm verifier as the user install path. Do not present a
product command as proof unless a receipt or verifier backs the claim.

## Markdown-Only Changes

For plain documentation edits:

```sh
npm run docs:verify
git diff --check
```

If the docs include current `cub installer` examples:

```sh
npm run installer:command-surface:verify
npm run docs:verify
git diff --check
```

If the docs include current `cub variant` examples:

```sh
npm run variant:command-surface:verify
npm run docs:verify
git diff --check
```

## Generated Surface Changes

Only do this when explicitly asked to update that surface.

| Surface | Generate | Verify |
| --- | --- | --- |
| Public site | `HELM_EXPT_SITE_GENERATED_AT="$(cat site/generated-at.txt)" npm run site:generate` | `npm run site:verify` and `npm run site:ux:verify` |
| Data index | `npm run data:index` | `npm run data:index:verify` |
| NPM script catalog | `npm run npm-scripts:catalog` | `npm run npm-scripts:catalog:verify` |
| Helm render intents | `npm run helm-render-intents` | `npm run helm-render-intents:verify` |
| Master matrix | `npm run master-matrix` | `npm run master-matrix:verify` |
| Status dashboard | `npm run status:dashboard` | `npm run status:dashboard:verify` |

The timestamp-preserving site command avoids changing `site/generated-at.txt`
when the user only asked for a content or generator update.

## Live Evidence

Live evidence commands can create clusters, use ConfigHub, publish OCI
artifacts, or write receipts. Run them only when the user asks for fresh live
evidence.

Rules:

- Run live lanes serially.
- Preserve receipts.
- Do not mark a lane green without the receipt and verifier.
- If a live row is blocked by target prerequisites, use the generated action
  packet or rerun plan before retrying.

Useful starting points:

- [Live Parity](../user/live-parity.md)
- [Verification Lanes](../user/verification-lanes.md)
- [NPM Test And Verification Scripts](../../tests/npm-scripts.md)
- [helm-expt live parity skill](../skills/live-parity.md)
