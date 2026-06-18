# Master Catalog Matrix Doctrine

The master catalog matrix is the first place to look when the question is:

```text
What is the current state of this chart, version, base variant, or downstream
ConfigHub-derived variant?
```

It is not a replacement for the underlying receipts, lane summaries, chart
catalog pages, or target-run receipts. It is the joined product view over those
sources.

## Three Renderings

The generated master matrix has three surfaces:

| Surface | Purpose |
| --- | --- |
| [matrix.html](../../data/master-catalog-matrix/matrix.html) | Human and product review. This is the browser view with visible color, user route, strongest evidence, core-lane status, target run scope, hard gap, hooks, quirks, and next action. |
| [matrix.csv](../../data/master-catalog-matrix/matrix.csv) | Machine and spreadsheet import. This carries the full row data as text, without relying on color. |
| [summary.md](../../data/master-catalog-matrix/summary.md) | Compact GitHub orientation. This includes the current product queues, then a narrower table for pull requests and code review. |

The HTML view is the primary human decision surface. The CSV is the primary
machine surface. The Markdown summary is a compact index.

The product queues in the HTML and Markdown summary are derived from the same
rows. They are not a second roadmap. They group the current matrix into the
actions a reviewer or product owner can take next: try public catalog rows,
promote proof-grade rows, design better bases, decide limitations, complete
core lanes, decide target run scope, or investigate named hard gaps.

## What Belongs In The Matrix

The matrix should carry the fields that help a user or reviewer decide the
next action:

| Field | Meaning |
| --- | --- |
| `Layer` | Where the row sits in the Helm-to-ConfigHub flow: upstream source, rendered base, candidate target fill, or downstream ConfigHub variant. |
| `Kind` | Whether the row is a source row, a real installer base variant, a candidate path, or a downstream ConfigHub-derived variant cloned from a base. |
| `Use` | The current route: try the public catalog, review for promotion, design a better base, or decide a limitation first. |
| `Evidence` | The strongest current proof for the row, such as render parity, ConfigHub proof, local live, kind parity, or live parity. |
| `Links` | Jump points to the upstream source repository, chart catalog, variant YAML, package base, variant revision, and GitHub folder. |
| `Core` | Whether the main proof lanes are complete for that row. |
| `R/C/L/G/P/K` | The individual proof lanes: render parity, ConfigHub upload/scan/ops, local live, GitOps/OCI live, live dual parity, and two-cluster kind parity. |
| `Target` and `Scope` | Whether the row has a target run decision or target-bound receipt, and what target shape it covers. |
| `Hooks`, `Quirks`, and `Gap` | The visible reasons the row is easy, risky, incomplete, or needs a product decision. |
| `Active proof` | The current non-pass live parity action when the row is in the rerun plan, including readiness, reason, support artifact, and command in the tooltip. |
| `Action` | The current completion-plan overlay for non-green cells: run, stage, model, image, upstream, scope, or deferred. `Deferred` means the row has an accepted `watch` or `n/a` disposition and should not consume live-run time until scope changes. |
| `Next action` | The shortest useful work item for the row. |

The matrix should not hide weakness. A `fail` lane is red. A missing receipt is
grey `todo`. A lane that does not apply should be neutral `n/a`, not blank.
`Deferred` is not a proof-lane state. It is an action overlay from the coverage
completion plan for cells whose current non-green status is already an accepted
product disposition.

Every base row must correspond to real catalog artifacts. The generator checks
that the recipe source lock, per-chart catalog, variant YAML, package base, and
variant revision exist. Derived rows must correspond to committed ConfigHub
variant execution or target-bound receipts, and they inherit their render shape
from a real base. The source lock supplies the upstream chart repository and
content URL.

## Layer Vocabulary

The `Layer` column is the map of how a public Helm chart becomes something a
user can operate.

| Layer | Meaning |
| --- | --- |
| `F1` | The upstream Helm chart/version source. This row is a source lock, not an installable ConfigHub package. |
| `F2a` | The honest default rendered base. This is the first base to try when the chart's default shape is useful. |
| `F2b` | A rendered standard fork. This is still produced by the installer path because Helm values change the rendered object set. |
| `F2c` | A candidate useful or parameterized base. This row shows a planned render-time base before the recipe/package/evidence exists. |
| `F3` | A target prerequisite or fill candidate, such as a Secret, CRD, namespace, cloud value, or target fact needed before delivery. |
| `F4a` | A downstream ConfigHub-derived clone that changes labels, target, region, environment, approval policy, links, or other post-render data without rerendering Helm. |
| `F4b` | A target-bound downstream variant with a committed target run receipt. |

Candidate rows are deliberately separate from proof rows. They let the matrix
show non-default paths and custom-discussion routes without pretending those
paths have already been rendered, uploaded, or run. A `custom-discussion`
candidate means the path is plausible but needs human agreement on inputs,
ownership, risk, or target shape before it becomes a runnable base or derived
variant.

## What Stays In Drill-Down Sources

The matrix is intentionally one row per chart/version/layer. Details that need
their own granularity stay in their source files:

| Detail | Source |
| --- | --- |
| Exact receipt paths and commands | [outcome-coverage](../../data/outcome-coverage/summary.md) |
| Hook route details | [hook-disposition](../../data/hook-disposition/summary.md) and [hook-route-candidates](../../data/hook-route-candidates/summary.md) |
| Target run decision evidence | [production-support-decisions](../../data/production-support-decisions/summary.md) |
| Derived ConfigHub variants | [derived-variant live proof](./derived-variant-live-proof.md) and [derived-variant-target-bound](../../data/derived-variant-target-bound/summary.md) |
| Active live parity rerun details | [live-parity-rerun-plan](../../data/live-parity-rerun-plan/summary.md) |
| Claim scope and limits | [claims-register](../../data/claims-register/summary.md) |
| Top-100 buckets and queues | [top100-readiness](../../data/top100-readiness/summary.md) |

If a new generated view duplicates the master matrix at the same granularity,
extend the matrix instead of adding another front door. If the new view has a
different granularity, name that granularity clearly and link back to the
matrix.

## Regeneration

```sh
npm run master-matrix
npm run master-matrix:verify
```

The verifier fails when any generated surface drifts from the committed source
data.
