# Get Started With Redis

**UNOFFICIAL/EXPERIMENTAL**

> Want to see a real run before you start? [first-run-walkthrough.md](./first-run-walkthrough.md)
> captures this flow end-to-end on a throwaway cluster — the actual commands,
> output, and one honest rough edge.

Redis is the smallest example on this site. It lets you compare a normal Helm
install with the ConfigHub `cub installer` path without starting with a
complicated chart.

First, look at what Helm would install. Then use `cub installer` with the same
Redis chart version and the same basic assumptions. The aim is simple: check
that the ConfigHub path starts from the same Kubernetes objects that Helm would
create.

## Helm Or cub Installer?

There are two useful ways to look at the same Redis chart. Helm is the direct
install path. `cub installer` is the path that renders the chart into files you
can inspect and manage before delivery.

| Path | Use it when | What you need |
| --- | --- | --- |
| Normal Helm | You want Helm to deploy Redis directly into a Kubernetes cluster. | Kubernetes cluster required. |
| cub installer | You want Redis rendered into explicit local config first, so it can be inspected, kept as OCI, or managed before delivery. | No cluster or ConfigHub account required for the render or local OCI output. |

The exact command table, expected output, catalog status, variants, caveats,
and evidence links live on the
[Redis chart page](../../site/charts/bitnami-redis-25-5-3.html).

## What This Shows

Redis answers the first question: can we use the ConfigHub path without changing
the starting Kubernetes objects that Helm would have created?

| Question | Answer |
| --- | --- |
| Does this replace Helm? | No. Helm remains the source chart ecosystem and the control path. |
| Does cub installer deploy the app? | Not by itself. It renders a reviewed package into explicit config first. |
| Can it write the rendered result as OCI? | Yes. Add `--output-oci ./redis-rendered.oci` for a local OCI image layout, or use an `oci://` reference to push. The output contains the selected preset's non-secret Kubernetes objects, source record, and checks. |
| Do I need ConfigHub for this first step? | No. ConfigHub comes later when you want Units, variants, approvals, OCI delivery, observations, and operations. |
| Where is the evidence? | On chart pages, docs, and data surfaces. The Get Started page should stay human-first. |

## Where To Go Next

- [Serverless mode](./serverless-mode.md) for the complete
  `cub installer setup --output-oci` example and its live Flux receipt.
- [Redis chart page](../../site/charts/bitnami-redis-25-5-3.html) for the exact
  Redis commands, expected output, catalog status, variants, caveats, and
  evidence links.
- [Expected Results And Clusters](./expected-results-and-clusters.md) for output
  checkpoints and cluster guidance.
- [Helm Catalog](../../site/charts/index.html) to choose another chart.
- [kube-prometheus-stack chart page](../../site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html)
  for a serious chart with CRDs, webhooks, target facts, and lifecycle
  prerequisites.
- [How It Works](../../site/how-it-works.html) for the render, route, deliver,
  observe model behind the catalog.
