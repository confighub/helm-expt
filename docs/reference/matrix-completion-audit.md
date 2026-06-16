# Matrix Completion Audit

**UNOFFICIAL/EXPERIMENTAL**

The [matrix completion audit](../../data/matrix-completion-audit/summary.md) takes
every **non-green / not-yet-run** cell of the
[master catalog matrix](../../data/master-catalog-matrix/summary.md) and answers,
per cell: what lane, what state, the product-readable reason, the next action, the
support artifact — and which of four **completion classes** it falls into.

It exists to finish the matrix faster by separating *the kind of work each cell
needs*, so the next effort goes where it pays off instead of re-running rows that
are already decided or that need a model change first.

## The four completion classes

| Class | What it means | Who acts | How to clear it |
| --- | --- | --- | --- |
| `needs-run` | A command exists; the cell just hasn't been run yet. | the live lane | Run it — the exact command is in the row (and grouped in [live-run-blocks](../../data/live-run-blocks/summary.md)). |
| `needs-target-or-prereq-fix` | Blocked on a target prerequisite, an unpullable image, or tooling — a user/target action, not a model change. | user / target | Stage the prerequisite, resolve the image, or fix the tooling, then re-run. |
| `needs-modeling` | The catalog/model has to change before the cell can pass. | catalog | Reconcile the base, render context, target facts, or semantic contract, then re-run. |
| `already-decided` | A `watch` cell with a recorded product decision: evidence plus a named residue. | nobody (it's recorded) | Nothing to run — it's usable today with the named caveat; revisit only if the residue changes. |

The split matters because the three "needs" buckets consume very different effort:
a `needs-run` cell is cheap (one serial command), a `needs-target-or-prereq-fix`
cell needs a target/user action, and a `needs-modeling` cell needs catalog work
before any run will help. `already-decided` cells need nothing — counting them as
"unfinished" would overstate the remaining work.

## How it helps finish the matrix

1. **Run the `needs-run` cells first** — they convert `todo` to `pass`/`watch`/`blocked`
   with a committed receipt for the cost of one command. Use
   [live-run-blocks](../../data/live-run-blocks/summary.md) for the ordered blocks.
2. **Batch the `needs-target-or-prereq-fix` cells by the fix** (image retention,
   CRD/Secret/Namespace staging, tooling) — one fix often clears several cells.
3. **Queue the `needs-modeling` cells for catalog work** — these will not move on a
   re-run alone; they need a model change first.
4. **Leave the `already-decided` cells alone** — they are recorded decisions, not
   gaps.

## What it is (and isn't)

It is a **read-only projection** over committed surfaces — the per-cell scoring
from [disposition-frontier](../../data/disposition-frontier/summary.md), the
[live-parity](../../data/live-parity-decisions/summary.md) and
[kind-parity](../../data/kind-parity-decisions/summary.md) decisions, the
[burn-down](../../data/live-matrix-burndown/summary.md), the run-blocks,
[base-outcomes](../../data/outcome-coverage/base-outcomes.csv), and the matrix's own
lifecycle/promotion columns. The residue families it references are defined in
[residue-families](./residue-families.md).

It **changes no status and runs nothing**. A completion class is a triage hint, not
a claim; a `watch` cell is a recorded decision and is never silently rounded up to a
`pass`. Because it projects the live burn-down, it regenerates with the lane: run
`npm run matrix-completion-audit` when a live row lands.
