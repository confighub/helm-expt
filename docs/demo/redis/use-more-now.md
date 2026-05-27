# Redis Use-More-Now Proof

## Purpose

This proof lane exercises existing `cub install`, `cub`, and ConfigHub
capabilities before asking for new porcelain verbs. It is deliberately based on
real current commands, not future shorthand.

## Acceptance Contract

The Redis lane is accepted when it proves:

| Capability | Command surface | Acceptance |
| --- | --- | --- |
| Package explanation | `cub install doc` | Shows Redis package bases and target-fact requirements from `installer.yaml`. |
| Deterministic setup | `cub install setup` | Renders the Redis default base into a fresh work directory. |
| Re-render | `cub install render` | Re-renders the same work directory successfully. |
| Package determinism | `cub install package` | Builds a deterministic package archive. |
| Validator path | `cub install vet` | Runs successfully when validators are present, or records that the package has no validators. |
| Upload plan | `cub install plan` | Produces a read-only plan after upload state exists, or records the missing upload state before first upload. |
| ConfigHub upload | `cub install upload` | Creates or reconciles ConfigHub Units for the rendered Redis output when the local server/auth surface is available. |
| Server-side variant | `cub variant create` | Clones a reviewed uploaded Redis space when server-side variation is simpler than another Helm render. |
| Review/diff | `cub unit tree`, `cub unit data`, `cub revision list`, `cub unit diff` | Shows ConfigHub-side object data, revision history, and a diff where possible. |

If a live ConfigHub command is blocked by auth, server availability, or an
existing CLI bug, the transcript must show the exact blocker and leave the
artifact in `blocked-live` status rather than silently treating docs as proof.

## Result

Passed for the current Redis proof lane on 2026-05-27.

See [use-more-now-transcript.md](use-more-now-transcript.md).

Current status:

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass, with local `kustomize` PATH note |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | Pass; package declares no validators |
| Upload plan | Pass; pre-upload missing-state failure is expected, post-upload plan is no-op |
| ConfigHub upload | Pass, using explicit `CUB_CONFIG` workaround |
| Server-side variant | Pass; `cub variant create` cloned staging space |
| Review/diff | Pass for Unit tree/data/revisions/revision diff; richer variant diff remains a product ask |
