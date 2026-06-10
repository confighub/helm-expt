# Quirk Work Queue (Source Top-100)

Generated. Do not edit by hand.

```sh
node scripts/generate-quirk-work-queue.mjs            # regenerate
node scripts/generate-quirk-work-queue.mjs --verify   # check
```

This queue turns the [quirk inventory audit](../quirk-inventory-audit/summary.md) gaps into chart-level work. Scope: the source top-100. A chart appears when it carries at least one under-modeled quirk axis; rank = user-risk weight times catalog leverage. Source state, modeled state, and proof state stay separate columns; nothing here is a proof claim. Full table: [top100-queue.csv](./top100-queue.csv).

## Scoring

| Axis | Weight | First action it implies |
| --- | --- | --- |
| remote-dependencies | 3 | record remote dependency repos and vendoring/pin status as chart facts |
| non-exact-dependencies | 3 | record non-exact dependency constraints and the pinned resolution as chart facts |
| apiservice | 2 | model APIService aggregation as a capability/target fact with a preflight check |
| hooks-unmodeled | 2 | create or promote a hook route candidate (see data/hook-route-candidates/) |
| semvercompare | 1 | add a version-conditional rendering note to the pain report; bind claims to the capability profile |
| files-get | 1 | record file-payload provenance in chart facts (payloads bypass values review) |

Leverage: top-20 catalog charts 3 (claims are strongest there, so untracked quirks cost the most credibility), promotion-review charts 2, everything else 1. Priority = risk x leverage; ties break by source rank.

## Queue Size Per Axis (of 80 queued charts)

| Axis | Charts |
| --- | --- |
| remote-dependencies | 47 |
| non-exact-dependencies | 26 |
| apiservice | 5 |
| hooks-unmodeled | 8 |
| semvercompare | 71 |
| files-get | 31 |

## Highest-Leverage Charts

| # | Chart | Tier | Gaps | First action |
| --- | --- | --- | --- | --- |
| 1 | prometheus-community/kube-prometheus-stack@85.3.0 | top20-catalog-supported | remote-dependencies;non-exact-dependencies;semvercompare;files-get | record remote dependency repos and vendoring/pin status as chart facts |
| 2 | prometheus-community/prometheus@29.8.0 | top20-catalog-supported | remote-dependencies;non-exact-dependencies;semvercompare | record remote dependency repos and vendoring/pin status as chart facts |
| 3 | bitnami/rabbitmq@16.0.14 | top20-catalog-supported | remote-dependencies;non-exact-dependencies;semvercompare | record remote dependency repos and vendoring/pin status as chart facts |
| 4 | bitnami/mysql@14.0.3 | top20-catalog-supported | remote-dependencies;non-exact-dependencies;semvercompare | record remote dependency repos and vendoring/pin status as chart facts |
| 5 | grafana/loki@7.0.0 | top20-catalog-supported | remote-dependencies;semvercompare;files-get | record remote dependency repos and vendoring/pin status as chart facts |
| 6 | bitnami/redis@25.5.3 | top20-catalog-supported | remote-dependencies;semvercompare | record remote dependency repos and vendoring/pin status as chart facts |
| 7 | bitnami/postgresql@18.6.7 | top20-catalog-supported | remote-dependencies;semvercompare | record remote dependency repos and vendoring/pin status as chart facts |
| 8 | k8s-dashboard/kubernetes-dashboard@7.14.0 | not-modeled | remote-dependencies;non-exact-dependencies;apiservice;hooks-unmodeled;semvercompare;files-get | record remote dependency repos and vendoring/pin status as chart facts |
| 9 | bitnami/mongodb@19.0.3 | top20-catalog-supported | remote-dependencies;semvercompare | record remote dependency repos and vendoring/pin status as chart facts |
| 10 | bitnami/nginx@24.0.2 | top20-catalog-supported | remote-dependencies;semvercompare | record remote dependency repos and vendoring/pin status as chart facts |

## Boundaries

- Source counts come from the committed static source feature scan; modeled and proof state from the maintained readiness data. The source and modeled top-100s are different lists; `not-modeled` rows are source-only charts.
- A queue position is prioritization, not a defect claim, and never a proof claim.
- Weights are editorial and documented above; change them in the generator, not the output.
