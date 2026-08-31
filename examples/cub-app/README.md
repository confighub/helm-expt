# cub app (prototype)

An app is a workload. This prototype implements the workload side of the
`cub <noun>` idea: render it, work out what it needs, upload it into governance, and
export it to Score.

## Run it

```bash
node scripts/cub-app.mjs list
node scripts/cub-app.mjs check hello-standalone
node scripts/cub-app.mjs check shop-web
node scripts/cub-app.mjs upload hello-standalone          # prints the delivery plan
node scripts/cub-app.mjs upload hello-standalone --run    # uploads it live into ConfigHub
node scripts/cub-app.mjs score shop-web                    # export to Score (score.dev)
```

## check

Renders the workload for free (no cluster, no account) and reports what it installs
and, crucially, whether it is self-contained or needs a **platform** for its
dependencies, read from its objects: an Ingress needs an ingress controller, a
cert-manager Certificate needs cert-manager, a ServiceMonitor needs a Prometheus
operator, an ExternalSecret needs external-secrets.

`hello-standalone` is standalone: a Deployment and a Service that deliver straight to
a cluster from OCI. `shop-web` needs a platform: its Ingress, Certificate, and
ServiceMonitor require an ingress controller, cert-manager, and a Prometheus operator,
which the [`web-platform`](../cub-stack/README.md) stack carries exactly.

## upload

Creates the app in ConfigHub, **one Unit per resource**, with the release gated on
review. Without `--run` it prints the plan; with `--run` it drives cub end to end
(verified live on `hello-standalone`, then torn down).

## score

Exports the app's workloads to [Score](https://score.dev) (`score.dev/v1b1`), one
Workload per Deployment or StatefulSet, ready for `score-k8s`. Because ConfigHub's
objects are already literal, env values and ports resolve rather than dangling. This
mirrors the `k8s-to-score` example in confighub/examples, applied to a cub app.

## Where this fits

An app needs a platform only for its dependencies. A standalone app runs direct; an
app with dependencies lands on a platform that carries the stack it needs. `check`
inspects one config or app for free, and `sandbox` renders a whole stack with no
infrastructure: the settled verbs, one per rung.
This is the app-and-platform boundary from the custom-stacks-and-apps proposal,
running.
