# Runtime Drift and Delivery Boundaries

This guide answers one question: what does a clean result mean after reviewed
Kubernetes configuration moves toward a cluster?

The answer depends on the delivery path. Local files, `kubectl`, Argo CD or
Flux, and ConfigHub with a GitOps controller do not observe the same things.

The canonical path record is
[`config-catalog/runtime-path-boundaries.yaml`](../../config-catalog/runtime-path-boundaries.yaml).
The [public question page](../../site/does-cluster-match-approved-config.html)
is generated from that record.

## Read Four Results Separately

1. A local check says something about the reviewed files. It says nothing about
   a cluster.
2. A successful `kubectl apply` says the Kubernetes API accepted the request.
   It does not prove workload readiness, and ordinary apply does not remove
   objects omitted from a later file set.
3. Argo CD or Flux reports whether its declared objects reconcile. Removal
   depends on pruning being enabled and tested. A green controller result does
   not prove every external prerequisite or application behavior.
4. ConfigHub records the approved desired revisions, checks, and publication.
   Argo CD or Flux still performs delivery. Live observation is a separate
   result with its own field coverage.

## Current Field Coverage

The retained live test changed a Deployment's replicas and one container
environment variable. The comparison found the replica change and missed the
environment-variable change. Treat the current result as partial.

- [Live drift receipt](../../runs/drift-detection-gap/receipt.yaml)
- [Pruning gap](../../data/prune-gap-proof/summary.md)
- [Server-side apply conflict gap](../../data/ssa-conflict-gap/summary.md)

Keep these questions separate when you review a path:

- Did the reviewed files pass their checks?
- Did the delivery tool accept or reconcile them?
- Were omitted objects removed?
- Did a field ownership conflict stop the update?
- Is the workload healthy?
- Which desired and live fields were actually compared?

A single green label cannot answer all six questions.
