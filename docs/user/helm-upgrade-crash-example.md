# Helm Upgrade Crash Example

**UNOFFICIAL/EXPERIMENTAL**

A customer once described a major outage caused by a Helm chart upgrade. The
important product claim here is not that ConfigHub makes every upgrade safe.
The claim is narrower and more useful:

```text
Helm upgrade becomes a staged, reviewable, rehearsable, gated change with
evidence at each stage, instead of one opaque production mutation.
```

## The Failure Mode

The risky path is familiar:

```text
helm upgrade ...
```

That single command can hide many different changes:

- CRD schema changes;
- webhook changes;
- immutable selector or StatefulSet changes;
- PVC, storage, or retention changes;
- Service identity and DNS changes;
- RBAC expansion;
- hook behavior;
- generated Secrets or certificates;
- namespace or release-name fanout;
- image changes;
- removed objects.

The problem is not that Helm is bad. The problem is that the upgrade is too
easy to treat as one operation when it actually contains several lifecycle
decisions.

## How The Staged Model Helps

For a serious chart, the ConfigHub/installer path breaks the upgrade into
checks a team can inspect.

| Stage | What The Team Sees |
| --- | --- |
| Render old and new | Exact Kubernetes objects for the supported version and candidate version. |
| Compare | Object and field diffs, not only values-file diffs. |
| Classify risk | CRDs, hooks, webhooks, storage, RBAC, images, target facts, generated facts, and removed objects are named. |
| Rehearse | The old and new paths can be tested in clean targets before production. |
| Gate | Scans, policy, changesets, approvals, and target prerequisites can block the operation. |
| Apply | ConfigHub records what was delivered as Units, variants, and revisions. |
| Observe | Receipts record what the cluster accepted and what actually converged. |

This does not guarantee that production cannot fail. It makes more failure
modes visible before production, and it leaves a receipt trail when something
does fail.

## Concrete Example: kube-prometheus-stack

The first serious upgrade seed is:

```text
prometheus-community/kube-prometheus-stack
85.3.3 -> 86.1.0
base: default
```

This chart is useful because it includes CRDs, admission webhooks, generated
credentials, dependencies, RBAC, and many rendered monitoring objects.

Current evidence in this repo:

| Evidence | What It Proves | Link |
| --- | --- | --- |
| Upgrade seed | `85.3.3` stays supported; `86.1.0` is a candidate until upgrade lanes pass. | [kube-prometheus-stack upgrade seed](../../data/refresh-survival/kube-prometheus-stack-upgrade-seed.md) |
| CRD delta | 10 CRDs in both versions; 6 changed; changes are recorded at schema-path level. | [CRD delta receipt](../../data/serious-chart-reviews/kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml) |
| Live CRD rehearsal | A fresh API server accepted the old CRDs, accepted the upgraded CRDs, and accepted a monitoring object server-side dry-run after upgrade. | [CRD live receipt](../../runs/serious-chart-reviews/kube-prometheus-stack/crd-upgrade-live/latest/receipt.yaml) |
| Live workload rehearsal | Plain Helm installed `85.3.3`, upgraded to `86.1.0`, and workloads converged again on the tested kind profile. | [workload live receipt](../../runs/serious-chart-reviews/kube-prometheus-stack/workload-upgrade-live/latest/receipt.yaml) |
| Blast-radius scoring | Some value changes have measured object reach; failing cases are published rather than hidden. | [blast-radius accuracy](../../data/blast-radius-accuracy/summary.md) |

This is already useful. It still does not claim that every production upgrade
path is safe.

## Example Workflow

The exact space, target, chart, and values depend on the user. The shape is:

```sh
# 1. Verify the supported version and candidate version surfaces are current.
npm run refresh:survival:verify

# 2. Compare the committed old and new rendered object sets.
mkdir -p .tmp/upgrade-review
diff -u \
  recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml \
  recipes/prometheus-community/kube-prometheus-stack/86.1.0/revisions/default/r001/rendered/release-objects.yaml \
  > .tmp/upgrade-review/kps-85.3.3-to-86.1.0.diff || true

# 3. Inspect the committed CRD delta for the serious candidate.
sed -n '1,160p' \
  data/serious-chart-reviews/kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml

# 4. Check the live CRD upgrade rehearsal receipt.
npm run kps:crd-upgrade-live:verify

# 5. Check the live regular-Helm workload upgrade rehearsal receipt.
npm run kps:workload-upgrade-live:verify

# 6. Check the measured blast-radius cases.
npm run blast-radius:accuracy:verify

# 7. Check current parity and live evidence already committed for the corpus.
npm run kind-parity:verify
npm run live-parity:verify
```

For a fresh upgrade on a new chart or private values file, the same workflow
would be run with new rendered inputs and new receipts. The ConfigHub operation
then becomes a reviewed change, not a blind upgrade:

```sh
# Pseudo-command shape. Use the current cub commands for your space and target.
cub unit diff --space <candidate-space>
cub changeset create --space <candidate-space> <upgrade-review>
cub function vet --space <candidate-space>
cub unit approve --space <candidate-space> --changeset <upgrade-review>
cub unit apply --space <candidate-space> --changeset <upgrade-review> --wait
```

The point is that the reviewer can see the exact object change, the scan result,
the target prerequisites, and the observation receipts before production is
declared healthy.

## What This Would Have Caught

This model is especially useful for upgrade failures caused by hidden scope:

- "This upgrade changes CRDs" becomes a CRD delta and live API-server
  rehearsal.
- "This chart needs a hook or lifecycle action" becomes a route, an observation,
  or a named blocker.
- "This value only looked small" becomes a blast-radius case against the actual
  object diff.
- "This target is not shaped correctly" becomes a target-fact or target-fit
  blocker before production.
- "The apply succeeded but the app is broken" becomes a live observation gap,
  not a false green.

Consul is a useful companion example. The secure-mesh path needs target facts
for TLS and secrets, and the proof target needs the right Kubernetes topology.
That is not a ConfigHub worker requirement. It is the install contract becoming
visible before the install is treated as supported.

## What Not To Claim

Do not claim that this repo has solved all Helm upgrades.

Do not claim that the kube-prometheus-stack candidate is a supported replacement
for every target. The current evidence is scoped to the recorded version pair,
base, values, and kind profile.

Do not claim that render parity alone proves upgrade safety. Render parity is
the baseline. Upgrade safety needs lifecycle review, target prerequisites,
scan/gate receipts, live before/after observations, and a scoped support
decision.

Do not claim that ConfigHub-managed upgrade orchestration and rollback are
complete for this example yet. The repo has a render-level CRD delta, a live
API-server CRD upgrade rehearsal, and a live regular-Helm workload upgrade
rehearsal. ConfigHub-managed upgrade receipt, rollback receipt, soak receipt,
private-overlay upgrade receipt, and production-target upgrade receipt remain
future work.

## Where This Fits

This is the day-2 version of the seven-stage model:

| Lifecycle Stage | Upgrade Use |
| --- | --- |
| 1. Source and inputs | Lock old chart, new chart, values, dependencies, and target facts. |
| 2. Render | Produce old and new object sets with the same declared profiles. |
| 3. Compare | Review object, field, CRD, hook, image, storage, and RBAC changes. |
| 4. Package and upload | Turn the candidate into reviewable ConfigHub Units and receipts. |
| 5. Variant and operation | Review changesets, approvals, scans, and target-specific gates. |
| 6. Deliver | Apply or reconcile through the declared target path. |
| 7. Observe | Record live readiness, controller status, drift, rollback, and freshness. |

Use [Serious Chart Proof](./serious-chart-proof.md) for the kube-prometheus-stack
proof path and [Upgrade Story Plan](../planning/upgrade-story-plan.md) for the
upgrade lane definition.
