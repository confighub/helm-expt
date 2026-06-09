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

Start with the target-scoped support decisions:

- [Production Support Decision Artifacts](../../data/production-support-decisions/summary.md)
- [Production Support Work Items](../../data/production-support-decisions/work-items.csv)
- [Production Support Decisions CSV](../../data/production-support-decisions/decisions.csv)

Use the older production-disposition outputs when you need the accepted
pre-review receipts or the original decision contract:

- [Production Disposition](../../data/production-disposition/summary.md)
- [Production Support Decision Contract](../../data/production-disposition/support-decision-contract.md)
- [Production Next Actions](../../data/production-disposition/next-actions.csv)

Then work the target-scoped row by decision field:

Use `work-items.csv` when you want assignable rows. One chart can have several
rows because image, scan, lifecycle, runtime, and fresh-evidence work can be
owned and closed separately.

| Decision field | What to do |
| --- | --- |
| `image_decision` | Pin images by digest or record the explicit exception for the supported scope. |
| `scan_decision` | Decide which findings are accepted, fixed, hardened, or outside the supported target scope. |
| `lifecycle_decision` | Decide which lifecycle behavior is supported, observed, excluded, or operator-owned. |
| `target_fact_decision` | State required CRDs, APIs, Secrets, storage, or other target prerequisites. |
| `live_evidence_decision` | Refresh target-scoped live evidence, or close the runtime/missing-lane/lifecycle decision first. |

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

## Current Decisions

The current queue has support decision artifacts for all top-20 catalog
charts:

```text
data/production-support-decisions/<chart>/support-decision.yaml
```

The current generated summary is:

```text
decision artifacts: 20
supported decisions: 16
draft decisions: 0
rejected decisions: 2
superseded decisions: 2
open work items: 0
```

Each decision names:

```text
base variant
target scope
delivery path
accepted evidence and risk decisions
what remains operator-owned or out of scope
next action
```

The generated summary is:

```text
data/production-support-decisions/summary.md
```

The verifier checks that every row in the production support queue has its
named decision artifact. That keeps the support surface actionable instead of
being a loose spreadsheet.

## Current Decision Groups

| Group | Charts | What it means |
| --- | ---: | --- |
| `supported` | 16 | The named chart/base/target/delivery scope has fresh evidence and an explicit operating boundary. |
| `superseded` | 2 | The proof remains useful, but the upstream chart source is deprecated and should not be promoted as production-supported. |
| `rejected` | 2 | The default base remains parity evidence, but it is not a good production support boundary. |
| `draft` | 0 | No top-20 chart is waiting on an unmade support decision. |

The next production work is specific:

- keep evidence fresh for the 16 supported scopes;
- choose maintained successor sources for Grafana and Tempo;
- create a production Vault base with init/unseal, storage, TLS, backup/restore,
  and an operator runbook;
- create an ingress-nginx support scope that matches the target environment,
  such as real LoadBalancer behavior or a deliberately admission-disabled
  topology.

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
