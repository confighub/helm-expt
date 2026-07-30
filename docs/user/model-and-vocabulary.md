# The Model And Its Words

**UNOFFICIAL/EXPERIMENTAL.** This page defines the five main terms in the
catalog. It also explains the four stages from a Helm source to an operated
ConfigHub variant.

## The five words

| Word | What it is | Where it lives |
| --- | --- | --- |
| **Recipe** | The source of a render: chart, version, values, named bases, and declared routing intent. | The repo (`recipes/`) and the installer package. |
| **Rendering** | Running the recipe once to create exact Kubernetes objects. | A tool run such as `cub installer setup`, outside ConfigHub Server. |
| **Render record** | The evidence for one render. It joins the render intent, rendered objects, checksums, and related receipts. | The repo (`data/helm-render-intents/` and revision files). |
| **Base variant** | One named way to render a chart, such as `default`, `no-crds`, `existing-secret`, or `ha`. The `--base` option selects it. | The package (`bases/<name>`) and, after upload, a root ConfigHub Space. |
| **Derived variant** | A ConfigHub Space cloned from an uploaded base for an environment, region, or customer. It records its upstream base and does not rerender Helm. | ConfigHub. |

In one sentence: **a recipe renders into a base variant, a base variant becomes
derived variants, and promotions carry reviewed changes between them.**

## The four stages

| Stage | Name | What happens | The word |
| --- | --- | --- | --- |
| **F1 · source** | Recipe | Record the chart, version, values, and routing intent. | recipe |
| **F2 · render** | Base variant | Create the exact objects. The render record binds the inputs to that output. | base variant, render record |
| **F3 · routes** | Prerequisites and routes | Record hooks, CRDs, Secrets, target facts, and other work outside ordinary objects. | routing intent |
| **F4 · operate** | Derived variants | Clone, edit, review, promote, deliver, and observe the configuration. | derived variant |

Rendering is not deployment. F2 produces configuration files. F4 can deliver
reviewed objects to live infrastructure. A base variant Space therefore has no
Target until you choose to deliver it.

## How this guide uses action words

| Word | Meaning here |
| --- | --- |
| **render** | Create Kubernetes objects from a recorded source and its inputs. |
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

**If you think in source objects:** the chart source can be one small YAML
record containing the repository, chart, version, and values. The catalog keeps
that record in the repo today. Rendering it produces the base variant.
ConfigHub manages the resulting objects without running Helm again.

## Where each thing is, today

- Recipes and render records live in this repo. Every chart page links to them.
- Base variants live in installer packages. Use `--base` to select one. After
  upload, each becomes a root Space in ConfigHub.
- Derived variants, promotions, delivery, and observations live in ConfigHub.
  Follow [variants after upload](./variants-after-upload.md) and the evidence
  links on each chart page.

When you browse a ConfigHub org, you see the rendered Units, derived Spaces,
revisions, and links from F2 through F4. The recipe and render record remain in
this repo and the package. Each uploaded Space has an `installer-record` Unit
that identifies the package that produced it.
