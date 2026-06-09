# Chain Of Proof

**UNOFFICIAL/EXPERIMENTAL**

The project does not ask users to trust one large black-box install step. It
breaks a Helm install into proof boundaries and records what each boundary can
truthfully prove.

The same rule applies to simple charts, serious charts, AI-assisted edits,
fleet operations, and production support decisions:

```text
claim only to the strongest unbroken proof boundary
```

## Proof Boundaries

| Boundary | Tool or home | What it proves | Time behavior | What it does not prove |
| --- | --- | --- | --- | --- |
| Chart inputs to rendered Kubernetes objects | `helm-expt` recipe artifacts and `cub installer` packages | The chart source, values, capability profile, generated facts, and base variant render to a known object set. | Recomputable from locked inputs. | Live cluster health, GitOps sync, hook execution, or controller mutations. |
| Rendered objects to ConfigHub-managed desired state | `cub installer upload`, ConfigHub Units, labels, scans, gates, receipts | The reviewed object set is present in ConfigHub with searchable metadata, revisions, checks, and operation history. | Historical and reviewable. | That a cluster has applied the desired state. |
| Base variant to derived ConfigHub variant | `cub variant create`, links, placeholders, TransformPaths, functions, gates, approvals | An already-rendered object set was cloned or refined through explicit ConfigHub operations. | Historical and reviewable. | Any change that requires a new Helm render. |
| Desired state to delivery handoff | ConfigHub OCI, GitOps, apply receipts, controller receipts | The approved desired object set was handed to the delivery mechanism. | Historical, with controller-specific evidence. | Workload convergence unless observed. |
| Delivery to live state | cub-scout, controller status, CI checks, operator checks, observation receipts | The target cluster was observed at a time, by a named method, with a freshness boundary. | Perishable; check `observedAt` and `expiresAt`. | Future health after the receipt expires. |

## How To Use It

Start with the narrow question you need to answer.

| Question | Start with |
| --- | --- |
| What will this chart/base render? | Per-chart `CATALOG.md`, rendered objects, render parity receipts. |
| Did the `cub installer` path match regular Helm? | The chart's compare proof and Helm-equivalence receipt. |
| Can I manage this as ConfigHub Units? | ConfigHub upload, Unit labels, scans, gates, safe-operation receipts. |
| Can I make an environment, region, customer, or target variant? | Derived ConfigHub variant docs and `cub variant create` receipts. |
| Did GitOps or apply hand the object set to Kubernetes? | OCI/GitOps or apply receipts. |
| Did the workload actually converge? | Live observation receipts and freshness. |

This prevents overclaiming. Render parity is valuable, but it is not a live
cluster proof. A live observation is valuable, but it does not replace the
render-parity proof that says where the desired objects came from.

## Why This Matters For AI And Day-2 Ops

AI makes it easier to generate values, overlays, patches, functions, and
variant plans. That is useful only if every generated change has a small proof
target.

The chain of proof gives those targets:

```text
new render input
-> render parity and scan proof

new ConfigHub-only variant
-> clone, diff, check, approval, and receipt

new delivery target
-> target facts, handoff receipt, and live observation

new patch or bulk operation
-> selected Units, preview diff, changeset, approval, re-scan, and receipt
```

This is how the project turns AI-assisted configuration work from "it produced
YAML" into "it produced a bounded change with evidence."

## Where kube-prometheus-stack Fits

Redis is the teaching chart because the happy path is short. NGINX is the
simple web/live path. `prometheus-community/kube-prometheus-stack` is the
serious chart because it exercises many of the hard Helm behaviors in one
place:

```text
large object fanout
CRDs
webhooks
cluster RBAC
generated facts
dependencies
extension slots
target prerequisites
lifecycle and observation boundaries
```

The kube-prometheus-stack page shows how one base choice changes the object
set and prerequisites:

- [`kube-prometheus-stack` high-fanout example](./prometheus-high-fanout.md)

Use that chart when you want to know whether the model survives a complex,
popular Helm chart, not just a small happy path.

## Read Next

| Need | Read |
| --- | --- |
| Current proof counts and authoritative summaries | [Current Proof Status](./current-proof-status.md) |
| What each verification lane means | [Verification Lanes](./verification-lanes.md) |
| The seven-stage lifecycle and quirk routing | [Seven-Stage Helm Lifecycle](../reference/seven-stage-helm-lifecycle.md) |
| The serious-chart example | [Prometheus High-Fanout Example](./prometheus-high-fanout.md) |
