# Current Proof Status

**UNOFFICIAL/EXPERIMENTAL**

Start here when you want to know what is proven today.

## Plain-English Status

The current catalog is useful, but it is not a blanket production support
claim.

```text
Top-20:
  Good public catalog examples.
  Every chart has maintained bases, proof artifacts, and at least one live lane.
  Exact proof still depends on the chart/base/lane row.

Top-100:
  Good maintained proof corpus.
  Every chart has render parity against regular Helm.
  Most charts still need catalog review, useful variants, or selected live lanes.

Top-500:
  Good reconnaissance data.
  It shows where Helm pain appears across public charts.
  It is not a maintained recipe catalog.
```

Use the catalog when you want a chart and base to try. Use the lane summaries
when you need to say exactly what has been proven for that chart/base. Use the
production disposition pages when you need to decide whether a chart is ready
for a specific production target.

## Source Of Truth

The shortest generated status page is:

[Status Dashboard](../../data/status-dashboard/summary.md)

It summarizes top100 readiness, the retained top500 evidence map, proof lanes,
hook and quirk residues, derived ConfigHub variants, GitOps/OCI, and live
parity in one place.

The compact top-20 catalog status CSV is:

[Top20 Catalog Status](../../data/status-dashboard/top20-status.csv)

It gives one row per catalog chart with supported base variants, strongest
evidence, lane counts, hard gaps, and next action.

The top-20 base readiness table is the shortest answer for which base variant
to try first:

[Top20 Base Variant Readiness](../../data/top20-base-readiness/summary.md)

It gives one row per top-20 base variant with `start-here`,
`try-with-proof`, prerequisite, runtime, or hook lifecycle status.

Production support is tracked separately from test evidence:

[Production Disposition](../../data/production-disposition/summary.md)

It shows which top-20 charts still need explicit decisions for scan/gate
warnings, lifecycle behavior, target facts, storage policy, RBAC, webhooks,
extension slots, and operating policy before they can be called
production-supported.

The shortest production work queue is:

[Production Next Actions](../../data/production-disposition/next-actions.csv)

It lists one row per top-20 chart with the recommended first base, production
decision focus, image digest status, and next action.

The scan warning workdown is:

[Scan Disposition Workdown](../../data/scan-disposition-workdown/summary.md)

It routes external scan findings into concrete production work: fix in the
installer base, add a resource policy, harden security context, explicitly
accept or split privileged infrastructure, review runtime endpoints, or decide
PDB policy.

The image digest workdown is:

[Image Digest Workdown](../../data/image-digest-workdown/summary.md)

It shows rendered image references that need digest resolution, image
overrides, or explicit proof receipts before reproducible production OCI
support.

The generated lane matrix is the authority for exact chart/version/base status:

[Lane Test Matrix](../../data/lane-test-matrix/summary.md)

The generated outcome coverage is the easiest spreadsheet-oriented entry
point for chart, base, derived variant, and feature status:

[Outcome Coverage](../../data/outcome-coverage/summary.md)

The runtime/GitOps wave tracks the first Argo/OCI live rows:

[Runtime/GitOps Wave](../../data/runtime-gitops/summary.md)

The target-bound derived variant summary tracks ConfigHub variants created from
uploaded bases and then bound to live targets:

[Target-Bound Derived Variants](../../data/derived-variant-target-bound/summary.md)

The lifecycle observation summary tracks cert-manager and External Secrets
checks that rendered YAML alone cannot prove:

[Cert-Manager And External Secrets Lifecycle Observations](../../data/lifecycle-observations/cert-manager-eso/summary.md)

The cub-scout live witness watchlist records cases where ordinary live checks
pass but strict rendered-object/live parity finds a target capability issue:

[cub-scout Live Witness Watchlist](../../data/live-e2e/cub-scout-watchlist.md)

The hook/lifecycle boundary page separates hook queue rows from hook-like
controller lifecycle observations:

[Hook And Lifecycle Boundary](../../data/lifecycle-boundary/summary.md)

The extension-slot coverage page tracks charts with raw manifests, `tpl`
snippets, sidecars, config blocks, add-on slots, or similar Helm inputs:

[Extension Slot Coverage](../../data/extension-slots/summary.md)

The top-level catalog shows what a user can browse:

[Catalog](../../CATALOG.md)

## How To Read The Status

The project has several levels of evidence:

```text
recipe/package proof
-> ConfigHub proof
-> local live Kubernetes proof
-> GitOps/OCI live proof
-> live Helm-vs-ConfigHub parity proof
-> lifecycle observation proof for controller-owned or hook-like behavior
```

A row is only proven for a lane when the lane matrix says `pass`.

Production support is stricter than a passing proof lane. A chart can be
render-equivalent, locally tested, and useful for demos while still not being
production-supported. Accepted dispositions are review input; production
support needs a final target-scoped decision.

## Current Interpretation

The repo has complete render-parity evidence for the current recipe/base rows.
ConfigHub proof, local live proof, GitOps/OCI proof, and strict live
Helm-vs-ConfigHub proof are tracked separately because each one proves a
different outcome.

Current aggregate status:

```text
helm_template_vs_installer_setup:        156 pass, 0 missing
confighub_upload_variant_scan_safe_ops:   18 pass, 138 missing
local_kind_kubectl_apply:                 21 pass, 135 missing
confighub_oci_argo_live:                  20 pass, 2 watch, 4 blocked, 130 missing
live_helm_vs_confighub_dual_compare:      18 pass, 2 watch, 0 blocked, 136 missing
```

Those counts come from the generated lane matrix:
[Lane Test Matrix](../../data/lane-test-matrix/summary.md).

The missing rows are backlog. They are not failed rows. `watch` and `blocked`
mean a committed receipt exists and the lane found a target, lifecycle, or
fixture condition that still needs a decision or rerun.

GitOps/OCI live proof has started:

- the first runtime/GitOps wave has 10 committed receipts;
- 5 first-wave receipts pass;
- 5 first-wave receipts are non-pass target-fit receipts;
- exact chart/base/controller status is in the generated runtime summary:
  [Runtime/GitOps Wave](../../data/runtime-gitops/summary.md).

Live Helm-vs-ConfigHub parity has started:

- The selected top-20 live comparison lane has committed receipts for all 20
  rows.
- 18 rows pass, 2 rows are watch, and no rows are blocked.
- A `watch` row means semantic object parity passed, but the live target still
  has a runtime, storage, controller-health, initialization, or operating-policy
  condition to review.
- The current watch rows are ingress-nginx `admission-disabled` and Vault
  `default`.
- The comparison checks regular Helm against ConfigHub delivery and records the
  expected installer-added Namespace object and any semantic object diffs.
- Exact chart/base status is in the generated summary:
  [Live Helm-vs-ConfigHub Parity](../../data/live-helm-confighub-compare/summary.md).

Strict two-cluster Helm-vs-installer parity now has committed receipts for all
40 maintained top-20 base variants:

- 32 rows pass;
- 1 row is watch;
- 7 rows are blocked by target prerequisites, runtime readiness, storage,
  hooks, or operating-policy decisions;
- 0 rows currently report a semantic parity defect.

Use the generated rerun plan for the next command and expected remediation:
[Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md).

The current rerun queue has no semantic parity defects. Its 10 non-pass rows
are grouped by the next decision needed before a rerun is useful:

| Next step | Rows | Meaning |
| --- | ---: | --- |
| runtime review | 6 | Inspect readiness, waits, storage, capacity, or application initialization. |
| stage prerequisite | 1 | Stage or model CRDs, APIs, Secrets, storage, or another target prerequisite. |
| GitOps runtime review | 1 | Inspect controller health or GitOps waits. |
| lifecycle route | 1 | Choose the hook or lifecycle observation route. |
| operating policy | 1 | Record the operating decision before expecting a different readiness result. |

Production support decisions are still open for the top-20 catalog:

- 0 of 20 top-20 charts are currently marked production-supported.
- 17 of 20 are production-review-ready pending a final support decision and
  target scope.
- 3 of 20 still need a pre-review production disposition, currently target
  fact preflight for Argo CD, External Secrets, and kube-prometheus-stack.
- 100 production-disposition receipts are accepted across 20 charts.
- external scan work has 0 remaining mutable-image rows after the current
  supported-base image pinning pass.
- the remaining high-priority scan rows are routed to explicit privileged
  infrastructure or security disposition work, not to simple image-pin fixes.
- A review-ready chart is still not production-supported until a final
  target-scoped support decision is recorded.

Use the generated production table for exact blockers and next actions:
[Production Disposition](../../data/production-disposition/summary.md).

Use the scan workdown when the question is what kind of work a scan warning
represents:
[Scan Disposition Workdown](../../data/scan-disposition-workdown/summary.md).

Use the detailed disposition plan when you need the accepted receipts, owners,
required evidence, and unblock rules:
[Production Disposition Details](../../data/production-disposition/dispositions.md).

Use the generated queue when you want the next chart-level production action:
[Production Next Actions](../../data/production-disposition/next-actions.csv).

Lifecycle observation proof has started:

- 5 maintained hook-bearing top-100 charts now have hook route receipts.
- 0 of those 5 hook routes have execution or observation receipts yet.
- cert-manager `default` and `crds-enabled` pass lifecycle checks for CRD
  ownership policy, startup API readiness, webhook CA bundle injection, and
  server dry-run.
- External Secrets `default` and `no-crds` pass lifecycle checks for CRD
  ownership policy, webhook CA bundle injection, controller-populated webhook
  Secret data, and server dry-run.
- These receipts demonstrate the lifecycle-observation pattern. They do not
  imply that all Helm hooks or controller-owned runtime behavior are supported
  automatically.

Use the hook boundary report for the current route-selected versus
lifecycle-observed split:
[Hook And Lifecycle Boundary](../../data/lifecycle-boundary/summary.md).

Target-bound derived ConfigHub variant proof has started:

- The generated target-bound derived variant summary shows the current pass and
  blocked rows:
  [Target-Bound Derived Variants](../../data/derived-variant-target-bound/summary.md).
- `NGINX-prod-us-east` was created from a clean uploaded NGINX
  `http-clusterip` base with `cub variant create --target`, applied to a
  ConfigHub OCI target, reconciled by Argo CD, and observed as a live NGINX
  Deployment in Kubernetes.
- `NGINX-customer-acme-prod` repeats that same path for a customer-derived
  NGINX variant from the reviewed `http-clusterip` base.
- `MetricsServer-prod-us-east` proves the same target-bound path for a
  cluster-service chart; the receipt records Deployment, Service, and
  APIService availability.
- `Prometheus-prod-us-east` was created from a clean uploaded Prometheus
  `server-only-ephemeral` base with `cub variant create --target`, applied to
  a ConfigHub OCI target, reconciled by Argo CD, and observed as a live
  Prometheus server Deployment in Kubernetes.
- `Prometheus-staging-eu-west` repeats that same target-bound path for a
  staging derived variant from the same reviewed Prometheus
  `server-only-ephemeral` base.
- These receipts prove the derived-variant operating path for a small web chart,
  a cluster-service chart, and a server-only observability chart across
  production, staging, and customer-derived variants: clone the reviewed base,
  bind a real target, apply the cloned workload Units, and record
  Argo/runtime evidence.
- `Redis-staging-eu-west` has a blocked target-bound receipt. The work order
  asks for a namespace change and Redis Secret delivery, but those are not yet
  represented as checked post-clone mutations or secret/fact bindings in the
  derived variant path.
- The other derived-variant receipts remain intended-state clone/link evidence
  until they have target-bound live receipts.

For the details, read the generated summaries rather than copying numbers from
this page.

## Useful Next Pages

| Question | Page |
| --- | --- |
| Where are the outcome CSVs? | [Outcomes And Tests](./outcomes-and-tests.md) |
| What are the verification lanes? | [Verification Lanes](./verification-lanes.md) |
| What can I install? | [Catalog](../../CATALOG.md) |
| How do I run the tutorial path? | [Tutorial Sequence](./tutorial-sequence.md) |
| How do variants work? | [Creating Variants](./creating-variants.md) |
| What compact work queue should we pick from next? | [Next-Ten Waves](../../data/next-ten-waves/summary.md) |
| What is the broader generated workdown? | [Attack Plan Workdown](../../data/attack-plan-workdown/summary.md) |
| What is the current execution plan? | [Large Machine Roadmap](../planning/large-machine-roadmap.md) |
