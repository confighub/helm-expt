# Prometheus High-Fanout Example

**UNOFFICIAL/EXPERIMENTAL**

`prometheus-community/kube-prometheus-stack` is a useful main-chart example
because one Helm values choice changes a large operational surface.

Redis teaches the shortest happy path. NGINX is the simple web/live path.
`kube-prometheus-stack` is the serious-chart proof path: it is popular, large,
and full of the Helm behaviors that make production installs hard to reason
about.

The catalog has two base variants:

| Base | Use it when | What changes |
| --- | --- | --- |
| `default` | This release should install the Prometheus Operator CRDs. | Renders 124 Helm objects, including 10 CRDs. |
| `no-crds` | The cluster already manages those CRDs elsewhere. | Renders 114 Helm objects and omits the 10 CRDs. |

The important point is that `no-crds` still renders Prometheus custom resources.
It only works when the target cluster already has the Prometheus Operator CRDs.
That prerequisite is part of the deployable contract.

## Why This Is The Serious Chart

| Feature | Why it matters |
| --- | --- |
| Large object fanout | A small base choice affects more than 100 Kubernetes objects, so object-level review matters. |
| CRDs | The `default` base installs CRDs; the `no-crds` base requires the target cluster to provide them. |
| Custom resources | `no-crds` still renders Prometheus custom resources, so prerequisites must be checked before delivery. |
| Webhooks and controllers | Readiness and controller-populated state require live observation, not just render proof. |
| Cluster RBAC | Cluster-wide objects increase blast radius and need explicit scan/gate evidence. |
| Dependencies | Dependency locks matter because the umbrella chart contains many moving parts. |
| Generated facts and secrets | Generated material must be bound, externalized, or checked before the rendered object set is approved. |
| Extension slots | Raw snippets, rules, dashboards, or extra manifests can change the support boundary. |
| Lifecycle behavior | CRD upgrades, webhook readiness, and controller behavior need lifecycle routes and receipts. |

The chart is valuable because it forces the model to separate the proof chain:

```text
render parity
-> scan and gate
-> target prerequisites
-> delivery handoff
-> live observation
-> production support decision
```

It also shows the graph bridge. The chart now has a small value-source map for
the two inputs users are most likely to ask about first:

| Input | Output evidence |
| --- | --- |
| `grafana.adminPassword` | The Grafana admin Secret and the Deployment references that consume it. |
| `crds.enabled` | The 10 Prometheus Operator CRDs present in `default` and omitted from `no-crds`. |

This is not a full inverse map for the whole chart. It is enough to show the
model: important Helm choices should remain traceable after render.

## User Flow

Choose the base:

```text
kube-prometheus-stack/default
  install CRDs with the stack

kube-prometheus-stack/no-crds
  require CRDs to exist before delivery
```

Render one base:

```sh
cub installer setup \
  --pull packages/prometheus-community/kube-prometheus-stack/85.3.3 \
  --base no-crds \
  --work-dir .tmp/demo/kps-no-crds \
  --non-interactive \
  --namespace monitoring
```

Check the catalog and generated demo:

```sh
npm run high-fanout:verify
```

Read:

| File | Shows |
| --- | --- |
| [KPS catalog](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md) | The two bases, receipts, gates, and package links. |
| [value source map](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/value-source-map.yaml) | Which checked inputs currently map to rendered fields. |
| [high-fanout summary](../../data/high-fanout-demo/summary.md) | Object counts, removed CRDs, proof-chain status, the blocked prerequisite receipt, and the passing staged-prerequisite GitOps/OCI receipt. |
| [operation preview](../../data/high-fanout-demo/operation-preview.md) | Pre-ship routing, blast-radius, guardrail, and next-proof view for mapped high-fanout inputs. |
| [prometheus-kps.csv](../../data/high-fanout-demo/prometheus-kps.csv) | Spreadsheet rows for the two bases, proof lanes, next hard work, and the base-to-base delta. |

## What The Current Evidence Says

`default` has render parity, local live evidence, and strict ConfigHub
OCI/Argo evidence. `no-crds` has render parity, two-cluster parity, and strict
ConfigHub OCI/Argo evidence when the target CRDs and admission Secret are
staged.

The older blocked GitOps/OCI receipt is still useful. It shows the same base
blocks when the target cluster does not have the required CRDs. Together, the
blocked and passing receipts prove the real contract: `no-crds` is valid only
when those prerequisites are supplied and observed.

Today this page proves the routing model and the high-fanout base difference.
The `default` base also has a target-scoped support decision for the recorded
vanilla kind, `monitoring` namespace, ConfigHub OCI, and Argo path. That is a
narrow supported scope, not a claim that every kube-prometheus-stack topology,
cluster, or values overlay is production-supported.

## Production Support Checklist

The generated [high-fanout summary](../../data/high-fanout-demo/summary.md)
has the current checklist. In short, production support for this chart is a
target-scoped decision, not a blanket chart label.

| Decision | `default` | `no-crds` |
| --- | --- | --- |
| CRD ownership | The package owns the Prometheus Operator CRDs. | The target cluster owns compatible CRDs before apply. |
| Admission Secret | Stage or manage the webhook admission Secret before config-only delivery. | Stage the admission Secret and the external CRDs. |
| Webhook freshness | Observe webhook, operator, and caBundle readiness after apply. | Observe the same checks after CRDs are established. |
| RBAC and scrape scope | Approve the rendered cluster RBAC and monitoring blast radius. | Same RBAC family; external CRDs do not narrow scrape scope. |
| Scan and image posture | Accept findings for this infrastructure scope or create a hardened base. | Same, plus prerequisite evidence for external CRDs. |
| Final live evidence | Refresh target-scoped live parity, GitOps/OCI, and observation receipts. | Use the passing staged-prerequisite GitOps/OCI receipt as proof input, then record a target-scoped support decision for the chosen target. |

Use `default` when the catalog package should own the CRDs. Use `no-crds` only
when CRDs have their own owner, version, and fresh observation.

## Current Production Proof Plan

The current target-scoped support decision covers the `default` base:

[kube-prometheus-stack support decision](../../data/production-support-decisions/prometheus-community-kube-prometheus-stack/support-decision.yaml)

The generated human workdown is easier to use when assigning the remaining
work:

[kube-prometheus-stack production support workdown](../../data/production-support-decisions/prometheus-community-kube-prometheus-stack/README.md)

The `default` base already has useful proof:

| Boundary | Current status |
| --- | --- |
| Render parity | pass |
| ConfigHub proof | pass |
| Two-cluster kind parity | pass |
| Strict ConfigHub OCI/Argo live path | pass |
| Production support | supported for the declared target scope |

To widen or refresh the `default` support scope, the remaining work is:

1. Choose the exact target scope: controller, namespace, cluster class, and OCI
   artifact digest.
2. Reuse the current mutable-image exception and security acceptance only if
   the new scope has the same posture; otherwise create a hardened or
   digest-pinned base.
3. Keep the selected hook/lifecycle route and live evidence fresh for the new
   scope.
4. Record a replacement support decision before calling the wider scope
   supported.

The `no-crds` base is a separate support decision. It now has both sides of the
prerequisite story: one receipt blocks when required CRDs are absent, and one
strict ConfigHub OCI/Argo receipt passes when compatible Prometheus Operator
CRDs and the admission Secret are staged. The target-scoped support evidence is
recorded in
[fresh-target-evidence-no-crds-2026-06-11.yaml](../../data/production-support-decisions/prometheus-community-kube-prometheus-stack/fresh-target-evidence-no-crds-2026-06-11.yaml).
Production support for that base still needs a target-scoped decision for the
chosen target.

## Why This Matters

For high-fanout charts, a small Helm input can alter many Kubernetes objects and
cluster prerequisites. ConfigHub should make that explicit:

```text
base choice
-> rendered object set
-> prerequisites
-> scans and gates
-> delivery receipts
-> live observations
```

This is the same reason variants are more valuable than raw rendering. The user
is not just asking "can Helm template this chart?" They are asking which
deployable contract is safe for this target.
