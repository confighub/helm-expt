# Reading The Catalog Matrix

**UNOFFICIAL/EXPERIMENTAL.**

The master catalog matrix
([data/master-catalog-matrix/matrix.html](../../data/master-catalog-matrix/matrix.html))
has one row per chart / version / base variant. Each row answers two questions:
**can I use this chart/base, and how much is proven?** This page explains the
lane columns, the `G` / `P` / `K` shorthands, and the cell states — and, when a
row is not green, exactly where to look to understand why.

## The proof lanes

Render parity is the baseline; the live lanes prove progressively more. Three
carry a one-letter shorthand in the live burn-down:

| Lane | Proves | Shorthand |
| --- | --- | --- |
| Render parity | `cub installer` renders the same Kubernetes objects as regular Helm | |
| ConfigHub proof | the rendered objects upload as ConfigHub Units with scan / safe-operation receipts | |
| Local live | the objects applied to a cluster and the workload was observed | |
| Lifecycle observed | a hook or hook-like lifecycle route has a live receipt | |
| GitOps/OCI live | ConfigHub OCI was reconciled by Argo/Flux and observed | **G** |
| Live Helm-vs-ConfigHub parity | regular Helm and the ConfigHub delivery reach the same live outcome | **P** |
| Two-cluster kind parity | regular Helm in one vanilla kind cluster vs `cub installer` in another | **K** |

Full lane definitions: [verification-lanes.md](./verification-lanes.md).

## The cell states

| In the matrix | What it means |
| --- | --- |
| `yes` | **pass** — this lane is proven for this base. |
| `watch` | **known evidence with a named residue** — the semantic comparison passed (the delivered objects match regular Helm), but a runtime, controller-health, or operational condition still needs review. **Not a pass, and not a failure.** |
| `todo` | **not yet run** — queued in the live burn-down. Backlog, not a failure. |
| `no` | **blocked or not reached** — a prerequisite, model gap, failed live condition, or unsupported route stopped this lane from passing. The decision surfaces below say which. |
| `n/a` | **not applicable** — this lane does not apply to this base. |
| (blank) | not recorded for this row. |

The key distinction: `todo`, `n/a`, and blank are **not failures**. They mean
"not done yet", "not applicable", or "not recorded". `no` means there is a
specific blocked/not-reached reason to inspect. And a `watch` is never silently
rounded up to a `pass`.

## Where to look when a row is not green

| Your question | Go to |
| --- | --- |
| Can I use this chart/base? | the matrix row and its chart page |
| What still needs live proof? | [live-matrix-burndown](../../data/live-matrix-burndown/summary.md) |
| Why is this **K** (two-cluster kind) row watch/blocked — who fixes it, can I use it today? | [kind-parity-decisions](../../data/kind-parity-decisions/summary.md) |
| Why is this **G/P** (GitOps/OCI + live Helm-vs-ConfigHub) row watch/blocked — who fixes it, can I use it today? | [live-parity-decisions](../../data/live-parity-decisions/summary.md) |
| What does the residue category mean — `remote-image` vs `render-input` vs `capability-profile` vs hook/lifecycle, …? | [residue-families](../reference/residue-families.md) |
| What does this chart's hook / lifecycle action need? | [lifecycle-route-actions](../../data/lifecycle-route-actions/summary.md) |
| How do I rerun it — exact command, receipt, support artifact? | the row's support artifact and receipt path, plus [live-parity.md](./live-parity.md) |

The two decision surfaces turn every non-pass G/P/K row into a plain answer:
what the residue is, **who fixes it** (you, with a target prerequisite — or the
catalog, with model work), and whether you can use the chart **today**. The
residue category names — `remote-image`, `render-input`, `capability-profile`,
`target-prerequisite`, hook/lifecycle, and the rest — are defined in
[residue-families](../reference/residue-families.md).

## The honest line

Render parity proves the YAML; the live lanes prove the running outcome. A
`watch` row means the configuration is correct (semantic parity passed) and a
named operational residue remains — recorded honestly, not rounded up to `pass`
or down to `fail`. A green matrix is the goal; an honest matrix is the
guarantee.
