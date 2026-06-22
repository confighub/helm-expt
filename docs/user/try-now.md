# Try Now

**UNOFFICIAL/EXPERIMENTAL**

> Want to see a real run before you start? [first-run-walkthrough.md](./first-run-walkthrough.md)
> captures this flow end-to-end on a throwaway cluster — the actual commands,
> output, and one honest rough edge.

Redis is the small teaching chart. It shows the chart to recipe to base variant
to exact rendered objects path.

Start with ordinary Helm as the control. Then run the cub installer path with
the same chart version and base assumptions. The first useful proof is not that
ConfigHub is clever; it is that the starting object set is preserved.

## Helm Install Or cub Installer?

There are two useful ways to look at the same Redis chart:

| Path | Use it when | What you need |
| --- | --- | --- |
| Normal Helm | You want Helm to deploy Redis directly into a Kubernetes cluster. | Kubernetes cluster required. |
| cub installer | You want Redis rendered into explicit local config first, so it can be inspected and managed before delivery. | No cluster or ConfigHub account required for the render. |

The exact command table, expected output, catalog status, variants, caveats,
and evidence links live on the
[Redis chart page](../../site/charts/bitnami-redis-25-5-3.html).

## What This First Step Proves

Redis answers the first question: can a Helm chart be converted into a cub
installer package without changing the intended Kubernetes object set?

| Question | Answer |
| --- | --- |
| Does this replace Helm? | No. Helm remains the source chart ecosystem and the control path. |
| Does cub installer deploy the app? | Not by itself. It renders a reviewed package into explicit config first. |
| Do I need ConfigHub for this first step? | No. ConfigHub comes later when you want Units, variants, approvals, OCI delivery, observations, and operations. |
| Where is the evidence? | On chart pages, docs, and data surfaces. The Get Started page should stay human-first. |

## Where To Go Next

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
