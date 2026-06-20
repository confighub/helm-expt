# Plan: executing hook lifecycle routes (closing `automatic: false`)

**UNOFFICIAL/EXPERIMENTAL planning brief.** Scope for the real answer to *"are we
really going to ask people to run these by hand?"* — **No.** The routing work
(visible, named, receipted lifecycle steps) is the prerequisite; this brief scopes
making them **executed** — by your delivery pipeline or by the product — with a
receipt, so a hook is *automated and auditable*, never manual toil and never a
hidden Helm Job.

## Where we are

- 25 route-actions, **15 observed**, **0 `automatic`** (`data/lifecycle-route-actions/`).
  `automatic` is `true` only when the product executes the route **and** committed
  evidence proves it (`schemas/lifecycle-route-action.schema.json`). No route is
  `execution_mode: product-executes` today.
- The site now says the honest thing per chart/variant: each hook is a visible,
  receipted step run by your delivery pipeline; product auto-execution is the roadmap.
- One existing receipt already proves execution works:
  `data/hook-lifecycle/receipts/projectcalico-tigera-operator/default/latest.yaml`
  ran the upstream pre-delete Job as an explicit lifecycle action
  (`helmHooksExecutedByHarness: true`). That is the proof-of-concept for the engine.

## What "execute" means per route class

| Route class (`action_kind`) | Can the product/pipeline run it? | How |
| --- | --- | --- |
| `run-job` / `run-preflight` / `run-check` | **Yes** | Apply the Job + wait, write an execution receipt; **or** emit a GitOps PreSync/PostSync the controller runs. |
| `run-test` | **Yes, opt-in** | `cub test` / a CI step runs the check on demand, writes a receipt. Tests stay explicit by design. |
| `install-crd` | **Yes** | Apply CRDs server-side as a managed step + receipt (already proven shape for observed bases). |
| `gitops-sync-hook` | **Yes** | Emit the route as the controller's native hook (Argo `PreSync`/`PostSync`, Flux). |
| `accept-target-policy` / `preserve-ordering` / `observe-webhook` (`target-owned`) | **Already automatic** | The cluster/applier does it — no product execution needed; just observed. |
| `stage-target-facts` | **No (stays prerequisite)** | These are *your inputs* (Secrets/CRDs/storage). The product can't invent them; it states the requirement. The one honest "you supply it" — but it's setup, like values, not per-deploy toil. |

So almost everything is executable; the only permanent "you provide it" is target facts, which are inputs, not toil.

## Two execution surfaces (not mutually exclusive)

1. **GitOps-native emission (lowest risk, ship first).** Generate the route as the
   user's existing controller's native step — an Argo CD `PreSync`/`PostSync` hook or
   a Flux equivalent — from the route-action packet. The controller runs it on every
   sync; it's visible in the controller UI and receipted. No new product runtime.
2. **Product-direct execution (`cub`).** A `cub`/`cub-scout` capability that, given a
   route-action, executes it against the target and writes an **execution receipt**.
   This is what flips `automatic: true` (per the schema rule: product executes +
   committed evidence). Mostly cub/cub-scout work, not helm-expt.

## The receipt (the audit trail that keeps it honest)

Extend the observation/route receipt to record an **execution**: who ran it
(`product` | `gitops-controller` | `user`), when, the command/route, and the
result. `automatic: true` is set **only** when an execution receipt with
`executor: product` exists. "Visible" is preserved: execution is logged and
receipted, never hidden. (Schema touch: add an `execution` block to
`schemas/observation-receipt.schema.json` or a new `route-execution-receipt`.)

## Phasing

- **Phase 1 — prove the receipted-execution path (helm-expt, doable now).** Generalize
  the tigera `helmHooksExecutedByHarness: true` pattern: for 1–2 observed `run-job`
  routes, run the route live on kind, write an **execution receipt**, and let
  `lifecycle-route-actions` derive `automatic: true` *for that proven scope only*.
  This is the same shape as `run-hook-test-proof.mjs` + a receipt. Low risk, in-repo.
- **Phase 2 — GitOps-native emission.** A generator that turns a route-action into an
  Argo `PreSync`/`PostSync` (and Flux) manifest, surfaced on the chart page next to
  "who runs it" as a copy-pasteable, controller-run step. Still helm-expt + docs.
- **Phase 3 — product-direct execution (cub/cub-scout).** The execution engine +
  receipt; flips `automatic: true` broadly. Cross-repo; the larger build.

## Honest boundaries / acceptance

- `automatic: true` requires a committed execution receipt with `executor: product`.
  No flipping the flag on intent alone.
- `stage-target-facts` never becomes `automatic` — it's a declared input.
- Falsification: every observed non-input route should be executable as above.
  If one genuinely cannot be (and isn't a precondition), that's a model finding.

## Decision needed before building

Which surface to lead with — **(1) GitOps-native emission** (ship in helm-expt,
controller runs it, no new runtime) or **(3) product-direct `cub` execution** (the
`automatic: true` endgame, cross-repo). Recommendation: **Phase 1 (prove receipted
execution in-repo) → Phase 2 (GitOps emission)** first; treat Phase 3 as the cub
roadmap item it already is (#688).

## Selecting a route (the user-facing affordance) — REQUIRED

The default is "deliver everything **except** the hook," so a separated hook does
not run on its own. That is only acceptable if **choosing the hook's execution
path is a first-class operation**, reachable through ConfigHub's surfaces
(**CLI · AI/agent · function · GUI**). Otherwise we have made the hidden step
visible but not actionable. (Product requirement, 2026-06-20.)

**The menu already exists.** Every route carries a `default_route`, `alternatives`
(off-ramps), and a machine-readable `agent_inputs` block
(`data/lifecycle-route-actions/`). Example — kyverno's migration Job
(`hook-phase` / run-job): default `upgrade-action-with-receipt` · alternatives
`argocd-or-flux-lifecycle-hook` | `target-facts-or-preflight` | `refuse`. The
choices are authored; the gap is the *selector* that lets someone pick and applies it.

**The selection contract** (one contract; every surface drives it):
- **Input:** `(chart, variant, hook) + chosen route`, validated ∈ default ∪ alternatives.
- **Output:** the **execution plan for the choice** — the Phase 2 GitOps step
  (Argo/Flux), a by-hand command, or queue-for-cub — **plus a selection receipt**
  recording who chose what, when, and why.

**This is a runtime module — not a catalog feature.** The selector + executor runs
at deploy/operate time and writes runtime receipts, so it belongs in the **cub /
cub-scout runtime, kept self-contained — NOT in helm-expt** (a static proof/catalog
harness with no runtime). Building it here would contaminate the catalog with runtime
concerns. helm-expt's lasting contribution is the **static contract + evidence** the
runtime module consumes: the per-hook menu (`default_route` + `alternatives` +
`agent_inputs`), the GitOps emission templates (Phase 2), and the live execution
proofs (Phase 1). Stop there in helm-expt.

**Surfaces (all part of the runtime module; one shared contract):**

| Surface | Where it lives | What it is |
| --- | --- | --- |
| CLI | cub runtime (`cub ...`) | list the menu, select → execute/emit + receipt |
| AI / agent | cub-scout / agent runtime; reads helm-expt's `agent_inputs` | picks a route with a rationale, executes + receipts |
| function | cub runtime (`cub function`) | sets the chosen route on a Unit, like `set-image` |
| GUI | product UI | per-hook control to pick + preview + apply |

helm-expt may, at most, host a **static contract-conformance check** (does each route
expose a valid menu + `agent_inputs`?) — never the live selector/executor.

**Status:** the menu + the contract exist; the selector mechanism is unbuilt.
helm-expt can ship the reference CLI + the agent path + surface the menu; the
productized cub CLI / function / GUI implement the same contract. The choice of
*which surface first* does not block the contract — build the contract once.
