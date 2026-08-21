# The configuration processing model

**UNOFFICIAL/EXPERIMENTAL.** This page gives the short version of the model used by
the Catalog. The [catalog doctrine](../reference/config-catalog-doctrine.md) is the
canonical definition.

## One path for every source

```text
source + processing intent
  -> materialize exact Kubernetes objects
  -> flatten, flatten with routes, or process late
  -> retain and change the accepted configuration
  -> publish, reconcile, and observe it
```

Helm, AICR, Kubara, OCI, and YAML use the same stages. They do not use the same
processor. A stage can also be a recorded no-op: literal YAML already contains exact
objects, for example.

## The core words

| Word | What it is | Where it lives |
| --- | --- | --- |
| **Source and intent** | Where the configuration came from and which choices produced or selected it. | A source-specific record, linked to the exact configuration. |
| **Materialize** | Produce or read the exact Kubernetes objects that will be reviewed. | In a local tool, build, or source adapter. |
| **Exact configuration revision** | One accepted Kubernetes object set, inventory, and digest. | Local files or OCI before upload; ConfigHub Units after upload. |
| **Flatten** | Retain the exact objects so delivery does not rerun the source processor. | A recorded decision for an exact source, configuration, and target path. |
| **Lifecycle route** | Work that must happen around ordinary apply, with its owner, order, checks, and receipts. | Companion records and evidence beside the configuration. |
| **Base variant** | One named, reviewed starting configuration. | A package and, after upload, a root ConfigHub Space. |
| **Derived variant** | A ConfigHub Space cloned from an uploaded base for an environment, region, or customer. It records its upstream base and does not rerender Helm. | ConfigHub. |

In one sentence: **materialize exact objects, keep the source and lifecycle context,
then retain reviewed changes as variants that can be promoted and delivered.**

## Helm's additional words

| Word | Helm meaning |
| --- | --- |
| **Recipe** | The chart, version, values, named bases, and declared lifecycle choices used by the installer package. |
| **Render** | Helm's materialization step. It produces exact Kubernetes objects but does not apply them. |
| **Helm render intent** | The chart inputs, context, source lock, prerequisites, and lifecycle choices for one render. |
| **Helm render variant** | The captured object output for one base and revision, linked to its intent and digest. |

Do not create a render variant for literal YAML or another source that did not render.
Its source-and-intent record links directly to its exact configuration revision.

## The source and intent record

Every maintained base needs a record that explains where its objects came from and
which choices produced them. We call this the **source and intent record**.

This is a role, not one file format. For Helm, the record is a
`HelmRenderIntent`. For AICR or Kubara, it is the recipe, selected options, and
generation receipts. Source OCI records the processor it contains or references.
Literal OCI and plain YAML name their source digest or checksums, object inventory,
remaining inputs, prerequisites, checks, and later transformations.
Today, that information may live in a source Unit, Space metadata plus a
committed receipt, or a generated base-variant record.

The record should let a new reader answer four questions:

1. What source produced these objects?
2. Which values or choices were used?
3. What must exist or run before delivery?
4. Which checks and receipts support the result?

All maintained examples should answer those questions. Chart-specific records for
hooks, CRDs, Secrets, setup jobs, and target facts are added when the configuration
needs them; they are not copied into examples where they do not apply.

An arbitrary upload does not gain facts that ConfigHub cannot know. Generic checks
can be attached automatically. A source adapter or review must supply the source
details and any chart-specific lifecycle work; otherwise the missing information is
recorded as a gap.

## The four stages

| Stage | Name | What happens | The word |
| --- | --- | --- | --- |
| **F1 · source** | Source and intent | Record the source, version, choices, and lifecycle decisions. | source and intent |
| **F2 · materialize** | Exact configuration | Produce or read the exact objects. For Helm, the render intent binds the inputs to the captured render variant. | exact configuration, Helm render variant |
| **F3 · routes** | Prerequisites and routes | Record hooks, CRDs, Secrets, target facts, and other work outside ordinary objects. | routing intent |
| **F4 · operate** | Derived variants | Clone, edit, review, promote, deliver, and observe the configuration. | derived variant |

Materializing is not deployment. F2 produces or reads configuration files. F4 can
deliver reviewed objects to live infrastructure. A base variant Space therefore has
no Target until you choose to deliver it.

## How this guide uses action words

| Word | Meaning here |
| --- | --- |
| **materialize** | Produce or read the exact Kubernetes objects from any supported source. |
| **render** | Materialize objects with a templating source, especially Helm. |
| **flatten** | Keep the materialized objects so the source processor does not run again during delivery. |
| **inspect** | Read objects or evidence. Inspection alone does not prove a claim. |
| **test** | Run a defined command or procedure. |
| **verify** | Compare a result with a recorded expectation, digest, or object set. |
| **review** | Decide whether a known change or result is acceptable. |
| **prove** | Produce an inspectable receipt for one limited claim. |
| **apply** | Send desired Kubernetes objects to a cluster. |
| **deliver** | Give reviewed objects to the controller or apply path that sends them to a cluster. |
| **observe** | Read the live result after delivery. |
| **promote** | Move a reviewed change to another environment while keeping its allowed local differences. |
| **route** | Record who performs work outside ordinary Kubernetes objects, such as a hook or prerequisite. |

The word **check** is broad. The guides use a more exact word when the
difference matters.

## The same objects, three other ways of seeing them

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

**If you start with AICR, Kubara, or another generator:** keep its native recipe and
choices, run its declared processor, and link the resulting object digest to those
inputs. Record any required controllers or setup separately.

## Where each thing is, today

- Helm recipes and render records live in this repo. Every chart page links to them.
- Other source-and-intent records live beside their recipes, source receipts, or base
  records. They use their own format rather than a fake Helm record.
- Base variants live in packages or exact object sets. After upload, each becomes a
  root Space in ConfigHub.
- Derived variants, promotions, delivery, and observations live in ConfigHub.
  Follow [variants after upload](./variants-after-upload.md) and the evidence
  links on each chart page.

When you browse a ConfigHub org, you see the materialized Units, derived Spaces,
revisions, and links from F2 through F4. The source-specific intent and processing
records remain linked from the base. A package upload also has an `installer-record`
Unit that identifies the package that produced it.
