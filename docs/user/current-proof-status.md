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

- NGINX `http-clusterip` passes.
- Metrics Server `default` passes.
- ingress-nginx `admission-disabled` has a watch receipt. The controller
  Deployment is Ready, but the kind target has no LoadBalancer external IP, so
  Argo health stayed Progressing.
- External Secrets `no-crds` has a blocked receipt. Argo synced the OCI
  artifact, but the target cluster still needed CRDs and the rendered webhook
  Secret delivered outside the workload OCI path.

Live Helm-vs-ConfigHub parity remains backlog until a receipt-producing harness
exists.

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
