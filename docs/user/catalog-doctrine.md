<!-- Catalog customization guidance for helm-expt. Validated live by the Pilot test harness (confighub-ai-demo#1134). -->

# Helm catalog doctrine — honest defaults, standard forks, layered fills

**Status:** WORKING DRAFT / proposal (shaped with Alexis, 2026-06-01). Candidate for a
numbered principle in helm-expt `principles.md`, the START of the #1133 decision tree, and
the catalog admission bar. Grounded by the #1134 campaign (F1–F4).

## Principle
Every **catalog-supported** chart presents a small, predictable customization surface:

1. **One honest `default` base** — concrete values, **zero placeholders where possible**,
   installs to Ready with no required input. Where a zero-placeholder default cannot honestly
   work (secret-needing charts over GitOps — F3), the default **declares its minimum required
   fills and refuses-with-reason** rather than delivering silently-broken.
2. **A parameterized base** (where it works) — identical in *shape* to `default`, but with the
   author-exposed, **non-shape-changing** fields exposed as **placeholders** instead of concrete
   values. This is the explicit "make it yours" surface — the placeholders are the form fields.
   *Can have, not must have:* some charts have few safe-to-parameterize fields.
3. **Up to ~4 standard forks** — additional base variants from a **shared catalog vocabulary**
   (`existing-secret`, `ingress-tls`, `ha`, `no-crds`, …), applied per chart **only where they
   apply** (don't pad fake forks). Same name = same meaning across the catalog.
4. **Fills layer on top** — placeholder values / fact bindings are filled on a **derived ConfigHub
   variant**, **without changing object shape**. The long tail is many derived variants
   (env / region / customer) over a few bases.

```
recipe ─┬─ default base            (concrete, zero placeholders, works OOTB)
        ├─ parameterized base      (same shape; fill-safe fields → placeholders)   ──fill──▶ derived variants
        └─ standard forks (0–4)    (existing-secret | ingress-tls | ha | no-crds…) ──fill──▶ derived variants
                                   each a real, rendered, Helm-equivalent, pinned shape
```

## Load-bearing invariants
- **Honest default:** reaches Ready, OR declares required fills + refuses silently-broken (#1132 required-secret gate).
- **Fork = shape change; fill = slot binding.** A value change that alters the rendered object set is a *base fork* (re-render, Helm-equivalent, digest-pinned). A value bound into an already-rendered field is a *fill* (derived variant, no re-render). Never blur this — it is what preserves Helm-equivalence + digest-pinning.
- **Shared fork vocabulary** — catalog-wide names, not per-chart ad-hoc.
  *Campaign evidence:* the existing-secret fork is named **5 different ways** today —
  `reuse-existing-secret` (redis) · `existing-secret` (postgresql/mysql/rabbitmq) ·
  `existing-secret-replicaset` (mongodb) · `existing-secret-ingress` (grafana) ·
  `default-control-plane` (consul). A user cannot predict that; the vocabulary fixes it.
- **Every base is pinned (F2) and Helm-equivalent.** Equivalence is verified per base.
- **Parameterized reproducibility:** `parameterized base + default fills ≡ default base ≡ helm template`.

## Admission check (what makes a chart "catalog-supported")
1. `installer.yaml` declares exactly one `default: true` base.
2. The default installs to Ready (live e2e) **or** trips a required-input/secret gate (no silent green).
3. Each declared fork renders coherently (single-namespace), is Helm-equivalent, and pins images.
4. Fork names come from the shared vocabulary.
5. Where a parameterized base exists: `parameterized + default fills ≡ default`.
Charts not meeting this are **catalog-candidates** (analysis tier), not catalog-supported.

## Why this serves the three goals
- **more charts** → it's the admission bar (a chart joins when it has an honest default + applicable forks).
- **obvious steps** → the #1133 tree START becomes "pick a named fork"; the parameterized base is the fill form.
- **tested & verified** → the admission check *is* the matrix: `charts × {default + parameterized + forks} × dimensions`, same harness/receipts/adversarial-verify.

## Open questions (honest)
- Zero-placeholder honest default is impossible for secret charts over GitOps without #1132 (gate) or a GitOps secret-delivery mechanism.
- "Fill-safe" fields (placeholder-able without shape change) need a per-chart determination — likely the author-exposed inputs minus structural ones.
- The shared fork vocabulary needs defining + a migration of the current inconsistent fork names.

## Sources
helm-expt `docs/user/customization-algorithm.md`, `change-routing-before-oci.md`, `principles.md`;
campaign findings F1–F4 + `reports/pilot-helm-sweep/SCORECARD.md`; the #1133 decision tree.
