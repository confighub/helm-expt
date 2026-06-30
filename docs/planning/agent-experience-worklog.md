# Agent Experience Worklog

**UNOFFICIAL/EXPERIMENTAL**

Use this log when an agent or maintainer gets confused by the repo. The goal is
to fix observed friction, not to guess.

## 2026-06-30

Task: create the first AX layer for `helm-expt`.

Observed friction:

- Agent/operator guidance existed in several places but had no canonical start
  point under `docs/`.
- The public website was at risk of becoming cluttered with agent instructions.
- The catalog is large enough that agents need a read-only guide before
  touching generated chart evidence.
- `docs:verify` intentionally rejected new Markdown directories until the
  location was added to the verifier and doc map.

Fix:

- Created `docs/agent/` with task, recovery, verification, catalog, and terms
  guides.
- Recorded the doctrine that website pages stay human-first and agent material
  lives in repo Markdown.
- Left catalog pages and generated chart evidence untouched.

Follow-up in the same pass:

- Added a quiet Docs/FAQ website pointer to `docs/agent/README.md` so agents
  arriving through the public site can find the repo operating notes.
- Added `docs/agent/human-agent-doctrine.md` to keep human and agent pages
  aligned without duplicating each other.

Follow-up:

- Improve verifier recovery messages in scripts.
- Add AX linting only after more real agent failures are observed.
