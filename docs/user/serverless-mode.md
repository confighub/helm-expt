# Serverless mode — install Helm charts, keep the proof, no account

**UNOFFICIAL/EXPERIMENTAL.**

The fastest way to start. No ConfigHub login, no sign-up. The point of serverless
mode is not "look at some YAML" — it is that you get the **same working install you'd
get from Helm, and the proof that it's the same**, with no account. You see exactly
what will deploy, you confirm it matches plain Helm, and then you actually install it
and watch it come up — by `kubectl`, or by handing it to the Argo or Flux you already
run.

This whole page is proven live on a throwaway cluster, no login:
[render + install parity](../../data/serverless-install-parity-proof/summary.md) ·
[push-to-OCI for Argo/Flux](../../data/serverless-oci-gitops-proof/summary.md).

## See it, then run it — no account

### 1. See it — render parity

Both of these render Redis to YAML locally. No cluster, no account.

```sh
# plain Helm
helm template redis oci://registry-1.docker.io/bitnamicharts/redis --version 25.5.3 > helm.yaml

# the ConfigHub way — a named, reviewed base
cub installer setup --pull packages/bitnami/redis/25.5.3 --base default \
  --work-dir ./out --non-interactive
```

They produce the **same Kubernetes object set** — proven: `helm template` and the cub
render carry identical object kinds. You can re-check the catalog's contract too:

```sh
npm run redis:verify-install:render        # PASS ... semantic object matches: 14/14
```

That's render parity: same chart, same inputs → the same objects, confirmed offline.

### 2. Run it — install parity

This is the half that matters: it actually installs and works. **Three ways, all with
no ConfigHub account, all proven to bring Redis up.**

**a) Plain Helm — what you do today:**

```sh
helm install redis oci://registry-1.docker.io/bitnamicharts/redis --version 25.5.3 \
  -n redis --create-namespace
```

**b) The cub render, applied with plain `kubectl`:**

```sh
kubectl create namespace redis
kubectl apply -f ./out/secrets -n redis      # the Secret first (the chart bakes one — see caveats)
kubectl apply -f ./out/manifests -n redis    # the rendered objects
```

Both reach a working (`Ready`) Redis. Same objects, same result, no login — that's
install parity, proven in the receipt above.

**c) If you already run Argo or Flux reading from OCI — push to OCI, don't `kubectl`:**

```sh
flux push artifact oci://<your-registry>/redis:v1 --path=./out \
  --source=serverless-cub-render --revision=v1
flux create source oci redis --url=oci://<your-registry>/redis --tag=v1 --interval=30s
flux create kustomization redis --source=OCIRepository/redis --path=./ --prune=true
```

Proven end to end: a no-login render was pushed to an OCI registry, an existing Flux
pulled it and applied it, and Redis came up — no `kubectl` from you at all.

## How it works

A Helm chart is a template. "Render" turns it into the exact Kubernetes YAML it would
install. Plain Helm renders and applies in one opaque step. Serverless mode renders
**to files you can read first**, from a named base the catalog already reviewed, and
lets you compare that output against Helm's own — so "it's the same as Helm" is
something you check, not take on trust. Then you install it however you like (a, b, or
c above). None of those steps contact ConfigHub.

## Honest caveats

- **Secrets.** The chart's render includes a Secret with a baked password. Applying the
  bundle (b) or pushing it (c) delivers that Secret — which for the OCI path means it
  lives in your registry. Supply your own and use a base like `reuse-existing-secret`
  for anything real; see the chart's [adoption caveats](../../data/cub-adoption-caveats/summary.md).
- **Apply ordering.** `kubectl apply -f` does not guarantee the Namespace is created
  before the objects in it — create the namespace first (as above). This is the same
  class of cub-direct edge as [no auto-prune and CRD ordering](./known-gaps-we-surface.md);
  a controller (Argo/Flux) handles them for you.
- **`cub installer push` is a different thing** — it pushes the *un-rendered installer
  package*, which Argo/Flux can't reconcile. The OCI install (c) uses `flux push
  artifact` on the *rendered* output.
- **Hook / CRD charts need more.** This is proven for a vanilla chart (Redis). Charts
  with Helm hooks, admission webhooks, or their own CRDs still need their lifecycle
  routes — see the per-chart pages.

## Where this is going

Serverless mode is the "capture" half — render, equivalence, provenance, named
variants, signing — and it installs and works on its own, as above. The fuller design
(resolve a chart by name from a signed catalog, collect target facts, record an
in-cluster install receipt, day-2 diff/upgrade/rollback) is in
`docs/planning/serverless-verified-install-plan.md`. The line stays honest: the moment
you want one change to propagate across many installs, that's the graph — and that's
where signing in begins.
