# Reading The Catalog Matrix

**UNOFFICIAL/EXPERIMENTAL.**

The master catalog matrix
([data/master-catalog-matrix/matrix.html](../../data/master-catalog-matrix/matrix.html))
has one row per chart / version / catalog layer. Each row answers two
questions: **what is this path, and how much is proven?** This page explains
the F1-F4 layers, the `G` / `P` / `K` shorthands, and the cell states. When a
row is not green, it shows where to look to understand why.

## The layers

The `Layer` column shows where the row sits in the Helm-to-ConfigHub flow.

| Layer | What it means |
| --- | --- |
| `F1` | Upstream Helm chart source. Pick or create a base before installing it. |
| `F2a` | Honest default base. This is the simplest rendered installer base when the chart default is useful. |
| `F2b` | Rendered standard fork. Helm values change the object set, so it belongs in the recipe/package path. |
| `F2c` | Candidate useful or parameterized base. The matrix shows the planned path, but it is not proof-backed yet. |
| `F3` | Target prerequisite or fill candidate: Secret, CRD, namespace, cloud value, target fact, or similar input needed before delivery. |
| `F4a` | Derived ConfigHub clone. Post-render changes such as target, region, labels, links, approvals, or observation policy. |
| `F4b` | Target-bound derived variant. A downstream ConfigHub variant with a committed target run receipt. |

The `Kind` column matters:

| Kind | Meaning |
| --- | --- |
| `source` | The upstream chart/version source row. This is not an install row. |
| `base` | An installer base variant. This is the render-time install shape: values, rendered objects, package base, and recipe evidence. |
| `candidate` | A planned F2/F3 path from committed work-order data. This is useful product guidance, not a proof claim. |
| `candidate discussion` | A non-default or target-specific candidate that needs discussion with the ConfigHub team before it becomes runnable. |
| `derived from <base>` | A ConfigHub-derived variant cloned from a base. This is post-render customization for a target, customer, environment, or region. It should not imply a Helm rerender. |

Candidate rows are intentionally colored separately in the HTML view. They show
where the catalog could go next: more useful bases, target prerequisite fills,
and custom paths. They do not claim render parity, live parity, or target-run
evidence until a real base or derived variant is committed.

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
| `yes` | **pass** — this lane is proven for this row. |
| `watch` | **known evidence with a named residue** — the semantic comparison passed (the delivered objects match regular Helm), but a runtime, controller-health, or operational condition still needs review. **Not a pass, and not a failure.** |
| `todo` | **not yet run** — queued in the live burn-down. Backlog, not a failure. |
| `no` | **blocked or not reached** — a prerequisite, model gap, failed live condition, or unsupported route stopped this lane from passing. The decision surfaces below say which. |
| `n/a` | **not applicable** — this lane does not apply to this row. |
| (blank) | not recorded for this row. |

The key distinction: `todo`, `n/a`, and blank are **not failures**. They mean
"not done yet", "not applicable", or "not recorded". `no` means there is a
specific blocked/not-reached reason to inspect. And a `watch` is never silently
rounded up to a `pass`.

## The action column

The `Action` column is separate from the proof-lane cells. It says what kind of
work remains, using the coverage completion plan:

| Action | What to do |
| --- | --- |
| `run` | Run the named live, kind, promotion, or lifecycle lane. |
| `stage` | Stage a target prerequisite such as a Secret, CRD, namespace, or external service. |
| `model` | Change the recipe, base variant, semantic normalization, or target-fact model. |
| `image` | Refresh or mirror an image before rerunning the lane. |
| `upstream` | Wait for or complete an upstream implementation fix, such as a ConfigHub server change. |
| `scope` | Decide the target run scope before rerunning. |
| `deferred` | No current run/fix work. The non-green cell already has an accepted `watch` or `n/a` disposition and should not consume live-run time until the product scope changes. |

This is the matrix version of "do nothing for now": visible, recorded, and
reversible when the scope changes, but not part of the active burn-down.

## Where to look when a row is not green

| Your question | Go to |
| --- | --- |
| Can I use this chart/base or derived variant? | the matrix row and its chart page |
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
