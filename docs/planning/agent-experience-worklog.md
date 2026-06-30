# Agent Experience Worklog

**UNOFFICIAL/EXPERIMENTAL**

Use this log when an agent or maintainer gets confused by the repo. Record the
problem and the fix.

## 2026-06-30

Task: create the first agent/operator documentation layer for `helm-expt`.

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
- Recorded the rule that website pages stay for users and agent material lives
  in repo Markdown.
- Left catalog pages and generated chart evidence untouched.

Follow-up in the same pass:

- Added a Docs/FAQ website link to `docs/agent/README.md` so agents arriving
  through the public site can find the repo operating notes.
- Added `docs/agent/human-agent-doctrine.md` to keep human and agent pages
  aligned without duplicating each other.

Follow-up:

- Improve verifier recovery messages in scripts.
- Add docs linting only after more real agent failures are observed.
