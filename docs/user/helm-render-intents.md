# Helm Render Intents

**UNOFFICIAL/EXPERIMENTAL**

This page explains how the catalog records a Helm render. A
`HelmRenderIntent` is the Helm-specific **source and intent record**: it says
where the rendered objects came from, which Helm choices produced them, and
which prerequisites or lifecycle work belong with them.

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

## Values, ConfigHub Changes, And Live State

Every intent has a `spec.settingSources` section:

| Field | What it says |
| --- | --- |
| `helmValues` | Which values profile produced the base render. |
| `configHubChanges` | The catalog base has no post-render edits. Those begin after upload and are recorded as Unit revisions or derived variants. |
| `installWork` | How many prerequisites and lifecycle routes belong around the objects. |
| `liveCluster` | Live state is observed separately; it is not used as desired configuration by itself. |
| `overlapPolicy` | `review-required`: if a later Helm render and a ConfigHub revision touch the same field, review the overlap before promotion. |

`installWork.status` has three meanings:

- `recorded`: both the lifecycle route and target-prerequisite review are
  complete, and at least one route or requirement is attached;
- `none-required`: both reviews explicitly say that this base needs no separate
  lifecycle route or target prerequisite;
- `review-required`: at least one of those two reviews is still incomplete.

A route on its own does not hide a missing target review, and a declared target
requirement does not hide a missing lifecycle review.

This is the machine-readable form of the table shown on every chart page and
in every demo Space README. It does not claim that every rendered field can be
traced back to one exact Helm value key; arbitrary chart templates make that
claim unsafe. It does show which layer supplied the base and which changes
happened later in ConfigHub.

## Render Variant Examples

These examples are current catalog rows:

| Component | Preset / base variant | Package users pull | Render intent | Full rendered YAML | Context and checks |
| --- | --- | --- | --- | --- | --- |
| Redis 25.5.3 | `default` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:7ad5fa6de0aa9c29df8cd26650893ebae6ad149a7c5ac33a8beedf5b02e2ac33` | [`bitnami-redis-25-5-3-default.yaml`](../../data/helm-render-intents/intents/bitnami-redis-25-5-3-default.yaml) | [`release-objects.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/default/r001/variant-revision.yaml) and [`packages/.../bases/default`](../../packages/bitnami/redis/25.5.3/bases/default) |
| Redis 25.5.3 | `reuse-existing-secret` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-redis:25.5.3@sha256:7ad5fa6de0aa9c29df8cd26650893ebae6ad149a7c5ac33a8beedf5b02e2ac33` | [`bitnami-redis-25-5-3-reuse-existing-secret.yaml`](../../data/helm-render-intents/intents/bitnami-redis-25-5-3-reuse-existing-secret.yaml) | [`release-objects.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/bitnami/redis/25.5.3/revisions/reuse-existing-secret/r001/variant-revision.yaml) and [`packages/.../bases/reuse-existing-secret`](../../packages/bitnami/redis/25.5.3/bases/reuse-existing-secret) |
| Argo CD 9.5.15 | `no-crds` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/argo-cd-argo-cd:9.5.15@sha256:3404bc0aed621a447aa76cd3e07f28a7f9bfd4d1a8da1385352852386643e665` | [`argo-cd-argo-cd-9-5-15-no-crds.yaml`](../../data/helm-render-intents/intents/argo-cd-argo-cd-9-5-15-no-crds.yaml) | [`release-objects.yaml`](../../recipes/argo-cd/argo-cd/9.5.15/revisions/no-crds/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/argo-cd/argo-cd/9.5.15/revisions/no-crds/r001/variant-revision.yaml) and [`packages/.../bases/no-crds`](../../packages/argo-cd/argo-cd/9.5.15/bases/no-crds) |
| kube-prometheus-stack 85.3.3 | `no-crds` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-kube-prometheus-stack:85.3.3@sha256:bc8b2b5a3b92e2e5e44638dd8da9ae49b2cfb5edccbe664208c8251585148679` | [`prometheus-community-kube-prometheus-stack-85-3-3-no-crds.yaml`](../../data/helm-render-intents/intents/prometheus-community-kube-prometheus-stack-85-3-3-no-crds.yaml) | [`release-objects.yaml`](../../recipes/prometheus-community/kube-prometheus-stack/85.3.3/revisions/no-crds/r001/rendered/release-objects.yaml) | The intent lists ten required CRDs, the admission Secret, and the Argo CD and Flux handling for each lifecycle route. |
| Prometheus 29.8.0 | `server-only-ephemeral` | `oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/prometheus-community-prometheus:29.8.0@sha256:5cf6400c75d1cafc06fee5ddaada47651926bdab3a9d674a9f966540b29edd26` | [`prometheus-community-prometheus-29-8-0-server-only-ephemeral.yaml`](../../data/helm-render-intents/intents/prometheus-community-prometheus-29-8-0-server-only-ephemeral.yaml) | [`release-objects.yaml`](../../recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/rendered/release-objects.yaml) | [`variant-revision.yaml`](../../recipes/prometheus-community/prometheus/29.8.0/revisions/server-only-ephemeral/r001/variant-revision.yaml) and [`packages/.../bases/server-only-ephemeral`](../../packages/prometheus-community/prometheus/29.8.0/bases/server-only-ephemeral) |

Each package reference keeps the readable chart version and pins the exact
published manifest digest. The render intent records that same immutable
reference with the Helm inputs, rendered objects, prerequisites, and lifecycle
work.

The public installer package also carries a copy under
`records/<base>/helm-render-intent.yaml`, beside the matching cross-format
`source-and-intent.yaml` record. Pulling the package therefore gives a user or
agent the objects and the records needed to explain them without cloning this
repository. The copy omits the package's own final digest; the publication
receipt and signature bind that digest after the package is built.

The `default` and `reuse-existing-secret` Redis rows are different base
variants because they ask Helm to render different security choices. Each one
has its own render intent and its own captured output.

The Kube Prometheus Stack `no-crds` intent links the exact Argo CD and Flux
receipt. Both controllers installed 85.3.3, upgraded to 86.1.0, replaced the
two completed setup Jobs, and passed the recorded runtime checks. Direct apply
has not run that upgrade, and ConfigHub does not select the route automatically.
[Read the controller result](../../data/kps-gitops-lifecycle-proof/summary.md).

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

- `targetFacts.declared` is the prerequisite decision for this base. It usually
  comes from the base variant. A review completed after a retained base was
  published can instead come from
  [`config-catalog/target-fact-reviews.yaml`](../../config-catalog/target-fact-reviews.yaml),
  so the Catalog can add evidence without changing the historical base and its
  checksums. `targetFacts.coverage.declarationSource` names the source used.
  When the installer package carries the exact CRDs, each CRD also gets a
  `packageSource` and repository `packagePath`.
- `targetFacts.requirements` turns that declaration into a consistent list of
  Secrets, CRDs, namespaces, values, storage, DNS names, or topology. Each item
  says whether it must be checked before render or before apply. The default
  freshness rule is one render or one apply, so a previous check is not reused
  for the next operation. Its `check` field uses the packaged CRD file instead
  of a placeholder command when that file exists.
- `targetFacts.actions` contains follow-up work derived from an observed failed
  or blocked run. A base can have declared facts even when no failure has
  produced an action record.
- `targetFacts.review` records the prerequisite scope that was checked and
  which repository evidence supports the decision. It is required before an
  empty `targetFacts` declaration can mean that no separate prerequisite is
  needed.
- `targetFacts.coverage.evidence` carries those evidence links into the
  generated record. An empty declaration without a review remains an
  `actionable-gap`.

For a chart with lifecycle routes, each route names the version that supplied
its evidence. It has separate records for direct commands, Argo CD, and Flux.
`pass` means that exact path ran. `mapping-only` explains how the controller
would handle the work but does not claim that it ran.

If a route is carried forward from another chart version, the route remains
visible as a useful starting point, but the lifecycle coverage state becomes
`actionable-gap`. The kube-prometheus-stack `86.1.0` intent now points to its
own packaged CRDs and records that it passed as the target of the 85.3.3 to
86.1.0 controller upgrade. Its inherited route descriptions still point to
85.3.3 evidence, so the intent does not present that bounded upgrade result as
a fresh 86.1.0 install or as proof for a different version pair.

## Coverage For Every Base

Every generated render intent has two coverage states:

| Area | Complete states | Missing-work state |
| --- | --- | --- |
| Hooks and lifecycle work | `attached` or `no-route-required` | `actionable-gap` |
| Target prerequisites | `attached`, `attached-with-observed-actions`, or `no-target-facts-required` | `actionable-gap` |

`no-route-required` and `no-target-facts-required` are explicit decisions. For
target prerequisites, an empty declaration must be paired with a review that
states the checked scope and links the evidence. That pair may be stored in the
base, or in the Catalog review file when the evidence was added after the base
was retained. A missing or unreviewed declaration does not receive either
complete state.

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

That verifier checks the generated objects against the master matrix, target
facts declared by the base or Catalog review, lifecycle-route data, GitOps
route mappings, and target-prerequisite action data. It also fails when an
evidence path is missing, a route hides chart-version drift, a prerequisite
lacks a check point or freshness rule, or the generated gap list omits an
incomplete base.

## What This Does Not Claim

A render intent is not a production promise. It does not say every live lane is
green. It does not make hooks automatic. It does not create ConfigHub server
state by itself.

It says something narrower: this Helm preset/base variant has a real catalog
path, and the inputs, captured output, evidence links, and known extra work are
recorded in one machine-readable object.
