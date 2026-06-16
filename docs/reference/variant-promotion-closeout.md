# Variant-Promotion Closeout

**UNOFFICIAL/EXPERIMENTAL**

Variant promotion is a **ConfigHub server value, not a helm-expt-only trick.**
`cub variant promote` clones a Unit and promotes it server-side — the catalog's
job is to prove that the promote works for each maintained variant and to record
the receipt. The matrix promotion column reads **0 proven / 20 watch / 172 todo**
not because promotion is broken, but because most variants have a server-side
clone and ConfigHub upload proof yet have not had the promote receipt recorded.

The [variant-promotion-closeout](../../data/variant-promotion-closeout/summary.md)
surface turns that column into an actionable queue: for every variant it says
whether `cub variant promote` is **ready to run now**, **watch-grade**, or
**blocked** by the known ConfigHub server bug, with the exact next command or fix
and the owner who has to act.

## How to read it

| Owner class | Meaning | What to do |
| --- | --- | --- |
| `run-proof` | A server-side clone exists and the base has ConfigHub upload proof (or a prerequisite ConfigHub proof can run); only the promote receipt is missing. | Run the listed `cub variant promote` proof and record the receipt — engineering/CI, no model change. |
| `fix-confighub-server` | Server-side promotion mechanics are proven, but the changeset-bound (add-new-units) promote path fails on the known ConfigHub server bug. | Land [confighub/helm-expt#682](https://github.com/confighub/helm-expt/issues/682), then re-run the changeset promote. |
| `catalog-modeling` | Needs catalog/model work before promotion is meaningful. | Model the base first, then promote. |
| `not-applicable-if-any` | Promotion does not apply to this variant. | Nothing. |

| Readiness | Meaning |
| --- | --- |
| `ready-to-run` | Clone exists; run the promote proof now. |
| `watch-grade` | Basic promote proven; the changeset add-new-units path is blocked by the server bug. |
| `blocked-needs-confighub-proof` | No ConfigHub upload proof yet, so there is no clone to promote — run the ConfigHub proof lane first. |

## Why this matters

It separates the promotion backlog into three very different kinds of work:

- **A large `run-proof` queue** — variants users can promote today; finishing them
  is recording receipts, not building anything. The summary lists a representative
  set of exact commands.
- **A small `fix-confighub-server` set** — the only true blocker is the ConfigHub
  changeset add-new-units bug; these are watch-grade until the server fix lands.
- **A residual `blocked-needs-confighub-proof` set** — variants that need the
  upstream ConfigHub proof before promotion is even possible.

So "172 todo" is mostly a receipt-recording queue, not unsolved product work. The
authoritative per-variant status is
[variant-promotion/status.csv](../../data/variant-promotion/status.csv); this
surface adds the readiness, owner class, clone-exists, and changeset-blocker
triage on top of it.

## Boundaries

Read-only. It lists promote commands but does not run them — promotion is a
deliberate ConfigHub-server action. A `watch-grade` row is a recorded decision
(mechanics proven, changeset path blocked), never silently rounded up to proven.
The surface regenerates from `variant-promotion/status.csv`.
