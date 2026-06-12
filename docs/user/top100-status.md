# Top-100 Status, In Plain English

**UNOFFICIAL/EXPERIMENTAL**

This page answers the questions a Helm user actually asks about the top-100
charts. The numbers come from the generated
[top-100 user-readiness data](../../data/top100-user-readiness/summary.md);
this page explains what they mean. Counts below are the snapshot at writing —
trust the generated file over this prose.

This is the user-facing view of the same data summarized in
[Top-100 Readiness](../../data/top100-readiness/summary.md). The readiness
summary has four operating buckets. This page splits the promotion-review
bucket into two practical user cases: charts that mostly need target inputs,
and charts that need operator review before they are presented as a catalog
offer.

| User-facing group | Readiness bucket | Charts |
| --- | --- | ---: |
| `ready-to-try` | `try-from-public-catalog` | 20 |
| `works-with-target-prerequisites` | `promote-after-review` | 13 |
| `works-with-operator-review` | `promote-after-review` | 14 |
| `needs-better-base-variant` | `needs-useful-variant` | 46 |
| `not-ready-yet` | `limitation-decision-first` | 7 |

## Can I use these charts today?

It depends which of five groups the chart is in:

| Group | Charts | What it means for you |
| --- | --- | --- |
| ready-to-try | 20 | Yes. Catalog-supported, a reviewed first base, live evidence on a local cluster. Pull it and inspect the exact objects. |
| works-with-target-prerequisites | 13 | Yes, once you provide something: usually an existing Secret, a StorageClass, or a CRD ownership choice. The render proof already holds. |
| works-with-operator-review | 14 | Probably, but have an operator read the chart's named review item (hooks, lifecycle, HA shape) before relying on it. |
| needs-better-base-variant | 46 | Not as a supported offer. The mechanism is proven, but the install shape you probably want has not been built and reviewed yet. |
| not-ready-yet | 7 | No. A named limitation needs a support / disclose / defer decision first. The chart may work fine under plain Helm; this catalog will not yet vouch for it. |

## Which ones are easiest?

The 20 catalog-supported charts. Each has a reviewed `start-here` base — the
shortest list is
[the start-here table](../../data/top20-base-readiness/start-here.md). Redis is
the small teaching example; kube-prometheus-stack is the deliberately hard one
(CRDs, webhooks, RBAC, generated facts) kept in the catalog to show the model
under real complexity.

## Which top-100 charts are closest next?

The current fast-track promotion candidates are
`elastic/logstash@8.5.1` and `prometheus-community/alertmanager@1.37.0`.
Both have render proof, two-cluster kind parity, clean scan/gate state, and
selected live Helm-vs-ConfigHub parity evidence.

They are still not catalog-supported. The remaining user-relevant decision is
operational: open the generated storage/rollback review, choose the target
boundary for backup, restore, retention, rollback, and storage-class fit, then
record a target-scoped support decision.

Use the generated fast-track page for the current list:
[Top-100 Promotion Fast Track](../../data/top100-promotion-wave/fast-track.md).

## Which ones need cluster prerequisites?

Charts whose gap is something only you can supply: an existing Secret the
chart refuses to generate, a StorageClass decision, CRD ownership, webhook or
cert readiness. The per-chart "you provide" column in the
[user-readiness summary](../../data/top100-user-readiness/summary.md) lists
exactly what, and the live lanes check those prerequisites against a real
cluster before anything claims to work.

## Which ones are hard because of hooks, CRDs, secrets, or storage?

Every chart's quirk flags are in the readiness data, and the
[Helm Quirk Support Matrix](../reference/helm-quirk-support-matrix.md) says how
each quirk class is handled at each lifecycle stage. The honest version:

- **Hooks** are classified and routed (desired objects, pre-install
  prerequisite, post-install lifecycle, controller-owned runtime, or
  unsupported/manual). Routing receipts exist; hook *execution* receipts do
  not yet.
- **CRDs** are split into explicit bases and checked live; Kubernetes-version
  capability mismatches become published watch rows instead of silent passes.
- **Generated secrets** are rendered for proof, separated out of the published
  artifact, and verified present before and after install.
- **Storage** choices are base variants plus a StorageClass you provide; PVC
  binding is checked at runtime.

## How does this differ from plain Helm?

With plain Helm you approve inputs — a values file — and find out later what
they produced. Here you approve outputs:

- the exact rendered objects, proven equivalent to regular Helm for the same
  chart, values, and flag profile;
- named base variants instead of ad-hoc values drift, and derived variants for
  environment/region/customer changes that never re-render Helm;
- receipts at each boundary (render, upload, delivery, live observation), so
  "deployed" and "working" stay distinct claims;
- failures that surface as routed watch/blocked rows with a next action,
  instead of silent drift off the chart's supported path.

What plain Helm still does better today: anything in the
`needs-better-base-variant` group — until someone builds and reviews the
install shape you want, `helm install` with your own values is the more direct
route, with the trade-offs above.

## Where to look next

- [Top-100 user-readiness summary](../../data/top100-user-readiness/summary.md) — per-chart detail behind every claim here.
- [Methodology and limits](../reference/top100-user-readiness.md) — how the groups are derived, and what they refuse to infer.
- [Current proof status](./current-proof-status.md) — the question-to-file evidence map.
- [What we refuse to claim](./what-we-refuse-to-claim.md) — why the blocked rows are the trust model.
