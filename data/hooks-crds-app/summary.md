# Hooks and CRDs App

This example shows how ConfigHub can keep the work around a Helm chart with the configuration it belongs to.

Kube Prometheus Stack 85.3.3 has ten CRDs, admission-webhook certificate setup, and checks that must happen at particular points in an install or upgrade. The 8 route records in this directory name that work. They say who runs each step and link to the receipts that support the choice.

The top-level chart routes remain `automatic: false`: ConfigHub does not yet choose this chart-specific route for a user. Once selected, the direct script has passed seven fresh-install steps. One staged OCI has also run through Argo CD and Flux on separate fresh clusters. Both controllers passed CRD ordering, certificate preparation, workload apply, webhook patching, and runtime checks. The controller receipt does not prove Helm's hook cleanup policy, and the 85.3.3 to 86.1.0 upgrade remains `not-run`.

Read the [direct lifecycle receipt](../../runs/kps-lifecycle-route-proof/no-crds-receipt.yaml) and [controller lifecycle receipt](../../runs/kps-gitops-lifecycle-proof/receipt.yaml) for the exact sequence and limits.

The smaller hook fixture is different. Its `explicit-managed-action` route ran from one OCI bundle through Argo CD, Flux, and direct apply, so that fixture is recorded as `automatic: true`. The claim applies to that fixture, not to every Helm hook.

The `catalog-standard` apply policy checks every LifecycleRoute stored in the demo organization. A route must name its chart, version, base, executor, disposition, and evidence. A route cannot claim automatic execution unless its disposition is `observed` and it links to evidence.

## Route records

| Scope | Route | Phase | Who runs it | Top-level automatic | Direct script | Argo CD | Flux |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tests/fixtures/hook-replacement-probe@1/base | explicit-managed-action | post-apply | Argo CD, Flux, or the direct apply script runs the packaged Job and waits for completion. | yes | pass | pass | pass |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | crds-first | pre-apply | Your delivery system applies the CRDs and waits for them before applying custom resources. | no | pass | pass | pass |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | postsync-check-or-observation | post-apply | Your delivery — a post-apply check (receipted) | no | pass | pass | pass |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | preflight-or-presync | preflight | Your delivery — a preflight step before apply (receipted) | no | pass | pass | pass |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | preserve-cleanup-policy | observe | Your delivery — an explicit, receipted step | no | pass | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | preserve-ordering | pre-apply | Your delivery — an explicit, receipted step | no | pass | pass | pass |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | target-facts-or-preflight | preflight | Handled — the recorded package script creates or checks this prerequisite | no | pass | pass | pass |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | upgrade-action-with-receipt | pre-apply | Not tested for this path | no | not-run | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/no-crds | webhook-readiness-observation | observe | Your delivery — an explicit, receipted step | no | pass | pass | pass |

## Human guide

Read [the Hooks and CRDs App guide](../../docs/demo/hooks-crds/kube-prometheus-stack.md) for the install order, the Argo CD, Flux, and direct-apply choices, what has been proved, and what is still manual.
