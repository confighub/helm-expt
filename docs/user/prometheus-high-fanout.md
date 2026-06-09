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
| [high-fanout summary](../../data/high-fanout-demo/summary.md) | Object counts, removed CRDs, proof-chain status, and the current GitOps/OCI prerequisite result. |
| [prometheus-kps.csv](../../data/high-fanout-demo/prometheus-kps.csv) | Spreadsheet rows for the two bases, proof lanes, next hard work, and the base-to-base delta. |

## What The Current Evidence Says

`default` has render parity and local live evidence. `no-crds` has render parity
and a GitOps/OCI receipt that blocked because the target cluster did not have the
required CRDs.

That is useful evidence. It means the model caught the prerequisite before
pretending the workload was healthy.

Today this page proves the routing model and the high-fanout base difference. It
does not claim that every kube-prometheus-stack lifecycle concern is production
supported. The remaining hard work is to record target-scoped support decisions
for CRD ownership, CRD upgrades, webhook readiness, generated material, GitOps
handoff, and any lifecycle actions that should become operator-reviewed
procedures.

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
| Final live evidence | Refresh target-scoped live parity, GitOps/OCI, and observation receipts. | Rerun GitOps/OCI after prerequisites are staged. |

Use `default` when the catalog package should own the CRDs. Use `no-crds` only
when CRDs have their own owner, version, and fresh observation.

## Current Production Proof Plan

The current target-scoped support decision is still a draft:

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
| Production support | draft |

To make `default` production-supported for one target scope, the remaining work
is:

1. Choose the exact target scope: controller, namespace, cluster class, and OCI
   artifact digest.
2. Resolve image digests or record an explicit mutable-image exception.
3. Record security acceptance for the monitoring stack scope, or create a
   narrower hardened base.
4. Execute or observe the selected hook/lifecycle route for admission webhook
   TLS, readiness, cleanup, ordering, and upgrade behavior.
5. Refresh ConfigHub OCI/GitOps and live/e2e evidence after the previous
   decisions are closed.

The `no-crds` base is a separate support decision. Its GitOps receipt is
currently useful because it blocked on missing CRDs; production support for
that base must first stage or prove compatible Prometheus Operator CRDs and the
admission Secret in the target.

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
