# Retained Candidate Replacement Decisions

This generated report is the final review surface for the retained
proof-complete update candidates.

The candidates have proof-complete root paths. They are visible in the catalog
as `catalog-candidate` entries. They do not replace the current supported
versions until a target-scoped replacement decision chooses that outcome. If a
candidate is already behind the latest upstream chart version, refresh or
explicitly retain it before making a replacement decision.

## Result

```text
candidate charts: 7
proof-complete root paths: 7 / 7
latest-upstream aligned: 4 / 7
superseded by newer upstream: 3 / 7
replacement decisions not written: 5 / 7
replacement decisions written: 2 / 7
support-promoted candidates: 0 / 7
```

## Candidates

| Chart | Current supported | Candidate | Latest upstream | Freshness | Candidate base | Proof status | Replacement decision | Topics | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | `9.5.17` | latest-upstream-aligned | default | proof-complete-root-path-present | not-decided | 7 | write target-scoped replacement decision for argo-cd/argo-cd@9.5.17; review 7 topic(s), then choose replace, defer, or keep 9.5.15 pinned |
| `bitnami/mongodb` | `19.0.7` | `19.0.9` | `19.1.0` | superseded-by-newer-upstream | generated-passwords | proof-complete-root-path-present | not-decided | 7 | candidate bitnami/mongodb@19.0.9 is behind latest upstream 19.1.0; decide whether to supersede it or keep it for legacy patch/rollback evidence before replacing 19.0.7 |
| `bitnami/nginx` | `24.0.2` | `24.0.4` | `25.0.0` | superseded-by-newer-upstream | http-clusterip | proof-complete-root-path-present | not-decided | 5 | candidate bitnami/nginx@24.0.4 is behind latest upstream 25.0.0; decide whether to supersede it or keep it for legacy patch/rollback evidence before replacing 24.0.2 |
| `bitnami/postgresql` | `18.6.7` | `18.6.10` | `18.7.0` | superseded-by-newer-upstream | generated-passwords | proof-complete-root-path-present | not-decided | 7 | candidate bitnami/postgresql@18.6.10 is behind latest upstream 18.7.0; decide whether to supersede it or keep it for legacy patch/rollback evidence before replacing 18.6.7 |
| `bitnami/redis` | `25.5.3` | `27.0.0` | `27.0.0` | latest-upstream-aligned | default | proof-complete-root-path-present | [defer-replacement](./decision-artifacts/bitnami-redis-27.0.0.yaml) | 5 | replacement decision defers bitnami/redis@27.0.0; keep 25.5.3 pinned and revisit after the recorded requirements are satisfied |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | `86.1.0` | latest-upstream-aligned | default | proof-complete-root-path-present | [defer-replacement](./decision-artifacts/prometheus-community-kube-prometheus-stack-86.1.0.yaml) | 6 | replacement decision defers prometheus-community/kube-prometheus-stack@86.1.0; keep 85.3.3 pinned and revisit after the recorded requirements are satisfied |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | `29.9.0` | latest-upstream-aligned | server-only-ephemeral | proof-complete-root-path-present | not-decided | 4 | write target-scoped replacement decision for prometheus-community/prometheus@29.9.0; review 4 topic(s), then choose replace, defer, or keep 29.8.0 pinned |

## Decision Rule

A proof-complete candidate can still be the wrong replacement for a given
target. Replacement needs a target-scoped decision that records:

- whether to replace, defer, or keep both versions;
- the supported base and target scope;
- accepted lifecycle, scan, image, storage, RBAC, CRD, webhook, and target-fact
  boundaries;
- fresh live evidence requirements after replacement.

Until that decision exists, the current supported version remains pinned.

## Files

| File | Role |
| --- | --- |
| [decisions.csv](./decisions.csv) | Spreadsheet replacement queue. |
| [decisions.yaml](./decisions.yaml) | Machine-readable replacement queue. |
| [decision-artifacts/](./decision-artifacts/) | Target-scoped replacement decisions that close individual rows. |
| [../promotion-work-orders.md](../promotion-work-orders.md) | Closed proof-lane work orders for these candidates. |
| [../production-disposition/summary.md](../production-disposition/summary.md) | Candidate production-disposition boundary. |

## Verify

```sh
npm run top20:latest-replacement-decisions:verify
```
