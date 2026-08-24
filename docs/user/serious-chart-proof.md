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
production support decision: supported for the recorded vanilla kind target, namespace=monitoring
```

That means regular Helm and the `cub installer` path produce equivalent
desired objects for the recorded inputs, and the selected ConfigHub delivery
path reached the recorded live state for the declared target scope.
The receipt stores that historical target class as `cub-lk-kind-vanilla`.
Current local delivery examples create the equivalent kind and Argo CD setup
with `cub cluster up`.

The `no-crds` base is deliberately different:

```text
render parity: pass
two-cluster kind parity: pass
target facts staged in live proof: 10 CRDs + monitoring/kube-prometheus-stack-admission Secret
runtime outcome: regular Helm and cub installer workloads both become Ready
ConfigHub OCI/Argo runtime path: pass when the same prerequisites are staged
staged no-crds OCI: pass through Argo CD and Flux on separate fresh clusters
staged upgrade: 85.3.3 to 86.1.0 pass through Argo CD and Flux
```

The earlier blocked runtime evidence was useful because it showed that
removing CRDs from the rendered object set creates a target prerequisite. The
model did not hide that prerequisite or pretend the install was complete. Fresh
live runs on 2026-06-11 then proved the positive path: stage the compatible
CRDs and the admission Secret, and both the two-cluster kind lane and the
ConfigHub OCI/Argo lane converge with semantic parity.

A separate fresh-install proof starts from the anonymous public installer
package, selects `no-crds`, and writes a non-secret OCI output with
`cub installer setup --output-oci`. A chart-specific packaging step adds four
explicit paths for CRDs, certificate preparation, ordinary workloads, and
webhook patching. Argo CD and Flux each pulled the same staged OCI digest on a
separate new cluster. Both passed those four stages and the checks for ten
established CRDs, three matching webhook CA bundles, a ready operator endpoint,
a server-side dry run, and six ready workloads. Each controller then moved to
the 86.1.0 staged digest, reran the four stages, replaced both completed setup
Jobs, and passed the runtime checks again.

[Read the Argo CD and Flux result](../../data/kps-gitops-lifecycle-proof/summary.md)
or [open its receipt](../../runs/kps-gitops-lifecycle-proof/receipt.yaml).

A second proof retains the 85.3.3 object set as a ConfigHub base, creates the
86.1.0 staging variant, records and approves the destination route, publishes
both exact release OCI digests, and reconciles both through Argo CD. It catches
two destination-specific requirements before release: five Services must stay
in `kube-system`, and the large CRDs require server-side apply.

[Read the ConfigHub promotion result](../../data/kps-confighub-lifecycle-promotion/summary.md)
or [open its receipt](../../runs/kps-confighub-lifecycle-promotion/receipt.yaml).

The current lifecycle evidence also shows the productive path forward: when
compatible CRDs and the admission webhook certificate Secret are staged
explicitly, the config-only path can converge in the tested local targets. That
does not make certificate rotation, route selection, or CRD upgrade policy
automatic. It proves the target contract can be made visible, staged, observed,
and bounded.

That is the important part of the proof. YAML/render parity is the baseline.
kube-prometheus-stack is useful because it forces the hidden install contract
into the open: which CRDs are owned by the package, which CRDs are target facts,
which admission certificate material is generated or staged, which evidence is
live, and which claims remain per-target.

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

For the staged CRD and admission certificate evidence, open:

[Webhook Certificate Lifecycle Evidence](../../data/webhook-cert-lifecycle/summary.md)

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

Check the live CRD upgrade rehearsal:

```sh
npm run kps:crd-upgrade-live:verify
```

Check the full regular-Helm workload upgrade rehearsal:

```sh
npm run kps:workload-upgrade-live:verify
```

Check the staged CRD and webhook certificate evidence:

```sh
npm run webhook-cert:lifecycle:verify
```

Check the current production-support artifacts:

```sh
npm run kps:image-digests:verify
npm run kps:image-policy-decision:verify
npm run kps:fresh-target-evidence:verify
npm run kps:lifecycle-decision:verify
npm run kps:security-decision:verify
```

Check the direct and controller lifecycle receipts:

```sh
npm run kps:lifecycle-route:verify
npm run kps:gitops-lifecycle:verify
npm run kps:confighub-lifecycle-promotion:verify
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
delta, a live API-server CRD upgrade rehearsal, a live regular-Helm workload
upgrade rehearsal, and a staged OCI upgrade receipt through Argo CD and Flux
for `85.3.3 -> 86.1.0`. ConfigHub does not yet select that route automatically.
The repo still does not have a rollback receipt, soak receipt, private-overlay
upgrade receipt, or production-target upgrade receipt.

Do not claim that all hook patterns are solved. This chart's hook route is
observed for the selected profiles. The controller proof covers a fresh install
and one upgrade of `no-crds`, including removal and replacement of the completed
setup Jobs. It does not prove automatic post-success cleanup of every temporary
hook resource. Other hook-bearing charts need their own route and receipt.

Do not claim that `no-crds` is a simpler install. It is a different contract:
the target must already provide compatible CRDs and required admission
prerequisites. The repo now has a fresh live proof of that contract on kind;
it still needs a target-scoped production decision, freshness policy, and
production target review before it becomes a supported production path.

## The Short Version

kube-prometheus-stack is the main proof that this is more than a Redis demo.
It shows how a complex Helm chart can become named base variants with visible
prerequisites, render parity, staged lifecycle evidence, live parity,
production decisions, and honest limits.
