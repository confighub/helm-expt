# Serverless mode

**UNOFFICIAL/EXPERIMENTAL.**

Serverless mode installs a Helm chart with no account and no sign-up — and proves, before
and after, that you got the same thing plain Helm would give you. Same chart, same running
result. The difference is that you can see every step, and nothing is taken on trust.

For the very first look you do not even need a cluster — just files on your machine.

Every command below is proven on a throwaway cluster with no login —
[render and install parity](../../data/serverless-install-parity-proof/summary.md) and
[push-to-OCI for Argo and Flux](../../data/serverless-oci-gitops-proof/summary.md).

## Install it — both paths, same outcome

We will use Redis, on any throwaway cluster (kind is fine). No ConfigHub account.

Plain Helm, one step:

```sh
helm install redis oci://registry-1.docker.io/bitnamicharts/redis --version 25.5.3 -n redis --create-namespace
```

The ConfigHub way — render the reviewed package, then apply it:

```sh
cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir ./out --non-interactive
kubectl create namespace redis
kubectl apply -f ./out/secrets -n redis
kubectl apply -f ./out/manifests -n redis
```

Both bring up the same Redis in the same namespace. Same outcome — that is **parity**.

> **What is `--pull packages/…`?** Everything here lives in this repo — nothing is fetched
> from outside. We review each chart as a *recipe* (`recipes/<helm-repo>/<chart>/<version>/`:
> its values, variants, and version locks), then publish that recipe as an installer
> *package* under `packages/<helm-repo>/<chart>/<version>/` — the chart's reviewed,
> pre-rendered form plus a short `installer.yaml` naming its *bases* (install shapes).
> `--pull` tells cub which package to load: a local path (as above), an `oci://…` address,
> or a `.tgz`. `--base` picks the shape.

## How it works — Helm hides one step, cub shows it

`helm install` renders the chart and applies it in a single step, so you only see the
objects once they are already running. The ConfigHub path does the same in two steps you
can watch:

1. **Render.** `cub installer setup` writes the exact objects to `./out/manifests` — plain
   files, readable before anything reaches the cluster. (It does not re-run Helm; the package
   already holds the chart's reviewed render.)
2. **Apply.** `kubectl apply` installs them.

The gap between the two is the point. There you can hold the render up against Helm's own
and confirm they match:

```sh
npm run redis:verify-install:render        # PASS — semantic object matches: 14/14
```

"It is the same as Helm" stops being a claim you accept and becomes a fact you check. None
of these steps contact ConfigHub.

## The other delivery — GitOps via OCI

Already running Argo or Flux from an OCI registry? Skip `kubectl`. Push the same rendered
output to your registry and let the controller you already trust pull it in:

```sh
flux push artifact oci://<your-registry>/redis:v1 --path=./out --source=serverless-cub-render --revision=v1
flux create source oci redis --url=oci://<your-registry>/redis --tag=v1 --interval=30s
flux create kustomization redis --source=OCIRepository/redis --path=./ --prune=true
```

Proven end to end: a no-login render was pushed to an OCI registry, an existing Flux pulled
it and applied it, and Redis came up — no `kubectl` from you at all. Same render, delivered
the way your cluster already works.

## The edges, kept in plain sight

A page that only flatters itself is not worth trusting. Three things are true here, so we
say them out loud.

- **The chart carries its own password.** The render includes a Secret with a baked-in
  password. Apply the bundle and the Secret goes in with it; push the bundle to a registry
  and the Secret rides along into that registry. For anything real, supply your own and
  choose a base such as `reuse-existing-secret`
  ([per-chart caveats](../../data/cub-adoption-caveats/summary.md)).
- **`kubectl` does not wait for the namespace.** `kubectl apply -f` may try to create an
  object before the namespace that holds it exists, so create the namespace first (as above).
  A controller like Argo or Flux orders this for you — one of several small rough edges of
  [applying by hand](./known-gaps-we-surface.md).
- **`cub installer push` is not this.** That command ships the *un-rendered installer
  package*, which no controller can apply. The OCI path above pushes the *rendered* result —
  what Argo and Flux actually understand.

And one boundary: this is proven on a plain chart. A chart with hooks, admission webhooks, or
its own CRDs needs more than a render — it needs its lifecycle steps, and its page tells you
which.

## Where it leads

Render, prove, install — all without an account — is a whole and useful thing on its own. The
larger story (resolve a chart by name from a signed catalog, gather what the cluster must
provide, keep a receipt of every install, and answer "what changed?" a month later) is laid
out in the [serverless install design](../planning/serverless-verified-install-plan.md). The
line never moves: the day you want one change to reach many places at once, that is the graph
— and that is the day you sign in.
