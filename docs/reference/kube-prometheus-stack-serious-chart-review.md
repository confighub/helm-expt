# kube-prometheus-stack: Serious Chart Review

**UNOFFICIAL/EXPERIMENTAL — reviewer-facing snapshot, 2026-06-10.**
Counts cite generated files; re-check those files before quoting.

kube-prometheus-stack (`prometheus-community/kube-prometheus-stack@85.3.3`,
bases `default` and `no-crds`) is the catalog's deliberately hard chart. This
page maps what is proved, what is partial, and what remains — so a reviewer
can probe the strongest example without mixing proof levels.
Compact table: [data/serious-chart-reviews/kube-prometheus-stack.csv](../../data/serious-chart-reviews/kube-prometheus-stack.csv).

## Why This Chart Matters

It concentrates most quirk classes in one install: ~20 CRDs, admission
webhooks with hook-driven cert patching, cluster RBAC, generated facts,
hooks across four phases (`pre-install, post-install, pre-upgrade,
post-upgrade`), large object fanout, dependency-locked subcharts (Grafana,
exporters), and real image/security surface. If the model only worked on
Redis-class charts, it would prove little; this chart is where the claims
earn their keep.

## What Current Receipts Prove

- **Render parity**: 2/2 bases match regular Helm for the pinned chart,
  values profiles, and capability profile
  (`data/status-dashboard/top20-status.csv`, rank 18).
- **Local live e2e (`default` base)**: pass, with the strict witness recorded
  as `observed` and `3/4` witness checks passing on the committed row
  (`data/live-e2e/top20-local-kind.csv`; the per-check detail lives in the
  run's observation receipt).
- **Base readiness**: `default` is `start-here` (all core lanes plus
  two-cluster parity pass); `no-crds` is `try-with-proof` with named missing
  lanes (`data/top20-base-readiness/base-readiness.csv`).
- **Blast radius, measured not assumed**: the `crds.enabled` base pair
  (`default` → `no-crds`) has a committed re-render diff — 10 predicted, 10
  observed object changes, accuracy 1.000
  (`data/blast-radius-accuracy/`). The `grafana.adminPassword` case is
  recorded as `not-measured-yet` — an honest open row, not a claim.

## What Live Parity Proves

Both lanes pass for this chart: the selected live Helm-vs-ConfigHub
comparison (`default`) and the two-cluster kind parity lane (`default` and
`no-crds`) — regular Helm in one kind cluster against the
`cub installer` path in another, compared semantically
(`data/live-kind-parity/summary.csv`,
`data/live-helm-confighub-compare/`). Scope: the pinned chart version, the
named values profiles, Kubernetes 1.30 kind clusters. This is install-time
equivalence on that profile; it is not an any-cluster or any-values claim.

## Hook Lifecycle Proof

The chart's admission-webhook cert patch jobs are the hooks. Status in the
maintained queue (`data/hook-lifecycle/top100-hooks.csv`):
`lifecycle-disposition: lifecycle-observed`, `receipt_status: observed`, with
the route hints preserved (preflight-or-presync, postsync check,
upgrade action with receipt, ordering and cleanup-policy preservation,
webhook readiness observation). This is the strongest hook evidence in the
corpus — and it is one chart's hooks observed on one profile, with the
standing next action "keep receipt fresh when chart, base, or cluster
version changes." It does not generalize to other charts' hooks.

## CRD / Webhook Lifecycle Proof

- CRD **install** behavior is covered by the live lanes and the explicit
  `no-crds` base; CRD ownership is a recorded user decision.
- CRD/webhook **runtime** lifecycle observation (controller-owned cert
  injection, conversion behavior) is demonstrated on cert-manager and
  External Secrets (`data/lifecycle-observations/cert-manager-eso/`), not yet
  receipted for this chart's own operator/webhook pair.
- CRD **upgrade** desired-state delta now has a committed render-level
  receipt for the pending 85.3.3 → 86.1.0 candidate
  ([`kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml`](../../data/serious-chart-reviews/kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml),
  regenerable via `node scripts/kps-crd-upgrade-delta.mjs --verify`): 6 of 10
  CRDs change, every change is an additive schema property path (none
  removed), and no version entry, served/storage flag, or conversion strategy
  changes. That is the desired-state half of the classic
  kube-prometheus-stack upgrade footgun; the **runtime** half (live upgrade,
  controller compatibility, stored objects) still has no receipt.

## Production Support State

From `data/production-disposition/` the chart is `production-review-ready`
with 7 dispositions accepted and 0 open. From
`data/production-support-decisions/prometheus-community-kube-prometheus-stack/support-decision.yaml`,
the `default` base is supported for one declared target scope:
`cub-lk-kind-vanilla`, namespace `monitoring`, ConfigHub OCI delivery, and
Argo.

That support decision records a mutable-image exception, scan/security
acceptance, lifecycle decision, target-fact decision, and fresh ConfigHub
OCI/Argo evidence for the declared scope. Stricter environments may still need
a hardened or digest-pinned base.

The `no-crds` base remains a separate support decision. Its GitOps/OCI runtime
receipt is valuable because it blocks when target CRDs are missing; support for
that base requires compatible external CRDs, the admission Secret, and fresh
target evidence.

## Claims That Must Not Be Made Yet

- "Production-supported for every target" — the supported decision is
  target-scoped to one declared kind/namespace/OCI/Argo path.
- "Upgrades are proven" — the committed CRD upgrade receipt is a
  desired-state delta between two renders. No live upgrade has been run; the
  runtime claim stays unmade.
- "Hooks are solved" — this chart's hooks are observed on one base and
  profile; the claim is per-chart, per-profile, freshness-bounded.
- "Works on any Kubernetes" — every live claim is bounded to the 1.30
  capability profile; this chart's CRDs are exactly where profile drift
  bites.
- "All blast radius is measured" — one value path is measured at accuracy
  1.000; the value-source-map backlog (e.g. `grafana.adminPassword`) is
  recorded as not measured.

## Suggested Next Receipts

In value order: (1) a **live** upgrade receipt 85.3.3 → 86.1.0 on kind — the
committed render-level CRD delta (all-additive) is the input that makes that
run well-scoped; (2) a `no-crds` support receipt with compatible external CRDs
and the admission Secret staged; (3) runtime webhook lifecycle observation for
this chart's own operator, reusing the cert-manager/External Secrets pattern;
(4) a hardened or digest-pinned base for stricter environments that should not
reuse the public proof scope's mutable-image and scan exceptions.
