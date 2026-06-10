# Helm Pain Points

**UNOFFICIAL/EXPERIMENTAL**

This project tracks Helm pain points in two ways.

First, it keeps a general matrix that explains how the model addresses common
Helm problems:

```text
data/pain-point-coverage/pain-points.csv
data/pain-point-coverage/summary.md
```

Second, each supported chart has its own pain report:

```text
recipes/<repo>/<chart>/<version>/helm-pain-report.yaml
```

The general matrix says what kind of problem we are dealing with. The per-chart
report says how that problem appears in a real chart and what the current
disposition is.

## The Short Version

Helm is a generator. One chart plus one set of values can produce many
Kubernetes objects. Some values touch many objects and fields. After render,
the output no longer explains clearly which input produced which field.

helm-expt addresses that by turning the render into explicit artifacts:

```text
source lock
dependency lock
effective values
named base variant
rendered objects
object inventory
Helm-equivalence receipt
scan/gate receipts
pain report
optional live receipts
```

That does not solve every Helm problem by itself. It makes each problem visible
and routes it to the right place.

## Where The Answer Lives

| Problem kind | Home |
| --- | --- |
| Chart source, dependency, values, render, and object inventory | helm-expt |
| Reviewed package/base that can be rendered or uploaded | `cub installer` |
| Managed desired state, variants, links, approvals, changesets | ConfigHub Server |
| Live state, drift, readiness, freshness | `cub-scout` and controllers |
| Private values, private overlays, old-version patches, production SLAs | managed/commercial lane |

## General Model

The general answer is the same for every chart:

```text
Helm chart or wrapper chart
-> cub installer recipe/package
-> named base variant
-> exact rendered object revision
-> scans, gates, and receipts
-> ConfigHub Units and optional derived ConfigHub variants
-> OCI/GitOps handoff
-> cub-scout, controller, or other observation receipts
```

`helm-expt` is the public proof corpus: chart analysis, recipes, variants,
rendered objects, receipts, and pain reports.

`cub installer` is the executable package path: setup, render, package, upload,
and verify the reviewed bases.

ConfigHub Server is the managed operations layer: Units, variants, links,
changesets, approvals, diffs, receipts, search, and governance.

GitOps controllers apply or pull the published desired state. `cub-scout` and
other observers provide fresh live evidence. Workerless ConfigHub should not
claim current cluster truth without a fresh observation receipt.

## Per-Chart Proof

The general model is not enough by itself because Helm pain is chart-specific.
Each maintained chart has a chart-level report:

```text
recipes/<repo>/<chart>/<version>/helm-pain-report.yaml
```

That file answers:

```text
What chart behavior caused pain?
Where did it land in the model?
Which variants are supported?
Which receipts prove the current claim?
What remains blocked, partial, or operator-reviewed?
```

Examples:

| Chart | Pain report |
| --- | --- |
| Redis | [recipes/bitnami/redis/25.5.3/helm-pain-report.yaml](../../recipes/bitnami/redis/25.5.3/helm-pain-report.yaml) |
| cert-manager | [recipes/jetstack/cert-manager/v1.20.2/helm-pain-report.yaml](../../recipes/jetstack/cert-manager/v1.20.2/helm-pain-report.yaml) |

## The 15 Pain Points

This is the user-facing view of the generated matrix in
[`data/pain-point-coverage/pain-points.csv`](../../data/pain-point-coverage/pain-points.csv).
The status column is deliberately conservative. "Strong" means there is current
catalog evidence for the supported scope. "Partial" means the route is defined
but still depends on live evidence, product work, or chart-specific review.

### Go-templated YAML

Root cause: Helm templates are string-producing programs whose structure is
discarded after render.

Current proof or representation: Render to explicit Kubernetes objects, keep
object inventories, and record Helm-equivalence receipts. Status:
`strong-current-proof`. Evidence:
recipes/*/*/*/revisions/*/r001/receipts/helm-equivalence-receipt.yaml;
data/outcome-coverage/base-outcomes.csv.

Handoff: ConfigHub stores rendered objects as typed Units with revisions, diffs,
links, gates, and approvals. Installer packages the reviewed render as a named
cub installer base. Live observation checks whether the applied objects exist
and remain fresh.

Remaining gap: Complex template behavior is still chart-specific; provenance is
not field-complete for every chart.

### values.yaml sprawl

Root cause: Chart defaults, values files, globals, subcharts, and overlays make
effective inputs hard to see.

Current proof or representation: Record effective values, value models,
value-source maps where present, and named base variants. Status:
`strong-for-supported-bases`. Evidence: recipes/*/*/*/effective-values*.yaml;
recipes/*/*/*/variants/*/variant.yaml; data/outcome-coverage/base-outcomes.csv.

Handoff: ConfigHub turns chosen bases into managed variants with explicit
parameters, labels, and links. Installer exposes supported bases rather than
unbounded ad hoc values combinations. Live observation confirms target facts and
live outcomes for a selected variant.

Remaining gap: Arbitrary user values and wrapper overlays need managed import or
a new base variant.

### State lives in cluster secrets

Root cause: Helm release history is stored as cluster state rather than a
durable desired-state graph.

Current proof or representation: Keep pinned rendered object sets, receipts,
source locks, dependency locks, and package receipts outside Helm release state.
Status: `partial-handoff`. Evidence: data/outcome-coverage/chart-outcomes.csv;
data/runtime-gitops/summary.md; data/live-kind-parity/summary.md.

Handoff: ConfigHub stores desired state, revisions, approvals, changesets,
links, and operation receipts. Installer uploads reviewed objects as ConfigHub
Units and package records. Live observation compares intended object sets with
observed live resources.

Remaining gap: Queryable operation history and authority are ConfigHub Server
concerns, not helm-expt alone.

### Failed upgrades wedge releases

Root cause: Helm upgrade state and three-way merge can leave release state
wedged or ambiguous.

Current proof or representation: Compute upgrade and rollback diffs where
represented; record simulation receipts and risk notes. Status: `partial`.
Evidence: recipes/*/*/*/operations/*/*receipt.yaml;
data/variant-path-coverage/coverage-matrix.csv.

Handoff: ConfigHub operates on approved desired revisions with changesets and
explicit rollback targets. Installer applies or uploads selected package bases
rather than mutating Helm release state. Live observation checks convergence,
drift, and stale live objects after upgrade paths.

Remaining gap: Real upgrade/prune behavior and rollback semantics require live
controller evidence.

### CRD handling

Root cause: Helm installs CRDs specially and does not manage CRD upgrades
cleanly.

Current proof or representation: Expose CRDs in object inventories, provide
no-crds bases where useful, and flag CRD lifecycle risk. Status: `partial`.
Evidence: data/hook-lifecycle/summary.md;
data/outcome-coverage/feature-outcomes.csv; recipes/*/*/*/helm-pain-report.yaml.

Handoff: ConfigHub gates CRD ownership and upgrade decisions before promotion.
Installer packages CRD/no-CRD bases and preserves declared lifecycle policy.
Live observation checks CRD presence, API availability, and webhook readiness.

Remaining gap: CRD upgrade behavior remains an operator-reviewed lifecycle path.

### Subchart and dependency hell

Root cause: Umbrella charts, aliases, globals, and dependency closures hide
where rendered objects come from.

Current proof or representation: Record dependency locks and chart dossiers; add
scanner axes for alias, import-values, and library charts. Status: `partial`.
Evidence: recipes/*/*/*/dependency-lock.yaml; data/chart-facts/chart-facts.csv;
docs/reference/quirk-coverage.md.

Handoff: ConfigHub represents component relationships and cross-object links in
the desired-state graph. Installer packages the reviewed dependency closure as
the supported artifact. Live observation checks whether dependency-owned objects
are healthy after apply.

Remaining gap: Dependency aliases and import-values need stronger scanner
coverage.

### No field-level governance

Root cause: Rendered YAML loses intent and field provenance unless captured at
render time.

Current proof or representation: Record value-source maps where available and
recover field reachability into graph fragments. Status:
`partial-strong-on-redis`. Evidence:
recipes/bitnami/redis/25.5.3/value-source-map.yaml; data/edge-recovery/edges.csv.

Handoff: ConfigHub uses Units, links, TransformPaths, functions, gates, and
mutation sources for field-level control. Installer keeps package bases bounded
and reviewed before upload. Live observation reports live drift at object/field
level where supported.

Remaining gap: Field-complete provenance is not yet available for every chart.

### No native secrets story

Root cause: Helm can generate or reference secrets, but GitOps and config stores
need explicit secret handling policy.

Current proof or representation: Classify generated facts and target facts;
provide generated-secret and existing-secret bases. Status: `partial-known-gap`.
Evidence: recipes/bitnami/redis/25.5.3/install-checks.yaml;
data/outcome-coverage/feature-outcomes.csv;
data/live-helm-confighub-compare/summary.md.

Handoff: ConfigHub stores secret references, requirements, gates, and receipts
rather than silently hiding credentials. Installer separates rendered Secrets
from uploaded manifests where required and enforces externalRequires/preflight
where available. Live observation checks required Secret presence and workload
start success.

Remaining gap: Secret delivery on GitOps paths needs hard gates and production
policy.

### Hooks are brittle

Root cause: Helm hook resources depend on phase, ordering, cluster state, and
delete policy outside plain desired YAML.

Current proof or representation: Detect hook-bearing charts and classify
lifecycle routes; do not claim hook execution from render parity. Status:
`partial-doctrine`. Evidence: data/hook-lifecycle/top100-hooks.csv;
docs/user/hook-lifecycle-strategy.md.

Handoff: ConfigHub represents lifecycle actions, approvals, and receipts as
explicit desired operations. Installer executes or hands off lifecycle steps
only where the route is supported. Live observation checks post-hook resources,
readiness, and failure conditions.

Remaining gap: Hook execution receipts are not complete for the hook-bearing
catalog.

### Multi-environment promotion is DIY

Root cause: Helm values files do not provide a durable variant model or
promotion record.

Current proof or representation: Provide named bases, variant diffs, promotion
examples, and target-bound derived variant receipts. Status: `partial`.
Evidence: docs/user/creating-variants.md;
docs/user/prometheus-overlay-promotion-example.md;
data/derived-variant-target-bound/summary.csv.

Handoff: ConfigHub uses spaces, Units, labels, links, `cub variant create`,
approvals, and changesets for derived variants. Installer supplies the reviewed
base that derived variants clone or refine. Live observation checks each target
after promotion.

Remaining gap: High-fanout propagation and override-protection need a stronger
demo.

### GitOps impedance mismatch

Root cause: Helm may render in different places, while GitOps controllers apply
or re-render under their own context.

Current proof or representation: Render once, publish signed/pinned object sets,
and prove the render under a declared flag profile. Status: `partial-live-lane`.
Evidence: data/runtime-gitops/summary.md;
data/live-helm-confighub-compare/summary.md.

Handoff: ConfigHub tracks desired revision and handoff target as managed state.
Installer publishes/uploads package bases into ConfigHub/OCI paths. Live
observation checks Argo/Flux sync and live object state.

Remaining gap: Controller-specific live proof is not complete for every base
variant.

### History without diffs

Root cause: Helm history records revisions but not durable object/field-level
explanations.

Current proof or representation: Store variant revisions, object inventories,
diffs, receipts, and operation simulations. Status:
`strong-static-partial-operational`. Evidence: recipes/*/*/*/diffs/*.yaml;
recipes/*/*/*/revisions/*/r001/variant-revision.yaml.

Handoff: ConfigHub provides queryable revision history, changesets, approvals,
and diff views. Installer records package/action receipts. Live observation
records observed live receipts against intended revisions.

Remaining gap: Fleet-wide query and operation history belong in ConfigHub
Server.

### Templating language limits

Root cause: Complex helper macros, tpl, raw manifests, and conditionals make
behavior hard to audit.

Current proof or representation: Surface tpl/raw/extension slots and keep
supported bases bounded. Status: `partial`. Evidence:
data/outcome-coverage/feature-outcomes.csv; recipes/*/*/*/helm-pain-report.yaml.

Handoff: ConfigHub moves post-render customization to typed Units, links,
functions, and views where possible. Installer rejects or gates unbounded
extension slots for supported catalog entries. Live observation checks live
effects of extension-derived objects.

Remaining gap: Not every template-language feature is field-provenanced yet.

### Dry-run does not match reality

Root cause: Admission, defaulting, controllers, webhooks, and API availability
affect stored/live state after render.

Current proof or representation: Keep render proof separate from live proof and
record target facts/capability profile. Status: `partial-live-dependent`.
Evidence: docs/user/verification-lanes.md; data/live-kind-parity/summary.md;
data/lifecycle-observations/cert-manager-eso/summary.md.

Handoff: ConfigHub gates promotion on target facts, approvals, and observation
policy. Installer runs preflight and target-fact collection where available.
Live observation checks live state, freshness, API readiness, and workload
health.

Remaining gap: Admission/defaulting parity is target-specific and requires live
observation.

### Chart ownership and fork burden

Root cause: Small local changes often force teams to fork charts or maintain
fragile overlays.

Current proof or representation: Route shape-changing changes to new bases and
post-render changes to derived ConfigHub variants. Status:
`partial-product-lane`. Evidence: docs/user/change-routing-before-oci.md;
docs/user/custom-overlays.md; docs/user/creating-variants.md.

Handoff: ConfigHub supports Creator flows, TransformPaths, functions, labels,
links, and approvals over rendered Units. Installer provides maintained public
and managed recipe bases. Live observation confirms the derived or promoted
variant reached the target.

Remaining gap: Creator UX and managed imports are product work beyond current
static catalog proof.

## What To Read

| Question | File |
| --- | --- |
| Which Helm pains are tracked? | [pain-points.csv](../../data/pain-point-coverage/pain-points.csv) |
| What is the summary? | [summary.md](../../data/pain-point-coverage/summary.md) |
| What does this chart specifically do? | `recipes/<repo>/<chart>/<version>/helm-pain-report.yaml` |
| Which proof lanes pass per base? | [base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| Which paths still need proof? | [coverage-matrix.csv](../../data/variant-path-coverage/coverage-matrix.csv) |

## Examples

Redis is the fast teaching chart. It shows the difference between a generated
credential base and a reuse-existing-secret base.

kube-prometheus-stack is the main hard chart. It shows why the model matters
for CRDs, webhooks, RBAC, dependencies, high object count, and blast radius.

The user should not need to read every receipt. The catalog should answer:

```text
What variant should I use?
What objects will it install?
What Helm pain is known for this chart?
What has been proven?
What still needs a human decision or live evidence?
```
