# PostgreSQL Use-More-Now Proof

## Purpose

This proof lane repeats the Redis, NGINX, and Metrics Server use-more-now shape
for `bitnami/postgresql@18.6.7`, starting with the `generated-passwords`
install variant.

PostgreSQL is the right fourth live proof because it exercises stateful
database concerns: generated Secret handling, a StatefulSet, persistent data
policy, service identity, and upgrade/rollback risk.

## Acceptance Contract

The PostgreSQL lane is accepted when it proves:

| Capability | Command surface | Acceptance |
| --- | --- | --- |
| Package explanation | `cub install doc` | Shows bases and target-fact requirements. |
| Deterministic setup | `cub install setup` | Renders `generated-passwords` into a fresh work directory. |
| Re-render | `cub install render` | Re-renders the same work directory successfully. |
| Package determinism | `cub install package` | Builds byte-identical package archives. |
| Validator path | `cub install vet` | Runs successfully, or records that the package has no validators. |
| Upload plan | `cub install plan` | Produces a read-only plan after upload state exists. |
| ConfigHub upload | `cub install upload` | Creates ConfigHub Units for the non-secret rendered output and records the separated Secret. |
| Server-side variant | `cub variant create` | Clones a reviewed uploaded PostgreSQL space. |
| Review/diff | `cub unit tree`, `cub unit data`, `cub revision list`, `cub unit diff` | Shows StatefulSet data, revision history, and a Unit diff. |
| ConfigHub function scan | `cub function vet` | Runs validating functions against uploaded Units. |
| Safe operations | `cub changeset`, `cub unit approve`, `cub unit apply --dry-run`, `cub unit cancel` | Records approval and blocks apply clearly when no target exists. |

## Result

Passed for the current PostgreSQL `generated-passwords` proof lane on
2026-05-27.

See [use-more-now-transcript.md](use-more-now-transcript.md).

Current status:

| Capability | Status |
| --- | --- |
| Package explanation | Pass |
| Deterministic setup | Pass |
| Re-render | Pass |
| Package determinism | Pass |
| Validator path | Pass; package declares no validators |
| Upload plan | Pass; pre-upload missing-state failure is expected, post-upload plan is no-op |
| ConfigHub upload | Pass, using explicit `CUB_CONFIG` workaround |
| Server-side variant | Pass; `cub variant create` cloned staging space |
| Review/diff | Pass for StatefulSet tree/data/revisions/revision diff |
| ConfigHub function scan | Pass; `vet-format`, `vet-placeholders`, and `vet-merge-keys` passed for 7 Units |
| Safe operations | Pass; changeset/update/approval worked and dry-run apply blocked because no target is attached |

Important visible control points:

- generated Secret `postgresql/postgresql` is separated and not uploaded
- `existing-secret` variant requires Secret `postgresql/postgresql-auth`
- StatefulSet and persistent data policy need production disposition
- upgrade/rollback risk is higher than for stateless charts

