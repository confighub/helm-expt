# Agent Recovery Guide

**UNOFFICIAL/EXPERIMENTAL**

Use this when a verifier fails or the repo looks stale. Prefer the narrowest
repair that matches the failure.

## General Pattern

1. Read the first failure, not the last one.
2. Identify the owner: manual Markdown, generated data, generated site, proof
   receipt, command-surface lint, or live evidence.
3. Regenerate only the owned surface.
4. Re-run the matching verifier.
5. Run `git diff --check`.

## Common Failures

| Failure | Meaning | Recovery |
| --- | --- | --- |
| `Markdown file is in an unexpected location` | `docs:verify` does not know the directory. | Add the directory pattern to `scripts/verify-doc-map.mjs` only if the location is intentional; then assign every new doc a role in `docs/README.md`. |
| `docs/README.md does not assign a role` | A top-level manual doc is not in the doc map. | Add a row for the file in `docs/README.md`, then run `npm run docs:verify`. |
| `Broken markdown link` | A Markdown link target does not exist from that file's directory. | Fix the link target or move the file intentionally; then run `npm run docs:verify`. |
| `tests/npm-script-catalog.* is stale` | `package.json` scripts changed. | Run `npm run npm-scripts:catalog`, then `npm run npm-scripts:catalog:verify`. |
| `site/... is stale` | Generated public site output does not match the generator and data. | Only if website work was requested: run `HELM_EXPT_SITE_GENERATED_AT="$(cat site/generated-at.txt)" npm run site:generate`, then `npm run site:verify` and `npm run site:ux:verify`. |
| `data/README.md is stale` or CSV index stale | Generated data index does not match `data/`. | Run `npm run data:index`, then `npm run data:index:verify`. |
| `helm-render-intents` output is stale | Render-intent YAML/CSV/JSON no longer matches matrix or lifecycle data. | Run `npm run helm-render-intents`, then `npm run helm-render-intents:verify`. |
| Matrix output is stale | The master matrix no longer matches source data. | Run `npm run master-matrix`, then `npm run master-matrix:verify`. |
| Command-surface verifier rejects an example | A doc uses stale `cub` syntax or planned syntax without saying it is planned. | Fix the example or mark planned/future syntax clearly; re-run the command-surface verifier. |
| `git diff --check` reports trailing whitespace | A generated or manual file has whitespace errors. | Fix the source generator if many generated files are affected; fix the manual file directly if only manual docs changed. |

## When Not To Regenerate

Do not regenerate a broad surface just because it is nearby. Examples:

- Do not run `npm run site:generate` during an agent-doc-only change.
- Do not regenerate catalog maps during a Markdown audit.
- Do not run live parity while fixing broken docs.
- Do not run `npm run verify` as the first debugging step for a narrow stale
  file.

## Live-Lane Recovery

If a live run fails:

1. Preserve logs and receipts under the run directory.
2. Check whether the failure is a target prerequisite, remote image, runtime
   health, controller health, model gap, or infrastructure block.
3. Use the generated rerun/action surfaces before retrying:
   - `data/live-parity-rerun-plan/summary.md`
   - `data/target-prerequisite-actions/summary.md`
   - `data/model-prereq-resolution/summary.md`
   - `data/live-run-blocks/summary.md`
4. Do not edit prose to turn a row green.

## Escalate To The Broad Gate

Run `npm run verify` after focused checks pass when:

- the change touches shared proof logic;
- the change updates many generated surfaces;
- the user asks for a full verification pass;
- a broad publish or release gate is needed.

