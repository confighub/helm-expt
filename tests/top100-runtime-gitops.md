# Top-100 Runtime And GitOps Test Plan

_The top-100 runtime/GitOps sweep under the [helm-expt test map](README.md)._

This file defines the next runtime test lane for the 100 maintained chart
recipes. It is separate from `npm run verify`.

`npm run verify` proves this repo's recipe, package, receipt, catalog, and data
artifacts are internally consistent. Runtime/GitOps tests prove that selected
rendered objects can be delivered to a real cluster and observed after apply or
controller sync.

## Current State

```text
recipe/package proof artifacts: 100 / 100
top-20 local kind live/e2e receipts: 20 / 20
top-20 ConfigHub proof receipts: 20 / 20
top-100 GitOps/OCI sweep receipts: not yet in this repo
production-supported charts: 0 / 20 top-20
```

The top-100 runtime lane should not claim production support by itself. It is
evidence for installability and observation under a declared test scope.

## Test Matrix

Run the matrix by chart and base variant:

| Dimension | What To Test | Pass Bar |
| --- | --- | --- |
| Default path | `cub installer setup` for the default base, upload/publish, cluster apply or GitOps sync. | Rendered object set matches the package receipt; cluster reaches expected workload state. |
| Existing-secret path | Secret-reuse bases with target Secrets staged before apply. | Required target facts are present; no generated secret delivery is silently assumed. |
| No-CRDs path | CRD-free bases where CRDs are externally owned. | Render contains no CRDs; CRD owner/precondition is recorded before workload sync. |
| Hook/lifecycle charts | Charts with hook or lifecycle policy. | Hook home is explicit: blocked, ConfigHub-applied, or GitOps-controller-executed with a receipt. |
| Day-2 edits | One safe edit per selected chart: image, resources, replicas, target, label, or values-driven base rerender. | Diff is explicit; apply/rollback receipts prove the intended field changed and can be reverted. |
| False-green guard | Controller says synced/healthy but workload is not actually usable. | Runtime check fails; receipt records the contradiction. |

## GitOps Modes

Use both controller families over time:

```text
Argo CD + ConfigHub OCI
Flux + ConfigHub OCI
```

Each run must record:

```text
chart
version
base variant
package digest
rendered object digest
ConfigHub space / target
OCI artifact reference
GitOps controller and version
cluster context
sync result
runtime checks
observedAt
freshness / expiry
```

## Output Artifacts

The runtime lane should produce machine-readable receipts, plus a generated
summary:

```text
data/runtime-gitops/receipts/<chart>/<base>/<run-id>.yaml
data/runtime-gitops/review.csv
data/runtime-gitops/summary.md
```

Logs are useful for debugging, but they are not proof. A passing run needs a
receipt that can be verified without rereading a terminal transcript.

## Promotion Rule

A chart can move from proof-grade to catalog-supported for a runtime scope only
when its selected bases have:

```text
package verification
ConfigHub proof receipts
runtime/GitOps observation receipt
no unresolved target-fact preconditions
no unreviewed hook/CRD/secret lifecycle blocker
```

Production support still requires production dispositions. See:

```text
data/production-disposition/summary.md
data/production-disposition/dispositions.md
```
