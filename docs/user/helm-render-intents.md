# Helm Render Intents

**UNOFFICIAL/EXPERIMENTAL**

This page explains how the catalog records a Helm render.

Start with these questions:

```text
For this chart, which named Helm render did we use?
What exact Kubernetes objects did it produce?
Can ConfigHub keep managing those objects after that?
```

## The Short Model

```text
chart version
  base variant: named Helm render choice
    render intent: inputs needed to repeat the render
    render variant: Kubernetes objects captured from that render
  managed variant: ConfigHub version made after the render
```

A component is an application or platform package: Redis, Prometheus,
ingress-nginx, a payments API, or a custom app.

The terms mean:

| Term | Plain meaning | Example |
| --- | --- | --- |
| Base variant | A named way to render a Helm chart. | Redis `default`, Redis `reuse-existing-secret`, Argo CD `no-crds` |
| Render intent | The inputs needed to repeat that render. | chart version, values file, namespace, release name, capabilities, source lock |
| Render variant | The captured Kubernetes output from that render. | the `variant-revision` file and the matching `packages/.../bases/...` directory |
| Managed variant | A ConfigHub version made after the rendered objects are uploaded. | dev, staging, prod, per-region, per-customer |

## Render Variant Examples

These examples are current catalog rows:

| Component | Base variant | Render intent | Captured render variant |
| --- | --- | --- | --- |
| Redis 25.5.3 | `default` | [`bitnami-redis-25-5-3-default.yaml`](../../data/helm-render-intents/intents/bitnami-redis-25-5-3-default.yaml) | [`revisions/default/r001/variant-revision.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/variant-revision.yaml) and [`packages/.../bases/default`](../../packages/bitnami/redis/25.5.3/bases/default) |
| Redis 25.5.3 | `reuse-existing-secret` | [`bitnami-redis-25-5-3-reuse-existing-secret.yaml`](../../data/helm-render-intents/intents/bitnami-redis-25-5-3-reuse-existing-secret.yaml) | [`revisions/reuse-existing-secret/r001/variant-revision.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/variant-revision.yaml) and [`packages/.../bases/reuse-existing-secret`](../../packages/bitnami/redis/25.5.3/bases/reuse-existing-secret) |
| Argo CD 9.5.17 | `no-crds` | [`argo-cd-argo-cd-9-5-17-no-crds.yaml`](../../data/helm-render-intents/intents/argo-cd-argo-cd-9-5-17-no-crds.yaml) | [`revisions/no-crds/r001/variant-revision.yaml`](../../recipes/argo-cd/argo-cd/9.5.17/revisions/no-crds/r001/variant-revision.yaml) and [`packages/.../bases/no-crds`](../../packages/argo-cd/argo-cd/9.5.17/bases/no-crds) |
| Prometheus 29.8.0 | `server-only-ephemeral` | [`prometheus-community-prometheus-29-8-0-server-only-ephemeral.yaml`](../../data/helm-render-intents/intents/prometheus-community-prometheus-29-8-0-server-only-ephemeral.yaml) | [`revisions/server-only-ephemeral/r001/variant-revision.yaml`](../../recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/variant-revision.yaml) and [`packages/.../bases/server-only-ephemeral`](../../packages/prometheus-community/prometheus/29.8.0/bases/server-only-ephemeral) |

The `default` and `reuse-existing-secret` Redis rows are different base
variants because they ask Helm to render different security choices. Each one
has its own render intent and its own captured output.

## The Full Model Underneath

```text
chart/version
  recipe
    base variant
      render intent
        render variant / rendered revision
          package base
            ConfigHub Units
              managed variants
                promotions / targets / observations
```

The full model matters because Helm charts often need work outside normal
rendered objects: CRDs, hooks, generated facts, target facts, webhook
certificates, namespaces, cloud identity, external Secrets, or setup jobs.

A render intent records:

- which chart and version are used;
- which base variant is being rendered;
- which values profile, namespace, release name, capability profile, and source
  lock are part of the render;
- where the captured render variant is stored;
- which evidence lanes exist for the row;
- which lifecycle routes and target prerequisites are known.

## Why We Generate It

The render intent gives people and agents one file that names the render inputs
and the matching output.

For a chart with CRDs, hooks, setup jobs, or external Secrets, it also points to
the recipe, captured render variant, package base, receipts, and matrix row.

We do not generate render intents for candidate or custom-discussion rows yet.
Those rows stay visible in the matrix, but they are not treated as runnable
configs until the underlying base path is real.

## Current Generated Surface

The generated surface is here:

- [summary](../../data/helm-render-intents/summary.md)
- [CSV](../../data/helm-render-intents/intents.csv)
- [JSON](../../data/helm-render-intents/intents.json)
- per-intent YAML files under `data/helm-render-intents/intents/`
- [contract](../../data/helm-render-intents/contract.md)

The verifier is:

```sh
npm run helm-render-intents:verify
```

That verifier checks the generated objects against the master matrix,
lifecycle-route data, and target-prerequisite action data.

## What This Does Not Claim

A render intent is not a production promise. It does not say every live lane is
green. It does not make hooks automatic. It does not create ConfigHub server
state by itself.

It says something narrower: this Helm base variant has a real catalog path, and
the inputs, captured output, evidence links, and known extra work are recorded
in one machine-readable object.
