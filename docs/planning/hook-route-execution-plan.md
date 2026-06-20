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
