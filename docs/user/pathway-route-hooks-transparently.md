# Pathway: Route a chart's hooks, transparently

**UNOFFICIAL/EXPERIMENTAL.** This is the first of the user-journey **test pathways**
(see `docs/planning/user-journey-test-pathways-brief.md`). A test pathway is a named,
runnable walkthrough defined by **(persona) × (the decisions they make) × (a class of
charts)**. This one covers the **hook / lifecycle** chart class. It answers the real
question a user asks — *"How do I run THIS chart (which has a hook) with cub, and what
happens to the hook — can I see and approve it, or does it run silently?"* — and it
doubles as the convince-the-team artifact for the hook-handling method.

---

## The user and the question

- **Persona:** a Helm user trying a popular chart (PRD persona 1) standing next to a
  security / compliance reviewer (PRD persona 4). The first wants the chart to work; the
  second wants to *see and approve* anything that runs in the cluster.
- **Chart class:** hook / lifecycle. **Example chart:** `fluent/fluent-bit@0.57.6`
  (`hook_disposition: observed`, ships a test hook).
- **The question:** "Fluent Bit's chart has a hook. If I install it with cub, what happens
  to that hook? Does a privileged step run that I never saw?"

Hooks are the **hardest case** for the Generative GitOps thesis (`docs/user/generative-gitops-fit.md`,
`why-this-does-not-collapse.md`): they are the last hidden imperative step in a Helm
install. Render parity can prove every *non-hook* object, but a hook is, by construction,
a thing Helm runs for you — a Job, a test, a delete-policy cleanup — often privileged,
usually invisible to your desired-state config. If config-as-data leaks anywhere, it
leaks here.

The method this pathway validates: **render parity proves the non-hook object set; each
hook is re-expressed as an explicit, non-automatic lifecycle route — visible, runnable,
and receipted (`automatic: false`).**

---

## The decision sequence

Each step names the `cub` / `cub-scout` move and states the **honest disposition** —
including where the proof stops.

### 1. Pick a base → render parity proves the non-hook objects
Render the chart's default base and compare object-for-object against upstream Helm.
For `fluent/fluent-bit@0.57.6 / default` the **render-parity lane passes** and the chart
reaches the **`live-parity`** outcome level (`data/master-catalog-matrix/matrix.csv`,
`data/outcome-coverage/base-outcomes.csv`). Disposition: **pass** — the steady-state
object set (the DaemonSet, Service, RBAC, ConfigMap) is proven equivalent. This is the
claim render parity is *allowed* to make, and no more (`docs/user/what-we-refuse-to-claim.md`).

### 2. Separate the hook from the steady state
A hook is not part of the steady-state set. Fluent Bit's test hook is recorded as a
**lifecycle route-action** (`data/lifecycle-route-actions/actions.csv`):

| field | value |
| --- | --- |
| `quirk_class` | `hook-test` |
| `route_name` | `explicit-test-check` |
| `lifecycle_phase` | `observe` |
| `action_kind` | **`run-test`** |
| `execution_mode` | `user-executes` |
| `automatic` | **`false`** |
| `evidence` | `data/hook-lifecycle/receipts/fluent-fluent-bit/default/latest.yaml` |

So the hook is **classified and named**, not silently bundled into the apply. Across the
whole catalog, **0 of 25 route-actions are `automatic`** — nothing claims the product runs
a hook for you (`data/lifecycle-route-actions/summary.md`). That honesty is what makes the
model credible.

### 3. Day-1 preview → see desired-vs-live *before* anything runs
Before applying or running anything, preview the change against the live cluster,
field-level, with no controller in the loop:

```
cub-scout compare three-way --dry-from <rendered-objects-dir> --scope namespace/<ns> --format json --fail-on warning
```

This is **shipped today** (`cub-scout` v2.5.0; `compare three-way --dry-from`,
read-only, tool-agnostic). The set-level `cub-scout compare object-set --dry-from` /
`ObjectSetDiffReceipt` that aggregates per-object deltas into one signed receipt is
**forthcoming** (design: `cub-scout` `docs/proposals/object-set-diff.md`) — cite it as
"coming," do not invoke it yet. Disposition: a dry-run preview is a **preview**, not a
guarantee the apply will converge — but it is strictly better than applying blind.

### 4. Run the hook — explicitly, visibly, with a receipt
The test hook runs as its named route (`run-test`), deliberately, and writes a receipt.
The committed live evidence for the real chart is fluent-bit's
**`HookLifecycleRouteReceipt`** (`data/hook-lifecycle/receipts/fluent-fluent-bit/default/latest.yaml`):

```yaml
route:
  summary: The chart hook is a test hook and is routed to an explicit post-install check.
execution:
  helmHooksExecutedByHarness: false      # the product did not silently run a Helm hook
  observedRoute: { daemonSetReady: true, serviceEndpointReady: true, healthEndpoint: pass }
```

The **mechanism** is proven self-contained by `npm run hook-test:proof`
(`scripts/run-hook-test-proof.mjs` on a throwaway kind cluster; summary at
`data/hook-test-proof/summary.md`, receipt at `runs/hook-test-proof/receipt.yaml`):

| Delivery path | test hook | result |
| --- | --- | --- |
| `helm template` (Argo-style render; no run step) | `hook-annotated` (separable) | pass |
| `helm install` (workload applied) | **`skipped`** (Helm does not run it) | pass |
| `helm test` (explicit run-test route) | **`executed`** (recorded result) | pass |

Disposition: **observed** — there is a live receipt. Re-run `--verify` to confirm it stays
fresh (the verify path re-derives the summary from the receipt and byte-compares).

### 5. Where the proof stops (honest disposition)
Fluent Bit's test hook is **observed and routed**. The broader lifecycle lane is **not**
finished: **62 lifecycle cells are defined-but-not-yet-observed**
(`data/matrix-completion-audit/summary.md`: `lifecycle` lane = 62, each "route defined,
not yet observed live → observe and record a receipt"). The pathway is honest about this:
a route being *known* is not a route being *observed*, and neither is *automatic*.

---

## Visible vs. silent (the convince-the-team table)

The same test hook, under each delivery tool:

- **Argo CD** renders with `helm template` (no run step) and has **no native Helm `test`
  execution** — the check is **silently dropped** unless you bolt on your own PostSync job.
- **Flux helm-controller** runs `helm test` only when `.spec.test.enable: true`
  (**off by default**) — **silently skipped** unless you opt in.
- **`helm install`** **never** runs a test hook; only `helm test` does. The steady-state
  workload is applied without it.
- **Routed delivery** re-expresses the hook as an explicit `run-test` lifecycle action
  (`automatic: false`) with a committed receipt — **visible and approvable**.

A colored, self-contained version of this comparison is at
`data/hook-test-proof/visible-vs-silent.html`.

---

## The argument

Silent hook execution is the one place the config-as-data promise leaks: a privileged
Job you never saw and never approved, run for you at install time. Routing hooks —
**visible, runnable, receipted, `automatic: false`** — is the natural completion of the
same thesis, not a different one. You can *still* automate a hook: wire it into your own
GitOps test/PostSync step. But then you do it **knowingly**, with an audit trail, instead
of inheriting a hidden imperative step. The honesty that earns trust: **0 of 25**
route-actions claim automatic execution; `helmHooksExecutedByHarness: false` everywhere.

### Falsification
The method fails if there is a hook that **cannot** be expressed as a route — one that
genuinely *needs* silent execution. None has been found across the hook classes. The
blocked routes (7 of 25) are **preconditions** — missing images, CRDs, or dependencies —
not un-routable hooks (`data/lifecycle-route-actions/actions.csv`,
`data/hook-disposition/evidence/`). Finding a genuinely un-routable hook would refute the
model; not finding one, across every class below, confirms it.

---

## How this generalizes (the hook-class span)

This pathway is the **test-hook** instance. The same shape (render parity for the
non-hook set + explicit routed hook + receipt + visible-vs-silent table) covers the other
hook classes, each of which already has — or honestly lacks — a committed live receipt:

| Hook class | Chart | Committed receipt? |
| --- | --- | --- |
| test hook | `fluent/fluent-bit` | ✅ (this pathway) |
| cleanup / delete-policy | `kyverno/kyverno` · `projectcalico/tigera-operator` | ✅ (`tigera` actually ran the upstream Job, `helmHooksExecutedByHarness: true`) |
| CRD-bootstrap | `gatekeeper/gatekeeper` | ✅ |
| webhook-cert | `prometheus-community/kube-prometheus-stack` | ✅ |
| **post-apply provisioning Job** | kafka / minio class | ❌ **none yet** — image-blocked precondition; the honest gap |

The post-apply-Job class is the open edge: its candidates are blocked on purged upstream
image tags (a precondition), not on un-routability — which is itself evidence for the
model, recorded honestly rather than claimed.

---

## Reproduce / verify

```
npm run hook-test:proof          # live: spin a throwaway kind cluster, write receipt + summary
npm run hook-test:proof:verify   # no cluster: re-derive the summary from the receipt, byte-compare
```

- Probe chart: `tests/fixtures/hook-test-probe/`
- Driver: `scripts/run-hook-test-proof.mjs`
- Summary (visible-vs-silent table): `data/hook-test-proof/summary.md`
- Receipt: `runs/hook-test-proof/receipt.yaml`
- Real-chart live evidence: `data/hook-lifecycle/receipts/fluent-fluent-bit/default/latest.yaml`

## Where this sits in the model
- Lanes & disposition: `docs/user/verification-lanes.md`, `reading-the-matrix.md`,
  `what-we-refuse-to-claim.md` (watch ≠ pass; render ≠ live-ready).
- Hook method: `docs/user/chart-hooks-what-happens.md`, `hook-lifecycle-strategy.md`,
  `docs/planning/where-does-my-hook-go.md`.
- Route contract: `schemas/lifecycle-route-action.schema.json`,
  `data/lifecycle-routes/`, `data/lifecycle-route-actions/`.
