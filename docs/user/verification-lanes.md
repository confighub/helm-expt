# Verification Lanes

**UNOFFICIAL/EXPERIMENTAL**

The repo uses several verification lanes because one test cannot prove the
whole Helm-to-ConfigHub lifecycle.

The generated lane matrix is the numeric source of truth:

[Lane Test Matrix](../../data/lane-test-matrix/summary.md)

For a chart/base/derived-variant/feature spreadsheet view, start with:

[Outcome Coverage](../../data/outcome-coverage/summary.md)

Each row is one chart, version, and base variant. A chart can have one lane
passing and another lane missing.

## Status Terms

| Status | Meaning |
| --- | --- |
| `pass` | The committed receipt proves the lane's stated outcome for that exact chart, version, and base variant. |
| `missing` | No committed receipt exists for that exact row yet. This is backlog, not failure. |
| `watch` | The lane produced useful evidence, and object parity usually passed, but a runtime, storage, controller-health, initialization, or operating-policy condition still needs review. |
| `blocked` | The lane produced useful evidence, but a target prerequisite, lifecycle route, hook decision, Secret, CRD, storage class, or similar condition must be resolved before the row can pass. |
| `fail` | The receipt records a failed check. Read the reason before treating it as a ConfigHub-vs-Helm defect. |

For live lanes, `watch`, `blocked`, and `fail` can be useful evidence rather
than a broken test. A chart may need CRDs preinstalled, separated Secret
delivery, a LoadBalancer-capable cluster, a controller readiness wait, or an
explicit lifecycle decision. Only call a row a parity defect when the semantic
object comparison fails.

## Core Lanes

| Lane | What it proves | What it does not prove |
| --- | --- | --- |
| `helm_template_vs_installer_setup` | `cub installer` renders the same Kubernetes object set as regular Helm for that base variant. | The objects work in a cluster. |
| `confighub_upload_variant_scan_safe_ops` | The rendered objects upload to ConfigHub Units and have scan/safe-operation receipts. | A GitOps controller or cluster applied them. |
| `local_kind_kubectl_apply` | The rendered objects were applied to a local Kubernetes cluster and workload checks passed. | Argo or Flux pulled from ConfigHub OCI. |
| `confighub_oci_argo_live` | ConfigHub Units were published through OCI and reconciled by Argo CD, with runtime evidence. | Regular Helm was deployed side by side for parity. |
| `live_helm_vs_confighub_dual_compare` | A live Helm deployment was compared against ConfigHub delivery paths. | Only exact rows with committed receipts pass. The lane matrix shows which rows still need evidence. |
| lifecycle observations | Controller-owned or hook-like post-apply behavior was checked with fresh runtime evidence. | Normal render equivalence for every hook-using chart. |

Strict Helm parity should use two vanilla kind clusters by default: regular Helm
on one cluster and `cub installer` render/apply on the other. This is the
required 100% live parity test for base variants. It avoids controller or CRD
contamination between the two legs. OCI/GitOps delivery remains a separate live
lane after parity has passed. See
[Two-Cluster Helm Parity Harness](../reference/two-cluster-parity-harness.md).

## Runtime Readiness

GitOps or Kubernetes can report that objects were accepted while the workload is
not usable. Secret delivery, missing CRDs, webhook readiness, LoadBalancer
availability, anti-affinity, PVC binding, and controller-populated fields can
all produce a false sense of success.

Treat this as a separate claim:

```text
render parity -> desired objects are right
apply or GitOps sync -> objects were handed to Kubernetes
runtime readiness -> the workload became usable
```

A tutorial or catalog row should say which of those claims it proves. If a row
has only render parity or GitOps sync, do not call it live-ready. Runtime-ready
claims need workload-specific checks or fresh observations.

## Commands

Check the generated matrix:

```sh
npm run lane-tests:verify
```

Check the selected GitOps/OCI wave:

```sh
npm run runtime-gitops:wave:verify
```

Check the cert-manager / External Secrets lifecycle observations:

```sh
npm run lifecycle:cert-manager-eso:verify
```

Check the complete repository corpus:

```sh
npm run verify
```

`npm run verify` is useful, but it is not a fresh live test. It checks that the
committed artifacts, receipts, generated data, and docs are self-consistent.
For the rule on when to run scoped checks, the full verifier, live tests, and
chart refreshes, see [NPM Test And Verification Scripts](../../tests/npm-scripts.md).

Check derived ConfigHub variants:

```sh
npm run derived-variants:verify
npm run derived-variants:target-bound:verify
npm run derived-variants:target-bound:summary:verify
```

The first command checks intended-state clone/link/gate receipts. The second
checks receipts where a derived variant was bound to a real target, applied to
OCI, reconciled by Argo, and observed in Kubernetes. The third command checks
the generated human-readable table:

[Target-Bound Derived Variants](../../data/derived-variant-target-bound/summary.md)

## Rule

Use the narrowest true claim:

```text
render verified
ConfigHub proof
local live
GitOps live
live parity
```

Do not collapse them into "tested" without naming the lane.
