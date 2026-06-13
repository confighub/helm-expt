# Serious Chart Playbooks

UNOFFICIAL/EXPERIMENTAL

Use these notes when working on charts that exercise several Helm pain points at
once. The goal is to keep hard charts as proof points, not exceptions hidden
behind easy demos.

## kube-prometheus-stack

Use kube-prometheus-stack to test CRDs, webhooks, hooks, generated facts,
storage, RBAC, high fanout, upgrade deltas, and blast-radius claims.

Start with:

```sh
open docs/reference/kube-prometheus-stack-serious-chart-review.md
open data/high-fanout-demo/summary.md
open data/blast-radius-accuracy/summary.md
```

## Consul

Use Consul to test existing Secrets, TLS identity, ACL/gossip prerequisites,
gateway topology, many Units, and target topology.

Start with:

```sh
open recipes/hashicorp/consul/2.0.0/gitops-runtime-review.yaml
open data/live-parity-rerun-plan/summary.md
```

Keep the target rule precise: Consul secure mesh needs a Kubernetes target with
three schedulable nodes. It does not require ConfigHub workers.

## cert-manager And External Secrets

Use these to test CRDs, webhooks, controller-populated fields, generated webhook
Secrets, and lifecycle observations.

Start with:

```sh
open data/lifecycle-observations/cert-manager-eso/summary.md
open data/secret-lifecycle/summary.md
```

## Loki

Use Loki to test required values, storage mode, object-store credentials,
stateful workloads, and target-fit decisions.

Start with:

```sh
open recipes/grafana/loki/7.0.0/CATALOG.md
open recipes/grafana/loki/7.0.0/helm-pain-report.yaml
```

## Argo Workflows

Use Argo Workflows to test install-critical hooks. The default upstream route
ships full CRDs through a pre-install hook. The maintained practical path is the
`minimal-crds` base; the default path remains prerequisite-bound unless the full
CRD hook route is explicitly handled.

Start with:

```sh
open data/hook-route-candidates/selected-routes/argo-cd-argo-workflows-minimal-crds.yaml
open data/lifecycle-boundary/summary.md
```
