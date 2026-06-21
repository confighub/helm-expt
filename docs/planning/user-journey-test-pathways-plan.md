# Plan: User-Journey Test Pathways — verified research map + build plan

_The journey-pathways UX test in the [helm-expt test map](../../tests/README.md)._

**UNOFFICIAL/EXPERIMENTAL.** Companion to `user-journey-test-pathways-brief.md`. The brief
said *do the research pass first*; this doc is the output of that pass (verified against the
generated data/receipts on `main`, 2026-06-20) plus the build plan and live status. Update
this doc as pathways land — it is the living plan.

## Status

- **Research pass: complete** (5-cluster verification; findings below).
- **Pathway 1 — "Route a chart's hooks, transparently": DELIVERED** (this PR). Files:
  `docs/user/pathway-route-hooks-transparently.md`, `scripts/run-hook-test-proof.mjs`,
  `tests/fixtures/hook-test-probe/`, `data/hook-test-proof/{summary.md,visible-vs-silent.html}`,
  `runs/hook-test-proof/receipt.yaml`, + the `hook-test:proof` / `:proof:verify` npm scripts.
- **Phases B & C: queued** (see sequencing).

## Verified research map (condensed)

- **The model.** 8 lanes — Render-parity · in-Confighub · Local-live · lifecycle-**Y** ·
  GitOps-OCI · live-**P**arity · two-cluster-**K**ind · **V**ariant-promotion — over layers
  F1/F2a/F2b/F2c/F3/F4a/F4b. The bar is **verified disposition, not green**: the
  disposition-frontier's 1194 cells (6 lanes × 199 base rows) are **937 pass / 116 watch /
  104 blocked / 19 n/a / 18 fail / 0 genuine todo = 100% verified**. Y tracked separately
  (12/12 observed; route contracts 7 observed / 3 todo / 386 n/a); V = **180 proven**.
- **Hooks (the method).** 25 route-actions = **15 observed / 7 blocked / 2 routed /
  1 per-target, 0 automatic** (verified in `data/lifecycle-route-actions/`). **Falsification
  holds**: zero un-routable hooks; every block is a *precondition* (images/CRDs/deps).
  **4 of 5 hook classes already have committed live receipts** — only post-apply-Job lacks one.
- **Personas.** `helm-community-persona-prd.md` has **6** personas (authoritative); the brief's
  5 is a working subset (drops catalog-maintainer; splits PRD#3 into platform + fleet).
- **Existing journeys.** The 7 `ux-proposal-*.md` files are GUI-proposal sketches, each
  mapping to a runnable `tutorial-sequence.md` tutorial. **Biggest gap before this PR:
  hook/lifecycle** (zero of 7 covered a hook chart) — Pathway 1 closes it.

## Corrections to the brief (verified 2026-06-20)

1. **Charts not in the catalog.** kafka, minio, thanos, airflow, kong, datadog,
   kubernetes-dashboard, keycloak, gitlab are **source-scan only** — not in
   `data/master-catalog-matrix/matrix.csv`. Do **not** anchor pathways on them (this is why
   the post-apply-Job hook exemplar has no observed receipt: its candidates are both
   not-in-catalog *and* image-blocked).
2. **cub-scout day-1 tooling.** Only **`cub-scout compare three-way --dry-from`** is
   **shipped** (v2.5.0). `compare object-set --dry-from` / `ObjectSetDiffReceipt` are
   **design/branch-only, not on cub-scout `main`** — the brief's "PR #498" has not landed.
   Pathways' day-1 step uses `three-way --dry-from` today and cites object-set as forthcoming.
3. **The "62".** It is the **lifecycle-lane cell count** (`data/matrix-completion-audit/summary.md`:
   `lifecycle` lane = 62; `needs-run` = 62; `todo` = 62 — three distinct columns that
   coincide). There is no single field literally named "62 routed-but-unobserved"; characterize
   it honestly as the remaining hook-observation work.
4. **Personas = 6, not 5** (see map above).

## Pathway matrix (persona × decisions × chart-class)

Verified catalog anchors only. `prometheus-community/kube-prometheus-stack` (124 objects,
every quirk) is the cross-class **capstone**, not a per-class anchor.

| # | Pathway | Persona (PRD#) | Chart-class · anchor | Builds on | New live run? |
| --- | --- | --- | --- | --- | --- |
| **1** | **Route a chart's hooks, transparently** ✅ | Helm-user (1) + SecOps (4) | hook/lifecycle · `fluent/fluent-bit` → kyverno | template + 4 existing receipts | no (reused) |
| 2 | CRDs & no-CRDs: "synced ≠ working" | Platform (3) | CRD · `jetstack/cert-manager` (kube-prom capstone) | Tutorial 3 | no |
| 3 | Adopt an existing app (brownfield) | App-team (2) + GitOps (5) | load-brown · nginx / sealed-secrets | `adopting-existing-apps.md` | no |
| 4 | Promote across a fleet | Fleet (3) | stateful · `bitnami/redis` / prometheus | Tutorial 4 (180-proven) | no |
| (5) | post-apply-Job hook exemplar | — | the §4 honest gap | blocker receipt | **yes** (image-override) |

Other verified class anchors for later pathways: no-crds happy-path = `aqua/trivy-operator`
(only fully-green F2b); image-migrated legacy = `bitnami/elasticsearch`; version-skew =
`bitnami/postgresql` (18.6.7↔18.6.10); target-prereq/external = `velero/velero` +
`external-dns` (invalid-shape = `elastic/logstash` ha).

## Sequencing + live-run policy

- **Phase A (done): Pathway 1** — the hook/lifecycle pathway + the test-hook exemplar; also
  the convince-the-team artifact. No new quota burn.
- **Phase B: Pathways 2–4** — the biggest remaining journey gaps (CRD, brownfield, fleet).
  All anchor on charts with existing committed receipts → **no new quota-limited runs**.
- **Phase C: the post-apply-Job exemplar** — the one piece needing a fresh local run on an
  image-overridden base, *or* ship it as the documented falsification-boundary gap.
- **Live-run policy:** serial only; local kind runs are not ConfigHub-quota-limited;
  detached runs must survive session suspension; honest disposition (watch ≠ pass).

## Hook-class exemplar span (for §4 of the brief)

| Hook class | Chart | Committed receipt |
| --- | --- | --- |
| test hook | `fluent/fluent-bit` | ✅ (Pathway 1) |
| cleanup/delete-policy | `kyverno/kyverno` · `projectcalico/tigera-operator` | ✅ (tigera ran the upstream Job: `helmHooksExecutedByHarness: true`) |
| CRD-bootstrap | `gatekeeper/gatekeeper` | ✅ |
| webhook-cert | `prometheus-community/kube-prometheus-stack` | ✅ |
| post-apply provisioning Job | kafka/minio class | ❌ none (image-blocked precondition) |
