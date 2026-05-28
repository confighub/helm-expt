# NGINX ConfigHub Proof

## Purpose

This proof lane repeats the Redis ConfigHub proof shape for
`bitnami/nginx@24.0.2`, starting with the simplest useful install variant:
`http-clusterip`.

It uses current commands only. It does not rely on future shorthand such as
`cub install nginx`, `cub install compare`, `cub install scan`, or
`cub variant diff`.

## Acceptance Contract

The NGINX lane is accepted when it proves:

| Capability | Command surface | Acceptance |
| --- | --- | --- |
| Package explanation | `cub install doc` | Shows NGINX package bases and target-fact requirements. |
| Deterministic setup | `cub install setup` | Renders `http-clusterip` into a fresh work directory. |
| Re-render | `cub install render` | Re-renders the same work directory successfully. |
| Package determinism | `cub install package` | Builds byte-identical package archives. |
| Validator path | `cub install vet` | Runs successfully, or records that the package has no validators. |
| Upload plan | `cub install plan` | Produces a read-only plan after upload state exists. |
| ConfigHub upload | `cub install upload` | Creates or reconciles ConfigHub Units for the rendered NGINX output. |
| Server-side variant | `cub variant create` | Clones a reviewed uploaded NGINX space. |
| Review/diff | `cub unit tree`, `cub unit data`, `cub revision list`, `cub unit diff` | Shows ConfigHub-side object data, revision history, and a Unit diff. |
| ConfigHub function scan | `cub function vet` | Runs validating functions against uploaded Units. |
| Safe operations | `cub changeset`, `cub unit approve`, `cub unit apply --dry-run`, `cub unit cancel` | Records approval and blocks apply clearly when no target exists. |

## Result

Passed for the current NGINX `http-clusterip` proof lane on 2026-05-27.

See the ConfigHub proof transcript in this directory.

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
| Review/diff | Pass for Unit tree/data/revisions/revision diff |
| ConfigHub function scan | Pass; `vet-format`, `vet-placeholders`, and `vet-merge-keys` passed for 6 Units |
| Safe operations | Pass; changeset/update/approval worked and dry-run apply blocked because no target is attached |

