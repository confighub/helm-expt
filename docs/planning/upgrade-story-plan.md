# Upgrade Story Plan

This page defines the upgrade proof lane for maintained chart versions.

The current catalog proves install-time rendering and selected live behavior.
That is not the same as proving that an old deployed release can be upgraded to
a newer chart version safely. Upgrade support needs its own artifacts.

## Current Seed

The first upgrade-story seed is:

[kube-prometheus-stack upgrade seed](../../data/refresh-survival/kube-prometheus-stack-upgrade-seed.md)

This chart is the right first serious case because it includes CRDs, admission
webhooks, generated credentials, dependencies, cluster RBAC, and many rendered
monitoring resources.

The current seed is not a live upgrade proof. It records the supported version,
the latest candidate version, object-count continuity for the declared bases,
and the lanes that must pass before the candidate can replace the supported
catalog row.

## Required Upgrade Artifacts

For one chart version pair and one base variant, an upgrade proof must include:

| Artifact | Purpose |
| --- | --- |
| Old rendered object set | The exact supported version currently installed. |
| New rendered object set | The exact candidate version being evaluated. |
| Render diff | Object and field differences between old and new desired state. |
| Provenance notes | Which recipe, values, target facts, generated facts, or lifecycle choice caused important changes. |
| CRD lifecycle review | Whether CRDs are installed, omitted, upgraded, or target-managed. |
| Hook/lifecycle route | Whether hook behavior is unsupported, moved into target facts, moved into controller lifecycle, or observed after apply. |
| Scan/gate receipts | Policy and misconfiguration results for the new rendered object set. |
| ConfigHub receipts | Upload, function scan, safe operation, and server-side variant receipts for the candidate. |
| Live before receipt | Fresh observation of the old version before upgrade. |
| Live after receipt | Fresh observation of the new version after upgrade. |
| Live parity receipt | Comparison of regular Helm upgrade behavior and the ConfigHub path where feasible. |
| Support decision | Target-scoped decision saying supported, watch, blocked, rejected, or superseded. |

## Claim Boundary

An upgrade proof is always scoped:

```text
chart + old version + new version + base variant + flag profile + Kubernetes profile
```

Do not generalize from one version pair to all future upgrades. A passing
upgrade proof says that this exact pair and profile passed. A watch or blocked
result stays visible until it is routed.

## Work Order

For `prometheus-community/kube-prometheus-stack`:

1. Keep `85.3.3` as the supported catalog version.
2. Keep `86.1.0` as a latest-version candidate until promotion lanes pass.
3. Generate an old/new rendered diff for `default` and `no-crds`.
4. Review CRD and webhook lifecycle changes.
5. Run scan/gate and ConfigHub proof lanes for the candidate.
6. Run live before/after observations on a fresh kind profile.
7. Record whether regular Helm upgrade and ConfigHub delivery reach equivalent
   desired and live outcomes.
8. Update production disposition, top100, top500, catalog, and refresh-survival
   surfaces only after the evidence is committed.

## Verify Current Seed

```sh
npm run refresh:survival:verify
```
