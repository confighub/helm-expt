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

Use the generated [Claims Register](../../data/claims-register/summary.md)
when you want to check whether a public claim is backed, partial, planned, or
explicitly refused.

Use the generated [Master Catalog Matrix](../../data/master-catalog-matrix/matrix.html)
when you want the broad chart/version/base view in one browser page. It shows
the current user route, strongest evidence, core-lane status, production
scope, hooks, quirks, hard gap, and next action for each row.

For the remaining non-pass live rows, use the generated
[Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md). The
current queue includes target prerequisites, runtime/watch rows, image
retention rows, render-input modeling work, and 16 two-cluster semantic parity
defects that need inspection before they can become stronger live claims.

## Product Frontiers

These are the main places where the catalog is useful but the product claim is
still bounded. A chart can have strong render and live evidence while one of
these frontiers remains open.

| Frontier | Current status |
| --- | --- |
| Field-complete provenance | Blast-radius prediction is scored by a generated accuracy harness: [13 measured cases](../../data/blast-radius-accuracy/summary.md), 13 passing, 0 failing, and 0 unmeasured value-source rows. The claim remains per measured case; not every rendered field in every chart has provenance. |
| Full change authority | ConfigHub can record and gate operations, but the repo does not yet prove a complete per-field authority model for every agent or user. |
| Reverse live-to-desired flow | Live observations are recorded. Authorized live fixes flowing back into desired state are still future product work. |
| Universal hook execution | The Kube Prometheus Stack direct example proves seven fresh-install steps. Its `no-crds` base also proves the 85.3.3 to 86.1.0 upgrade through Argo CD and Flux, including CRD, certificate, workload, webhook patch, setup-Job replacement, and runtime checks. ConfigHub does not yet select that route automatically, and other charts still need their own route decisions and receipts. This is not a claim that every Helm hook in the top-100 runs automatically. |
| Fleet-wide bounded propagation | Derived variants, blast-radius cases, and promotion examples exist, but a complete fleet propagation product is still being built. |
| Signatures as trust | The [claims register](../../data/claims-register/summary.md) enforces this as reviewer discipline: no evidence means no current claim, partial stays partial, and refused claims stay visible. Signatures still prove integrity and transport only within a named signer, authority, and verification context. |

The sceptic-proofing work is also not finished. The claims register,
blast-radius scoreboard, torture suite, and environment matrix exist today.
Cluster-matrix, external reproduction, time-travel re-verification, and the
upgrade gauntlet remain open proof work.

## Find The Answer Fast

One generated file answers each common evidence question. Open the file; do
not rely on prose summaries for counts.

| Question | Open | What it gives you |
| --- | --- | --- |
| What is the broad product status of this chart, version, and base? | [Master Catalog Matrix](../../data/master-catalog-matrix/matrix.html) | One browser table with user route, strongest evidence, core lanes, production scope, hooks, quirks, hard gaps, and next action. |
| Which top-20 charts are live tested? | [Live E2E Summary](../../data/live-e2e/summary.md) | One row per chart: local kind live/e2e result and the strict witness columns. |
| Does the selected top-20 path match regular Helm in live clusters? | [Live Helm-vs-ConfigHub Parity](../../data/live-helm-confighub-compare/summary.md) | One row per selected chart/base: regular Helm compared with ConfigHub delivery and live semantic parity. |
| Which latest chart versions are ready for promotion work? | [Promotion Work Orders](../../data/latest-top20-refresh/promotion-work-orders.md) | Per-candidate work orders for newer upstream versions. |
| Which top-100 charts are covered, partial, or decision-needed? | [Top-100 Coverage](../../data/top100-coverage/summary.md) and [Top-100 Readiness](../../data/top100-readiness/summary.md) | Coverage-contract status per chart, and the adoption bucket with next action. |
| Which hard chart shows the model under serious Helm complexity? | [Serious Chart Proof](./serious-chart-proof.md), [Kube Prometheus Stack direct lifecycle proof](../../data/kps-lifecycle-route-proof/summary.md), [kube-prometheus-stack catalog page](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/CATALOG.md), [Webhook Certificate Lifecycle Evidence](../../data/webhook-cert-lifecycle/summary.md), and [Lifecycle Observations](../../data/lifecycle-observations/cert-manager-eso/summary.md) | CRDs, webhooks, RBAC, generated facts, dependency locks, a complete fresh-install sequence using the chart's actual setup Jobs, staged CRD/admission certificate evidence, live CRD upgrade rehearsal, and observed CRD/webhook/controller runtime behavior on related charts. |
| Is value-change blast radius measured or assumed? | [Blast-Radius Accuracy](../../data/blast-radius-accuracy/summary.md) | The generated harness currently scores 13 measured cases: 13 pass, 0 fail, and 0 value-source rows are unmeasured. |
| Which watch/blocked rows are trust signals, not failures? | [cub-scout Watchlist](../../data/live-e2e/cub-scout-watchlist.md) and [What We Refuse To Claim](./what-we-refuse-to-claim.md) | Routed strict-witness findings with live effect and next action, and why publishing refusals is the trust model. |
| Which public claims are backed, partial, planned, or refused? | [Claims Register](../../data/claims-register/summary.md) | One row per claim with evidence paths, scoped verifier, and the limit that keeps the claim honest. |
| Which sceptic attacks have fixtures, and which are still partial? | [Generative GitOps Fit](./generative-gitops-fit.md#sceptic-proofing-status), [Blast-Radius Accuracy](../../data/blast-radius-accuracy/summary.md), [Environment-Determinism Matrix](../../data/environment-matrix/summary.md), and [Synthetic Torture Suite](../../data/torture-suite/summary.md) | The built attack fixtures for blast radius, environment determinism, and breaker charts, plus the open cluster-matrix, external-reproduction, time-travel, and upgrade-gauntlet work. |
| Why is a live row non-pass, and what reruns it? | [Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md) | Non-pass rows separated into semantic defects, target prerequisites, runtime watch, and lifecycle work. |
| Is this chart ready for my production target? | [Production Disposition](../../data/production-disposition/summary.md) and [Production Support Decisions](./production-support-decisions.md) | What is still required per chart, and how review-ready becomes supported for one target scope. |

## Source Of Truth

The shortest generated status page is:

[Status Dashboard](../../data/status-dashboard/summary.md)

It summarizes top100 readiness, the retained top500 evidence map, proof lanes,
hook and quirk residues, derived ConfigHub variants, GitOps/OCI, and live
parity in one place.

The shortest generated answer for "can I use this chart?" is:

[Chart Use Guide](../../data/chart-use-guide/summary.md)

It gives one row per top-100 chart and routes the chart to one of four user
answers: use the public catalog now, promote after review, design a useful base
variant first, or decide a named limitation before promotion.

The compact top-20 catalog status CSV is:

[Top20 Catalog Status](../../data/status-dashboard/top20-status.csv)

It gives one row per catalog chart with supported base variants, strongest
evidence, lane counts, hard gaps, and next action.

The top-20 base readiness table is the shortest answer for which base variant
to try first:

[Top20 Base Variant Readiness](../../data/top20-base-readiness/summary.md)

It gives one row per top-20 base variant with `start-here`,
`try-with-proof`, prerequisite, runtime, or hook lifecycle status.

The next80 queue is the shortest answer for which proof-grade non-catalog chart
to promote, review, or improve next:

[Next80 Action Queues](../../data/top100-readiness/next80-queues.md)

It separates the next80 into promotion review, limitation review, and
user-shaped variant work, with source features and artifact links.

The refresh-survival report is the shortest answer for what happens when
upstream Helm publishes a newer chart version:

[Refresh Survival](../../data/refresh-survival/summary.md)

It keeps supported versions pinned, lists upstream update candidates, and shows
which candidate versions have only passed the render proof lane so far.

Production support is tracked separately from test evidence:

[Production Disposition](../../data/production-disposition/summary.md)

It shows which top-20 charts still need explicit decisions for scan/gate
warnings, lifecycle behavior, target facts, storage policy, RBAC, webhooks,
extension slots, and operating policy before they can be called
production-supported.

The shortest assignable production-support work queue is:

[Production Support Work Items](../../data/production-support-decisions/work-items.csv)

It lists one row per concrete support task or keep-fresh item. A chart can have
several rows because image, scan, lifecycle, runtime, and fresh-evidence work
can be assigned independently.

The older chart-level production queue is still useful when you want one broad
next action per chart:

[Production Next Actions](../../data/production-disposition/next-actions.csv)

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

[Outcome Coverage](../../data/outcome-coverage/summary.md)

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

The Kube Prometheus Stack direct lifecycle proof records one complete
fresh-install sequence: ten CRDs, the chart's certificate creation and webhook
patch Jobs, 124 ordinary objects, readiness checks, and cleanup:

[Kube Prometheus Stack Lifecycle Route Proof](../../data/kps-lifecycle-route-proof/summary.md)

The `no-crds` base also has an install-and-upgrade receipt through Argo CD and
Flux. Both controllers installed the same 85.3.3 staged OCI digest, moved to
the same 86.1.0 staged digest, replaced the completed setup Jobs, and passed
the recorded CRD, certificate, workload, webhook patch, and runtime checks:

[Kube Prometheus Stack Argo CD And Flux Proof](../../data/kps-gitops-lifecycle-proof/summary.md)

The controller receipt is limited to this version pair and target profile. It
does not prove rollback, long-running soak, automatic ConfigHub route
selection, or automatic post-success removal of every temporary hook resource.

The webhook certificate lifecycle summary tracks staged generated certificate
material and staged CRDs for bases where render parity is not enough to prove
the install contract:

[Webhook Certificate Lifecycle Evidence](../../data/webhook-cert-lifecycle/summary.md)

The cub-scout live witness watchlist records cases where ordinary live checks
pass but strict rendered-object/live parity finds a target capability issue:

[cub-scout Live Witness Watchlist](../../data/live-e2e/cub-scout-watchlist.md)

Accepted server-normalization rules for strict live witness checks are recorded
separately:

[Live Witness Normalization Rules](../../data/live-e2e/normalization-rules.md)

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

Strict cub-scout witness checks are routed more conservatively than ordinary
local live checks. A local live receipt can pass because the workloads converge,
while the strict witness still finds that the live API did not preserve an
authored field. Every committed strict-witness `BLOCK` must appear either in the
watchlist or in the normalization log.

In `data/live-e2e/top20-local-kind.csv`, `cubScout=observed` means the row has
committed cub-scout witness evidence summarized in the CSV. A blank `cubScout`
cell means the row still has its ordinary observation receipt, but no committed
cub-scout witness for that row. It is not a hidden pass or fail.

Receipt retention follows this policy:

- commit worked-example receipts and evidence needed by public walkthroughs;
- commit every receipt or evidence summary cited by a watchlist row;
- keep bulk transient run artifacts local when the generated summaries are the
  public surface;
- when a claim depends on live evidence, commit enough detail for a reader to
  understand the target, chart, base, result, and next action.

## Current Interpretation

The repo has complete render-parity evidence for the current recipe/base rows.
ConfigHub proof, local live proof, GitOps/OCI proof, and strict live
Helm-vs-ConfigHub proof are tracked separately because each one proves a
different outcome.

Current aggregate status:

```text
chart/base rows:                          199
helm_template_vs_installer_setup:         199 pass, 0 missing
confighub_upload_variant_scan_safe_ops:   198 pass, 1 missing
local_kind_kubectl_apply:                 148 pass
confighub_oci_argo_live:                  135 pass
live_helm_vs_confighub_dual_compare:      135 pass, 53 watch, 10 blocked
two_cluster_kind_parity:                  121 pass, 10 watch, 47 blocked
```

Those counts come from the generated lane matrix:
[Outcome Coverage](../../data/outcome-coverage/summary.md).

The missing rows are backlog. They are not failed rows. `watch` and `blocked`
mean a committed receipt exists and the lane found a target, lifecycle, or
fixture condition that still needs a decision or rerun.

GitOps/OCI live proof is tracked in two views:

- the broad outcome lane has 135 of 199 chart/base rows marked pass;
- the first runtime/GitOps wave has 11 committed controller receipts;
- 8 first-wave receipts pass and 3 are non-pass target-fit or runtime receipts;
- exact chart/base/controller status is in the generated runtime summary:
  [Runtime/GitOps Wave](../../data/runtime-gitops/summary.md).

Live Helm-vs-ConfigHub parity is selected-row evidence:

- The selected live comparison lane has 198 committed receipts.
- 135 rows pass, 53 rows are watch, and 10 rows are blocked.
- The lane currently has 0 ConfigHub/OCI semantic parity defect receipts.
- Watch and blocked rows are routed to target prerequisites, capability
  profiles, render-input modeling, image retention, runtime readiness, or
  GitOps controller review before a stronger live claim is made.
- Across the full 199-row lane matrix, use the generated outcome coverage to
  distinguish pass rows, committed non-pass receipts, and rows without a pass.
- The comparison checks regular Helm against ConfigHub delivery and records the
  expected installer-added Namespace object and any semantic object diffs.
- Exact chart/base status is in the generated summary:
  [Live Helm-vs-ConfigHub Parity](../../data/live-helm-confighub-compare/summary.md).

Strict two-cluster Helm-vs-installer parity now has 178 committed receipts:

- 121 rows pass;
- 10 rows are watch;
- 47 rows are blocked;
- 153 rows have semantic object parity;
- 16 rows currently report a semantic parity defect.

Use the generated rerun plan for the next command and expected remediation:
[Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md).

For the shortest active queue, use:
[Active Proof Queue](../../data/status-dashboard/active-proof-queue.csv).

The current rerun queue has 119 rows: 62 watch rows, 57 blocked rows, 63
ConfigHub/OCI comparison rows, 56 two-cluster kind-parity rows, and 16 semantic
parity defects. One row is documented as resolved by a separate useful base and
is no longer active rerun work.

Production support decisions are now explicit for the top-20 catalog:

- 17 of 20 top-20 charts have supported target-scoped proof scopes.
- 2 of 20 top-20 charts are superseded deprecated source charts and remain
  catalog proof evidence only.
- 0 of 20 top-20 charts have rejected target-scoped proof scopes.
- 1 of 20 top-20 charts has a draft support decision.
- 19 of 20 are production-review-ready by pre-review disposition receipt.
- 1 of 20 still has a blocked pre-review production disposition.
- 105 production-disposition receipts are accepted across 20 charts.
- external scan work has 0 remaining mutable-image rows after the current
  supported-base image pinning pass.
- the remaining high-priority scan rows are routed to explicit privileged
  infrastructure or security disposition work, not to simple image-pin fixes.
- A supported target scope is still narrow: it covers the named chart, base,
  target, delivery path, accepted risks, and live evidence rule only.

The top-20 production queue has one remaining pre-review disposition blocker:
cert-manager needs target-fact preflight closure. Vault is currently a draft
target-scoped support decision for the default base; its `dev-mode` base remains
documented as local/demo evidence rather than a production support path. The
active support view is grouped from the current target-scoped decisions.
Workstreams can overlap: one chart can need image, scan, lifecycle, and fresh
evidence work before it becomes production-supported for a target scope.

| Decision group | Charts | Meaning |
| --- | ---: | --- |
| Supported scope evidence | 17 | Keep target-scoped evidence fresh before using the supported scope as a production example. |
| Superseded source chart | 2 | Keep the existing proof as evidence, but review a maintained chart source before making a production-support claim. |
| Rejected default base | 0 | No current top-20 support decisions are rejected. |
| Draft support decision | 1 | Resolve the remaining target-scoped draft before making a production-support claim. |

Use the target-scoped decision table for exact blockers and next actions:
[Production Support Decisions](../../data/production-support-decisions/summary.md).

For the plain-English path from review-ready to production-supported, see the
user guide:
[Production Support Decisions](./production-support-decisions.md).

Use the generated production disposition table when you need the pre-review
receipts and accepted dispositions:
[Production Disposition](../../data/production-disposition/summary.md).

Use the scan workdown when the question is what kind of work a scan warning
represents:
[Scan Disposition Workdown](../../data/scan-disposition-workdown/summary.md).

Use the detailed disposition plan when you need the accepted receipts, owners,
required evidence, and unblock rules:
[Production Disposition Details](../../data/production-disposition/dispositions.md).

Use the generated support work-item queue when you want assignable production
tasks:
[Production Support Work Items](../../data/production-support-decisions/work-items.csv).

Use the generated disposition queue when you want the older one-row-per-chart
production action:
[Production Next Actions](../../data/production-disposition/next-actions.csv).

Lifecycle observation proof has started:

- 11 public top-100 source-scan rows contain Helm hooks.
- 5 maintained hook queue rows now have hook route receipts.
- 5 of those 5 queue rows have lifecycle observation receipts.
- 0 of those 5 queue rows have only partial install-lifecycle observations.
- cert-manager `default` and `crds-enabled` pass lifecycle checks for its
  `startupapicheck` hook route, CRD ownership policy, startup API readiness,
  webhook CA bundle injection, and server dry-run.
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
