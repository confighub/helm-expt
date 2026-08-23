# The ConfigHub data model

**UNOFFICIAL/EXPERIMENTAL.** These are the terms used by the catalog and the
technical guides.

This guide explains how source packages, processing records, exact Kubernetes
objects, ConfigHub Units, variants, releases, and targets fit together.

## From source to a reviewed base

Every source follows the same decisions, even when one step does no work:

```text
source + processing intent
  -> select and lock inputs
  -> materialize exact Kubernetes objects
  -> capture the exact configuration revision
  -> identify lifecycle requirements
  -> decide the flattening lane for the intended path
  -> retain a reviewed base
```

After the base exists, configuration and lifecycle decisions continue together:

```text
base
  -> derive or update a variant
  -> recheck affected source, flattening, lifecycle, and ownership facts
  -> resolve lifecycle routes for the exact variant, destination, and runtime
  -> compare, test, approve, and promote
  -> publish the release OCI
  -> reconcile objects and perform lifecycle work
  -> observe and record receipts
```

This is not a one-way build pipeline. A source upgrade rematerializes the base. A
variant can introduce a new prerequisite. A destination can select a different route
without changing the Kubernetes objects.

- **Source package or configuration** is the input you already use: a Helm
  chart, typed Timoni module, AICR recipe, installer package, Kubara or Sveltos
  configuration, OCI, or ordinary Kubernetes YAML.
- **Processing intent** records the source identity and the choices needed to
  produce or select exact objects. The concrete record must match the source.
- **Materialize** means produce or read those exact objects. Helm renders.
  Timoni builds. AICR and Kubara generate or compose. Literal YAML and literal
  configuration OCI are already materialized, so this step is a recorded no-op.
- **Exact configuration revision** is the accepted object set, inventory, and
  digest for one revision.
- **Flatten** means retain the exact objects so delivery does not rerun the
  source processor. The verdict is `safe-to-flatten`, `flatten-with-routes`,
  `unsafe-to-flatten`, or `born-flattened`. An unsafe result means process the
  source late (`render late` for Helm).
- **Lifecycle requirement** records work or target state needed around ordinary
  apply, such as CRDs, hooks, setup Jobs, certificates, cloud resources, model
  preparation, controllers, or prerequisite Secrets.
- **Route intent** records portable handling proposed by the source or base.
- **Resolved lifecycle route** binds those requirements to an exact variant,
  destination, delivery runtime, order, actor, checks, retry rule, and failure rule.
  An explicit `no route required` decision is different from a missing record.
- **Protected local field** records downstream field ownership. A protected
  input keeps secret material outside portable configuration. Prune protection
  is a separate delivery rule.

| Source | Materialization step | Source-and-intent record |
| --- | --- | --- |
| Helm | Render with the recorded chart context. | `HelmRenderIntent`, linked to a captured Helm render variant. |
| Timoni | Build the pinned module or bundle with its typed values. | Module OCI version and digest, typed schema, selected values, build receipt, and lifecycle workflow. |
| AICR | Run its declared composition step. | Native AICR recipe, choices, controller requirements, receipts, and output digest. |
| Kubara or another generator | Run its declared generation step. | Source revision, choices, controller requirements, receipts, and output digest. |
| Installer or source OCI | Pull by digest and invoke its declared processor. | OCI role, digest, processor, selections, and receipts. |
| Literal configuration OCI | Pull and read the objects; no source transformation is needed. | OCI digest, provenance, object inventory, checks, and transformations. |
| Plain Kubernetes YAML | Parse and canonicalize the files; no source transformation is needed. | Source revision or path, checksums, object inventory, and checks. |
| ConfigHub Units or release OCI | Read the retained revision; no source transformation is needed. | Space and Unit revisions, source link, approvals, release digest, and receipts. |

A source OCI and a literal configuration OCI have different jobs. The first still
needs its declared processor. The second contains the exact objects a delivery
consumer can read. OCI is transport in both cases; it does not execute lifecycle
routes.

Catalog records keep the precise source type. The live apply-policy profile uses a
smaller set of labels to select checks: plain YAML, literal configuration OCI, and
ConfigHub revisions are grouped as `rendered-config`. That policy label does not
replace the source-and-intent record.

### Helm's two linked records

For Helm, a **render intent** records everything needed to reproduce one render.
It also names prerequisites and lifecycle work such as CRDs, setup Jobs, and hooks.
It does not contain the rendered objects. A **render variant** is the captured
Kubernetes output for one base and one revision. It points back to the render intent
and includes the object inventory and digest.

For Helm, the two layers are therefore:

```text
chart + values + render context + lifecycle choices
  -> render intent
  -> captured render variant
  -> exact Kubernetes objects
```

Do not create a fake render variant for Timoni, YAML, AICR, or literal OCI that did
not use Helm rendering. Their source-and-intent record links directly to the exact
configuration revision. Do not call the combined record a "full rendering." The
complete managed result is source and intent, exact configuration, lifecycle
requirements, route resolutions, and runtime receipts.

## Records that answer different questions

A deployable configuration is not the whole operational story. Keep these records
separate so one file or receipt is not asked to prove something it cannot prove.

| Record | The question it answers | Example |
| --- | --- | --- |
| Source and intent | Where did this come from, and which choices produced it? | Chart and version, values, release name, namespace, API capabilities, source lock, and selected preset configuration. |
| Exact configuration | Which Kubernetes objects did we accept? | The captured render variant or literal YAML, with its object inventory and digest. |
| Flattening verdict | Can the exact objects travel alone, with routes, or must the source processor still run later? | `flatten-with-routes` for an exact chart version and base because CRDs need ordered handling. |
| Lifecycle requirements and route intent | What work or target state is known before a destination is selected? | Install CRDs before custom resources, require an external Secret, or preserve upstream component order. |
| Field ownership | Which source, variant, or destination owns each controlled choice? | Helm values own a source-rendered field; production owns its external-Secret reference. |
| Variant revision | Which exact changes did this environment or customer make? | Development changes an image; production keeps a storage class and Secret reference. |
| Route resolution | How will this exact variant run on this destination through this delivery runtime? | Argo CD sync waves, Flux dependencies, or a blocked promotion because a prerequisite is absent. |
| Delivery and runtime receipts | What was published, reconciled, executed, and observed? | Release digest, controller result, completed setup Job, ready workload, cloud resource status, or successful model request. |

The records stay linked, but they do not collapse into one result. Render parity does
not prove that a workload became ready. A healthy Deployment does not prove that a
model answered a request. A route intent describing a hook does not prove that a
delivery controller ran it.

The hashes also stay separate. A base-revision digest, exact-object digest, OCI
manifest digest, ConfigHub Unit data hash, and release OCI digest identify different
records. A handoff receipt names both sides and compares their exact objects. It must
not call unlike hashes "the same digest." The generated Catalog records state each
digest role explicitly.

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
- **Lifecycle requirements** inherited from the base are rechecked when a variant
  changes or receives a target.
- **Resolved lifecycle route** says what must happen for that exact variant and
  target, in which order, under which delivery system, and which receipt proves
  completion.
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

A source-and-intent record can point to lifecycle requirements and route intents, and
a configuration OCI can carry them beside the objects. A promotion or release binds
those requirements to the selected variant, destination, and delivery runtime. The
route resolution defines the work; the receipt records what happened. Keeping those
roles separate makes retries, upgrades, promotion, and rollback reviewable.

## How the pieces fit

```text
source package or configuration + processing intent
  -> materialize exact Kubernetes objects
  -> decide safe-to-flatten, flatten-with-routes, unsafe-to-flatten, or born-flattened
  -> exact objects, source record, requirements, and route intents retained as a base
  -> derived Space and exact variant revision
  -> destination-specific route resolution, diff, checks, approval, and promotion
  -> cub release publish
  -> one Space release OCI with the applicable companion records
  -> Argo CD, Flux, or recorded direct apply
  -> lifecycle execution, live observations, and scoped receipts
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
