# Helm Render Intents

**UNOFFICIAL/EXPERIMENTAL**

This page explains how the catalog records a Helm render.

If you are reading the public website, the first word you see is **preset**.
In this repo, that same supported chart choice is usually called a **base
variant**. A preset/base variant is a named way to render one chart version,
such as `default`, `no-crds`, `reuse-existing-secret`, `server-only`, or `ha`.

Start with these questions:

```text
For this chart, which named Helm render did we use?
What exact Kubernetes objects did it produce?
What extra work does the chart need around those objects?
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
| Preset / base variant | A named way to render a Helm chart. `Preset` is the public word; `base variant` is the repo word. | Redis `default`, Redis `reuse-existing-secret`, Argo CD `no-crds` |
| Render intent | The inputs needed to repeat that render. | chart version, values file, namespace, release name, capabilities, source lock |
| Render variant | The captured output from that render. The full YAML is `rendered/release-objects.yaml`; the revision file binds it to inputs and checksums. | Redis `release-objects.yaml` plus `variant-revision.yaml` |
| Managed variant | A ConfigHub version made after the rendered objects are uploaded. | dev, staging, prod, per-region, per-customer |

Do not stop at `release-objects.yaml` when you need the full record. That file
is the Kubernetes object output. The render intent, revision, lifecycle routes,
target facts, receipts, and chart page explain the Helm inputs and any hook,
CRD, setup-job, Secret, or target-prerequisite work around that output.

## Render Variant Examples

These examples are current catalog rows:

| Component | Preset / base variant | Package users pull | Render intent | Full rendered YAML | Context and checks |
| --- | --- | --- | --- | --- | --- |
| Redis 25.5.3 | `default` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3` | [`bitnami-redis-25-5-3-default.yaml`](../../data/helm-render-intents/intents/bitnami-redis-25-5-3-default.yaml) | [`release-objects.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/variant-revision.yaml) and [`packages/.../bases/default`](../../packages/bitnami/redis/25.5.3/bases/default) |
| Redis 25.5.3 | `reuse-existing-secret` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3` | [`bitnami-redis-25-5-3-reuse-existing-secret.yaml`](../../data/helm-render-intents/intents/bitnami-redis-25-5-3-reuse-existing-secret.yaml) | [`release-objects.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/variant-revision.yaml) and [`packages/.../bases/reuse-existing-secret`](../../packages/bitnami/redis/25.5.3/bases/reuse-existing-secret) |
| Argo CD 9.5.15 | `no-crds` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/argo-cd-argo-cd:9.5.15` | [`argo-cd-argo-cd-9-5-15-no-crds.yaml`](../../data/helm-render-intents/intents/argo-cd-argo-cd-9-5-15-no-crds.yaml) | [`release-objects.yaml`](../../recipes/argo-cd/argo-cd/9.5.15/revisions/no-crds/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/argo-cd/argo-cd/9.5.15/revisions/no-crds/r001/variant-revision.yaml) and [`packages/.../bases/no-crds`](../../packages/argo-cd/argo-cd/9.5.15/bases/no-crds) |
| kube-prometheus-stack 85.3.3 | `no-crds` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack:85.3.3` | [`prometheus-community-kube-prometheus-stack-85-3-3-no-crds.yaml`](../../data/helm-render-intents/intents/prometheus-community-kube-prometheus-stack-85-3-3-no-crds.yaml) | [`release-objects.yaml`](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/rendered/release-objects.yaml) | The intent lists ten required CRDs, the admission Secret, and the Argo CD and Flux handling for each lifecycle route. |
| Prometheus 29.8.0 | `server-only-ephemeral` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-prometheus:29.8.0` | [`prometheus-community-prometheus-29-8-0-server-only-ephemeral.yaml`](../../data/helm-render-intents/intents/prometheus-community-prometheus-29-8-0-server-only-ephemeral.yaml) | [`release-objects.yaml`](../../recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/variant-revision.yaml) and [`packages/.../bases/server-only-ephemeral`](../../packages/prometheus-community/prometheus/29.8.0/bases/server-only-ephemeral) |

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
- which preset/base variant is being rendered;
- which values profile, namespace, release name, capability profile, and source
  lock are part of the render;
- which installer package OCI ref users pull for that chart version;
- where the full rendered YAML is stored;
- where the revision/checksum record is stored;
- which evidence lanes exist for the row;
- which lifecycle routes and target prerequisites are known.

The target-prerequisite section has two parts:

- `targetFacts.declared` is the original declaration copied from the base
  variant.
- `targetFacts.requirements` turns that declaration into a consistent list of
  Secrets, CRDs, namespaces, values, storage, DNS names, or topology. Each item
  says whether it must be checked before render or before apply. The default
  freshness rule is one render or one apply, so a previous check is not reused
  for the next operation.
- `targetFacts.actions` contains follow-up work derived from an observed failed
  or blocked run. A base can have declared facts even when no failure has
  produced an action record.

For a chart with lifecycle routes, each route names the version that supplied
its evidence. It has separate records for direct commands, Argo CD, and Flux.
`pass` means that exact path ran. `mapping-only` explains how the controller
would handle the work but does not claim that it ran.

If a route is carried forward from another chart version, the route remains
visible as a useful starting point, but the lifecycle coverage state becomes
`actionable-gap`. For example, the kube-prometheus-stack `86.1.0` mappings
currently point to `85.3.3` evidence. They do not become `86.1.0` proof until a
version-matched run and receipt exist.

## Coverage For Every Base

Every generated render intent has two coverage states:

| Area | Complete states | Missing-work state |
| --- | --- | --- |
| Hooks and lifecycle work | `attached` or `no-route-required` | `actionable-gap` |
| Target prerequisites | `attached`, `attached-with-observed-actions`, or `no-target-facts-required` | `actionable-gap` |

`no-route-required` and `no-target-facts-required` are explicit decisions. A
missing declaration does not receive either state.

The current work list is generated here:

- [human-readable gap list](../../data/helm-render-intents/contract-gaps.md)
- [CSV gap list](../../data/helm-render-intents/contract-gaps.csv)

The gap list currently includes bases whose hooks still need a route, bases
whose route evidence comes from another chart version, and bases that have not
yet said what the target must provide.

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
- [contract gaps](../../data/helm-render-intents/contract-gaps.md)

The verifier is:

```sh
npm run helm-render-intents:verify
npm run helm-render-intents:contracts:verify
```

That verifier checks the generated objects against the master matrix, the base
variant's declared target facts, lifecycle-route data, GitOps route mappings,
and target-prerequisite action data. It also fails when an evidence path is
missing, a route hides chart-version drift, a prerequisite lacks a check point
or freshness rule, or the generated gap list omits an incomplete base.

## What This Does Not Claim

A render intent is not a production promise. It does not say every live lane is
green. It does not make hooks automatic. It does not create ConfigHub server
state by itself.

It says something narrower: this Helm preset/base variant has a real catalog
path, and the inputs, captured output, evidence links, and known extra work are
recorded in one machine-readable object.
