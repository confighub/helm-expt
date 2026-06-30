# Agent Experience Audit

**UNOFFICIAL/EXPERIMENTAL**

This audit records the AX decision for `helm-expt`: keep the public website and
human docs readable, and put agent/operator instructions in repo Markdown.

## Scope

Audited surfaces:

- `README.md`
- `docs/README.md`
- `docs/user/README.md`
- `docs/user/verification.md`
- `docs/user/choosing-commands.md`
- `docs/user/helm-render-intents.md`
- `tests/npm-scripts.md`
- `data/README.md`
- `data/helm-render-intents/summary.md`
- `knowledge/wiki/agent-operating-guide.md`
- `scripts/verify-doc-map.mjs`

Out of scope for this pass:

- generated catalog pages;
- generated chart pages;
- catalog data redesign;
- live proof reruns.

## Findings

### Human surfaces should stay human

The public website and `docs/user` pages are easier to improve when they tell a
human story. Adding command-routing blocks for agents would make those pages
noisier and would repeat material already present in `tests/npm-scripts.md` and
the generated data index.

Decision: keep detailed agent instructions out of website pages and do not add
agent sections to the catalog. The website may include a quiet pointer from
Docs/FAQ to `docs/agent/README.md`.

### Agents need a deterministic start point

The repo already has useful material, but agents have to discover it from many
places:

- `docs/README.md` maps manual docs;
- `tests/npm-scripts.md` maps npm commands;
- `data/README.md` maps generated evidence;
- `docs/user/verification.md` explains proof concepts;
- `knowledge/wiki/agent-operating-guide.md` gives older high-level rules.

Decision: add `docs/agent/README.md` as the stable start page and keep links to
the authoritative human and generated sources.

### Generated evidence is too large for cold starts

`data/`, `recipes/`, `packages/`, and `site/charts/` are large. Agents that
open them directly can lose the thread and overclaim from one row.

Decision: add a read-only catalog guide that tells agents which generated
front doors to use first and what not to edit in the first AX pass.

### Verifier choice is the main operational risk

The repo has many npm scripts. The biggest AX risk is running too broad a gate,
running live evidence accidentally, or treating a product command as a proof
command.

Decision: add task recipes, recovery rules, and a verification command map
under `docs/agent/`.

### Existing doc verifier must allow the new layer

`scripts/verify-doc-map.mjs` intentionally rejects unexpected Markdown
locations. Adding `docs/agent` requires updating that allowlist and assigning
each agent doc a role in `docs/README.md`.

Decision: update the verifier for `docs/agent/*.md` and document every new file
in `docs/README.md`.

## Implemented In This Pass

- Added `docs/agent/README.md`.
- Added `docs/agent/tasks.md`.
- Added `docs/agent/recovery.md`.
- Added `docs/agent/verification.md`.
- Added `docs/agent/catalog.md`.
- Added `docs/agent/human-agent-doctrine.md`.
- Added `docs/agent/terms.md`.
- Added this audit.
- Added an agent-experience worklog.
- Updated the Markdown verifier to allow `docs/agent`.
- Linked the agent docs from repo Markdown and from a quiet Docs/FAQ website
  pointer.

## Future Work

- Improve common verifier failure messages so each one prints the recovery
  command directly.
- Add an AX lint check for ambiguous public claims and stale command examples.
- Keep recording real agent mistakes in the worklog.
- Revisit catalog AX later as a separate project if agents still struggle after
  the repo Markdown layer is in place.
