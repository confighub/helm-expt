# Production Support Decisions

**UNOFFICIAL/EXPERIMENTAL**

Use this page when a chart is already `production-review-ready` and the next
question is whether ConfigHub should call one chart/base/target combination
production-supported.

Production support is not created by a green render check. It is a scoped
operating decision.

```text
chart + version
base variant
target scope
delivery path
image and scan decision
lifecycle policy
fresh live evidence
operator-owned boundaries
```

The current top-20 catalog has completed the pre-review disposition step. That
means the charts have accepted evidence for scan warnings, target facts,
lifecycle risks, extension slots, storage, RBAC, webhooks, and operating policy.
It does not mean every chart is production-supported.

## The Boundary

| State | Meaning |
| --- | --- |
| `catalog-supported` | The chart is in the public catalog with maintained bases and local-test proof. |
| `production-review-ready` | The required pre-review disposition receipts exist. A support decision can now be made. |
| `production-supported` | A target-scoped support decision has been recorded and backed by fresh evidence. |

The support decision names the exact promise. For example, it might support
`bitnami/nginx@24.0.2` with the `http-clusterip` base on a vanilla Kubernetes
cluster through ConfigHub OCI and Argo, with image digests resolved and a
freshness rule for live evidence.

That decision would not automatically support every NGINX base, every ingress
mode, every cluster type, or every private overlay.

## How To Work The Queue

Start with the generated production queue:

- [Production Support Decision Contract](../../data/production-disposition/support-decision-contract.md)
- [Production Support Decision Queue](../../data/production-disposition/support-decision-queue.csv)
- [Production Next Actions](../../data/production-disposition/next-actions.csv)
- [Production Support Decision Artifacts](../../data/production-support-decisions/summary.md)

Then work the row by decision state:

| Decision state | What to do |
| --- | --- |
| `ready-for-final-scope-decision` | Choose the supported base, target scope, delivery path, and evidence refresh rule. |
| `resolve-images-before-production-oci` | Pin images by digest or record the explicit exception for the supported scope. |
| `lifecycle-support-scope-decision` | Decide which lifecycle behavior is supported, observed, excluded, or operator-owned. |
| `security-acceptance-or-hardened-base` | Accept the current finding for the target scope or create a hardened base variant. |
| `target-runtime-scope-review` | Decide whether the runtime condition is acceptable for the target scope, then refresh live evidence. |

## Minimum Decision

A useful support decision should record at least:

```yaml
chart: bitnami/nginx
version: 24.0.2
supportedBase: http-clusterip
targetScope:
  clusterClass: vanilla-kubernetes
  namespace: nginx
  gitopsController: argo
deliveryPath: confighub-oci
imageDecision: digest-pinned
scanDecision: accepted-for-scope
lifecycleDecision: no-chart-hooks
requiredLiveEvidence:
  - live Helm-vs-ConfigHub parity for this base and target scope
  - ConfigHub OCI/Argo sync and workload observation
freshness:
  liveEvidenceTTL: 30d
supportBoundary:
  includes:
    - declared base variant
    - declared target scope
    - declared delivery path
  excludes:
    - private overlays
    - other base variants
    - unreviewed extension slots
```

That shape is an operating contract, not a new install mechanism. The actual
implementation still uses `cub installer`, ConfigHub Units, `cub variant
create` where needed, scans, changesets, approvals, OCI/GitOps, and live
observation.

## Current Draft Decisions

The current queue has draft support decision artifacts for all top-20 catalog
charts:

```text
data/production-support-decisions/<chart>/support-decision.yaml
```

These are drafts, not support claims. Each one names:

```text
candidate base
vanilla target class
ConfigHub OCI delivery path
known evidence already in the repo
image, scan, lifecycle, target-fact, and live-evidence decision state
requirements that must close before final support
```

The generated summary is:

```text
data/production-support-decisions/summary.md
```

The verifier now checks that every row in the production support queue has its
named decision artifact. That keeps the production queue actionable instead of
being a loose spreadsheet.

## First Final Candidate

NGINX remains the clean first final-support candidate:

```text
bitnami/nginx@24.0.2
candidate base: http-clusterip
draft artifact: data/production-support-decisions/bitnami-nginx/support-decision.yaml
```

That base is small, its extension slots are empty in the supported path, and
the remaining work is mainly to choose the exact target scope and refresh
evidence for that scope.

After NGINX, the queue splits into four kinds of work:

- image digest resolution for charts that need reproducible production OCI;
- lifecycle boundary decisions for stateful or controller-heavy charts;
- security acceptance or hardened bases for privileged infrastructure;
- target runtime review where a live row is `watch` or `blocked`.

## What Users Should Expect

A production-supported row should let a user answer:

```text
Which base should I use?
Which target is it supported on?
Which delivery path is covered?
Which findings or lifecycle behaviors were accepted?
What live evidence proves this exact scope?
What remains my responsibility?
```

If any of those answers are missing, the chart may still be useful, tested, and
review-ready, but it should not be called production-supported.
