# Per-Chart Fact-Sheet Spec

**UNOFFICIAL/EXPERIMENTAL** — design spec for the public per-chart page.

This is the detailed spec for the website Chart Page in
[dedicated-website-plan.md](./dedicated-website-plan.md) §3: the section list,
the exact data source each field pulls from, and a **solid / partial /
needs-more-testing** status per item so the build renders what is real first and
labels the rest honestly.

It is the union of per-chart surfaces already produced under `data/`. The
backbone that already joins most of it per chart is
`data/chart-evidence-router/router.csv`.

## The core principle: two columns, not one

A user needs **level of support** (the claim) next to **evidence depth** (the
substantiation + freshness) — never one without the other. "Supported for scope
X" is only trustworthy beside "proven on lanes A,B; C is watch; D untested, as
of <date>." Evidence depth is the honesty that beats "helm just runs": not just
*works*, but *how much we have proven and where the edge of evidence is*.

Status legend: **solid** = data exists and is stable, render now. **partial** =
data exists but coverage is uneven across charts. **needs-more-testing** =
depends on live lanes / fresh evidence; render with freshness and a "what more
testing adds" note.

## A. Identity & origin

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Chart / version / source digest | which chart, pinned to what | `recipes/<repo>/<chart>/<ver>/source-lock.yaml`; matrix `source_lock_path` | solid |
| Upstream currency | is this current vs upstream | `data/refresh-survival/refreshes.csv` | partial (top-20) |
| Dependency provenance | chart-own vs vendored subcharts; where objects come from | `data/remote-dependency-closure/top100.csv`; `recipes/.../dependency-lock.yaml` | partial |
| Image pinning | digest-pinned vs mutable (reproducibility/security) | `data/image-digest-workdown/` | partial |

## B. Support level (the claim)

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Catalog tier / adoption bucket | use now / promote / needs-variant / limitation-first | matrix `catalog_tier`,`adoption_bucket`; `data/chart-use-guide/chart-use-guide.csv` | solid |
| Production decision + target scope | supported where, for what | `data/production-support-decisions/decisions.csv` | partial (top-20) |

## C. Evidence depth (the substantiation) — the "with more testing?" column

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Lane results (render / in-ConfigHub / local-live / GitOps-OCI / live Helm-vs-ConfigHub / two-cluster) | how much is proven | matrix `lane_*`; `data/outcome-coverage/base-outcomes.csv` | partial → needs-more-testing (live lanes) |
| Freshness | how fresh the evidence is | receipt timestamps; `generated-at`; matrix evidence-version cols | needs-more-testing |
| What's `todo`/`watch`/`blocked` = what more testing would add | the edge of evidence | matrix lane statuses; `data/disposition-frontier/` | solid (the gap is measured) |

## D. Variants / bases

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Available bases + recommended first | which shape to use | `data/top20-base-readiness/base-readiness.csv`; `data/variant-path-coverage/` | solid (top-20) / partial (beyond) |
| Derived variants | target-bound clones | `data/outcome-coverage/derived-variant-outcomes.csv` | partial |

## E. Quirks & hidden behaviors, and their dispositions

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Hook / lifecycle routes (route, execution mode, default, off-ramps, safe-to-automate) | where hooks/hidden behavior go, who runs them | `data/lifecycle-routes/routes.json` | solid contract; **partial coverage** (hook source covers 13 charts) |
| Quirk features present | what hidden behaviors exist | `data/chart-facts/chart-facts.csv`; matrix `quirk_features` | solid |
| Quirk-axis treatment | how each quirk class is handled | `data/quirk-coverage/coverage.csv` | solid (per-axis) |

## F. Mitigations

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Known pain & how the catalog handled it | the rough edges and the route taken | `recipes/.../helm-pain-report.yaml`; `recipes/.../weirdness-and-mitigations.md` | partial (per-chart coverage uneven) |

## G. What you must provide or decide

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Target facts / prerequisites | what you must supply before apply | `data/top20-base-readiness` (target facts); chart-facts `required_values`; lifecycle-routes `target-facts` routes | partial |
| Per-target decisions | what you must choose (catalog names it, doesn't guess) | lifecycle-routes `per-target` rows; `data/production-support-decisions` target scope | partial |

## H. Help & next step

| Field | User learns | Data source | Status |
| --- | --- | --- | --- |
| Applicable skill(s) | is there a playbook for this chart | `data/chart-skills/skills.json` | solid (advisory) |
| Try-it command + next action | how to start | matrix `start_command`/`next_action`; `data/chart-use-guide/` | solid |
| Claims vs explicit non-claims | the trust boundary | `data/claims-register/claims.csv`; `docs/user/what-we-refuse-to-claim.md` | solid |

## Build sequencing

1. **Render the solid items now** — identity, support level, variants, quirks &
   dispositions (lifecycle-routes is already on the chart page), skills (after
   the chart-skills mapping lands), claims, try-it.
2. **Add evidence depth with freshness** — lanes + the `todo`/`watch`/`blocked`
   edge, dated. This is the column that makes the support claim trustworthy.
3. **Fill mitigations and prerequisites where coverage exists**, and mark the
   rest `needs-more-testing` rather than hiding it.

Honest defaults: never imply automatic execution unless `execution_mode =
product-executes` with evidence; never show a support level without its evidence
depth; show "none recorded" explicitly rather than omitting a section.
