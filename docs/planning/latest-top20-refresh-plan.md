# Latest Top-20 Refresh Plan

The top-20 catalog is not a one-time screenshot. It must stay current without
silently changing what users deploy.

Current snapshot:

```text
npm run top20:latest-refresh
```

Outputs:

```text
data/latest-top20-refresh/review.csv
data/latest-top20-refresh/summary.md
data/latest-top20-refresh/work-orders.md
data/latest-top20-refresh/variant-work-orders.yaml
data/latest-top20-refresh/candidates/
data/latest-top20-refresh/promotion-readiness.md
data/latest-top20-refresh/promotion-readiness.csv
data/latest-top20-refresh/replacement-decisions/summary.md
data/latest-top20-refresh/replacement-decisions/decisions.csv
```

## What The Snapshot Means

The snapshot compares the chart versions in the current supported top-20
catalog with the latest chart versions returned by Helm after `helm repo
update`.

It does **not** mutate recipes or packages.

It answers:

```text
Which supported catalog proofs are still on the latest chart?
Which charts need a new versioned proof path?
Which variant/product work should happen next even when the chart is current?
```

## Current Result

As of the committed snapshot:

```text
14 / 20 top-chart proofs are on the latest chart version
6 / 20 have newer upstream chart versions available
```

The current update rows are:

| Chart | Current proof | Latest upstream | State |
| --- | --- | --- | --- |
| `argo-cd/argo-cd` | `9.5.15` | `9.5.17` | retained candidate still aligned |
| `bitnami/mongodb` | `19.0.7` | `19.1.0` | retained candidate `19.0.9` already superseded |
| `bitnami/nginx` | `24.0.2` | `25.0.0` | retained candidate `24.0.4` already superseded |
| `bitnami/postgresql` | `18.6.7` | `18.7.0` | retained candidate `18.6.10` already superseded |
| `bitnami/redis` | `25.5.3` | `27.0.0` | no retained candidate yet |
| `prometheus-community/kube-prometheus-stack` | `85.3.3` | `86.1.0` | retained candidate still aligned |
| `prometheus-community/prometheus` | `29.8.0` | `29.9.0` | retained candidate still aligned |

## Candidate Proof Status

The retained update candidates now have proof-complete root paths under:

```text
recipes/
packages/
```

The retained candidate source artifacts remain under:

```text
data/latest-top20-refresh/candidates/
```

Verify them with:

```sh
npm run top20:latest-candidates:verify
npm run top20:latest-promote-root-paths:verify
npm run top20:latest-promotion-readiness:verify
npm run top20:latest-replacement-decisions:verify
```

These candidate artifacts prove the updated chart versions have their own
recipe/package paths, rendered objects, Helm-equivalence evidence, ConfigHub
proof receipts, live e2e observation receipts, live parity receipts,
production-disposition boundary, catalog status, and top-100/top-500 refresh
coverage.

They are not catalog-supported replacements. The replacement-decision output is
the handoff checklist for choosing whether to replace, defer, or keep both the
current supported version and the proof-complete candidate. If a retained
candidate is already behind the latest upstream version, refresh or explicitly
retain it before making a replacement decision.

## Promotion Rule

A newer Helm chart version is only a candidate.

It becomes a supported ConfigHub catalog entry only when the new version has:

- a new `recipes/<repo>/<chart>/<version>/` path;
- a new `packages/<repo>/<chart>/<version>/` path;
- source lock, dependency lock, effective values, value model, control points,
  Helm plan, dossier, and pain report;
- supported install variants and rendered revision artifacts;
- regular Helm versus `cub installer` equivalence receipts;
- scan/gate receipts and installer-package receipts;
- ConfigHub upload, function scan, safe-ops, and server-side variant receipts;
- live e2e observation receipts;
- updated `CATALOG.md`, production disposition, top-100, and top-500 outputs.

No public catalog row should roll forward implicitly.

## Redis Work In This Wave

Redis is already current at `bitnami/redis@25.5.3`.

The next Redis work is therefore variant-product proof, not chart-version
refresh:

```text
Redis/default -> Redis/prod-us-east
Redis/default -> Redis/prod-eu-west
```

That proof should use:

- the reviewed `redis/default` `cub installer` base;
- `cub variant create` for clone/link;
- the Variant Creator contract for UX/AX/FX consistency;
- TransformPaths/functions/placeholders only for allowed post-render
  refinements;
- target facts for the existing Redis Secret reference where used;
- receipts for clone, mutation sources, checks, approvals, and observations.

If a Redis choice changes the rendered Kubernetes object set, it is not a
promotion variant. It goes back to the `cub installer` recipe/package path.

## Kubara Overlay Work In This Wave

Kubara-style managed apps are not simply "public chart at latest version."

The import unit is usually:

```text
managed wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + render context
  + target facts
```

The first planned golden remains:

```text
ExternalDNS/managed-aws -> ExternalDNS/customer-acme-prod
```

This must prove:

- customer overlay choices are classified before creation;
- rendered-object changes become new `cub installer` bases;
- post-render refinements become ConfigHub variants;
- ConfigHub Promotion shows the managed base and customer variant;
- receipts explain what changed and what remained target/live dependent.

This is a managed/commercial lane, not a free static catalog lane, because it
uses private overlay values, target facts, approvals, gates, and receipts.

## Order Of Work

1. Review the three latest-aligned retained candidates for target-scoped
   replacement decisions.
2. Refresh the three superseded retained candidates to the newer upstream
   versions or explicitly keep them for legacy patch and rollback evidence.
3. Create a new Redis update candidate for `bitnami/redis@27.0.0`.
4. Keep previous chart versions available for legacy patch and rollback review.
5. Generate and verify the Redis promotion Creator golden and receipts.
6. Generate and verify the ExternalDNS/Kubara managed overlay golden.
7. Recalculate top-100 and top-500 data from any changed catalog state.
8. Publish the website/catalog view from the generated chart catalog and proof
   data.

## Review Command

```sh
npm run top20:latest-refresh
npm run top20:latest-refresh:verify
npm run top20:latest-promotion-readiness:verify
npm run top20:latest-replacement-decisions:verify
npm run refresh:survival:verify
npm run variant-goldens:verify
npm run top100:catalog:verify
npm run top500:catalog:verify
npm run site:verify
```

The refresh command depends on the locally configured Helm repositories and
should be rerun after `helm repo update`.
