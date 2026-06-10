# Why This Does Not Collapse

**UNOFFICIAL/EXPERIMENTAL**

The main risk in this project is simple: Helm charts are full of quirks, and a
catalog could turn into a pile of special cases. The way to avoid that is to
make every claim narrow and every exception visible.

helm-expt does not claim that every public chart is production-safe because it
rendered once. It claims that a specific chart version, base variant, flag
profile, and Kubernetes profile have passed named checks, or that the remaining
gap is routed.

## Hooks And Quirks

Helm quirks are handled as catalog facts, not as hidden runtime behavior.

The tracked axes include:

```text
lookup and target facts
generated facts
hooks by lifecycle phase
CRDs and webhook lifecycle
capability profiles
install versus upgrade behavior
getHostByName
import-values
dependency aliases
library charts
extension slots and raw manifests
```

The current quirk audit is:

[data/quirk-coverage/summary.md](../../data/quirk-coverage/summary.md)

Hooks are not treated as ordinary rendered objects. Render parity covers the
desired non-hook object set. A hook only becomes supported when it has a
lifecycle route and receipt. Some hooks can map to preflight checks, Argo sync
hooks, sync waves, managed actions, or post-install observations. Some hooks
should remain blocked until reviewed.

Hook policy:

[Hook Lifecycle Strategy](./hook-lifecycle-strategy.md)

## Failure Is Routed

The useful property is not that the harness never finds problems. It is that
the problems become explicit.

Examples already found:

| Finding | What happened | Route |
| --- | --- | --- |
| Missing Secret | Rendered objects applied and GitOps could report sync, but the pod could not start. | Target fact and prerequisite check. |
| CRD `selectableFields` | Rendered CRDs included a field that Kubernetes 1.30 did not preserve after apply. | Capability-profile and CRD lifecycle review. |
| Grafana empty RBAC rules | Rendered RBAC authored empty `rules: []`; the live API did not preserve the same shape. | Server-normalization review or target-profile watch item. |

The current watchlist is:

[data/live-e2e/cub-scout-watchlist.md](../../data/live-e2e/cub-scout-watchlist.md)

A strict witness block is not hidden. It must appear in the watchlist or in the
normalization log:

[data/live-e2e/normalization-rules.md](../../data/live-e2e/normalization-rules.md)

## Config Volume

The model creates more explicit data than raw Helm. That is intentional. The
Helm status quo already has the complexity; it is just buried in values files,
template branches, release state, and cluster behavior.

The catalog stays usable by keeping the layers distinct:

| Layer | Purpose |
| --- | --- |
| Base variant | A reviewed render-time shape, such as Redis with generated credentials or Redis using an existing Secret. |
| Derived ConfigHub variant | A post-render refinement, such as target, labels, namespace, approvals, and controlled mutations. |
| Receipt | Evidence for one boundary: render, scan, upload, live witness, or operation. |
| Watchlist row | A known limitation that must not be mistaken for a pass. |

Small numbers of reviewed base variants should cover the important install
shapes. Derived ConfigHub variants handle environment, region, customer, target,
approval, observation, and policy differences after render.

The top-100 coverage contract makes the remaining work visible:

[data/top100-coverage/summary.md](../../data/top100-coverage/summary.md)

## The Trust Rule

The catalog should be trusted only when it can answer these questions:

```text
Which chart version and base variant is this?
Which Helm flags and Kubernetes profile were used?
What exact objects were rendered?
What changed compared with regular Helm?
What was scanned or gated?
What reached live Kubernetes?
What is not claimed yet?
```

If one of those answers is missing, the row is partial, not covered.

