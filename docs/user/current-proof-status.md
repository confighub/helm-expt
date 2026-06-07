# Current Proof Status

**UNOFFICIAL/EXPERIMENTAL**

Start here when you want to know what is proven today.

## Source Of Truth

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
- Redis `default` passes the same live comparison, including separated Secret
  staging, four Bound PVCs, StatefulSets Ready, and Redis PONG.
- The comparison found the expected installer-added Namespace object and no
  semantic object diffs for the shared Kubernetes objects.
- Remaining chart-recipe-variant rows are backlog until they have committed
  receipts.

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
- These receipts prove the derived-variant operating path for a small web chart
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
