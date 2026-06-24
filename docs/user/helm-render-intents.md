# Helm Render Intents

**UNOFFICIAL/EXPERIMENTAL**

This page explains the two-layer model behind the Helm catalog.

Most people should not need to think about every file in a recipe. They should
be able to ask a simpler question:

```text
I want this component.
Which base variant renders it?
Which managed variants can I run after that?
```

A component is the thing you are configuring and shipping: Redis, Prometheus,
ingress-nginx, a payments API, a platform package, or a custom app. A base
variant says how Helm is rendered for that component. A managed variant starts
after the render, when ConfigHub can compare, promote, approve, deliver, and
observe the resulting Kubernetes objects.

## The Short Model

```text
Component
  base variants: how Helm is rendered
  managed variants: how ConfigHub operates the rendered config
```

This is the model we want most users and agents to see first. It is close to a
HelmChart-style config, but it is generated only when the catalog has a real
base-variant path behind it.

## The Full Model Underneath

```text
chart/version
  recipe
    base variant
      render intent
        rendered revision
          package base
            ConfigHub Units
              managed variants
                promotions / targets / observations
```

The full model matters because Helm charts have quirks. A chart may need CRDs,
hooks, generated facts, target facts, webhook certificates, namespaces, cloud
identity, or external Secrets. Those details cannot be waved away by a small
YAML object.

The render intent sits in the middle. It is the compact config object that says:

- which chart and version are used;
- which base variant is being rendered;
- which values profile, namespace, release name, capability profile, and source
  lock are part of the render;
- which package base and rendered revision back it;
- which evidence lanes exist for the row;
- which lifecycle routes and target prerequisites are known.

## Why We Generate It

The render intent gives us the useful compact object without throwing away the
proof chain. It lets a person or agent talk about a base variant as one thing,
while still being able to open the recipe, rendered revision, package base,
receipts, and matrix row when the chart is difficult.

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

That verifier checks the generated objects against the master matrix, lifecycle
route data, and target-prerequisite action data.

## What This Does Not Claim

A render intent is not a production promise. It does not say every live lane is
green. It does not make hooks automatic. It does not create ConfigHub server
state by itself.

It says something narrower and more useful: this Helm base variant has a real
catalog path, and its render inputs and known quirks are now recorded in one
machine-readable object.
