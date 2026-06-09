# Try Now

**UNOFFICIAL/EXPERIMENTAL**

This page gives a short path through the catalog. Use Redis for the simple
happy path. Use kube-prometheus-stack when you want to inspect a serious Helm
chart with CRDs, webhooks, RBAC, generated facts, dependencies, extension
slots, and target prerequisites.

## Setup

Clone the repo and run the lightweight checks:

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
labels.

## Path 3: Serious Chart Check

kube-prometheus-stack is the serious-chart proof path. It is useful because it
exercises the hard Helm features that small examples often avoid.

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
kube-prometheus-stack base choices and prerequisites.

## Next

- [Tutorial Sequence](./tutorial-sequence.md)
- [Chain Of Proof](./chain-of-proof.md)
- [Current Proof Status](./current-proof-status.md)
- [Catalog Dashboard](../../site/index.html)
- [Top-20 Base Readiness](../../data/top20-base-readiness/summary.md)
