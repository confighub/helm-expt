# Brief: User-Journey Test Pathways + Hook-Method Validation

**Audience:** the next helm-expt working session (fresh Opus 4.8 chat).
**Status:** UNOFFICIAL/EXPERIMENTAL planning brief. Do the research pass *first*; do not build from assumption.

> **Update (2026-06-20) — research pass done; Pathway 1 shipped.** The verified research map,
> the pathway matrix, and the build plan are in the companion
> [`user-journey-test-pathways-plan.md`](user-journey-test-pathways-plan.md). **Read it
> alongside this brief** — it corrects four specifics below that the research pass falsified:
> (1) several charts named here are **source-scan only, not in the catalog** (kafka, minio,
> thanos, airflow, kong, datadog, kubernetes-dashboard, keycloak, gitlab) — do not anchor
> pathways on them; (2) **only `cub-scout compare three-way --dry-from` is shipped** —
> `compare object-set --dry-from` / `ObjectSetDiffReceipt` (the "#498" in §2d) are
> design/branch-only, not on `main`; (3) the **"62"** (§4, §7) is the lifecycle-lane cell
> count, not a single named field; (4) the persona PRD has **6** personas (this brief's 5 is a
> subset). Pathway 1 — "Route a chart's hooks, transparently" — is built:
> [`pathway-route-hooks-transparently.md`](../user/pathway-route-hooks-transparently.md).

---

## 1. Mission

Two intertwined goals:

1. **Construct standard "test pathways"** — real user journeys. A pathway =
   **(user type / persona) × (the key decisions they make) × (a class of charts, especially quirky ones)**.
   Each pathway is a named, runnable walkthrough that answers the question a real
   user asks: *"How do I figure out the way to run THIS chart with cub, and what
   are my options?"*

2. **Validate the hook-handling method** (convince the team **and** ourselves):
   prove that *"render parity proves the non-hook object set + hooks are explicit,
   non-automatic lifecycle routes (visible, runnable, receipted)"* works well —
   via a few **worked, live, side-by-side exemplars** on quirky hook charts.

These are the same work: a hook chart's pathway *is* "how do I run its hook,
transparently." The exemplars double as the most important pathways.

**Deeper why.** This ultimately tests whether helm-expt *proves the Generative
GitOps thesis* (white-paper draft `~/Downloads/DRAFT w-paper Generative GitOps.pdf`;
durable in-repo versions: `docs/user/generative-gitops-fit.md`, `why-this-exists.md`,
`why-this-does-not-collapse.md`). The hook method is the thesis's **hardest case** —
the last hidden imperative step in a Helm install — so convincingly routing hooks
(visible, runnable, receipted) is strong evidence for the whole argument. Frame the
convince-the-team work against that thesis.

---

## 2. Required research (DO THIS FIRST — full pass)

Read before building. Verify claims against the **generated surfaces / receipts**,
not prose (prose can be stale vs the data).

### 2a. The model — how proof + disposition work
- `data/master-catalog-matrix/summary.md` + `matrix.csv` — the row-level source of
  truth: 396 rows × 110 chart versions; lanes **R**ender / **C**onfighub / **L**ocal-live /
  lifecycle-**Y** / **G**itops-oci / live-**P**arity / two-cluster-**K**ind / **V**ariant-promotion;
  F1/F2a/F2b/F2c/F3/F4a/F4b layers.
- `data/disposition-frontier/summary.md` — the bar is **verified disposition, not
  green** (pass/watch/blocked/refused/n-a, todo only as a named next step). Currently
  **0 genuine todo / 100%**.
- `data/outcome-coverage/base-outcomes.csv` — the spine (variant × lanes × outcome level).
- `docs/user/verification-lanes.md`, `reading-the-matrix.md`, `outcomes-and-tests.md`,
  `what-we-refuse-to-claim.md` — lane semantics + honesty rules.
- Proof lanes: `data/variant-promotion/` (180 proven post-#682), `data/live-helm-confighub-compare/`
  (G/P), `data/live-kind-parity/` (K), `data/cub-scout-diff/`.

### 2b. Quirks — the chart classes to bucket pathways over
- `data/quirk-coverage/`, `data/quirk-inventory-audit/`, `data/quirk-work-queue/`,
  `data/pain-point-coverage/`, `data/hard-proof-gaps/`, `data/adversarial10/`, `data/torture-suite/`.
- `docs/user/helm-pain-points.md`, `serious-charts.md`, `hard-questions.md`.
- **Chart classes** (pick 1–2 representative charts each): hook/lifecycle · image-migrated
  legacy (`bitnamilegacy` F2b) · version-skew (covered-by; see [[helm-expt-kind-parity-version-skew]]) ·
  CRD/bootstrap · target-prerequisite / external-platform (AWS-EKS etc.) · stateful/credentialed · no-crds.

### 2c. Hooks / lifecycle — the method under test
- `data/hook-disposition/` (top-100 hook dispositions + per-chart `evidence/`),
  `data/hook-lifecycle/` (receipts), `data/lifecycle-routes/` + `data/lifecycle-route-actions/`
  (route schema + **25 actions: 15 observed / 7 blocked / 2 routed / 1 per-target; ALL `automatic:false`**),
  `data/hook-route-candidates/`, `data/webhook-cert-lifecycle/`, `data/secret-lifecycle/`.
- `schemas/lifecycle-route-action.schema.json` — the route contract schema.
- `docs/user/chart-hooks-what-happens.md`, `hook-lifecycle-strategy.md`,
  `docs/planning/where-does-my-hook-go.md`.
- Worked proof to build on: observed routes with receipts — e.g. `fluent/fluent-bit`
  (`explicit-test-check` → run-test) and `kyverno/kyverno` (cleanup-policy), receipts under
  `data/hook-lifecycle/receipts/`.

### 2d. Personas + existing journey material (BUILD ON THIS — do not restart)
- `docs/planning/helm-community-persona-prd.md` + `helm-community-persona-plan.md` — personas.
- `docs/user/choose-your-path.md`, `choosing-commands.md`, `first-run-walkthrough.md`,
  `adopting-existing-apps.md` (brownfield), `creating-variants.md`, `derived-variant-walkthrough.md`,
  `tutorial-sequence.md`, `cub-variant-command-surface.md`.
- **Already-drafted journey tutorials** (reuse/upgrade these): `docs/user/ux-proposal-redis-quick-start-tutorial.md`,
  `ux-proposal-redis-secret-modes-tutorial.md`, `ux-proposal-prometheus-base-variant-tutorial.md`,
  `ux-proposal-prometheus-promotion-tutorial.md`, `ux-proposal-externaldns-custom-overlay-tutorial.md`,
  `ux-proposal-gitops-runtime-proof-tutorial.md`, `ux-proposal-bulk-scan-patch-tutorial.md`.
- User-story spine: `docs/user/generative-gitops-fit.md`; site `site/journey.html`,
  `site/day1-operations.html`, `site/hooks.html`, and the per-row **"Options From The Matrix"**
  cards on `site/charts/*.html` (generator `scripts/generate-public-site.mjs`).
- **Day-1 tooling** (preview / dry-run / diff): cub-scout at `/Users/alexis/code/cub-scout` —
  `compare three-way --dry-from`, and the new `compare object-set --dry-from` / `ObjectSetDiffReceipt`
  (cub-scout PR #498). `docs/user/cub-scout-diff-design.md`, `reverse-reconcile-design.md`.

### 2e. Planning context
- `docs/planning/next-execution-plan.md` (the 99% bar), `serverless-verified-install-plan.md`,
  `agreed-execution-plan.md`, `robust-sceptic-plan.md`, `outside-user-test.md`,
  `pilot-adversarial-testing.md`, `upgrade-story-plan.md`.

---

## 3. The user-journey framework to build

Spine (from `generative-gitops-fit.md`): **helm serverless → add server → add app
(write-green | load-brown) → make changes + variants → day-1 (preview / dry-run /
lifecycle / other) → day-2.** Cross-cutting: **SecOps · platforms · fleets · stacks.**

A **test pathway** = persona × decision-sequence × chart-class:
- **Personas:** platform engineer · app/dev team · SecOps · fleet/multi-env operator ·
  GitOps (Argo/Flux) adopter. (Reconcile with the persona PRD.)
- **Key decisions:** base/variant · write-green vs load-brown · default vs no-crds ·
  existing-secret vs generated · target/platform shape · GitOps backend · **post-deploy
  hook route** · promotion/changeset.
- **Chart classes:** §2b.

Each pathway maps to the matrix lanes + the chart-page cards + the exact day-1
`cub` / `cub-scout` commands, stating the **honest disposition at each step**
(including where the proof stops). "Our dry-run has to be better than ArgoCD's"
and the journey must work for *all* charts, not be tied to one.

---

## 4. The hook-method validation challenge (convince-the-team artifact)

Build **3–4 worked, live, side-by-side exemplars** on quirky **hook** charts. For each:
1. render parity proves the non-hook objects;
2. the post-deploy hook **run as its explicit route on a live kind cluster + verified by a receipt**;
3. shown next to *"what Helm/Argo would have done silently."*

Span hook **classes**: post-apply Job · test hook · cleanup/delete-policy · CRD-bootstrap · webhook-cert.

- **Template (proven pattern — copy this shape):** `scripts/run-flux-lookup-proof.mjs`
  + `tests/fixtures/flux-lookup-probe/` is the worked-live-exemplar to imitate — a minimal
  probe chart + a `--run`/`--verify` script that exercises it multiple ways on a throwaway
  kind cluster, then writes a **typed receipt** (`runs/.../receipt.yaml`) and a side-by-side
  `summary.md` table with a per-leg `result` (pass/watch). Build each hook exemplar this way:
  probe-or-real chart → run the route live → receipt + a visible-vs-silent table. Reuse
  `scripts/lib/proof-common.mjs` (`check`/`write`/`writeYaml`/`readYaml`).
- **Argument:** silent hook execution (a privileged Job you never saw/approved) is the one
  place the config-as-data promise leaks; routing hooks (visible + runnable + receipted,
  `automatic:false`) is the natural completion of the same thesis. You *can* still automate
  via your own GitOps PostSync — **knowingly**, with an audit trail.
- **Existing evidence:** 15 observed route-actions with receipts; `automatic:false` everywhere
  (0/25 claimed automatic) = the honesty that makes it credible.
- **Honest gap:** 62 routed-but-unobserved lifecycle cells + 7 precondition-blocked.
- **Falsification test:** find a hook that **cannot** be expressed as a route (genuinely
  needs silent execution). None found yet across the quirk classes — finding one refutes the
  method; not finding one confirms it. The blocked ones are *preconditions* (images/CRDs/deps),
  not "un-routable," which supports the model.

---

## 5. Deliverables

1. A persona × decision × chart-class **pathway matrix** (which pathways, which charts, why).
2. **~4–6 fully-written test pathways** (the most important journeys), each runnable end-to-end.
3. **3–4 worked live hook exemplars** (side-by-side visible-vs-silent, receipted), spanning hook classes.
4. The **convince-the-team writeup**: the argument + the exemplars + the falsification framing.

---

## 6. Operating constraints (honor these — learned the hard way)

- **Workspace:** use the standalone clone `/Users/alexis/code/helm-expt-claude-clone` (the
  loop owns `/Users/alexis/code/helm-expt`). **SOURCE-ONLY PRs; never self-merge helm-expt PRs**
  (Codex/user merges; cub-scout self-merge OK when authorized). A safety classifier enforces this.
- **Live runs: serial only** (one live/kind job at a time — concurrent starves kind nodes →
  false blocks). **Quota:** ConfigHub prod org = **Kubara**, Unit-quota-limited — use
  `--cleanup-spaces`; clean orphans (`cub lk down --name <c> --force`, then
  `cub space delete <c>-<chart> --recursive-force`). Only delete clusters you created
  (`helm-expt-parity-*` / `hx-*`).
- **Detached runs survive session suspension** (the machine/session suspends when the user
  steps away and kills harness-tracked background tasks; a screen-saver was one trigger).
  Launch long live runs as `( nohup <cmd> > /tmp/x.log 2>&1 < /dev/null & )` and watch via a
  separate `run_in_background` watcher (or it dies with the session). Make drivers
  **skip-already-fresh** so they're resumable.
- **Recording pipelines** (see memory [[helm-expt-live-parity-recording]]): a run only writes a
  gitignored receipt; to land it you must fold it into the committed summary, then run
  `outcomes:generate` → master-matrix / disposition-frontier / matrix-completion-audit /
  coverage-completion-plan as a **fixpoint** (loop until `:verify` gates pass — matrix↔coverage
  cross-depend), then the leaf generators; force-add receipts (`git add -f`).
- **Don't force green / don't overclaim:** honest disposition; `automatic:false` for hooks;
  watch ≠ pass; promotion-proven ≠ production-proven; verify numbers against committed surfaces.
- **Codex coordination:** Codex absorbs PRs onto main (CLOSED ≠ rejected — verify it landed).
  Two sessions in one working dir collide — isolate with a `git worktree` if needed.

---

## 7. Current state (start here)

All merged to main this session:
- Promotion **180 proven** (#998, on the #682-fixed ConfigHub v0.1.80; `cub variant promote
  --changeset` now works for newly-added Units).
- Frontier **0 genuine todo / 100% verified disposition** (#997: K version-skew covered-by n/a).
- Legacy Bitnami G/P watch + K blocked (#994/#995); Flux `lookup()` proof (#996);
  cub-scout object-set-diff Issue A (cub-scout #498).

The matrix is **complete as far as testing takes it.** What remains is catalog/lifecycle/
external work — including the **62 lifecycle-observed cells**, which *is* the hook-method
work in §4. That, plus the user-journey pathways, is this brief.
