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
file reproduces live, cluster-dependent dynamism by itself.

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

## Where we are vs. the contract

The current measured state is in `data/model-completeness/summary.md`.

This report is a model-support view, not the whole live outcome. Level 2 means
the chart has a complete, honest, reproducible model for its declared scope.
The full catalog outcome still needs the lane-test matrix:

```text
default and declared main choices
-> Helm-equivalence and installer setup
-> ConfigHub upload, scan, clone/check, and safe-ops proof
-> live Kubernetes observation
-> ConfigHub OCI through Argo/Flux
-> live Helm-vs-ConfigHub parity
```

Recommended extra variants are an enhancement until they are declared as
supported choices. Once a choice is declared supported, it must be tracked as
its own chart-recipe-variant row with the relevant lane evidence.

Current headline:

```text
supported (Level 2): 100 / 100
variant-rich:        54 / 100
```

`supported (Level 2)` means the six support criteria pass for the declared
scope: render equivalent, behavior accounted for, readable, usable, verifiable,
and honestly scoped. Variant richness is now reported as an enhancement metric,
not as the support gate.

The current top-100 should be read like this:

| Question | Current answer | Source |
| --- | --- | --- |
| Does every maintained chart have a recipe/package proof path? | 100 / 100 | `data/top100-catalog-analysis/summary.md` |
| Are all maintained charts Level-2 supported for their declared scope? | 100 / 100 | `data/model-completeness/summary.md` |
| Are all charts rich enough for common user variants? | 54 / 100 are variant-rich | `data/model-completeness/summary.md` |
| Are all top-20 public catalog charts live/e2e tested locally? | 20 / 20 | `data/live-e2e/summary.md` |
| Are any top-20 charts production-supported today? | 0 / 20 | `data/production-disposition/summary.md` |
| Do any charts have hard gaps for recommended extra capabilities? | 25 / 100 | `data/chart-facts/summary.md` |

So the catalog is no longer "20 complete and 80 incomplete." A more accurate
reading is:

```text
100 charts have a supported proof model for their declared scope.
20 charts are public catalog-supported for local-test.
54 charts have more than one base variant.
46 charts are still default-only.
25 charts have a hard gap for at least one recommended extra capability.
0 charts are production-supported yet.
```

The hard-gap count is about missing recommended capabilities, not total chart
failure. A chart can have a working, supported default recipe while still
missing a useful `existing-secret`, `no-crds`, or HA path for a specific
variant.

## The delivery program (to actually earn the claim)
1. **Keep the verifier check green** — `npm run completeness:verify` scores the
   100 charts and fails if support criteria regress.
2. **Use the gap reports as work queues** — `data/chart-facts/summary.md`,
   `data/variant-backlog/summary.md`, and `data/quirk-review-queue/summary.md`
   explain which charts need capability, variant, or review work.
3. **Build variant richness deliberately** — close the 46 default-only entries
   and the 29 hard-gap entries without treating every possible Helm value as a
   catalog promise.
4. **Add production dispositions** — local-test support is not production
   support. The production lane is tracked in
   `data/production-disposition/summary.md`.
5. **User-verifiable surface** — each chart's map carries the exact `cub installer` commands plus the
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
