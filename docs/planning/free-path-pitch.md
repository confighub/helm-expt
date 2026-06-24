# Free path pitch — "look before you install"

**UNOFFICIAL/EXPERIMENTAL.**

## The thesis

Lead the free path with a **pre-flight check** — pure upside, no migration — not with parity.
Parity drops to a quiet line of assurance underneath. This answers the critique that "parity
sounds like a solution to a problem this approach itself creates": if the only reason you need
parity is that we introduced cub, leading with it is damage control. The pre-flight check is a
real pareto gain instead — benefit with no offsetting loss, because you change nothing and
switch nothing.

Safety and correctness are the spine through all three tiers: free **see it** → server **fix
it once and propagate** → paid **govern it**.

## Ship now — the shipped subset

Every claim below is backed by something we already do. This is the copy that can go on the
site today.

---

### Look before you install

Helm installs a chart in one step and tells you what it did afterward. Render it with cub
first — free, no account, without changing how you install — and read what you're about to run.

**See every object.** The exact Kubernetes resources the chart will create, as plain files you
can read before anything reaches the cluster.

**See the secret it bakes in.** Many charts generate a password and ship it inside the render.
Spot it, and swap in your own, before it lands in your cluster or your registry.

**See what your cluster needs first.** The CRDs, secrets, and targets that must already be
there — named up front, instead of a half-applied release to debug.

**Bringing AI?** When AI writes your values, render what it produced before it's live — the
objects on screen, not a wall of plausible YAML you take on faith.

You switch nothing. Keep Helm. Keep Argo or Flux. Keep your AI. You look first — and there's
nothing to undo, because you changed nothing.

*And it's provably the same objects Helm would install. We're not changing your install. We're
showing you what's in it.*

---

**What backs each line (so it is not an overclaim):**

- *See every object* — `cub installer setup` / `cub helm template` renders the exact objects.
- *See the secret it bakes in* — the per-chart [adoption caveats](../../data/cub-adoption-caveats/summary.md)
  surface baked passwords (e.g. redis); the Secret is in the render itself.
- *See what your cluster needs first* — [target prerequisites](../user/target-prerequisites.md)
  and the per-chart pages record required CRDs, secrets, and targets.
- *Bringing AI* — cub renders any values, AI-generated included (render is render).
- *Parity* — the catalog's render-parity rows prove the objects match Helm.

## North star — the full pitch, once the builds land

Same copy, with three more lines that need building first (marked ⏳):

- **Insecure defaults ⏳.** Charts often ship wide open — open ports, no auth, a privileged
  container. cub flags it before it's live. *(Needs the misconfig scan.)*
- **What the next upgrade breaks ⏳.** A version bump can drop a CRD your workloads still use.
  cub catches the clash before you hit it. *(Needs the CRD-skew check.)*
- **If a chart won't render, ask why ⏳.** cub answers from the real objects and what the
  catalog knows about that chart — not a generic guess. *(Needs the grounded explainer.)*

## The three builds that make the full pitch true

1. **Render-time misconfig scan** — open ports, privileged containers, missing auth, weak
   defaults (kubescape / checkov-style), run on the rendered objects. Turns "insecure defaults"
   from the baked-secret slice into the real security hook.
2. **Upgrade pre-flight / CRD-skew check** — detect that a chart bump drops an in-use CRD
   version, then offer a version both releases support. (A concrete feature proposed by Brian
   Grant; chkk-shaped, scoped to a chart.)
3. **Grounded AI explainer** — "why won't this render?" answered from the actual render plus
   the catalog's per-chart knowledge. The grounding data exists; the explainer is the build.

These also extend the safety spine into server and paid: gate AI/misconfig changes across a
fleet (server), governed agentic remediation with compliance and SLA (paid).

## Placement and generator notes (for Codex)

- The strongest home is the **homepage hero** — this *is* the free-path value proposition. The
  current hero ("Change Helm charts without losing track") is the older control-plane framing;
  "look before you install" reframes the top of funnel. **Recommended, pending sign-off** —
  reframing the hero is a positioning call, not a copy edit.
- Alternative: a dedicated **free-path section** on the homepage (or a short page) linked from
  the hero, leaving the current hero in place.
- Render the command as a terminal card (house layout); keep prose narrow; keep the
  experimental banner; apply the house voice (Jobs is the final filter).
