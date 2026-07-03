# The Model And Its Words

**UNOFFICIAL/EXPERIMENTAL.** One page for the whole model: the five words this catalog uses, the four stages they move through, and how the same objects look from three other points of view you may already hold.

## The five words

| Word | What it is | Wet or dry | Where it lives |
| --- | --- | --- | --- |
| **Recipe** | The source of renders: chart, version, values, declared bases, and declared routing intent. | Dry | The repo (`recipes/`) and the package. |
| **Rendering** | The act: running the recipe once to produce exact Kubernetes objects. | The boundary | A tool run (`cub installer setup`), never inside ConfigHub. |
| **Render record** | The evidence of one rendering: the render intent (the inputs, including routing intent) plus the rendered output (the objects, frozen with checksums). | Dry in, wet out | The repo (`data/helm-render-intents/`, revision files). |
| **Base variant** | A recipe rendered one named way: default, no-crds, existing-secret, ha. What `--base` picks. Uploaded, it becomes a root Space. | Wet | The package (`bases/<name>`) and, after upload, a ConfigHub Space with no upstream. |
| **Derived variant** | A Space cloned from an uploaded base for an environment, upstream link recorded. Never re-renders. | Wet | ConfigHub only. |

One sentence: **a recipe renders into a base variant; a base variant clones into derived variants; promotions carry reviewed changes down.**

## The four stages

| Stage | Name | What happens | The word |
| --- | --- | --- | --- |
| **F1 · source** | Recipe | Chart, version, values, and routing intent are declared and versioned. | recipe |
| **F2 · render** | Base variant | One rendering produces the exact objects; the render record binds inputs to output. | base variant, render record |
| **F3 · routes** | Prerequisites and routes | The work Helm leaves at the edges is named: hooks, CRDs, Secrets to stage, target facts. Recorded, not silently executed. | routing intent |
| **F4 · operate** | Derived variants | Clones, edits with reasons, promotions, delivery through a Target to OCI and GitOps, observation. | derived variant |

Rendering is not deployment. F2 produces config; only F4 touches live infrastructure. That boundary is why a base variant Space carries no Target until you deliver it.

## The same objects, three other ways of seeing them

**If you think in plain Helm:** the recipe is your chart plus your values file, pinned. A base variant is what `helm template` would print for one values choice, kept as reviewable files instead of piped to a cluster. A derived variant is the thing Helm does not have: the same objects, owned per environment, surviving upgrades.

**If you think in Kustomize:** a base variant plays the role of a base, and a derived variant plays the role of an overlay, with two differences. The base here is fully rendered, not a template to patch at build time; and the overlay here is a first-class Space with revisions, gates, and an upstream link, not a directory convention.

**If you think in source objects:** everything dry in this catalog can be written as one small YAML object per chart: repository, chart, version, values. The catalog keeps that object in the repo today. Wherever such a source object lives, the model is unchanged: it is the recipe, its rendering produces the base variant, and everything downstream is operation, not rendering.

## Where each thing is, today

- Recipes and render records: this repo, versioned, linked from every chart page.
- Base variants: the package (pull with `--base`), and as root Spaces in a ConfigHub org after upload.
- Derived variants, promotions, delivery, observation: ConfigHub, using the walkthroughs: [variants after upload](./variants-after-upload.md) and the chart pages' evidence links.

An honest note on the seam: when you browse a ConfigHub org, you see the wet half, F2 through F4: rendered Units, clones, revisions, links. The dry half, the recipe and the render record, lives in this repo and in the package. The `installer-record` Unit in each uploaded Space is the breadcrumb that ties a Space back to the package that produced it.
