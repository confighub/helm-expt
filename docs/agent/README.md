# Agent And Operator Notes

**UNOFFICIAL/EXPERIMENTAL**

This directory tells agents and maintainers how to work in this repository. It
is separate from the public website. The site and `docs/user` explain the
product; this directory lists repo commands, recovery steps, and repo terms.

## Doctrine

- Keep the public website written for people evaluating or using the product.
- Keep website docs focused on user tasks and product behavior.
- Put agent and operator instructions in repo Markdown, mainly here.
- Do not change catalog pages or generated chart pages as part of the AX pass.
- Treat catalog data as evidence. If a row is `watch`, `blocked`, or `refused`,
  do not make it green with prose.
- Use the narrowest verifier that matches the file or claim you changed.
- Run live lanes only when explicitly needed, and run them serially.

## Start With The Task

| Task | Open |
| --- | --- |
| Choose the right command for a repo task. | [Task Recipes](./tasks.md) |
| Recover from stale generated files, broken links, or failed checks. | [Recovery](./recovery.md) |
| Decide which proof command matches a claim. | [Verification For Agents](./verification.md) |
| Inspect catalog evidence without changing the catalog. | [Catalog Read-Only Guide](./catalog.md) |
| Keep human and agent docs consistent without copying the same text. | [Human And Agent Documentation Doctrine](./human-agent-doctrine.md) |
| Decode repo-specific terms. | [Terms](./terms.md) |

## Entry Points

Use these before reading older planning prose:

- [Documentation Map](../README.md)
- [User Docs Reading Order](../user/README.md)
- [NPM Test And Verification Scripts](../../tests/npm-scripts.md)
- [Generated Data Index](../../data/README.md)
- [Helm Render Intents](../user/helm-render-intents.md)
- [What We Refuse To Claim](../user/what-we-refuse-to-claim.md)
- [Human And Agent Documentation Doctrine](./human-agent-doctrine.md)

## Basic Operating Rules

1. Check `git status --short --branch` before editing.
2. Do not touch `site/`, `site/charts/`, `recipes/`, `packages/`, or generated
   `data/` unless the user explicitly asks for that generated surface.
3. When a generated file is stale, update the generator or source data, then
   regenerate the owned output. Do not hand-edit generated output.
4. When editing Markdown, run `npm run docs:verify`.
5. When editing CLI examples, also run the relevant command-surface verifier:
   `npm run installer:command-surface:verify` or
   `npm run variant:command-surface:verify`.
6. Before claiming a proof lane changed, point to the receipt or verifier that
   changed it.
