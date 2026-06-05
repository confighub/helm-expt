# Large Machine Handover

Updated: 2026-06-05

This is the handover for a Codex instance with enough local resources to run
cluster and GitOps tests. It starts from public `main` after PR #162.

## First Principle

Do not claim "checked", "verified", "live", "all charts", or "all quirks"
unless the exact scope has committed evidence and a verifier.

Use these words precisely:

| Word | Meaning in this repo |
| --- | --- |
| `render verified` | Helm-equivalence and installer setup checks exist for the recipe variant. |
| `ConfigHub proof` | ConfigHub upload, server-side clone, function scan, and safe-ops receipts exist. This is not a cluster deployment. |
| `local live` | A kind or equivalent Kubernetes observation receipt proves objects were applied and runtime checks passed. |
| `GitOps live` | ConfigHub Units were published through OCI and reconciled by Argo or Flux, with sync and runtime evidence. |
| `live parity` | A live Helm deployment was compared against both ConfigHub delivery paths: controller-driven OCI and kubectl/apply. |
| `derived variant proof` | A downstream ConfigHub Space was created from an uploaded reviewed base, with clone/link/gate/check evidence. |
| `target-bound derived variant` | A derived variant has a real target attached and live apply evidence. |

The repo has useful proof. It does not yet have complete live proof.

## Current Honest State

Use [data/lane-test-matrix/summary.md](../../data/lane-test-matrix/summary.md)
as the chart-recipe-variant truth source.

Current row-level lane counts:

```text
chart-recipe-variant rows: 156
helm_template_vs_installer_setup: 156 pass, 0 missing
confighub_upload_variant_scan_safe_ops: 18 pass, 138 missing
local_kind_kubectl_apply: 21 pass, 135 missing
confighub_oci_argo_live: 6 pass, 145 missing, 5 fail
live_helm_vs_confighub_dual_compare: 2 pass, 154 missing
complete core lane set: 2
```

Also true:

```text
100 charts have recipe/package proof artifacts.
20 top-20 chart-level ConfigHub proof receipt sets exist.
20 top-20 local-kind receipt sets exist for selected supported scope.
10 derived ConfigHub variants have live intended-state receipts.
5 derived ConfigHub variants have target-bound live apply PASS receipts:
`NGINX-prod-us-east`, `NGINX-customer-acme-prod`,
`MetricsServer-prod-us-east`, `Prometheus-prod-us-east`, and
`Prometheus-staging-eu-west`.
1 derived ConfigHub variant has a target-bound blocked receipt:
`Redis-staging-eu-west`.
The generated target-bound derived variant summary is:
`data/derived-variant-target-bound/summary.md`.
10 rows have committed GitOps/OCI live receipts:
`bitnami/redis@25.5.3 / reuse-existing-secret`,
`prometheus-community/prometheus@29.8.0 / server-only-ephemeral`, and
`bitnami/postgresql@18.6.7 / existing-secret` pass through Flux OCI.
`bitnami/nginx@24.0.2 / http-clusterip` and
`metrics-server/metrics-server@3.13.0 / default` pass through Argo CD OCI.
`external-secrets/external-secrets@2.5.0 / no-crds` has a blocked receipt:
Argo synced the OCI artifact, but the workload needs CRDs already present and
the webhook Secret delivered outside the current workload OCI path.
`argo-cd/argo-cd@9.5.15 / no-crds` has a blocked receipt: Argo synced the OCI
artifact, but runtime Secret requirements were incomplete.
`prometheus-community/kube-prometheus-stack@85.3.3 / no-crds` has a blocked
receipt: Flux pulled the OCI artifact, but reconciliation failed because
Prometheus Operator CRDs were absent and separated Secrets were not delivered.
`hashicorp/consul@2.0.0 / secure-mesh-existing-secrets` has a blocked receipt:
Flux pulled the OCI artifact, but the selected secure mesh base needs a
multi-node target for its three-server topology and anti-affinity rules.
`ingress-nginx/ingress-nginx@4.15.1 / admission-disabled` has a watch receipt:
Argo synced the OCI artifact and the controller Deployment became Ready, but
the kind target has no LoadBalancer external IP so Argo health stayed
Progressing.
2 rows have committed live Helm-vs-ConfigHub parity receipts:
`bitnami/nginx@24.0.2 / http-clusterip` passes regular Helm, ConfigHub
kubectl/apply, and ConfigHub OCI/Argo delivery. The shared rendered object sets
match semantically; the only expected difference is the installer-added
Namespace object.
`bitnami/redis@25.5.3 / default` passes the same three delivery paths. The
Redis run also proves separated Secret staging, four Bound PVCs, StatefulSets
Ready, Redis PONG, and the same expected Namespace-only ConfigHub extra object.
```

The apparent tension between "20 top-20 receipt sets" and "18 row-level
ConfigHub lane passes" is expected: the lane matrix is exact by
chart-recipe-variant row and includes non-default choices. Never collapse the
row-level gap into chart-level success.

## What Was Just Completed

PR #155 and PR #157 added:

- Redis ConfigHub proof refresh through the common proof lane.
- Live intended-state receipts for all 10 work orders in the first derived
  expansion wave:
  - Redis: `prod-us-east`, `staging-eu-west`
  - NGINX: `prod-us-east`, `customer-acme-prod`
  - Prometheus: `prod-us-east`, `staging-eu-west`
  - Grafana: `prod-us-east`, `customer-acme-prod`
  - Vault: `regulated-prod-us-east`, `staging-us-east`
- `npm run derived-variants:verify` now verifies all 10 receipts.
- Demo proof docs now distinguish `ConfigHub Units` from `Kubernetes Units plus
  installer record`.
- Issue #156 tracks Grafana placeholder drift observed during clone.

Important limitation: all 10 derived receipts intentionally stop before target
binding and live apply. They prove ConfigHub intended state, not runtime.

The current target-bound derived variant receipts are:

```text
runs/derived-variant-target-bound/nginx-prod-us-east/receipt.yaml
runs/derived-variant-target-bound/nginx-customer-acme-prod/receipt.yaml
runs/derived-variant-target-bound/metrics-server-prod-us-east/receipt.yaml
runs/derived-variant-target-bound/prometheus-server-only-prod-us-east/receipt.yaml
runs/derived-variant-target-bound/prometheus-server-only-staging-eu-west/receipt.yaml
npm run derived-variants:target-bound:verify
```

Those receipts prove clean uploaded NGINX `http-clusterip`, Metrics Server
`default`, and Prometheus `server-only-ephemeral` bases were cloned with
`cub variant create --target`. The cloned workload Units were applied to
ConfigHub OCI targets, Argo CD reconciled the derived Spaces, and Kubernetes
reported the workloads ready. Metrics Server also records APIService
availability. Prometheus now has both production and staging target-bound
derived receipts.
The receipts also record a product detail: the derived Space label changes to
the requested operating variant, while cloned Unit labels still preserve the
source base label unless a post-clone mutation changes them.

The first target-bound blocked receipt is:

```text
runs/derived-variant-target-bound/redis-staging-eu-west/receipt.yaml
```

It records that Redis staging cannot yet be honestly called target-bound live:
the work order asks for a namespace change and Redis Secret delivery, but those
are not yet represented by checked post-clone mutations or secret/fact bindings
in the derived path.

## Known Sharp Edge

Grafana generated-passwords derived variants initially cloned
`deployment-grafana-grafana` with one duplicated `9094` port rewritten to:

```text
name: confighubplaceholder
protocol: confighubplaceholder
```

Both Grafana derived variants were corrected by copying the reviewed source
Unit data back into the derived Unit. The receipts record the corrective update.

Follow-up issue:

```text
https://github.com/confighub/helm-expt/issues/156
```

Do not present Grafana as a clean clone until that behavior is fixed or
explained by product.

## Start Here On The Large Machine

Run these first:

```sh
git status -sb
npm run docs:verify
npm run lane-tests:verify
npm run top20:verify-confighub-proof
npm run derived-variants:verify
npm run derived-variants:target-bound:verify
npm run derived-variants:target-bound:summary:verify
npm run completeness:verify
cub version
cub context get -o json
cub space list -o json
cub target list --space "*" -o json
```

These are read-only except for normal local generated-process temp files. Do
not mutate ConfigHub or clusters until you state exactly what will change.

## Live Testing Definition Of Done

For a chart-recipe-variant row to move toward fully proven, produce receipts
for:

1. Fresh Helm install in a live cluster.
2. ConfigHub kubectl/apply delivery in a live cluster.
3. ConfigHub OCI plus Argo or Flux delivery in a live cluster.
4. Semantic object comparison across Helm and both ConfigHub deliveries.
5. Runtime checks that match the chart's actual workload and quirks.
6. Cleanup or retention receipt explaining what remains.
7. Lane-matrix update that marks only the rows actually covered as pass.

Runtime checks must cover relevant quirks, not just "kubectl apply returned 0":

```text
CRDs
hooks and lifecycle jobs
admission webhooks
cluster-scoped RBAC
generated Secrets and separated Secrets
existing Secret target facts
PVCs and StatefulSets
Service, Ingress, TLS, and LoadBalancer behavior
lookup/tpl/template weirdness
mutable image tags and digest overrides
namespace and storage class prerequisites
day-2 upgrade and rollback for stateful or hook-heavy charts
```

## Next Codex Work Packet

Use [large-machine-roadmap.md](./large-machine-roadmap.md) as the active
roadmap. The shortest useful path is:

1. Attach targets to one prod and one staging derived variant and produce
   target-bound live apply receipts.
2. Expand live Helm-vs-ConfigHub parity to the next useful top-20 row.
3. Keep the receipt schema and verifier as the gate before expanding to more
   charts.
4. Update the lane matrix after every exact row moves from missing to pass.

If any part fails, record a blocked receipt or issue with the exact command,
environment, and observed failure. A failed or blocked lane is valuable evidence
as long as it is not described as a pass.

## Human Navigation Problem

The repo is hard for humans to navigate. That is now a first-class workstream,
not cosmetic cleanup.

The large-machine Codex should improve:

- `README.md`: answer "what am I getting?" before proof mechanics.
- `CATALOG.md` and site pages: per-chart promise cards.
- `docs/README.md`: doc map by audience and task.
- `docs/user/`: only human-facing docs.
- `docs/reference/`: stable definitions, lane doctrine, command surfaces.
- `docs/planning/`: roadmap, handover, issue mirrors, execution queues.
- stale docs: move, archive, or mark as historical so they cannot mislead.

Do not delete docs casually. Move or mark them only after checking references
with `npm run docs:verify`.

## Verification Tools Explained

New users need to know what each verifier proves:

| Tool | Proves | Does not prove |
| --- | --- | --- |
| `npm run verify` | Corpus self-consistency across many generated artifacts and receipts. | Fresh live cluster behavior for every chart. |
| `npm run lane-tests:verify` | Lane matrix is current and missing/pass states are generated from evidence. | That missing lanes have been run. |
| `npm run top20:verify-confighub-proof` | Top-20 ConfigHub proof receipt sets are present and schema-valid. | Every variant row has ConfigHub proof, or any row is live. |
| `npm run derived-variants:verify` | Ten derived intended-state receipts exist and match expected clone/link/gate evidence. | Target-bound live apply. |
| `npm run derived-variants:target-bound:verify` | Target-bound derived variant receipts exist and pass schema/content checks. | More than the exact committed receipts. |
| `npm run derived-variants:target-bound:summary:verify` | The generated target-bound derived variant table is current with the receipts. | Fresh live execution. |
| `npm run variant-goldens:verify` | Creator and derived-variant golden files are current. | Live execution unless a separate receipt exists. |
| `npm run completeness:verify` | Model-completeness generated outputs are current. | Runtime correctness. |
| `npm run docs:verify` | Markdown doc map and links are internally consistent. | Docs are understandable or complete. |

The next docs improvement should make this table visible from a user-facing
"How verification works" page.

## GitHub Sync Expectation

Work in small branches, commit evidence plus verifier changes together, then
sync frequently:

```sh
git fetch origin
git rebase origin/main
git push -u origin <branch>
gh pr create ...
gh pr merge ...
```

After each merge, re-check open PRs:

```sh
gh pr list --state open --json number,title,headRefName,mergeStateStatus,url
```
