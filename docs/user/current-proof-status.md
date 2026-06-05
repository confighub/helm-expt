# Current Proof Status

**UNOFFICIAL/EXPERIMENTAL**

Start here when you want to know what is proven today.

## Source Of Truth

The generated lane matrix is the authority for exact chart/version/base status:

[Lane Test Matrix](../../data/lane-test-matrix/summary.md)

The runtime/GitOps wave tracks the first Argo/OCI live rows:

[Runtime/GitOps Wave](../../data/runtime-gitops/summary.md)

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
```

A row is only proven for a lane when the lane matrix says `pass`.

## Current Interpretation

The repo has strong render evidence for the current recipe variants. ConfigHub
proof and local live proof are partial by exact variant row.

GitOps/OCI live proof has started:

- Redis `reuse-existing-secret` passes through Flux OCI with the required
  existing Secret staged in the target namespace.
- Prometheus `server-only-ephemeral` passes through Flux OCI.
- PostgreSQL `existing-secret` passes through Flux OCI with the required
  existing Secret staged in the target namespace.
- NGINX `http-clusterip` passes.
- Metrics Server `default` passes.
- ingress-nginx `admission-disabled` has a watch receipt. The controller
  Deployment is Ready, but the kind target has no LoadBalancer external IP, so
  Argo health stayed Progressing.
- External Secrets `no-crds` has a blocked receipt. Argo synced the OCI
  artifact, but the target cluster still needed CRDs and the rendered webhook
  Secret delivered outside the workload OCI path.
- Argo CD `no-crds` has a blocked receipt. Argo synced the OCI artifact, but
  runtime Secret requirements were incomplete: `argocd-redis` was absent and
  `argocd-secret` did not contain `server.secretkey`.
- kube-prometheus-stack `no-crds` has a blocked receipt. Flux pulled the OCI
  artifact, but reconciliation failed because Prometheus Operator CRDs were
  absent and separated Secrets were not delivered.
- Consul `secure-mesh-existing-secrets` has a blocked receipt. Flux pulled the
  OCI artifact, but the selected secure mesh base needs a multi-node target for
  the three-server topology and anti-affinity rules.

Live Helm-vs-ConfigHub parity has started:

- NGINX `http-clusterip` passes a live comparison between regular Helm,
  ConfigHub kubectl/apply delivery, and ConfigHub OCI/Argo delivery.
- The comparison found the expected installer-added Namespace object and no
  semantic object diffs for the shared Kubernetes objects.
- Remaining chart-recipe-variant rows are backlog until they have committed
  receipts.

For the details, read the generated summaries rather than copying numbers from
this page.

## Useful Next Pages

| Question | Page |
| --- | --- |
| What are the verification lanes? | [Verification Lanes](./verification-lanes.md) |
| What can I install? | [Catalog](../../CATALOG.md) |
| How do I run the tutorial path? | [Tutorial Sequence](./tutorial-sequence.md) |
| How do variants work? | [Creating Variants](./creating-variants.md) |
| What is the current execution plan? | [Large Machine Roadmap](../planning/large-machine-roadmap.md) |
