# Master Catalog Matrix Doctrine

The master catalog matrix is the first place to look when the question is:

```text
What is the current state of this chart, version, and base variant?
```

It is not a replacement for the underlying receipts, lane summaries, chart
catalog pages, or production support decisions. It is the joined product view
over those sources.

## Three Renderings

The generated master matrix has three surfaces:

| Surface | Purpose |
| --- | --- |
| [matrix.html](../../data/master-catalog-matrix/matrix.html) | Human and product review. This is the browser view with visible color, user route, strongest evidence, core-lane status, production scope, hard gap, hooks, quirks, and next action. |
| [matrix.csv](../../data/master-catalog-matrix/matrix.csv) | Machine and spreadsheet import. This carries the full row data as text, without relying on color. |
| [summary.md](../../data/master-catalog-matrix/summary.md) | Compact GitHub orientation. This includes the current product queues, then a narrower table for pull requests and code review. |

The HTML view is the primary human decision surface. The CSV is the primary
machine surface. The Markdown summary is a compact index.

The product queues in the HTML and Markdown summary are derived from the same
rows. They are not a second roadmap. They group the current matrix into the
actions a reviewer or product owner can take next: try public catalog rows,
promote proof-grade rows, design better bases, decide limitations, complete
core lanes, finish production scope, or investigate named hard gaps.

## What Belongs In The Matrix

The matrix should carry the fields that help a user or reviewer decide the
next action:

| Field | Meaning |
| --- | --- |
| `Use` | The current route: try the public catalog, review for promotion, design a better base, or decide a limitation first. |
| `Evidence` | The strongest current proof for the row, such as render parity, ConfigHub proof, local live, kind parity, or live parity. |
| `Links` | Jump points to the upstream source repository, chart catalog, variant YAML, package base, variant revision, and GitHub folder. |
| `Core` | Whether the main proof lanes are complete for that row. |
| `R/C/L/G/P/K` | The individual proof lanes: render parity, ConfigHub upload/scan/ops, local live, GitOps/OCI live, live dual parity, and two-cluster kind parity. |
| `Prod` and `Scope` | Whether there is a target-scoped production support decision, and what it covers. |
| `Hooks`, `Quirks`, and `Gap` | The visible reasons the row is easy, risky, incomplete, or needs a product decision. |
| `Next action` | The shortest useful work item for the row. |

The matrix should not hide weakness. A `fail` lane is red. A missing receipt is
grey `todo`. A lane that does not apply should be neutral `n/a`, not blank.

Every row must correspond to real catalog artifacts. The generator checks that
the recipe source lock, per-chart catalog, variant YAML, package base, and
variant revision exist. The source lock supplies the upstream chart repository
and content URL.

## What Stays In Drill-Down Sources

The matrix is intentionally one row per chart/version/base. Details that need
their own granularity stay in their source files:

| Detail | Source |
| --- | --- |
| Exact receipt paths and commands | [outcome-coverage](../../data/outcome-coverage/summary.md) |
| Hook route details | [hook-disposition](../../data/hook-disposition/summary.md) and [hook-route-candidates](../../data/hook-route-candidates/summary.md) |
| Production decision evidence | [production-support-decisions](../../data/production-support-decisions/summary.md) |
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
