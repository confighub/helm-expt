# The configuration processing model

This page explains how the Catalog treats configuration.
[The detail page](./model-reference.md) has the full definitions of each step
in the model.

## The model in one line

**Flatten it. Put it in an OCI bundle, with a plan if it needs one. Load it
into ConfigHub.**

| Step | What happens | Tool |
| --- | --- | --- |
| 1. Flatten | A source is turned into plain Kubernetes objects. | Helm for a chart. `cub installer` for an installer package. `aicr` for an AICR recipe. |
| 2. Bundle | The objects go into one OCI bundle. If they need steps that objects cannot carry, the plan goes in with them. | The Catalog publishes the bundle. |
| 3. Load | The bundle is loaded into ConfigHub. It becomes a base, and you make a variant of it for each environment. | `cub variant upload` |

Then you deploy a variant to a cluster.

## Step 1. Flatten

A source is what a provider publishes, such as a Helm chart, an installer
package or an NVIDIA AICR recipe. A recipe pins one choice from it: the
source, its version and one set of values.

Flattening runs the source's own tool once and keeps the objects it produces.
Nothing runs that tool again when you install.

| Source | Flattened by |
| --- | --- |
| Helm chart | Helm |
| Installer package | `cub installer` |
| AICR recipe | `aicr` |
| Plain YAML | Nothing. It is already objects. |

## Step 2. Put it in an OCI bundle, with a plan if it needs one

An OCI bundle is one artifact in a registry. It holds the flattened objects.

Not all source configuration can be completely flattened. The configuration
steps taken after flattening are called the plan. Examples are "apply the CRDs
first" and "this Secret must exist". A bundle carries its plan. A bundle that
needs no such step has no plan.

You can pull, read, compare and install an OCI bundle with no account.

## Step 3. Load it into ConfigHub

```bash
cub variant upload --component gpu-operator --variant base --namespace gpu-operator "$BUNDLE"
```

The bundle becomes a base, with one Unit for each object. A variant is a copy
of the base with your changes for one environment. When a new bundle arrives,
you load it over the base and promote the change to each variant.

| You want to | Do this |
| --- | --- |
| Turn a component on or off | Flatten again with new values. It gives a new bundle, and a new base. |
| Set replicas or limits for one environment | Make a variant of the base. |
| Make production differ from staging | Make a variant of the base for each. |

## The same model for every format

| | Helm | cub installer | AICR | Plain YAML |
| --- | --- | --- | --- | --- |
| 1. Flatten | Helm | `cub installer` | `aicr` | Nothing to do |
| 2. OCI bundle | Objects, and a plan if needed | Objects, and a plan if needed | Argo CD Applications, and a plan | Objects |
| 3. Load into ConfigHub | A base, then variants | A base, then variants | A base, then variants | A base, then variants |

## What the flattening verdict means

Every entry records a flattening verdict. It answers one question: can this
source be flattened once and delivered as plain objects?

| Verdict | What it means | What you do |
| --- | --- | --- |
| `safe-to-flatten` | The objects are everything. No step is needed around them. | Load the bundle and deliver it. |
| `flatten-with-routes` | The source is flattened, and some steps must still happen when you deliver. Those steps are the plan. "Routes" is the stored name for the plan's steps. | Load the bundle, and carry out the plan when you deliver. |
| `unsafe-to-flatten` | The objects alone are not enough. The source depends on a live lookup, generated state or a destructive lifecycle step that no plan step covers yet. | Use the installer package with `cub installer`. No bundle is published. |
| `born-flattened` | The source is already plain objects. | Load it and deliver it. |

Three questions people ask about `flatten-with-routes`.

**Is it completely flattened?** For a Helm chart, yes. Helm has run, and
nothing renders again when you install. Most plan steps are work around the
objects, such as "apply the CRDs first", "this Secret must exist" or a hook
Job. A few name a value that only your destination knows, such as a cluster
name or a region. The entry records that value as one you must supply for each
destination before you deliver. For an AICR recipe the bundle holds Argo CD Applications, and Argo CD still
renders the charts inside them when it deploys.

**Can I load it into ConfigHub?** Yes. `cub variant upload` loads the bundle
as a base, and you make variants of it as you do for any other entry. The plan
travels inside the bundle.

**What do I do with the plan?** Read it on the entry page, which lists each
step, who carries it out and whether the Catalog has run it. You, or your
pipeline, carry out the steps when you deliver. Where an entry page has a test
script, the script stops and names any step it cannot do for you.

## Try it

[Deploy the GPU Operator from the Catalog](./deploy-gpu-operator-from-catalog.md)
does all three steps, and then deploys and tests the result.

## Read next

| Page | What it adds |
| --- | --- |
| [The model, in detail](./model-reference.md) | The full definition of each step. |
| [Deploy the GPU Operator from the Catalog](./deploy-gpu-operator-from-catalog.md) | The model on one Helm chart, in five steps. |
| [One AICR v1.0.0 recipe](../demo/aicr/eks-h100-training-kubeflow-v1-0-0.md) | The model on one NVIDIA AICR recipe. |
| [What we refuse to claim](./what-we-refuse-to-claim.md) | The limits of what the Catalog says. |

## Words

| Word | Meaning |
| --- | --- |
| Source | What a provider publishes. |
| Recipe | One pinned choice from a source: its version and one set of values. |
| OCI bundle | The flattened objects of one recipe, in one OCI artifact, with a plan if they need one. |
| Plan | The steps that objects cannot carry. |
| Base | An OCI bundle loaded into ConfigHub. |
| Variant | A copy of a base with your changes for one environment. |
| Installer package | One OCI artifact that holds every preset of a chart version. `cub installer` flattens one preset into files. |

## Technical notes and disclaimers

- UNOFFICIAL/EXPERIMENTAL.
- The [reference page](./model-reference.md) holds the detail.
- Not every entry has a published OCI bundle yet. Each entry page says whether its bundle is published.
- For an AICR recipe, Argo CD still renders the charts inside the Applications when it deploys them.
