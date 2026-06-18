# Variant-Promotion Closeout

**UNOFFICIAL/EXPERIMENTAL**

Variant promotion is a **ConfigHub server value, not a helm-expt-only trick.**
`cub variant promote` clones a Unit and promotes it server-side. The catalog's
job is to prove that the promote works for each maintained variant and to record
the receipt. The latest representative receipts prove the changeset-bound path
on Redis, NGINX, and kube-prometheus-stack. Older watch rows remain visible
until their receipts are rerun on the fixed ConfigHub server.

The [variant-promotion-closeout](../../data/variant-promotion-closeout/summary.md)
surface turns that column into an actionable queue: for every variant it says
whether `cub variant promote` is **ready to run now**, **watch-grade pending
receipt rerun**, or **blocked** by a proof prerequisite, with the exact next
command or fix and the owner who has to act.

## How to read it

| Owner class | Meaning | What to do |
| --- | --- | --- |
| `run-proof` | A server-side clone exists and the base has ConfigHub upload proof (or a prerequisite ConfigHub proof can run); only the promote receipt is missing or stale. | Run or rerun the listed `cub variant promote` proof and record the receipt. Engineering/CI, no model change. |
| `catalog-modeling` | Needs catalog/model work before promotion is meaningful. | Model the base first, then promote. |
| `not-applicable-if-any` | Promotion does not apply to this variant. | Nothing. |

| Readiness | Meaning |
| --- | --- |
| `ready-to-run` | Clone exists; run the promote proof now. |
| `watch-grade` | Basic promote proven on an old receipt; rerun on ConfigHub v0.1.80 or newer to prove the changeset add-new-units path. |
| `blocked-needs-confighub-proof` | No ConfigHub upload proof yet, so there is no clone to promote. Run the ConfigHub proof lane first. |

## Why this matters

It separates the promotion backlog into three very different kinds of work:

- **A large `run-proof` queue** — variants users can promote today; finishing them
  is recording or refreshing receipts, not building a new promotion model. The
  summary lists a representative set of exact commands.
- **A watch-grade rerun queue** — receipts recorded before the ConfigHub v0.1.80
  server fix still show the fallback path. They stay watch until rerun.
- **A residual `blocked-needs-confighub-proof` set** — variants that need the
  upstream ConfigHub proof before promotion is even possible.

So the remaining non-proven promotion cells are mostly a receipt-refresh queue,
not unsolved product work. The
authoritative per-variant status is
[variant-promotion/status.csv](../../data/variant-promotion/status.csv); this
surface adds the readiness, owner class, clone-exists, and proof-refresh
triage on top of it.

## Boundaries

Read-only. It lists promote commands but does not run them — promotion is a
deliberate ConfigHub-server action. A `watch-grade` row is a recorded decision
(mechanics proven, old receipt still used the fallback), never silently rounded up to proven.
The surface regenerates from `variant-promotion/status.csv`.
