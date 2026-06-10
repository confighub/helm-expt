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
- CRD **upgrade** behavior across chart versions (the classic
  kube-prometheus-stack footgun) has no committed receipt yet.

## What Production Support Still Needs

From `data/production-disposition/` (state: `production-review-ready`,
7 dispositions accepted, 0 open) and the support-decision queue (state:
`not-production-supported`, focus `security-acceptance-or-hardened-base`):

- **Security acceptance or a hardened base** — 54 external scan findings need
  recorded acceptance or a hardened base variant; scan priority `high`.
- **Image digest work** — rendered image references need digest resolution or
  overrides for reproducible production OCI support
  (`data/image-digest-workdown/`).
- **Target-scoped decision** — production support is per target scope; none
  is recorded as supported yet.

## Claims That Must Not Be Made Yet

- "Production-supported" — it is production-review-ready with a named
  security decision outstanding; those are different states.
- "Upgrades are proven" — no CRD/chart upgrade receipt exists for this chart;
  only install-time lanes are committed.
- "Hooks are solved" — this chart's hooks are observed on one base and
  profile; the claim is per-chart, per-profile, freshness-bounded.
- "Works on any Kubernetes" — every live claim is bounded to the 1.30
  capability profile; this chart's CRDs are exactly where profile drift
  bites.
- "All blast radius is measured" — one value path is measured at accuracy
  1.000; the value-source-map backlog (e.g. `grafana.adminPassword`) is
  recorded as not measured.

## Suggested Next Receipts

In value order: (1) the security acceptance / hardened-base decision (it
gates the support state); (2) a CRD upgrade receipt across two pinned chart
versions; (3) runtime webhook lifecycle observation for this chart's own
operator, reusing the cert-manager/External Secrets pattern.
