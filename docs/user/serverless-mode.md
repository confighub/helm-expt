# Serverless mode

**UNOFFICIAL/EXPERIMENTAL.**

Helm installs a chart in a single step, and you find out what it did afterward.
Serverless mode turns that around. First you see the exact Kubernetes objects the
chart will create. Then you confirm they are precisely the ones plain Helm would have
produced. Then you install them and watch the workload come up.

No account. No sign-up. For the first look, not even a cluster — just files on your
own machine. It is the same install you would get from Helm. The only difference is
that nothing is hidden, and nothing is taken on trust.

Every command below is proven on a throwaway cluster with no login —
[render and install parity](../../data/serverless-install-parity-proof/summary.md) and
[push-to-OCI for Argo and Flux](../../data/serverless-oci-gitops-proof/summary.md).

## First, see it

A Helm chart is not Kubernetes objects. It is a template *for* them — a promise of
what will be created. **Rendering** is the moment that promise becomes real YAML you
can read. Plain Helm renders and applies in the same opaque breath. Here, you render,
and stop, and look.

Render Redis two ways. Neither touches a cluster or an account.

```sh
# plain Helm
helm template redis oci://registry-1.docker.io/bitnamicharts/redis --version 25.5.3 > helm.yaml

# the ConfigHub way — from a named, already-reviewed base
cub installer setup --pull packages/bitnami/redis/25.5.3 --base default --work-dir ./out --non-interactive
```

The two renders carry the same set of objects. That is **render parity**: the same
chart and the same inputs produce the same Kubernetes resources, and you have checked
it with your own eyes. If you would rather the catalog check it for you:

```sh
npm run redis:verify-install:render        # PASS — semantic object matches: 14/14
```

## Then, run it

Seeing is only half. The other half is that it installs and works — and it does, three
ways, every one of them with no account.

**The way you already know — `helm install`:**

```sh
helm install redis oci://registry-1.docker.io/bitnamicharts/redis --version 25.5.3 -n redis --create-namespace
```

**The very same render, applied by hand with `kubectl`:**

```sh
kubectl create namespace redis
kubectl apply -f ./out/secrets -n redis
kubectl apply -f ./out/manifests -n redis
```

**Or, if Argo or Flux already runs in your cluster — hand it the bundle and never
touch `kubectl` at all:**

```sh
flux push artifact oci://<your-registry>/redis:v1 --path=./out --source=serverless-cub-render --revision=v1
flux create source oci redis --url=oci://<your-registry>/redis --tag=v1 --interval=30s
flux create kustomization redis --source=OCIRepository/redis --path=./ --prune=true
```

Each brings up the same working Redis. The first is Helm being Helm. The second is the
rendered objects, applied by your own hand. The third pushes those objects to your
registry and lets the controller you already trust pull them in. One result, three
roads to it, and a receipt for each.

## How it works, in one breath

Plain Helm renders and applies at once, so you meet your objects only after they are
already running. Serverless mode puts a window between the render and the apply: it
writes the objects to files you can read, from a base the catalog has already
reviewed, and lets you set them beside Helm's own output. "It is the same as Helm"
stops being a claim you accept and becomes a fact you confirm. What you do next —
`kubectl`, or your own GitOps controller — is your choice, and none of it phones home.

## The edges, kept in plain sight

A page that only flatters itself is not worth trusting. Three things are true here, so
we say them out loud.

- **The chart carries its own password.** The render includes a Secret with a baked-in
  password. Apply the bundle and the Secret goes in with it; push the bundle to a
  registry and the Secret rides along into that registry. For anything real, supply
  your own and choose a base such as `reuse-existing-secret`
  ([per-chart caveats](../../data/cub-adoption-caveats/summary.md)).
- **`kubectl` does not wait for the namespace.** `kubectl apply -f` may try to create
  an object before the namespace that holds it exists, so create the namespace first.
  A controller like Argo or Flux orders this for you — one of several small rough edges
  of [applying by hand](./known-gaps-we-surface.md).
- **`cub installer push` is not this.** That command ships the *un-rendered* recipe,
  which no controller can apply. The OCI path above pushes the *rendered* result —
  what Argo and Flux actually understand.

And one boundary: this is proven on a plain chart. A chart with hooks, admission
webhooks, or its own CRDs needs more than a render — it needs its lifecycle steps, and
its page tells you which.

## Where it leads

Render, prove, install — all without an account — is a whole and useful thing on its
own. The larger story (resolve a chart by name from a signed catalog, gather what the
cluster must provide, keep a receipt of every install, and answer "what changed?" a
month later) is laid out in the
[serverless install design](../planning/serverless-verified-install-plan.md). The line
never moves: the day you want one change to reach many places at once, that is the
graph — and that is the day you sign in.
