# Metrics Server Use-More-Now Proof

## Purpose

This proof lane repeats the Redis and NGINX use-more-now shape for
`metrics-server/metrics-server@3.13.0`, starting with the `default` install
variant in `kube-system`.

Metrics Server is the right third live proof because it exercises APIService,
cluster RBAC, unresolved cluster-provided references, and a target-fact variant
for external TLS.

## Acceptance Contract

The Metrics Server lane is accepted when it proves:

| Capability | Command surface | Acceptance |
| --- | --- | --- |
| Package explanation | `cub install doc` | Shows bases and target-fact requirements. |
| Deterministic setup | `cub install setup` | Renders `default` into a fresh work directory. |
| Re-render | `cub install render` | Re-renders the same work directory successfully. |
| Package determinism | `cub install package` | Builds byte-identical package archives. |
| Validator path | `cub install vet` | Runs successfully, or records that the package has no validators. |
| Upload plan | `cub install plan` | Produces a read-only plan after upload state exists. |
| ConfigHub upload | `cub install upload` | Creates ConfigHub Units for APIService, cluster RBAC, workload, Service, and Namespace support objects. |
| Server-side variant | `cub variant create` | Clones a reviewed uploaded Metrics Server space. |
| Review/diff | `cub unit tree`, `cub unit data`, `cub revision list`, `cub unit diff` | Shows APIService data, revision history, and a Unit diff. |
| ConfigHub function scan | `cub function vet` | Runs validating functions against uploaded Units. |
| Safe operations | `cub changeset`, `cub unit approve`, `cub unit apply --dry-run`, `cub unit cancel` | Records approval and blocks apply clearly when no target exists. |

## Result

Passed for the current Metrics Server `default` proof lane on 2026-05-27.

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
| Review/diff | Pass for APIService tree/data/revisions/revision diff |
| ConfigHub function scan | Pass; `vet-format`, `vet-placeholders`, and `vet-merge-keys` passed for 10 Units |
| Safe operations | Pass; changeset/update/approval worked and dry-run apply blocked because no target is attached |

Important visible control points:

- `APIService v1beta1.metrics.k8s.io`
- cluster-scope RBAC
- unresolved cluster-provided `PriorityClass system-cluster-critical`
- unresolved cluster-provided `Role extension-apiserver-authentication-reader`
- `external-tls-ca` variant requires Secret `kube-system/metrics-server-tls`

