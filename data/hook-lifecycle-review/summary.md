# Top-100 Source Hook Route Review

**UNOFFICIAL/EXPERIMENTAL — hand-reviewed audit artifact, 2026-06-10.**

This is an independent review of hook-bearing charts that rank inside the
top-100 of the **source scan** but are not yet modeled in the maintained hook
lifecycle queue. It does not modify the maintained queue
(`data/hook-lifecycle/`); it is input for it.

Per-chart detail: [top100-source-hook-route-review.csv](./top100-source-hook-route-review.csv).

## Method

- Hook counts, phases, example templates, and delete-policy counts come from
  the committed source feature scan
  (`data/top500-catalog-analysis/source/source-feature-scan.raw.json`), which
  statically inspects the pinned chart archives. Nothing here is a live or
  runtime claim.
- Risk class, likely route, and next action are hand-reviewed using the
  maintained queue's route vocabulary: test, preflight, Argo/Flux lifecycle
  hook, explicit managed action, upgrade action, delete cleanup, blocker.
- Reviewed charts: kubernetes-dashboard, gitlab, kafka, minio, datadog,
  thanos, airflow, kong (the source-scan hook-bearing set named for review).

## Findings

1. **None of the eight are in the maintained hook queue.** The queue currently
   models five charts (kube-prometheus-stack, kyverno, fluent-bit,
   tigera-operator, gatekeeper). All eight reviewed charts sit outside it, and
   none is a blocker: every observed hook fits an existing route.
2. **Two hook patterns cover six of the eight charts.**
   The kong database-migration pair (`pre-upgrade` + `post-upgrade`, with
   delete policies) appears standalone in kong and vendored inside
   kubernetes-dashboard. The bitnami provisioning job
   (`post-install, post-upgrade`, values-conditional) appears in kafka, minio,
   and vendored inside thanos. Modeling those two patterns once would cover
   most of this set.
3. **Hooks arrive through the dependency closure.** kubernetes-dashboard,
   thanos, and gitlab carry their hooks in vendored subcharts (kong, minio,
   traefik). Chart-level hook review must therefore include vendored
   subcharts, or it undercounts.
4. **A scan zero is not a hook-free claim.** The airflow chart shows zero
   `helm.sh/hook` annotations at the pinned version but ships two plain
   migration-style Jobs; some hook usage in popular charts is
   values-conditional. The next action records that recipe-time verification,
   not this scan, is what can claim hook-free behavior.
5. **One environment-conditional route.** The datadog GKE Autopilot allowlist
   synchronizers are preflight work only on a specific cluster class; the
   migration job is a normal upgrade action. Routes can differ per target.

## Boundaries

- Static source analysis only. No hook was executed or observed for these
  eight charts, and nothing here claims runtime behavior.
- The maintained queue's roster and receipts are unchanged by this review.
- Counts reflect the pinned versions in the source scan; new chart versions
  can change hook usage.
