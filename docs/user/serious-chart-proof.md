# Serious Chart Proof

**UNOFFICIAL/EXPERIMENTAL**

Use Redis to understand the happy path. Use kube-prometheus-stack to check
whether the model survives a chart that looks like real platform work.

kube-prometheus-stack is the main hard-chart example in this repo:

```text
chart: prometheus-community/kube-prometheus-stack@85.3.3
bases: default, no-crds
component: monitoring platform
```

It is useful because it exercises many Helm pain points at once: CRDs,
webhooks, hook-driven admission certificate patching, cluster RBAC, generated
facts, subchart dependencies, large object fanout, image policy, scan warnings,
and target prerequisites.

## What This Proves

The `default` base is the strongest current proof path:

```text
render parity: pass
two-cluster kind parity: pass
strict Helm-vs-ConfigHub live parity: pass
ConfigHub OCI/Argo evidence: pass for the declared support scope
production support decision: supported for cub-lk vanilla kind, namespace=monitoring
```

That means regular Helm and the `cub installer` path produce equivalent
desired objects for the recorded inputs, and the selected ConfigHub delivery
path reached the recorded live state for the declared target scope.

The `no-crds` base is deliberately different:

```text
render parity: pass
two-cluster kind parity: pass
GitOps/OCI runtime wave: blocked when target CRDs are missing
```

That block is good evidence. It shows that removing CRDs from the rendered
object set creates a target prerequisite. The model does not hide that
prerequisite or pretend the install is complete.

## Why This Matters

Small charts can make the catalog look easy. kube-prometheus-stack tests the
parts of Helm that usually create day-1 and day-2 pain:

| Helm behavior | How the repo handles it |
| --- | --- |
| CRDs on or off | Separate base variants: `default` owns CRDs, `no-crds` requires target CRDs. |
| Hook-driven admission setup | Lifecycle route and receipt for the admission webhook jobs. |
| Webhook and controller readiness | Target-scoped lifecycle and production-support decisions. |
| Large object fanout | Value-source and blast-radius evidence for high-impact choices. |
| Scan warnings | Security decision or hardened-base work, not a silent pass. |
| Images | Digest-resolution evidence and image-policy decision for the support scope. |
| Production support | Per target scope, not implied by render success. |

## How To Inspect It

Start with the generated catalog page:

[kube-prometheus-stack catalog](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md)

Then open the user-facing proof explanation:

[Prometheus High-Fanout Example](./prometheus-high-fanout.md)

For the current supported target scope, open:

[kube-prometheus-stack production support workdown](../../data/production-support-decisions/prometheus-community-kube-prometheus-stack/README.md)

For reviewer-level detail, open:

[kube-prometheus-stack serious chart review](../reference/kube-prometheus-stack-serious-chart-review.md)

## Commands

Check the committed proof and package:

```sh
npm run kube-prometheus-stack:verify-proof
npm run kube-prometheus-stack:verify-package
npm run kube-prometheus-stack:compare
```

Check the generated high-fanout example:

```sh
npm run high-fanout:verify
```

Check the current production-support artifacts:

```sh
npm run kps:image-digests:verify
npm run kps:image-policy-decision:verify
npm run kps:fresh-target-evidence:verify
npm run kps:lifecycle-decision:verify
npm run kps:security-decision:verify
```

Check the live parity receipts that already exist in the repo:

```sh
npm run live-parity:verify
npm run kind-parity:verify
```

These commands verify committed evidence. They do not run a fresh cluster test.
Use the live lane docs when you need fresh cluster evidence for a new target.

## What Not To Claim

Do not claim that every kube-prometheus-stack topology is supported. The
current support decision is for one base and one target scope.

Do not claim that upgrades are solved. The repo has a render-level CRD upgrade
delta for the latest candidate, but no live upgrade receipt for that upgrade.

Do not claim that all hook patterns are solved. This chart's hook route is
observed for the selected profile. Other hook-bearing charts need their own
route and receipt.

Do not claim that `no-crds` is a simpler install. It is a different contract:
the target must already provide compatible CRDs and required admission
prerequisites.

## The Short Version

kube-prometheus-stack is the main proof that this is more than a Redis demo.
It shows how a complex Helm chart can become named base variants with visible
prerequisites, render parity, live parity, production decisions, and honest
limits.
