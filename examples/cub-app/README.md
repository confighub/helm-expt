# cub app (prototype)

An app is a workload. This prototype implements the workload side of the
`cub <noun>` idea: `cub app sandbox <name>` renders the workload for free and works
out what it needs to run, in particular whether it is self-contained or needs a
platform for its dependencies.

## Run it

```bash
node scripts/cub-app.mjs list
node scripts/cub-app.mjs sandbox hello-standalone
node scripts/cub-app.mjs sandbox shop-web
node scripts/cub-app.mjs install shop-web
```

## What sandbox reports

- **installs** — the objects the app would create, and the namespaces that must
  already exist.
- **dependencies** — the platform services the app needs, read from its objects: an
  Ingress needs an ingress controller, a cert-manager Certificate needs cert-manager,
  a ServiceMonitor needs a Prometheus operator, an ExternalSecret needs
  external-secrets.
- **verdict** — standalone or needs-a-platform.

`hello-standalone` is standalone: a Deployment and a Service that deliver straight to
a cluster from OCI, reconciled by your own Argo CD or Flux. `shop-web` needs a
platform: its Ingress, Certificate, and ServiceMonitor require an ingress controller,
cert-manager, and a Prometheus operator, which a `cub stack` such as
`observability-base` carries.

## Where this fits

An app needs a platform only for its dependencies. A standalone app runs direct; an
app with dependencies lands on a platform that carries the stack it needs. That is
the app-and-platform boundary from the custom-stacks-and-apps proposal, running.
