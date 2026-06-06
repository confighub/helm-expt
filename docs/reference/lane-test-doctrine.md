# Lane Test Doctrine

**UNOFFICIAL/EXPERIMENTAL**

Lane tests are core corpus evidence. Every chart-recipe-variant row should be
tracked against the same lane set, even when the current state is `missing`.
Missing live evidence is backlog, not invisible work.

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
data/lane-test-matrix/summary.md
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
