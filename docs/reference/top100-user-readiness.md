# Top-100 User Readiness: Methodology

**UNOFFICIAL/EXPERIMENTAL**

This page documents how
[`data/top100-user-readiness/readiness.csv`](../../data/top100-user-readiness/readiness.csv)
and [its summary](../../data/top100-user-readiness/summary.md) are derived.

The report is a **Helm-user-language projection of curated repo data**. It
invents no new judgments: every bucket and field is a deterministic mapping
from three committed sources. If a bucket looks wrong, the fix belongs in the
source data, not in this projection.

```sh
npm run top100:user-readiness          # regenerate
npm run top100:user-readiness:verify   # check committed outputs
```

## Sources

| Source | Used for |
| --- | --- |
| [`data/top100-readiness/readiness.csv`](../../data/top100-readiness/readiness.csv) | The curated tier/workability buckets, proof lanes, hard gaps, source feature tokens, and next actions. |
| [`data/chart-facts/chart-facts.csv`](../../data/chart-facts/chart-facts.csv) | Per-chart quirk facts for all 100 charts: hooks, CRDs, generated and existing Secrets, webhooks, extension slots, required values, install-vs-upgrade divergence. |
| [`data/top20-base-readiness/base-readiness.csv`](../../data/top20-base-readiness/base-readiness.csv) | The reviewed recommended first base for catalog-supported charts. |

## Bucket Rules

The generated [top-100 readiness summary](../../data/top100-readiness/summary.md)
uses four operating buckets. This report keeps the same source of truth, then
splits `promote-after-review` into two user-facing groups so a reader can see
whether the next step is mostly a target prerequisite or an operator review.

| User-readiness bucket | Source readiness bucket |
| --- | --- |
| `ready-to-try` | `try-from-public-catalog` |
| `works-with-target-prerequisites` | `promote-after-review` |
| `works-with-operator-review` | `promote-after-review` |
| `needs-better-base-variant` | `needs-useful-variant` |
| `not-ready-yet` | `limitation-decision-first` |

| Bucket | Rule |
| --- | --- |
| `ready-to-try` | `catalog_tier = top20-catalog-supported`. Every such chart has a reviewed `recommended_first` base whose readiness is `start-here`. |
| `works-with-target-prerequisites` | `workability = works-as-proof-needs-catalog-review` **and** the named gap text matches a prerequisite shape (existing Secret, StorageClass, CRD owner, pull secret, IngressClass). |
| `works-with-operator-review` | The remaining `works-as-proof-needs-catalog-review` charts: the gap is the review itself (hooks, lifecycle, HA teaching, variant naming), not a missing cluster input. |
| `needs-better-base-variant` | `workability = not-yet-a-good-catalog-offer`: the mechanism is proven, but the install shapes a real user wants are not built or reviewed. |
| `not-ready-yet` | `workability = decision-needed-before-promotion`: a named limitation needs a support / disclose / defer decision. |

Buckets describe **what stands between a Helm user and value on the best
known path**, not chart quality. A `not-ready-yet` chart may work fine under
plain Helm; the bucket says this catalog will not yet vouch for it.

## Field Derivations

| Column | Derivation |
| --- | --- |
| `current_proof` | `user_status` plus the populated lane fractions (render parity, local live, live parity). |
| `recommended_first_base` | The reviewed `recommended_first` base for catalog-supported charts. For everything else, the first listed variant marked `(unreviewed first guess)` — an honest hint, not a recommendation. |
| `quirks` | Union of chart-facts flags (hooks, crds, generated-secrets, existing-secret, webhooks, extension-slots, install-vs-upgrade-divergence, required-values) and `source_features` tokens (lookup, capabilities, tpl, rbac, storage, generated-facts). |
| `user_must_provide` | Assembled from the prerequisite-shaped flags: existing Secret detail, storage decision, CRD ownership choice, webhook readiness, target facts, mandatory inputs — plus the bucket-level caveat for not-ready and needs-variant rows. |
| `confighub_absorbs` | Assembled from the quirk flags: exact rendered objects with parity and receipts always; separated generated Secrets, CRD bases, hook classification and routing, reviewed extension slots, captured install-vs-upgrade divergence, lookups lifted to target facts — where flagged. |
| `next_action` | Passed through verbatim from the curated top-100 readiness row. |
| `pain_report` | The chart's Helm pain report path, for full per-chart detail. |

## Honest Limits

- `source_features` tokens (lookup, capabilities, tpl, rbac, storage) are
  currently populated for the next-80 rows, not the top-20. Top-20 quirk
  columns therefore come from chart facts only; their full quirk picture is in
  each chart's pain report.
- "ConfigHub absorbs hooks" means **classified and routed** (desired objects,
  pre-install prerequisites, post-install lifecycle, controller-owned runtime
  state, or unsupported/manual). It does not mean every hook is executed and
  proven; hook execution receipts are tracked separately.
- The prerequisite-vs-review split inside the 27 review-queued charts is a
  keyword rule over the named gap text. A misclassified row means the gap text
  should be made more explicit in the source data.
- Buckets change only when the curated sources change; this report adds no
  fresh evidence of its own.

## Related

- [Top-100 Readiness](../../data/top100-readiness/summary.md) — the curated
  planning view this projects from.
- [Top-100 Coverage](../../data/top100-coverage/summary.md) — the strict
  coverage contract per chart.
- [Top-20 Base Readiness](../../data/top20-base-readiness/summary.md) — the
  reviewed first-base table behind `ready-to-try`.
- [Helm Quirk Support Matrix](./helm-quirk-support-matrix.md) — how each quirk
  class is handled across the seven-stage lifecycle.
