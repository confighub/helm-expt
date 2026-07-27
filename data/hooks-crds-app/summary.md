# Hooks and CRDs App

This example shows how ConfigHub can keep the work around a Helm chart with the configuration it belongs to.

Kube Prometheus Stack 85.3.3 has ten CRDs, admission-webhook certificate setup, and checks that must happen at particular points in an install or upgrade. The 8 route records in this directory name that work. They say who runs each step and link to the receipts that support the choice.

The top-level chart routes remain `automatic: false`: ConfigHub does not yet choose and execute them across every delivery path. The direct-install script now has a narrower result. Seven fresh-install steps ran automatically in that script, using the chart's own certificate and patch Jobs. The upgrade step is still `not-run`. Argo CD and Flux are still `not-run` for this chart-specific sequence.

That distinction matters. A passing direct implementation does not turn the Argo CD or Flux columns green. Read the [direct lifecycle receipt](../../runs/kps-lifecycle-route-proof/receipt.yaml) for the exact sequence and limits.

The smaller hook fixture is different. Its `explicit-managed-action` route ran from one OCI bundle through Argo CD, Flux, and direct apply, so that fixture is recorded as `automatic: true`. The claim applies to that fixture, not to every Helm hook.

The `catalog-standard` apply policy checks every LifecycleRoute stored in the demo organization. A route must name its chart, version, base, executor, disposition, and evidence. A route cannot claim automatic execution unless its disposition is `observed` and it links to evidence.

## Route records

| Scope | Route | Phase | Who runs it | Top-level automatic | Direct script | Argo CD | Flux |
| --- | --- | --- | --- | --- | --- | --- | --- |
| tests/fixtures/hook-replacement-probe@1/base | explicit-managed-action | post-apply | Argo CD, Flux, or the direct apply script runs the packaged Job and waits for completion. | yes | pass | pass | pass |
| prometheus-community/kube-prometheus-stack@85.3.3/default | crds-first | pre-apply | Your delivery system applies the CRDs and waits for them before applying custom resources. | no | pass | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/default | postsync-check-or-observation | post-apply | Your delivery — a post-apply check (receipted) | no | pass | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/default | preflight-or-presync | preflight | Your delivery — a preflight step before apply (receipted) | no | pass | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/default | preserve-cleanup-policy | observe | Your cluster — at uninstall, automatically | no | pass | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/default | preserve-ordering | pre-apply | Your applier — must apply CRDs before dependent objects | no | pass | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/default | target-facts-or-preflight | preflight | Prerequisite — supply once (Secret / CRD / storage), like values | no | pass | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/default | upgrade-action-with-receipt | pre-apply | Your delivery — a GitOps PreSync/PostSync or cub action (receipted) | no | not-run | not-run | not-run |
| prometheus-community/kube-prometheus-stack@85.3.3/default | webhook-readiness-observation | observe | Your delivery and cluster — stage any declared certificate, then check webhook readiness | no | pass | not-run | not-run |

## Human guide

Read [the Hooks and CRDs App guide](../../docs/demo/hooks-crds/kube-prometheus-stack.md) for the install order, the Argo CD, Flux, and direct-apply choices, what has been proved, and what is still manual.
