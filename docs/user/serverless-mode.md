# Serverless mode — try it with no account and no cluster

**UNOFFICIAL/EXPERIMENTAL.**

The fastest way to start. No ConfigHub login. No sign-up. For the first step, not
even a Kubernetes cluster — just files on your laptop. You render a Helm chart the
ConfigHub way, see exactly what it produces, and prove it matches plain Helm. The
catalog calls this **serverless mode**: the parts that work as local files, before
any server is involved.

## What you can do without an account

- **See the exact objects** a chart will create, before anything is applied.
- **Prove parity with Helm** — that the ConfigHub render is the same object set Helm
  would have produced for the same inputs.
- **Apply it to your own cluster** with plain `kubectl`, if you have one.
- **Hand it to your existing Argo or Flux** by pushing to OCI — see the last section.

What you *can't* do serverless is the part that needs the server: connecting many
installs into one graph, propagating a change across a fleet, and tracking who
changed what. That's ConfigHub proper. Serverless mode is honest about that line.

## The simplest parity, side by side

Both of these render Redis locally. Neither needs a cluster or an account.

**Plain Helm — render to YAML:**

```sh
helm template redis oci://registry-1.docker.io/bitnamicharts/redis --version 25.5.3 > helm.yaml
```

**The ConfigHub way — render a named, reviewed base:**

```sh
cub installer setup --pull packages/bitnami/redis/25.5.3 --base default \
  --work-dir ./out --non-interactive --namespace redis
# rendered manifests land in ./out/manifests, secrets in ./out/secrets
```

**Prove they match** (semantic object comparison, still local):

```sh
npm run redis:verify-install:render
# You should see: PASS ... semantic object matches: 14/14
```

That's the whole parity claim: same chart, same version, same inputs → the same
Kubernetes objects, checked on your laptop. (For the very lightest render with no
package at all, `cub helm template` renders a chart to stdout and also "does not
require a ConfigHub server connection.")

## How it works

A Helm chart is a template. "Render" means turning that template into the actual
Kubernetes YAML it would install. Plain Helm renders and then usually applies in one
opaque step. Serverless mode renders **to files you can read first**, from a named
base variant the catalog already reviewed, and lets you compare that output against
Helm's own — so "it's the same as Helm" is something you check, not something you
take on trust. Then you apply it however you like: `kubectl apply -f ./out/manifests`,
or the OCI path below.

## Already running Argo or Flux? Push to OCI instead of `kubectl`

If your cluster already runs Argo CD or Flux reading from an OCI registry, you don't
have to `kubectl apply` at all. You can render serverlessly and **push the rendered
bundle to your OCI registry**, and your existing controller pulls and applies it —
no ConfigHub account, no new agent.

```sh
# 1. render locally (no account), as above -> ./out
# 2. push the RENDERED bundle to your registry
flux push artifact oci://<your-registry>/redis:v1 --path=./out \
  --source=serverless-cub-render --revision=v1
# 3. point your existing Flux at it
flux create source oci redis --url=oci://<your-registry>/redis --tag=v1 --interval=30s
flux create kustomization redis --source=OCIRepository/redis --path=./ --prune=true
```

This is **proven**, end to end, on a throwaway cluster: a no-login serverless render
was pushed to an OCI registry, an existing Flux pulled it from OCI and applied it,
and Redis came up — no `kubectl apply` of the workload from cub. Receipt:
`runs/serverless-oci-gitops-proof/receipt.yaml`
([summary](../../data/serverless-oci-gitops-proof/summary.md)).

Three honest caveats, because this path has real edges:

- **Secrets ride in the bundle.** The render includes the chart's Secret, so pushing
  the bundle delivers it — which also means the Secret now lives in your OCI registry.
  (The full ConfigHub path keeps secret material separate instead.) Supply your own
  Secret out-of-band and use a base like `reuse-existing-secret` if that matters.
- **`cub installer push` is a different thing.** It pushes the *un-rendered installer
  package* (the recipe), which Argo/Flux can't reconcile directly. The push above uses
  `flux push artifact` on the *rendered* output, which is what a controller consumes.
- **Hook / CRD charts need more.** This is proven for a vanilla chart (Redis). Charts
  with Helm hooks, admission webhooks, or their own CRDs still need their lifecycle
  routes — see the per-chart pages and [known gaps](./known-gaps-we-surface.md).

## Where this is going

Serverless mode is the "capture" half — render, equivalence, provenance, named
variants, signing — and it is genuinely useful on its own. The full design (resolve a
chart by name from a signed catalog, collect target facts, record an in-cluster
install receipt, day-2 diff/upgrade/rollback) is written up in
`docs/planning/serverless-verified-install-plan.md`. The boundary stays honest: the
moment you want one change to propagate across many installs, that's the graph, and
that's where signing in begins.
