# Hook Route Candidates

**UNOFFICIAL/EXPERIMENTAL — candidate route plans, 2026-06-11.**

These are **candidates** for the maintained hook lifecycle queue, not members
of it. Each file is a `HookLifecycleRouteCandidate` with
`result: candidate-route-plan` — a deliberately different kind from the
maintained `HookLifecycleRouteReceipt`, so a candidate can never be mistaken
for an observed receipt. Nothing here executes a hook, observes runtime
behavior, or claims production readiness.

Per-chart plans: [kong](./kong-kong.yaml) ·
[kubernetes-dashboard](./k8s-dashboard-kubernetes-dashboard.yaml) ·
[gitlab](./gitlab-gitlab.yaml) · [kafka](./bitnami-kafka.yaml) ·
[minio](./bitnami-minio.yaml) · [datadog](./datadog-datadog.yaml) ·
[thanos](./bitnami-thanos.yaml) ·
[airflow](./apache-airflow-airflow.yaml).
Compact table: [candidates.csv](./candidates.csv).

## Why These Eight

The source top-100 has 11 hook-bearing charts; the maintained queue models 5.
The reviewed delta is in
[`data/hook-lifecycle-review/`](../hook-lifecycle-review/summary.md). These
eight rows cover the reviewed source-hook and hook-like routes that are not yet
maintained lifecycle receipts:

| Pattern | Charts here | Route |
| --- | --- | --- |
| Database migration pair (`pre-upgrade` + `post-upgrade`, delete policies) | kong; kubernetes-dashboard (vendored kong) | upgrade action with receipt; Argo CD PreSync/PostSync for GitOps |
| Provisioning Job (`post-install, post-upgrade`, values-conditional) | kafka; minio (and thanos via its vendored minio) | explicit managed action with receipt; Argo CD PostSync for GitOps |
| Vendored lifecycle hook | gitlab (vendored traefik) | Argo/Flux lifecycle hook after serious-chart review decides the supported base |
| Environment-conditional hook set | datadog | target-class preflight plus upgrade/install action with receipt |
| Hook-like migration Jobs without hook annotations | airflow | recipe-time lifecycle verification before any hook-free claim |

Dependency-provided hooks are recorded as such: the dashboard's hooks come
from its vendored kong subchart, and the minio plan explicitly covers the
thanos-vendored instance. Chart-level review that skips the dependency
closure undercounts hooks.

## Promotion Path (Per Chart, Exact)

1. **kong/kong** — create the `cub installer` recipe with a DB-less base and
   a database base; confirm which bases render the migration pair; model the
   pair as ordered upgrade actions; admit to the maintained queue with a
   route receipt. Observed status requires a live run, which no candidate
   claims.
2. **kubernetes-dashboard** — create the recipe; render the default base and
   determine whether the vendored kong migration hooks materialize at all.
   If not rendered, record a hook-inert-under-default-values fact for that
   base instead of a route, and keep the route plan for any database-enabled
   base.
3. **bitnami/kafka** — recipe with a provisioning-off default base
   (hook-free render) and a provisioning-enabled base; route the Job as an
   explicit managed post-install action with a receipt.
4. **gitlab/gitlab** — treat as a serious-chart review first; confirm whether
   the vendored Traefik lifecycle hook renders in the supported base; then
   write a maintained route receipt or a hook-inert fact for that base.
5. **bitnami/minio** — same as kafka, reusing one shared route receipt shape
   for the whole bitnami provisioning pattern.
6. **datadog/datadog** — split target scopes: normal targets where the GKE
   Autopilot hooks are inert, GKE Autopilot targets where the allowlist work is
   preflight, and upgrade paths where the migration Job gets a receipt.
7. **bitnami/thanos** — record the vendored MinIO provisioning hook as
   dependency-provided and reuse the MinIO provisioning route shape when a
   provisioning-enabled base renders it.
8. **apache-airflow/airflow** — verify values-conditional lifecycle Jobs at
   recipe time. A zero Helm-hook annotation count is not a hook-free claim.

## Boundaries

- Static source analysis plus hand review only; phases, templates, and delete
  policies come from the committed source feature scan.
- The maintained queue (`data/hook-lifecycle/`) is unchanged.
- A route plan is a classification, not a proof: no chart here is
  production-ready, runtime-observed, or guaranteed to render its hooks under
  every values profile. The unresolved default-values rendering question for
  the dashboard is stated, not assumed.
