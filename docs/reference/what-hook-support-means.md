# What "Hook Support" Means Here

**UNOFFICIAL/EXPERIMENTAL**

Helm hooks are phaseful actions, not objects. Render parity proves an object
set; it proves nothing about whether a pre-upgrade migration ran before the
workload updated. So this repo never says a chart's hooks "work." It gives
every hook-bearing top-100 chart exactly one disposition, in
[`data/hook-disposition/`](../../data/hook-disposition/summary.md), enforced
by a verifier that fails when a hook-bearing chart has none.

## The Dispositions

| Disposition | What it claims | What it does not claim |
| --- | --- | --- |
| `observed` | A maintained lifecycle receipt exists from a live run: the hook's resources were inventoried, a route was selected, and the runtime outcome was observed, with a freshness timestamp. | That the hook works on other bases, values profiles, chart versions, or cluster classes. Receipts age; the next action is always keep-fresh. |
| `routed` | A route is selected in the lifecycle vocabulary (preflight, Argo/Flux lifecycle hook, explicit managed action, upgrade action, delete cleanup) and worked evidence exists: rendered hook resources extracted from the pinned chart, plus a live rehearsal that ran or a blocker receipt with the exact failing command output. | Any live behavior. A route is a classification with evidence, not an execution proof. |
| `per-target` | The honest route differs by target cluster class (for example, GKE Autopilot preflight synchronizers vs an ordinary migration Job). | That any single route claim covers all targets. |
| `refused` | The hook behavior is explicitly out of support, with a refusal receipt naming why. | Nothing — that is the point. A refusal is a published claim boundary. |
| `recipe-needed` | A route plan exists, but the chart has no maintained recipe, so no lifecycle work can attach to a base yet. | That the chart or its hooks are deficient. The gap is catalog work, not chart quality. |

## Three Rules That Keep This Honest

1. **Dependency-provided hooks count.** The disposition table's
   `dependency_source` column names the vendored subchart that ships a hook
   (kong inside kubernetes-dashboard, minio inside thanos, traefik inside
   gitlab). Chart-level review that skips the dependency closure undercounts.
2. **Values-conditional hooks are proven by rendering both paths.** The
   worked evidence under `data/hook-disposition/evidence/` renders the
   default and the hook-enabled profile and records both digests. A source
   scan count is neither an undercount alarm nor a support claim until the
   render shows when the hooks actually materialize — kubernetes-dashboard's
   hooks do not render at all under default values, and airflow's migrations
   default to a plain Deployment.
3. **A blocked rehearsal is evidence, not failure.** The kafka and minio
   rehearsals reached real target preconditions and blocked because pinned
   upstream image tags no longer resolved. Those receipts — with the exact
   pull errors or preconditions — are stronger trust artifacts than untested
   green rows, and they route the real precondition (an image-override,
   digest-pinned base, or newer chart version) into the next action.

## Where The Evidence Lives

- Disposition table: [`data/hook-disposition/top100-hook-dispositions.csv`](../../data/hook-disposition/top100-hook-dispositions.csv)
- Worked render evidence and blocker receipts: `data/hook-disposition/evidence/<chart>/`
- Maintained live receipts: [`data/hook-lifecycle/`](../../data/hook-lifecycle/summary.md)
- Route candidates awaiting recipes: [`data/hook-route-candidates/`](../../data/hook-route-candidates/summary.md)
