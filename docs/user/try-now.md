# Try Now

**UNOFFICIAL/EXPERIMENTAL**

> Want to see a real run before you start? [first-run-walkthrough.md](./first-run-walkthrough.md)
> captures this flow end-to-end on a throwaway cluster — the actual commands,
> output, and one honest rough edge.

This page gives a short path through the catalog. Use Redis for the simple
happy path. Use kube-prometheus-stack when you want to inspect a serious Helm
chart with CRDs, webhooks, RBAC, generated facts, dependencies, extension
slots, and target prerequisites.

If you are deciding between `cub helm template`, `cub helm install`, public
`cub installer` packages, and ConfigHub-managed operations, start with
[Choose Your Path](./choose-your-path.md).

At each step, compare your output with
[Expected Results And Clusters](./expected-results-and-clusters.md). It explains
what you should see, when you need a Kubernetes cluster, when to use kind or
`cub-lk`, and why `npm run ...` checks are optional proof checks rather than
the default product workflow.

## Setup

Clone the repo. The lightweight documentation checks are optional, but useful if
you are reviewing the site or editing docs:

```sh
git clone https://github.com/confighub/helm-expt.git
cd helm-expt
npm run site:verify
npm run docs:verify
```

There are no npm dependencies. To render packages locally, install the
ConfigHub installer plugin:

```sh
cub version
cub plugin install confighub/installer
cub installer --help
```

Expected result:

```text
cub installer --help prints installer commands.
```

No Kubernetes cluster is needed for `cub installer setup` or for the Redis
render check below.

## Path 1: Redis Happy Path

Redis shows the shortest chart-to-package-to-render flow.

```sh
cub installer setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis

npm run redis:verify-install:render -- \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --namespace redis
```

Expected result:

```text
PASS redis:verify-install:render bitnami/redis/25.5.3 default
```

This proves your rendered Redis objects match the catalog acceptance contract.
You should also see a populated work directory under
`.tmp/demo/redis-default/out/`. For Redis `default`, generated Secret material
is separated under `out/secrets`, and workload manifests are under
`out/manifests`.

## Path 2: Upload To ConfigHub

Use this when you want to see the rendered objects as ConfigHub Units. This
requires an authenticated ConfigHub context.

```sh
cub auth login
cub context get -o json

cub installer upload \
  --work-dir .tmp/demo/redis-default \
  --space helm-redis-default \
  --component Redis \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant default \
  --unit-label Component=Redis \
  --unit-label HelmChart=bitnami-redis \
  --unit-label HelmChartVersion=25.5.3 \
  --unit-label Variant=default

npm run redis:verify-install:confighub -- \
  --base default \
  --space helm-redis-default
```

Expected result:

```text
ConfigHub has a helm-redis-default Space with labeled Redis Units.
```

In the ConfigHub UI, open the `helm-redis-default` Space and inspect Units and
labels. You should see Redis Units labeled with `Component=Redis` and
`Variant=default`.

## Path 3: Serious Chart Check

kube-prometheus-stack is the serious-chart proof path. It is useful because it
exercises the hard Helm features that small examples often avoid.

The useful question is not only "does the YAML match Helm?" Render parity is
the baseline. The serious-chart path also shows target facts and lifecycle
prerequisites: CRDs, admission webhook certificate material, and live
observation boundaries that must be explicit before a config-only install can
be trusted.

```sh
npm run kube-prometheus-stack:verify-proof
npm run kube-prometheus-stack:verify-package
npm run kube-prometheus-stack:compare
```

Expected result:

```text
The chart proof, package, and comparison checks pass.
```

This checks the committed proof and package for the serious chart. Use the full
live lanes when you need fresh cluster evidence.

Read [Chain Of Proof](./chain-of-proof.md) for the boundary between render
proof, ConfigHub desired state, GitOps handoff, and live observation. Read
[Prometheus High-Fanout Example](./prometheus-high-fanout.md) for the
kube-prometheus-stack base choices, prerequisites, and current production proof
plan. Read [Serious Chart Proof](./serious-chart-proof.md) for the shortest
explanation of why this chart is the hard public example.

## Next

- [Tutorial Sequence](./tutorial-sequence.md)
- [Choose Your Path](./choose-your-path.md)
- [Chain Of Proof](./chain-of-proof.md)
- [Verify It Yourself](./verify-it-yourself.md) — once applied to a cluster, confirm it is *working* (not just created) with cub-scout receipts (`object-set-matches`, `prerequisites-met`, `workloads-converged`)
- [Current Proof Status](./current-proof-status.md)
- [Chart Use Guide](../../data/chart-use-guide/summary.md)
- [Catalog Dashboard](../../site/index.html)
- [Top-20 Base Readiness](../../data/top20-base-readiness/summary.md)
