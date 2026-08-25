# The configuration processing model

This is the working model used by the Catalog. The
[catalog doctrine](../reference/config-catalog-doctrine.md) defines the rules in
full.

## Start with the question

The same four questions apply to Helm, AICR, Timoni, Kubara, installer packages,
OCI, YAML, and retained ConfigHub revisions:

| Question | What answers it | Needs a Catalog match? | Needs destination access? | Needs the selected configuration deployed? |
| --- | --- | --- | --- | --- |
| **What do I have?** | Inspect the source, exact files, OCI, or a snapshot of an existing system. | No | Usually no. A live snapshot needs read access to the system it measures. | No |
| **What will it produce?** | Run the source-native materialization step, or read the objects when the source is already literal configuration. | No | No | No |
| **Can this destination accept it?** | Check the exact candidate against the chosen destination's APIs, CRDs, Secrets, policies, controllers, credentials, hardware, and lifecycle requirements. | No | Yes | No |
| **Did it work?** | Check the exact delivered revision, controller result, resource health, runtime behavior, drift, and rollback result required by the claim. | No | Yes | Yes |

A Catalog entry can shorten any investigation, but it is never a prerequisite for
inspecting or processing a user's own configuration. The answer to each question
must state its required inputs, evidence state, and result state. If the required
destination or deployment does not exist, the check is **blocked** or **not run**.
It is not a failed configuration, failed workload, or failed conformance result.

AICR makes the distinction especially clear. `aicr snapshot` and `aicr diff` can
compare GPU-node state without selecting a recipe or deploying a bundle. A
recipe-dependent `expected-resources` check can run only after the declared
components have been deployed. The same rule applies elsewhere: a Helm render is
not destination acceptance, an OCI publication is not controller reconciliation,
and an Argo CD sync is not proof that an application request succeeded.

The generated [cross-format assessment cases](../../data/config-assessment-stages/summary.md)
test these boundaries, and every generated Catalog base records all four answers in
`spec.assessment`.

## The processing sequence

The four questions sit above a more detailed sequence. A maintained configuration
records:

1. the source, version, and choices;
2. the exact Kubernetes objects produced or read from that source;
3. whether those objects can be retained as deployable configuration, with any
   source processor removed from the delivery path;
4. CRDs, hooks, setup Jobs, certificates, Secrets, cloud resources, controllers,
   models, ordering, and other lifecycle work;
5. variants, comparisons, tests, approvals, and promotions; and
6. release, delivery, live observation, and rollback evidence.

A record can be complete through materialization and still have no destination or
deployment proof. The Catalog must show that boundary rather than collapsing every
stage into one status.

## Where OCI fits

OCI is the transport, not the processor and not the deployment proof. We use three
different OCI roles:

| OCI role | What it carries | What happens next |
| --- | --- | --- |
| **Source package OCI** | A chart, installer package, AICR-generated chart, or another input that still needs a processor. | Run the named processor to produce exact objects. |
| **Literal configuration OCI** | Exact Kubernetes objects that have already been materialized. | Inspect, retain, compare, or deliver those objects without rerunning the source processor. |
| **ConfigHub release OCI** | One approved ConfigHub revision for delivery. | Argo CD, Flux, or another recorded runtime reconciles that exact release. |

These artifacts can contain related objects but have different manifests and
digests. A receipt binds stages by naming both identities and comparing the objects;
it never calls unlike digests the same digest.

## Two connected tracks

The model tracks both the configuration and the work needed to use it.

```text
configuration lineage
  source and intent -> exact base -> derived variant -> promoted release

lifecycle handling
  requirements -> route intent -> destination resolution -> execution -> receipt
```

The tracks meet more than once. Source processing reveals lifecycle requirements.
A derived variant can add, remove, or change them. The final route is therefore
resolved only after the exact variant, destination, and delivery runtime are known.

The full operating sequence is:

```text
source + processing intent
  -> select and lock the inputs
  -> materialize exact Kubernetes objects
  -> capture an exact configuration revision
  -> identify lifecycle requirements
  -> decide the flattening lane for the intended path
  -> retain a reviewed base
  -> derive or update a variant
  -> recheck affected requirements, ownership, and flattening assumptions
  -> resolve lifecycle routes for the variant, destination, and delivery runtime
  -> compare, test, approve, and promote
  -> publish an immutable release
  -> reconcile the objects and perform the lifecycle work
  -> observe the result and record receipts
```

Helm, Timoni, AICR, Kubara, OCI, and YAML use the same decisions. They do not use
the same processor. Helm renders, Timoni builds, and AICR or Kubara compose or
generate. A step can be a recorded no-op: literal YAML already contains exact
objects, for example. A source refresh, variant change, or new destination can send
the process back to an earlier decision.

## Rules that keep the model usable

- Keep the source identity, exact-object digest, OCI digest, ConfigHub data hash, and
  release digest separate.
- Decide flattening for one processing boundary. Flattening an AICR or Argo CD wrapper
  does not flatten the charts it still references.
- Record missing lifecycle information as a gap. Do not translate silence into "no
  route required."
- Recheck lifecycle requirements and field ownership after a variant changes.
- Resolve the route after the exact variant, destination, and delivery runtime are
  known. A base route intent is input to that decision, not its final answer.
- Promotion compares objects, lifecycle changes, and protected fields. Delivery then
  performs the selected route, and a receipt records the result.

## The core words

| Word | What it is | Where it lives |
| --- | --- | --- |
| **Source and intent** | Where the configuration came from and which choices produced or selected it. | A source-specific record, linked to the exact configuration. |
| **Materialize** | Produce or read the exact Kubernetes objects that will be reviewed. | In a local tool, build, or source adapter. |
| **Exact configuration revision** | One accepted Kubernetes object set, inventory, and digest. | Local files or OCI before upload; ConfigHub Units after upload. |
| **Flatten** | Retain the exact objects so delivery does not rerun the source processor. | A recorded decision for an exact source, configuration, and target path. |
| **Flattening verdict** | The decision to flatten, flatten with routes, or process the source late. Literal sources can be born flattened. | A record scoped to an exact source, configuration, and intended delivery path. |
| **Lifecycle requirement** | Something that must exist or happen around ordinary apply, such as a CRD, hook, setup Job, certificate, controller, model, cloud resource, or prerequisite Secret. | Discovered from the source, exact objects, variant, or destination. |
| **Route intent** | A portable proposal for handling one or more lifecycle requirements. | Beside the base configuration or source record. |
| **Resolved lifecycle route** | The selected actor, order, mechanism, checks, retry rule, and failure rule for an exact variant, destination, and delivery runtime. | A promotion or release record linked to the exact configuration digest and target. |
| **Field ownership** | Which fields remain controlled by the source, a ConfigHub variant, or the destination. | Source policy, variant history, and promotion review. |
| **Receipt** | The recorded result of a generation, check, route, promotion, delivery, or runtime test. | Committed evidence or ConfigHub history. |
| **Base variant** | One named, reviewed starting configuration. | A package and, after upload, a root ConfigHub Space. |
| **Derived variant** | A ConfigHub Space cloned from an uploaded base for an environment, region, or customer. It records its upstream base and does not rerender Helm. | ConfigHub. |

In one sentence: **materialize exact objects, keep the source and lifecycle context,
then retain reviewed changes as variants that can be promoted and delivered.**

## Source-specific words

| Word | Meaning |
| --- | --- |
| **Helm recipe** | The chart, version, values, named preset configurations, and declared lifecycle choices used by a Helm installer package. |
| **AICR recipe** | AICR's native document containing resolved criteria, components, order, and checks. |
| **Timoni module or bundle** | A typed source package selected by OCI version and digest, built with recorded values. It is not a Helm recipe. |
| **Render** | Helm's materialization step. It produces exact Kubernetes objects but does not apply them. |
| **Helm render intent** | The chart inputs, context, source lock, prerequisites, and lifecycle choices for one render. |
| **Helm render variant** | The captured object output for one base and revision, linked to its intent and digest. |

**Recipe is not the general name for a configuration.** Use it only when the
source tool has a recipe. OCI and plain YAML use a source-and-intent record and
an exact configuration revision instead.

Do not create a render variant for literal YAML or another source that did not render.
Its source-and-intent record links directly to its exact configuration revision.

## The source and intent record

Every maintained base needs a record that explains where its objects came from and
which choices produced them. We call this the **source and intent record**.

This is a role, not one file format. For Helm, the record is a
`HelmRenderIntent`. Timoni records the module or bundle OCI version and digest,
typed schema, selected values, build receipt, and declared workflow. For AICR,
it includes the native recipe, selected options, and generation receipts. Kubara
records its selected source and generation inputs. Source OCI records the
processor it contains or references.
Literal OCI and plain YAML name their source digest or checksums, object inventory,
remaining inputs, prerequisites, checks, and later transformations.
Today, that information may live in a source Unit, Space metadata plus a
committed receipt, or a generated base-variant record.

The record should let a new reader answer five questions:

1. What source produced these objects?
2. Which values or choices were used?
3. Which exact object digest did those choices produce?
4. What must exist or run before delivery?
5. Which checks and receipts support the result?

All maintained examples should answer those questions. Chart-specific records for
hooks, CRDs, Secrets, setup jobs, and target facts are added when the configuration
needs them; they are not copied into examples where they do not apply.

An arbitrary upload does not gain facts that ConfigHub cannot know. Generic checks
can be attached automatically. A source adapter or review must supply the source
details and any chart-specific lifecycle work; otherwise the missing information is
recorded as a gap.

## The four record layers

F1-F4 describe the records a reader can inspect. They are not four moments on a
clock. F3 lifecycle information is discovered at the base and resolved again after
a derived variant and destination are selected.

| Layer | Name | What it records | Main terms |
| --- | --- | --- | --- |
| **F1 · source** | Source and intent | Source identity, version, choices, locks, and processing context. | source and intent, recipe where the source uses one |
| **F2 · exact base** | Materialized configuration | Exact objects, inventory, digest, and flattening verdict for the reviewed base. | render, materialize, exact revision, render variant |
| **F3 · lifecycle** | Work around apply | Requirements, portable route intents, destination-specific route resolutions, and route receipts. | lifecycle requirement, route intent, resolved route, receipt |
| **F4 · operate** | Managed change and delivery | Field ownership, derived variants, comparisons, approvals, promotions, releases, delivery, and observations. | derived variant, promotion, release, observation |

Materializing is not deployment. F2 produces or reads configuration files. F4 can
deliver reviewed objects to live infrastructure. A base variant Space therefore has
no Target until you choose to deliver it.

## When routes are decided

| Point | Decision | Example |
| --- | --- | --- |
| Source and base | Record the requirement and possible handling. | A chart contains a certificate hook and ten CRDs. |
| Derived variant | Inherit, add, remove, or change the requirement. | Production uses an external Secret while development creates a temporary one. |
| Destination | Resolve the actor and mechanism. | Argo CD uses sync waves; Flux uses dependent Kustomizations; direct apply uses ordered commands and waits. |
| Promotion | Refuse or approve the destination-specific plan. | A production promotion stops because its required Secret is absent. |
| Delivery | Perform the selected work. | Install the CRDs, wait for them to become Established, then apply dependent objects. |
| Observation | Record what happened. | The controller used the requested digest and every required stage passed. |

A route copied from the base is not automatically resolved. Changing only the target
can change the route even when the Kubernetes objects stay identical.

## Digest roles

Several records can identify one configuration journey. Their hashes do not identify
the same bytes, so the role must always be stated.

| Identity | What it pins | Example |
| --- | --- | --- |
| Base-revision digest | The complete base record, including source inputs and processing context. | A Helm variant-revision digest or an AICR platform-index digest. |
| Exact-object digest | The accepted Kubernetes object set or the inventory that pins every object file. | `renderedObjectSetSHA256` for a Helm revision. |
| OCI manifest digest | One transported artifact manifest. A source package OCI and a literal configuration OCI have different roles and digests. | The digest returned by the registry. |
| ConfigHub data hash | One retained Unit revision. | The hash reported for a ConfigHub Unit. |
| Release OCI digest | The immutable artifact published from one reviewed ConfigHub Space revision. | The digest consumed by Argo CD or Flux. |

Do not describe these as "the same digest." A receipt binds two stages by naming both
identities and comparing the exact objects between them. The Catalog records
`digestRole` and `digestRecord` beside every base and object-set digest.

## How this guide uses action words

| Word | Meaning here |
| --- | --- |
| **materialize** | Produce or read the exact Kubernetes objects from any supported source. |
| **render** | Materialize objects with a templating source, especially Helm. |
| **flatten** | Keep the materialized objects so the source processor does not run again during delivery. |
| **resolve** | Bind lifecycle requirements to one variant, destination, delivery runtime, and executable plan. |
| **inspect** | Read objects or evidence. Inspection alone does not prove a claim. |
| **test** | Run a defined command or procedure. |
| **verify** | Compare a result with a recorded expectation, digest, or object set. |
| **review** | Decide whether a known change or result is acceptable. |
| **prove** | Produce an inspectable receipt for one limited claim. |
| **apply** | Send desired Kubernetes objects to a cluster. |
| **deliver** | Give reviewed objects to the controller or apply path that sends them to a cluster. |
| **observe** | Read the live result after delivery. |
| **promote** | Move a reviewed change to another environment while keeping its allowed local differences. |
| **route** | Record or resolve how lifecycle requirements will be handled. State whether the route is proposed, resolved, or executed. |

The word **check** is broad. The guides use a more exact word when the
difference matters.

## How common sources answer the four questions

| Source | What do I have? | What will it produce? | Can this destination accept it? | Did it work? |
| --- | --- | --- | --- | --- |
| Helm | Inspect the chart, version, values, render context, and any existing render. | Render the pinned chart into exact objects. | Check APIs, CRDs, Secrets, hooks, setup Jobs, policies, and controller handling for the exact variant. | Record delivery, controller, workload, runtime, drift, and rollback results separately. |
| AICR | Inspect or diff GPU-node snapshots without a recipe; inspect a recipe when one is selected. | Compose or generate the selected recipe output. Nested charts may still render later. | Check GPU and cloud facts, required controllers, component order, credentials, and nested-source requirements. | Run recipe-dependent resource and runtime checks only after the declared components have been deployed. |
| Timoni | Inspect the pinned module or bundle, typed schema, selected values, and existing build output. | Build the exact objects from the module or bundle. | Check ordered apply sets, waits, tests, prune behavior, runtime lookups, and target requirements. | Record apply, status, test, health, drift, and rollback results for the exact build. |
| Kubara | Inspect the selected platform components, versions, generator inputs, and generated files. | Generate the platform bootstrap and component assignments. | Check platform APIs, component prerequisites, ownership, credentials, nested sources, and controller work. | Record bootstrap, component, application, fleet, and rollback results at the layers actually tested. |
| Sveltos | Inspect the literal Sveltos objects and their nested source references. | Reading the Sveltos objects is a no-op; each nested source keeps its own materialization step. | Check the management cluster, selected workload clusters, Sveltos APIs, selectors, credentials, and nested-source requirements. | Record management reconciliation and each selected cluster's result separately. |
| Installer or source OCI | Inspect the OCI manifest, digest, included source, choices, and declared processor. | Pull by digest and invoke the declared processor. | Check the resulting exact objects and lifecycle requirements against the target. OCI transport itself performs no lifecycle work. | Record the consumer and runtime results for the output artifact, not merely the source-package pull. |
| Literal configuration OCI or YAML | Inspect and compare the exact objects and their identity. | Reading and canonicalizing the objects is a recorded no-op. | Check prerequisites, ownership, ordering, policies, and setup for the chosen destination. | Record delivery and live behavior for the exact object set. |
| ConfigHub revision or release OCI | Inspect the retained revision, source links, variant history, checks, approvals, and release digest. | Reading the retained exact objects is a recorded no-op. | Resolve the selected revision against its target, gates, and delivery runtime. | Record the controller, resource, runtime, drift, and rollback observations linked to that revision. |

Flattening is evaluated at each processing boundary. An AICR Application set can be
flattened while the Helm charts referenced by those Applications remain render-late.
An OCI artifact can carry source material, literal configuration, or a ConfigHub
release; its media type and source record must say which role it has.

The Catalog currently includes concrete records for Helm, Timoni, AICR, cub installer
source OCI, Kubara, Sveltos, literal configuration OCI, and plain YAML. The generic
model is ahead for a non-installer source OCI and for ConfigHub-release re-entry as a new base.
The [generated alignment report](../../data/base-variant-records/summary.md) gives the
current counts and gaps.

## The same objects in familiar terms

**If you think in plain Helm:** the recipe is your pinned chart and values. A
base variant is the output of `helm template` for one values choice, kept as
reviewable files. A derived variant gives one environment its own recorded
version of those objects and keeps its changes through upgrades.

**If you think in Kustomize:** a base variant plays the role of a base, and a
derived variant plays the role of an overlay. The base is already rendered
rather than patched at build time. The derived variant is a ConfigHub Space
with revisions, gates, and an upstream link rather than a directory convention.

**If you start with literal YAML or configuration OCI:** the objects are already
materialized and flat. Record their source and digest, attach any required routes,
then retain them as a base. Do not pretend they passed through Helm.

**If you start with AICR:** use `snapshot` and `diff` first when the question is
about existing GPU-node state; that path needs no recipe. When you select an AICR
recipe, keep the recipe and choices, run its declared processor, and link the
resulting object digest to those inputs. Record required controllers and setup as
lifecycle work. Run recipe-dependent resource checks only after those components
have been deployed.

**If you start with Kubara or another generator:** keep its native source and
choices, run its declared processor, and link the resulting object digest to those
inputs. Do not call that record a recipe unless the source tool does.

**If you start with Timoni:** pin the module or bundle OCI, keep its typed schema and
selected values, build the exact objects, and record any ordered apply sets, waits,
tests, or target lookups that must still run. The built objects are an exact
configuration revision, not a Helm render variant.

## Where each thing is, today

- Helm recipes and render records live in this repo. Every chart page links to them.
- The first Timoni source-and-intent record and exact object set live under
  `examples/timoni/`; the Catalog links to the retained evidence.
- AICR recipes remain AICR recipes. Other source-and-intent records live beside
  source receipts or base records. They use their own format rather than a fake
  Helm record or a generic "recipe" label.
- Base variants live in packages or exact object sets. After upload, each becomes a
  root Space in ConfigHub.
- Derived variants, promotions, delivery, and observations live in ConfigHub.
  Follow [variants after upload](./variants-after-upload.md) and the evidence
  links on each chart page.

When you browse a ConfigHub org, you see the materialized Units, derived Spaces,
revisions, and links from F2 through F4. The source-specific intent and processing
records remain linked from the base. A package upload also has an `installer-record`
Unit that identifies the package that produced it.
