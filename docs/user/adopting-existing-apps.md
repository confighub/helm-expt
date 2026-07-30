# Adopting Existing Apps

**UNOFFICIAL/EXPERIMENTAL**

This project should not only help with new Helm installs. It should also give
teams a way to adopt apps they already run through Argo CD, Flux, KRM YAML,
Kustomize, rendered manifests, or other Kubernetes configuration sources.

The goal is:

```text
Keep the app running.
Import or discover the desired state.
Attach ConfigHub labels, links, variants, scans, gates, and receipts.
Only move to a cub installer recipe when the app needs a maintained render path.
```

## Short Answer

Yes, a user should be able to start from an existing app, a group of apps, a
platform slice, a stack, rendered manifests, GitOps objects, or a live cluster.
The first step should be read-only discovery or import, not a forced rewrite.

The expected first result is:

```text
ConfigHub found the app or objects.
ConfigHub shows source, target, labels, and object inventory.
No cluster change was made yet.
The next decision is keep imported, create a derived variant, or graduate to a
maintained cub installer recipe.
```

## Why This Matters

Most real teams do not start from a blank cluster. They already have:

- Argo CD Applications;
- Flux HelmReleases;
- Flux Kustomizations;
- KRM YAML or Kustomize output;
- rendered manifests in Git;
- manually imported or live Kubernetes resources.

The adoption path must not say "rewrite all of that first." It should let the
team upgrade into ConfigHub gradually.

## Current Entry Points

| Existing source | Current entry point | What ConfigHub should preserve |
| --- | --- | --- |
| Argo CD Application | `cub gitops discover` / `cub gitops import` | controller ownership, source reference, rendered resources, links, target |
| Flux HelmRelease | `cub gitops discover` / `cub gitops import` | chart source, values source, rendered resources, links, target |
| Flux Kustomization | `cub gitops discover` / `cub gitops import` | Kustomize source, rendered resources, links, target |
| KRM YAML / rendered manifests | `cub unit import` or managed import workflow | resource identity, labels, target, provenance, scans |
| Public Helm chart with no existing app | `helm template`, `cub variant upload`, or the `cub installer` catalog path | Helm baseline, ConfigHub Units, or maintained recipe/package depending on intent |

## A Small Plain YAML Example

The repository includes a four-object application under
[`examples/plain-yaml/acme-web`](../../examples/plain-yaml/acme-web/README.md).
It has one Namespace, ConfigMap, Deployment, and Service. There is no chart and
no render step.

Upload the files as one Unit per Kubernetes object:

```sh
cub variant upload \
  --component plain-yaml-acme-web \
  --variant base \
  --space plain-yaml-acme-web-base \
  --granularity per-resource \
  examples/plain-yaml/acme-web
```

The [focused receipt](../../runs/literal-yaml-upload-proof/receipt.yaml) reads
the four Units back and compares them with the four files. The source and stored
object-set hashes match. The separate README Unit explains the example inside
the `helm-catalog` demo organization.

This proves the import boundary. No cluster apply, promotion, release, or
workload observation is claimed by this receipt.

ConfigHub documentation currently describes `cub gitops import` as importing
Argo CD Applications, Flux HelmReleases, and Flux Kustomizations from a
Kubernetes target, rendering them with a render target, and creating ConfigHub
Units and links. It also documents `cub unit import` for Kubernetes resource
filtering and import.

## Adoption Levels

| Level | What happens | User value |
| --- | --- | --- |
| Observe | Import or discover the existing app and record where it came from. | The team can see and search the app in ConfigHub without changing delivery. |
| Explain | Add component, chart, variant, environment, region, target, and source labels; preserve links. | The app becomes understandable and comparable. |
| Check | Run scans, schema checks, policy checks, and drift/live observations. | The team gets evidence without rewriting the app. |
| Variant | Clone/refine post-render ConfigHub state with `cub variant create` where safe. | The team can create environment/customer variants without rerendering Helm when the change is post-render. |
| Graduate | If the app needs a maintained render path, create a `cub installer` recipe/package/base. | The app gets catalog-grade repeatability, Helm-equivalence proof, receipts, upgrade support, and maintenance policy. |

## Routing Rule

Use the narrowest adoption path that matches the user's intent:

| User says | Route |
| --- | --- |
| "I already have Argo managing this app." | Discover/import the Argo app first. Do not force a recipe rewrite. |
| "I already have Flux HelmRelease or Kustomization objects." | Discover/import Flux first. Preserve the GitOps source and target. |
| "I have KRM YAML or rendered manifests." | Import as ConfigHub Units, then scan, label, link, and review. |
| "I want to turn this into a maintained catalog entry." | Create or request a `cub installer` recipe/package and base variants. |
| "I want prod from dev with target/gates/labels changed." | Use a derived ConfigHub variant after import or upload. |
| "I want a values file, wrapper chart, or overlay that changes object shape." | Use the installer recipe/base path or managed overlay import. |

## What Not To Overclaim

Importing an existing app does not automatically prove it is a supported
catalog recipe.

Use precise language:

```text
imported into ConfigHub
scanned
linked to source
observed live
variant-created
graduated to maintained recipe
```

Do not collapse those into one generic "managed" claim.

## Product Shape

The user-facing flow should be:

```text
Choose source: Argo, Flux, KRM, Helm, rendered YAML
Preview discovered apps and objects
Select app/component
Import with labels and links
Run checks
Decide: keep imported, create derived variant, or graduate to recipe
```

The product should make the first step low risk. A team should be able to say:

```text
Show ConfigHub my existing app.
Do not change my cluster yet.
Tell me what you found and what you can prove.
```

That is how existing Argo, Flux, KRM, and rendered-manifest estates enter the
same ConfigHub model without making Helm users start over.
