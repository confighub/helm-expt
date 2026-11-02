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

## The whole picture

```text
DEVELOPER INTENT: deterministic and reproducible
  pinned source + choices --its own tool--> plain objects --> OCI bundle + plan
                                                                    |
OPERATOR INTENT: decisions can't be predicted, results are data     v
  ConfigHub base --> variant + recorded edits --> release OCI --> Argo CD or Flux
        ^                                                             |
        +------------- an agent observes live state and proposes <----+
```

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

## How the formats relate

Every format follows the same three steps, and the formats also stack on each
other.

| | Helm | `cub installer` | AICR | Plain YAML |
| --- | --- | --- | --- | --- |
| You choose | Chart version and values | Preset and inputs | Five criteria | Nothing |
| 1. Flatten | Helm | Kustomize and named functions | `aicr recipe`, `aicr bundle`, then Helm | Nothing to do |
| 2. OCI bundle | Objects, and a plan if needed | Objects, and a plan if needed | Argo CD Applications, and a plan | Objects |
| 3. Load into ConfigHub | A base, then variants | A base, then variants | A base, then variants | A base, then variants |

- **`cub installer` sits on top of Helm.** Helm runs once when the Catalog is
  built, and an installer package holds its output as plain objects.
  `cub installer` runs no Helm.
- **`cub installer` is a parallel route for Helm entries.** Every Helm entry is
  in OCI inside its chart's installer package. Where the flattening verdict
  permits, the entry also has a published OCI bundle. An entry whose verdict
  forbids a bundle keeps the installer package as its route.
- **AICR sits above Helm.** It picks many charts and their values, so an AICR
  recipe is closer to a stack than to one chart. Its nested charts also appear
  as ordinary Helm entries. AICR entries have no installer package.

## OCI has three jobs

OCI is the transport. It is not the tool and it is not proof of a deployment.

| Job | What it holds | What happens next |
| --- | --- | --- |
| Source | A chart, an installer package or an AICR-generated chart. | A tool still has to run. |
| Literal | Flattened objects. An OCI bundle is this kind. | You read, compare or deliver them, and no generator runs. |
| Release | One approved ConfigHub revision. | Argo CD or Flux reconciles that exact digest. |

## What is fixed, and what is read from a volatile source

The objects are deterministic. The same pinned source and the same choices give
the same objects, and `cub installer` holds itself to byte-identical output for
the same package, choices and facts. A few values can't be known in advance, so
the model says where each one comes from.

| Value | Example | Where it is read from | How it is kept |
| --- | --- | --- | --- |
| Pinned choice | Chart version, values, AICR criteria | The recipe | Fixed. Changing it gives a new OCI bundle. |
| Destination input | Cluster name, region | You, for each destination | The objects hold `confighubplaceholder` until a variant sets the value. |
| Fact | Node hardware, an existing CRD | The cluster, by a package's collector | Fixed once `cub installer` writes it to `facts.yaml`. |
| Secret material | A password | The destination | Named by the plan. An entry whose render holds key material gets no OCI bundle. |
| Live lookup | A chart that reads the cluster as it renders | The cluster, at render time | No bundle is published, because the verdict is `unsafe-to-flatten`. |
| Late render | The charts inside AICR's Applications | The chart source, when Argo CD deploys | Outside the flattened objects. The Catalog records a digest-bound render beside some of them. |

The plan is where these meet. A step can name something that must exist on the
destination, so the final plan is settled only when the variant, the destination
and the delivery tool are all known.

## Developer intent, operator intent and the agent loop

The model separates two kinds of intent.

| Change | Kind of intent | How it happens |
| --- | --- | --- |
| Turn a component on or off | Developer | Flatten again, which gives a new OCI bundle and a new base. |
| Set replicas for one environment | Operator | Edit a variant in ConfigHub. |

An agent's decision can be unpredictable, but what it writes can't be. It either
changes the pinned inputs or applies a named function to a variant, and each
result is versioned, gated and released by digest. The agent is the author of a
change, not the authority for it.

The two kinds of intent meet when a new render is loaded. `cub installer upload`
merges the render three ways and writes only the paths the render changed, so
operator edits survive.

The loop isn't closed yet. Live fixes that flow back into desired state are
still future work.

## What can be traced back

The Catalog keeps a record of what produced each set of objects, so the inputs
are never lost. Tracing one rendered field back to the input that set it is a
goal, and today it holds only in part.

| Stage | Can you trace a field back? |
| --- | --- |
| `cub installer` input | Yes, where a function writes the input to a named field. Most packages declare no inputs. |
| Helm values | Only for measured cases. A value can reach many fields, and a field can depend on many values. |
| Variant edit | Yes. ConfigHub records each change as a revision. |

Different inputs can also give the same objects, so a render can't be run
backwards from its output alone. That is why the record is kept.

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
name or a region. The objects hold the placeholder `confighubplaceholder` where
that value goes, and the entry page lists it as an input the destination must
supply. You replace the placeholder for each destination before you deliver.
For an AICR recipe the bundle holds Argo CD Applications, and Argo CD still
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
| [The model, in detail](./model-reference.md) | The full definition of each step, and the record layers. |
| [Deploy the GPU Operator from the Catalog](./deploy-gpu-operator-from-catalog.md) | The model on one Helm chart, in five steps. |
| [One AICR v1.0.0 recipe](../demo/aicr/eks-h100-training-kubeflow-v1-0-0.md) | The model on one NVIDIA AICR recipe. |
| [What we refuse to claim](./what-we-refuse-to-claim.md) | The limits of what the Catalog says. |

## Words

This table is the one place these words are defined. Records and tools keep some
older names, and the last column says where a word means something else.

### Inputs

| Word | Meaning | Don't confuse it with |
| --- | --- | --- |
| Source | What a provider publishes, such as a chart or an AICR release. | |
| Recipe | One pinned choice from a source: its version and one set of values or criteria. | An **AICR recipe** is the document `aicr recipe` resolves from the criteria. The `recipes/` directory holds the Catalog's records. |
| Preset | One named set of choices inside an installer package. | `installer.yaml` and `cub installer --base` call a preset a base. |
| Input | A named value `cub installer` asks for and writes to a field. | Helm values, which are chosen before the package is built. |
| Fact | Something read from the destination and recorded before a render. | An input, which a person supplies. |
| Placeholder | The value `confighubplaceholder`, which marks a value each destination must supply. | |

### Artifacts

| Word | Meaning | Don't confuse it with |
| --- | --- | --- |
| Installer package | One OCI artifact that holds every preset of a chart version. `cub installer` flattens one preset into files. | An OCI bundle, which holds one recipe's objects. |
| OCI bundle | The flattened objects of one recipe, in one OCI artifact, with a plan if they need one. | AICR's **bundle**, the output of `aicr bundle`. Whether to rename either one is an open decision. |
| Plan | The steps that objects cannot carry. Records call them routes. | `cub fleet plan` and the other `plan` commands, which preview a change. `helm-plan.yaml`, which is a Catalog record about a chart. |
| Step | One item in a plan. | |
| Flattening verdict | The recorded answer to whether a source can be flattened once. | AICR's **validation result**, from checks against a cluster. Whether to rename "verdict" is an open decision. |
| Receipt | The recorded result of a generation, check, delivery or test. | AICR's **evidence bundle**, which records one AICR run. |

### In ConfigHub and on a cluster

| Word | Meaning | Don't confuse it with |
| --- | --- | --- |
| Base | An OCI bundle or installer output loaded into ConfigHub. | A preset in a package, before it is loaded. |
| Variant | A copy of a base with your changes for one environment. | |
| Unit | One object in ConfigHub. | |
| Space | The ConfigHub container that holds the Units of one base or variant. | |
| Release | One approved revision, published to OCI for delivery. | A chart's version or a Helm release. |
| Stack | A set of parts named in one manifest and checked for conflicts before it renders. | A platform. |
| Platform | What a stack becomes once it runs under governance with your apps on it. | A stack. |

### Intent

| Word | Meaning | Don't confuse it with |
| --- | --- | --- |
| Developer intent | The pinned inputs that deterministically produce a base. | |
| Operator intent | The changes made to a variant, often in response to live operations. | A manual edit on the cluster, which ConfigHub has not recorded. |

## Technical notes and disclaimers

- UNOFFICIAL/EXPERIMENTAL.
- The [reference page](./model-reference.md) holds the detail.
- Not every entry has a published OCI bundle yet. Each entry page says whether its bundle is published.
- For an AICR recipe, Argo CD still renders the charts inside the Applications when it deploys them.
