# The ConfigHub data model

**UNOFFICIAL/EXPERIMENTAL.** These are the terms used by the catalog and the
technical guides.

This guide explains how source packages, render records, ConfigHub Units,
variants, releases, and targets fit together.

## Before ConfigHub

- **Source package** is the input you already use: a Helm chart, AICR recipe,
  installer package, Kubara or Sveltos configuration, or ordinary Kubernetes
  YAML.
- **Preset configuration** is a maintained choice for that source. For Helm it
  fixes a chart version, values, release name, namespace, capabilities, and
  other render inputs.
- **Render intent** records everything needed to reproduce one Helm render. It
  also names prerequisites and lifecycle work such as CRDs, setup Jobs, and
  hooks. It does not contain the rendered objects.
- **Render variant** is the captured Kubernetes output for one base and one
  revision. It points back to the render intent and includes the object
  inventory and digest.
- **Literal configuration OCI** contains rendered Kubernetes objects rather
  than a chart that still needs to be rendered. `cub variant upload` can read
  one directly.

For Helm, the two layers are therefore:

```text
chart + values + render context + lifecycle choices
  -> render intent
  -> captured render variant
  -> exact Kubernetes objects
```

## Four Different Records

A deployable configuration is not the whole operational story. Keep these four
records separate so a package is not asked to prove something it cannot prove.

| Record | The question it answers | Example |
| --- | --- | --- |
| Source and intent | Where did this come from, and which choices produced it? | Chart and version, values, release name, namespace, API capabilities, source lock, and selected preset configuration. |
| Exact configuration | Which Kubernetes objects did we accept? | The captured render variant or literal YAML, with its object inventory and digest. |
| Lifecycle work | What must happen around an ordinary apply, in which order, and who performs it? | Install CRDs before custom resources, run a setup Job, stage a Secret, or wait for a cloud controller. |
| Runtime result | What happened on the selected target? | Controller convergence, ready workloads, a completed setup Job, a cloud resource becoming ready, or a successful model request. |

The records stay linked, but they do not collapse into one result. Render parity does
not prove that a workload became ready. A healthy Deployment does not prove that a
model answered a request. A route describing a hook does not prove that a delivery
controller ran it.

### Different work has different lifecycle rules

| Item | What must be recorded |
| --- | --- |
| Helm hooks and setup Jobs | When they run, their order, retry and interruption behavior, who runs them, and the receipt from the exact run. |
| CRDs | Who owns them, whether they are included, the order in which definitions and custom resources are applied, and the wait for the CRDs to become established. |
| Cloud provisioning | The controller or API that performs the work, required credentials and target facts, asynchronous status, failure and retry behavior, and cleanup or rollback responsibility. |
| Runtime images | The exact image digest and where it is referenced. Image publication and workload readiness are separate results. |
| Models | The model identity and version, access and storage requirements, runtime compatibility, and a real inference check when serving is claimed. |
| Configuration OCI | The immutable configuration or source package, its digest, and its consumer. Moving the OCI does not execute hooks, create cloud resources, or prove a workload result. |

OCI is the transport between tools and systems. It can carry exact configuration,
source material, routes, and explanatory records. It is not a universal execution
model. Argo CD, Flux, ConfigHub, a cloud controller, a setup Job, and a model server
still perform different work and need separate evidence.

## Inside ConfigHub

- **Unit** is a versioned, diffable piece of configuration. Rendered
  Kubernetes objects become Units when they are uploaded.
- **Space** groups the Units for one managed configuration, such as a base,
  development environment, production region, or customer.
- **Component** is the app, service, or platform capability being managed,
  such as `payments-api`, `redis`, or `ingress-nginx`. Today it is represented
  by standard Space metadata rather than a separate API object.
- **Base variant** is the reviewed starting configuration. For a Helm source,
  it corresponds to a supported render shape such as `no-crds` or
  `reuse-existing-secret`.
- **Derived variant** is a ConfigHub clone for a specific environment, region,
  customer, or target. Its changes are exact object changes; Helm is not
  rendered again.
- **Target fact** is something the destination must provide, such as an
  existing Secret, storage class, cloud identity, or installed CRD.
- **Lifecycle route** records work that ordinary apply cannot safely perform
  by itself. It says what must happen, in which order, under which delivery
  system, and which receipt proves completion.
- **Receipt** records a result for an exact configuration and target. A render
  receipt, controller result, or workload observation does not prove a broader
  claim than the inputs it names.

## After ConfigHub

- **Target** identifies where Units are released. `cub cluster up` creates a
  temporary cluster Space and its server-hosted OCI target for the local
  examples.
- **Space release OCI** is produced by `cub release publish <space>`. It
  contains the reviewed Units from that Space and has a pull URL such as
  `oci://oci.hub.confighub.com:443/space/my-app`.
- **Delivery consumer** is Argo CD, Flux, or a recorded direct path. It applies
  the Space release without rendering the original source package again.

A source-and-intent record can point to lifecycle routes, and a configuration OCI
can carry them beside the objects. The source record explains the choice; the route
defines the work; the runtime receipt records what happened. Keeping those roles
separate makes retries, upgrades, promotion, and rollback reviewable.

## How the pieces fit

```text
source package
  -> render intent and captured render variant
  -> exact objects uploaded as ConfigHub Units
  -> base and derived Spaces, diffs, checks, approvals, promotions
  -> cub release publish
  -> one Space release OCI
  -> Argo CD, Flux, or recorded direct apply
  -> live observations and receipts
```

## One component with several variants

```text
Component: payments-api

Variants:
  payments-api/base
  payments-api/dev
  payments-api/staging
  payments-api/prod-us
  payments-api/prod-eu
```

This lets a team answer concrete questions:

- What differs between the base and `prod-us`?
- Which environments will receive a base change?
- Did staging pass before production was promoted?
- Which target facts make `prod-eu` different?
- Did an AI-assisted edit stay within the approved fields?

Read [Creating variants](creating-variants.md),
[How ConfigHub delivers configuration through OCI](cub-deployment-path.md),
[Render intents and render variants](helm-render-intents.md),
[Target prerequisites](target-prerequisites.md), and
[What happens to Helm hooks](chart-hooks-what-happens.md).
