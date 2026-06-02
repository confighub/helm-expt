<!-- Catalog doctrine for helm-expt. The completeness contract behind the equivalence claim. -->

# The complete corresponding model — what "ConfigHub replaces Helm" must mean

**Status:** DOCTRINE (2026-06-02). The north-star claim of the catalog and the contract every chart must meet.

## The claim
> For any public Helm chart (plus its Kustomize / overlay customization), ConfigHub + `cub installer`
> provides a **modular, executable model** that reproduces the chart's result and that a user can
> **read, use, and verify** — without running the chart's templating engine.

This is the product thesis. The catalog only earns it if **every chart ships a complete corresponding
model**, not a prose promise. This doc defines "complete" precisely enough to be machine-checked, and —
critically — honestly, so the claim survives an adversary.

## What "100%" must mean (and must not)
"100%" is a claim about **the rendered result and the accounting of behavior** — not a claim that a static
file magically reproduces live, cluster-dependent dynamism.

**100% means, per chart:**
1. **Render-equivalent** — for every supported variant, `cub installer setup` output **≡** `helm template`
   output (modulo declared support objects), proven by a digest-bound equivalence receipt the user can re-run.
2. **Behaviorally complete (no silent gaps)** — every Helm behavior the chart uses is either **absorbed**
   into the model (named home + policy + proof) or **explicitly dispositioned**. The HelmPlan carries
   **zero `unknown` and zero `unhandled`**. Render-time dynamism becomes explicit model elements; live /
   lifecycle behavior becomes policy + receipts or an honest blocker:

   | Helm behavior | How the model accounts for it |
   |---|---|
   | `lookup` (reads the live cluster) | declared target-fact requirement + bound fact value (explicit input, never silent) |
   | random / cert / time (generated) | generated-fact receipt — generated once, bound into the revision |
   | `.Capabilities` branching | named capability profile (the model is reproducible *for a declared context*) |
   | hooks | lifecycle policy + receipt, or an **honest blocker** (execution is cluster-dependent) |
   | `tpl` / raw manifests / post-renderers | explicit extension slot with policy, or reject |
   | CRDs / webhooks / RBAC | operate policy + rendered-object scan/gate |
   | mutable image tags | digest-resolution receipt, or gate |

3. **Variant-complete** — the model covers how users actually install/vary the chart (`default` **plus** the
   meaningful render-time variants), so a Helm user replacing their usage finds *their* shape, not only `default`.
4. **Readable** — a per-chart artifact map answers: which variant do I install, what will it create, what
   differs between variants, and what's the catch.
5. **Usable** — executable end to end (`cub installer setup / render / package`), reproducing the objects
   without the chart's templating engine.
6. **Verifiable** — machine-checkable receipts (equivalence / render / scan / gate) + `npm run verify`; the
   user can re-run the equivalence proof themselves.
7. **Honestly scoped** — `catalog-status.yaml` declares the support scope (local-test / production) and names
   every blocked or deferred part.

**100% does NOT mean** a static model silently re-executes `lookup`, runs hooks, or resolves `.Capabilities`
on its own. Those are made **explicit** (facts / profiles / policies) or **blocked**. A chart whose core
function is arbitrary post-render templating may be **honestly un-modelable in full** — and saying so, with
the boundary named, *is* a complete model. The blocked / operator-decision disposition is **part of
completeness, not a failure**: an adversary cannot find a behavior we silently dropped, because there are
none — every behavior is either absorbed or named.

## Why the honest version is the strong version
A breakable claim ("100% of any chart is silently replaced") dies the first time a reviewer finds a `lookup`
or a hook we glossed over. The honest claim ("100% rendered-equivalent for declared contexts + 100% of
behaviors absorbed-or-named + every receipt re-runnable") **cannot** be broken that way — and it is a bigger
product statement: not "we re-ran Helm," but "we turned Helm's hidden behavior into an explicit, reviewable,
verifiable model."

## Where we are vs. the contract (measured 2026-06-02)
| Criterion | State |
|---|---|
| Per-chart model structure (recipe, HelmPlan, dossier, control-points, value-model, receipts) | **100 / 100** ✓ |
| Helm-equivalence receipts | 120 (covers the proven variants) ✓ |
| Variant-complete (more than `default`) | **20 / 100** — 80 are default-only ✗ |
| HelmPlan with zero `unknown` / `unhandled` | **99 / 100** (1 `unhandled` remains); 21 explicit `blocked` (honest) |
| Production-scoped (vs local-test) | **0 / 100** ✗ |

The **structure** of the corresponding model exists catalog-wide and render-equivalence is broadly proven —
but the catalog is **not yet complete by this contract**: most charts model only their default shape, one
chart has an unhandled pain point, and none are production-scoped.

## The delivery program (to actually earn the claim)
1. **Encode this contract as a verifier check** — a per-chart `model-completeness` score over the 7 criteria,
   rolled up catalog-wide, failing CI when a chart regresses or a HelmPlan carries `unknown` / `unhandled`.
2. **Audit + gap report** — every chart scored against the contract; the gap list becomes the work queue.
3. **Close the gap** — variant-complete the 80 default-only charts (their meaningful render-time variants),
   resolve the 1 unhandled, and give every chart a production or honest-scope disposition.
4. **User-verifiable surface** — each chart's map carries the exact `cub installer` commands plus the
   re-runnable equivalence check, so a user can read → use → verify the corresponding model themselves.

**Completeness is the admission bar:** a chart is `catalog-supported` only when it meets this contract for its
declared scope; otherwise it is a candidate, with the gap named.

## Relationship to the other doctrine docs
- `catalog-doctrine.md` defines the customization *surface* (default + parameterized + standard variants).
- `complete-corresponding-model.md` (this doc) defines *completeness + equivalence + verifiability* per chart.
- `agreed-execution-plan.md` "Helm Pain Absorption" is the behavior-accounting mechanism this contract enforces.

## Sources
`agreed-execution-plan.md` (Helm Pain Absorption; "no unhandled pain points"), `catalog-doctrine.md`,
`next-execution-plan.md`; the #1134 campaign equivalence result; measured catalog state 2026-06-02.
