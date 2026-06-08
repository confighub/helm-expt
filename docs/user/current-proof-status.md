# Current Proof Status

**UNOFFICIAL/EXPERIMENTAL**

Start here when you want to know what is proven today.

## Source Of Truth

The shortest generated status page is:

[Status Dashboard](../../data/status-dashboard/summary.md)

It summarizes top100 readiness, proof lanes, hook and quirk residues,
derived ConfigHub variants, GitOps/OCI, and live parity in one place.

The compact top-20 catalog status CSV is:

[Top20 Catalog Status](../../data/status-dashboard/top20-status.csv)

It gives one row per catalog chart with supported base variants, strongest
evidence, lane counts, hard gaps, and next action.

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

The hook/lifecycle boundary page separates hook queue rows from hook-like
controller lifecycle observations:

[Hook And Lifecycle Boundary](../../data/lifecycle-boundary/summary.md)

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
confighub_oci_argo_live:                  17 pass, 5 watch, 4 blocked, 130 missing
live_helm_vs_confighub_dual_compare:      15 pass, 5 watch, 0 blocked, 136 missing
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
- 15 rows pass, 5 rows are watch, and no rows are blocked.
- A `watch` row means semantic object parity passed, but the live target still
  has a runtime, storage, controller-health, initialization, or operating-policy
  condition to review.
- The current watch rows are ingress-nginx `admission-disabled`, Argo CD
  `default`, kube-prometheus-stack `default`, Vault `default`, and Tempo
  `local-persistent`.
- The comparison checks regular Helm against ConfigHub delivery and records the
  expected installer-added Namespace object and any semantic object diffs.
- Exact chart/base status is in the generated summary:
  [Live Helm-vs-ConfigHub Parity](../../data/live-helm-confighub-compare/summary.md).

Lifecycle observation proof has started:

- cert-manager `default` and `crds-enabled` pass lifecycle checks for CRD
  ownership policy, startup API readiness, webhook CA bundle injection, and
  server dry-run.
- External Secrets `default` and `no-crds` pass lifecycle checks for CRD
  ownership policy, webhook CA bundle injection, controller-populated webhook
  Secret data, and server dry-run.
- These receipts demonstrate the lifecycle-observation pattern. They do not
  imply that all Helm hooks or controller-owned runtime behavior are supported
  automatically.

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
| What is the current execution plan? | [Large Machine Roadmap](../planning/large-machine-roadmap.md) |
