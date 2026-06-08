# Seven-Stage Helm Lifecycle

This is the doctrine for how the harness handles Helm charts, hooks, CRDs,
generated values, target facts, overlays, and other chart quirks.

The pipeline has seven stages. Every chart follows the same stages. What
changes from chart to chart is which quirks appear and which stage owns each
decision.

## Render Parity

Render parity means:

```text
regular Helm render and cub installer render produce the same Kubernetes object
set under recorded inputs, except for explicitly classified support objects or
intentional differences.
```

Render parity is the first trust boundary. It proves the desired non-hook object
set. It does not prove lifecycle execution, cluster readiness, controller
mutation, admission defaulting, GitOps sync, or day-2 behavior. Those claims
need later receipts.

## The Seven Stages

| Stage | Purpose | Main artifacts |
| --- | --- | --- |
| 1. Acquire and pin | Fetch the chart and dependencies, then lock exact bytes and provenance. | source lock, dependency lock |
| 2. Render and capture | Run Helm under recorded inputs, bind generated values, and compare with `cub installer`. | effective values, capability profile, generated facts, render receipt, render parity receipt |
| 3. Shape base variants | Define the supported install shapes that require a Helm render. | recipe, package, base variants, variant revisions |
| 4. Scan and gate | Check the exact rendered object set before install or publication. | object inventory, scan receipt, install gate |
| 5. Settle prerequisites | Record what must exist before the artifact is usable. | target facts, preflight results, approvals, signatures, delivery requirements |
| 6. Publish and deploy | Publish or apply the approved object set and route lifecycle behavior. | OCI/GitOps handoff, apply receipt, lifecycle receipt |
| 7. Observe and operate | Record live state and perform day-1/day-2 operations. | observation receipt, freshness status, upgrade/rollback receipts, drift and promotion evidence |

## Quirk Routing

| Quirk | Stage | Handling |
| --- | --- | --- |
| mutable chart source | 1 | source lock, digest, signature where available |
| subcharts, library charts, dependency aliases | 1 | dependency lock and dependency facts |
| values sprawl | 2 and 3 | effective values, value model, named base variants |
| `tpl`, Go templates, `required`, `fail` | 2 | render under recorded inputs; classify failures before support |
| `.Capabilities` and Kubernetes API branching | 2 | named capability profile |
| random passwords, certs, time, UUIDs | 2 | generated facts or external secret handles bound before render |
| `lookup` and existing cluster objects | 5 and 7 | target fact requirement, preflight, live observation |
| CRD on/off choice | 3 | separate base variant such as `default` or `no-crds` |
| CRD-before-CR ordering | 5 and 6 | prerequisite and delivery ordering policy |
| CRD upgrade behavior | 7 | operator-reviewed upgrade policy and receipts |
| webhooks, APIServices, controller-populated fields | 5, 6, and 7 | prerequisite checks, deploy ordering, readiness observation |
| generated Secret versus existing Secret | 2, 3, and 5 | generated fact, base variant, or target fact requirement |
| ingress, TLS, HA, storage, topology choices | 3 | base variant when object shape, count, or lifecycle changes |
| Kustomize or values overlay changing rendered objects | 3 | recipe/base overlay with digest and rendered diff |
| ConfigHub-only labels, target, region, approval, observation policy | 4 and 7 | derived ConfigHub variant or day-2 operation |
| raw manifests and extension slots | 2, 3, and 4 | explicit extension slot, scan/gate, or block |
| post-renderer | 2 or block | include in recorded render path or reject for catalog support |
| scanner/policy drift | 4 | scan receipt with scanner and policy bundle identity |
| GitOps sync and OCI pull | 6 and 7 | handoff receipt and controller observation |

## Hook Routing

Hooks are lifecycle behavior, not normal rendered configuration.

```text
Do not execute Helm hooks during recipe import.
Do not hide hooks inside render parity.
Do not claim hook behavior is supported without lifecycle routing and receipts.
```

Hook handling follows the same seven-stage model:

| Stage | Hook handling |
| --- | --- |
| 1. Acquire and pin | Keep hook templates in the pinned source. |
| 2. Render and capture | Inventory hook templates, phase, weight, delete policy, and object kind. |
| 3. Shape base variants | Decide whether a base includes, excludes, translates, or blocks hook behavior. |
| 4. Scan and gate | Surface hook risk in the chart pain report and install gate. |
| 5. Settle prerequisites | Record target facts, RBAC, CRDs, Secrets, StorageClasses, release phase, and approval requirements. |
| 6. Publish and deploy | Route safe behavior to an explicit lifecycle action, Argo/GitOps hook, sync wave, managed action, or skip/block decision. |
| 7. Observe and operate | Record execution result, readiness, cleanup, upgrade/rollback behavior, and freshness. |

Common dispositions:

| Hook class | Disposition |
| --- | --- |
| Helm test hook | explicit post-install check/test |
| pre-install setup | preflight, target fact, install lifecycle action, Argo `PreSync`, or blocker |
| post-install smoke test | ConfigHub check, Argo `PostSync`, or observation receipt |
| pre-upgrade or post-upgrade migration | upgrade lifecycle action with approval and receipt |
| hook weight/order | lifecycle ordering, sync waves where semantics match, or blocker |
| hook delete policy | explicit cleanup or rollback policy |
| CRD/webhook/bootstrap hook | CRD/webhook lifecycle gate plus live observation |
| unclear or unsafe side effect | production blocker until reviewed |

The top-500 source scan currently shows:

```text
495 charts scanned
54 charts with Helm hooks
176 hook templates found
42 likely problematic hook charts
```

This makes hooks a bounded support problem, not a reason to abandon the model.
The model is useful because it makes hook behavior visible and gives every hook
a disposition: translated, tested, skipped, blocked, or observed.

## Support Boundary

Use the narrowest true claim:

| Claim | Required evidence |
| --- | --- |
| model-supported | chart quirks are surfaced or disclosed |
| render parity | regular Helm and `cub installer` render match under recorded inputs |
| in-ConfigHub proof | rendered objects upload to ConfigHub with labels, Units, scans, and receipts |
| local live proof | rendered objects apply to a live test cluster and workload checks pass |
| GitOps/OCI proof | a controller pulls the published artifact and reconciles it |
| hook lifecycle proof | hook behavior has a route, execution/skip receipt, and fresh observation where needed |
| production support | lifecycle, prerequisites, scans, operations, and known residues are reviewed |

The public catalog should make the current support level visible per chart,
recipe, base variant, derived variant, and feature. A chart can have render
parity while a hook, CRD upgrade, secret delivery, or GitOps lane remains
blocked or operator-reviewed.

## User-Facing Summary

The user should see:

```text
Can I use this chart/base?
What needs to exist first?
What will be deployed?
What was checked?
What lifecycle behavior remains?
What did the cluster actually do?
```

The model is working when those answers are visible without reading Helm
templates or guessing what a values file produced.
