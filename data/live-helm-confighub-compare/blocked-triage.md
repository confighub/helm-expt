# Live Helm-vs-ConfigHub Parity — `blocked` triage

Triage of the 8 `blocked` rows in the top-20 strict live-parity lane
(receipts observed 2026-06-05, under `runs/live-helm-confighub-compare/`).

## Headline

**None of the 8 blocked rows is a ConfigHub-vs-Helm parity defect.** All 8 die in
per-chart cluster/rig provisioning (`cub lk up`) or in the upstream Helm install
leg — *before* a parity comparison is reached. The one chart that did reach the
comparison (`tempo`) **passed** it (`missing=0, diffs=0`); it is only `blocked`
because the upstream Helm release's pod stayed `Pending` past the 8-minute wait.

So the lane's real parity result is better than "10 pass / 2 watch / 8 blocked"
suggests: **0 confirmed parity regressions**, with 8 rows un-evaluated due to
local infrastructure flakiness.

## Per-chart breakdown

| Rank | Chart | Failure point | Category |
| ---: | --- | --- | --- |
| 5 | external-secrets/external-secrets | `cub lk up failed: kind create cluster: exit status 1` | infra: kind create failed |
| 10 | grafana/loki | `cub lk up failed: kind create cluster: exit status 1` | infra: kind create failed |
| 11 | longhorn/longhorn | `cub lk up failed: kind create cluster: exit status 1` | infra: kind create failed |
| 7 | prometheus-community/kube-prometheus-stack | `cub lk up failed: wait for argocd-server … not Available` | infra: rig bootstrap (argocd) not ready |
| 12 | hashicorp/vault | `cub lk up failed: wait for argocd-server … not Available` | infra: rig bootstrap (argocd) not ready |
| 20 | hashicorp/consul | `cub lk up failed: timeout after 600s` | infra: provisioning timeout |
| 6 | argo-cd/argo-cd | `crd apply failed: etcdserver: request timed out` (+ CRD ownership conflict on the Helm leg) | infra: etcd/apiserver overload |
| 19 | grafana/tempo | semantic parity **passed**; upstream Helm `StatefulSet/tempo` stuck `Pending`, `context deadline exceeded` | helm-runtime: upstream not ready (parity passed) |

How far each row got:

- **6 of 8** never ran a single leg — they failed inside `cub lk up` (kind cluster
  create + bootstrap Argo CD). `legs: {}`, `semanticComparison: <did not run>`.
- **1 of 8** (argo-cd) created the cluster but died on `etcdserver: request timed
  out`; teardown then could not kill the container
  (`docker rm -f … did not receive an exit event`).
- **1 of 8** (tempo) completed the comparison and passed; the block is the upstream
  Helm pod readiness timeout, not parity.

## Root cause

The bottleneck and failure point is **per-chart ephemeral cluster provisioning**
(`cub lk up`: a fresh `kind` cluster plus a bootstrap Argo CD per chart), run on a
single host. Under load this manifests as: `kind create cluster` failing, the
bootstrap `argocd-server` never reaching `Available` within 5m, a 600s
provisioning timeout, `etcd` request timeouts, and teardown that cannot remove
containers. A failed teardown (`clusterLifecycle: cleanup-failed`, "no lk-managed
Space") can also leak clusters/containers that starve subsequent runs, turning one
flake into a cascade.

Aggravating factors:

- The blocked set skews toward heavyweight / CRD-heavy charts (argo-cd,
  kube-prometheus-stack, vault, consul, longhorn, loki) — more resource pressure
  per cluster.
- Upstream Helm `--wait --timeout 8m` on single-node `kind` is too tight for
  storage-bound workloads (tempo's PVC-backed StatefulSet stays `Pending`).

## Recommended remediations

Harness / infrastructure (the actual fix — tracked, not in this PR because it needs
the full live rig to validate):

1. **Serialize chart runs** under `--all` and reclaim resources between rows; never
   provision multiple kind clusters concurrently on one host.
2. **Make teardown authoritative**: always `cub lk down --force` and prune leaked
   `kind` clusters / `docker` containers before the next row, so a failure cannot
   cascade.
3. **Retry/backoff** transient `kind create cluster` and bootstrap-Argo-CD
   readiness failures; raise the bootstrap readiness budget or make it
   non-blocking where the leg doesn't need Argo CD.
4. **Right-size waits & resources**: pre-pull `kindest/node`, ensure Docker has
   enough memory/disk, and either raise the Helm `--wait` timeout or treat an
   upstream-Helm `Pending` (storage/scheduling) as `watch` when ConfigHub parity
   already passed — the tempo case.
5. **Pre-clean CRD state** for charts like argo-cd to avoid the
   "CRD exists and cannot be imported … missing meta.helm.sh/release-name"
   ownership conflict.

Taxonomy (shipped in this PR):

6. **Distinguish `blocked-infra` from `blocked-parity`.** The summary now carries a
   `reason` column and a per-cause breakdown (`scripts/run-top20-live-parity.mjs`),
   so an infra flake and a genuine parity regression are never conflated. A real
   parity mismatch would surface as `helm-runtime: upstream leg blocked` with the
   semantic comparison failing, or as a future `parity: …` category — visibly
   different from the `infra:` rows.

## Next action

Re-run the 8 blocked rows **serially on a clean host** with hardened teardown.
Expectation, based on this triage: most flip to `pass`/`watch`, and tempo flips
once the upstream wait is right-sized. Any row that then still fails the *semantic*
comparison is a real parity finding worth a dedicated issue.
