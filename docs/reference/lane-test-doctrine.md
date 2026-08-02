# Lane Test Doctrine

**UNOFFICIAL/EXPERIMENTAL**

This document defines the tests and evidence required for each chart
configuration. A missing result stays visible until the test runs or the
limitation is recorded.

## Outcome Standard

Tasks and proof lanes should name the user-visible outcome first. A task is not
complete because a script, doc, or generated row exists. It is complete when the
repo has committed evidence for the promised outcome and the verifier fails if
that evidence becomes stale.

The target outcome for the catalog is:

```text
Every supported Helm chart default and declared main choice is reproducible,
ConfigHub-reviewable, live-cluster verified, and tied to receipts.
```

In this doctrine, "main choice" means every published recipe/package base that
the catalog presents as a supported install shape, plus any derived ConfigHub
variant that the docs present as a supported post-render operating choice.
Default-only proof is not enough when the chart has a declared non-default main
choice such as existing-secret, no-crds, server-only, ClusterIP, ingress, HA, or
storage mode.

For a chart-choice row to be called fully proven, the outcome is:

| Outcome | Required evidence |
| --- | --- |
| Reproducible render | fresh or receipt-backed Helm-equivalence evidence, rendered object digest, and matching installer setup check. |
| ConfigHub reviewability | upload proof, linked Units, server-side derived-variant clone where applicable, function scan receipt, and safe-ops receipt. |
| Live cluster truth | local-kind or equivalent Kubernetes observation receipt that checks applied objects and meaningful runtime state, not just file generation. |
| GitOps/OCI truth | ConfigHub Units published through OCI and reconciled by Argo or Flux, with sync and runtime evidence. |
| Helm-vs-installer parity | required live parity: live Helm deployment on one vanilla cluster compared with live `cub installer` render/apply on a second vanilla cluster. |
| ConfigHub delivery parity | live Helm deployment compared with ConfigHub delivery paths such as controller-driven OCI and kubectl/apply. |

If any required evidence is missing, the row remains useful but incomplete. The
matrix should say `missing`; docs should not flatten that into "verified."

The generated control surface is:

```text
data/lane-test-matrix/variant-lanes.csv
data/outcome-coverage/summary.md
```

Regenerate or verify it with:

```sh
npm run lane-tests:generate
npm run lane-tests:verify
```

## Required Lanes

| Lane | Evidence |
| --- | --- |
| `helm_template_vs_installer_setup` | A passing Helm-equivalence receipt plus an installer package `setupChecks[]` entry for the variant. |
| `confighub_upload_variant_scan_safe_ops` | ConfigHub upload proof, server-side variant clone, function scan receipt, and safe-ops receipt. |
| `local_kind_kubectl_apply` | A committed local-kind observation receipt proving the rendered object set applies and reaches expected runtime checks. |
| `confighub_oci_argo_live` | A receipt from `tests/chart-install-test` or its successor proving ConfigHub Units were published through OCI and reconciled by Argo or Flux. |
| `live_helm_vs_confighub_dual_compare` | Historical combined lane that installs the chart with Helm and compares it against ConfigHub delivery paths. Keep these receipts as useful evidence. The required 100% live parity lane should use the two-cluster kind harness described in [Two-Cluster Helm Parity Harness](two-cluster-parity-harness.md). |

## Live Evidence Funnel

Large charts can involve dozens or hundreds of ConfigHub Units. A single status
label is not enough to explain what happened. Live receipts and user-facing
tools should report the deployment funnel:

| Funnel step | Question |
| --- | --- |
| ConfigHub Units | Were the expected Units uploaded and applied to the target? |
| GitOps source | Did the controller pull the expected OCI or Git revision? |
| GitOps sync | Did the controller sync the desired objects? |
| Target facts and lifecycle prerequisites | Were required Secrets, CRDs, topology, storage, and lifecycle objects present at the right time? |
| Workload convergence | Did Deployments, StatefulSets, Jobs, APIServices, webhooks, and chart-specific checks reach the expected state? |
| Controller aggregate health | Does Argo, Flux, or another controller mark the application healthy, and if not, what resource or health rule explains the residue? |

The funnel keeps hard cases readable. For example, a chart can have synced
ConfigHub OCI delivery and fully converged Kubernetes workloads while a GitOps
controller still reports an aggregate `Progressing` health label. That is a
`watch` row, not a silent failure and not a full pass. The receipt should keep
both facts visible: workload evidence and controller-health residue.

Target shape is Kubernetes topology, not ConfigHub deployment architecture. A
chart such as Consul may require three schedulable Kubernetes nodes because its
server pods have hard anti-affinity and quorum expectations. That does not mean
ConfigHub needs an in-cluster worker. In the OCI/GitOps lane, ConfigHub remains
workerless from the cluster's point of view: Argo or Flux pulls the published
desired state, and the receipt records the target topology that made the chart
schedulable.

The strict two-cluster kind parity lane can create multi-node vanilla kind
targets directly from target facts. The single-cluster ConfigHub/OCI rig also
needs the same Kubernetes target shape, but its cluster bootstrap goes through
`cub cluster up` because that command provisions Argo CD and the ConfigHub
target. If it cannot create a multi-node kind target,
the row is blocked on proof-rig provisioning. It is not a ConfigHub worker
requirement and not a render-parity defect.

## Controller Namespace Protection

Single-cluster GitOps lanes use a delivery controller and a chart under test in
the same cluster. If the chart renders objects into a protected controller
namespace, cleanup must not delete objects that existed before the chart leg
began. The harness snapshots those pre-existing objects, preserves them during
cleanup, and records the preserved identities in the receipt.

This matters for charts such as Argo CD. A live test may need Argo CD to deliver
the ConfigHub OCI artifact while also testing an Argo CD chart. The harness may
clean up chart-owned objects between legs, but it must not remove the bootstrap
controller's ConfigMaps, RBAC, Services, or workloads. Otherwise the test would
measure harness damage rather than Helm-vs-ConfigHub behavior.

## Current Reading

The repo already proves the first lane for every current recipe variant. The
other lanes are intentionally tracked as partial or missing until their receipt
families cover every chart-recipe-variant row.

Redis must not remain a permanent special case. Redis-only tutorial helpers such
as `redis:verify-install:*` are allowed as user-facing checks, but corpus-core lane
coverage should come from the same generated lane matrix and receipt families as
the other charts.

## How To Use The Matrix

Use the CSV as the spreadsheet-facing source of truth:

```text
chart
version
variant
core lane statuses
missing_core_lanes
evidence notes
```

Use the summary for the headline counts. A lane status of `missing` means the
test harness or receipt exists in doctrine but does not yet have committed
evidence for that row.
