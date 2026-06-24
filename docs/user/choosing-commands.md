# Choosing Commands

**UNOFFICIAL/EXPERIMENTAL**

This guide explains which command path to use for a Helm chart. The commands
answer different questions. They are complementary, not replacements for each
other.

## Short Version

| User goal | Use |
| --- | --- |
| See what a Helm chart renders, without ConfigHub state. | `cub helm template` |
| Quickly load one Helm render into ConfigHub Units. | `cub helm install` |
| Use a maintained catalog entry with supported bases, receipts, scans, and live evidence. | `cub installer setup --pull <package> --base <base>` |
| Upload a reviewed rendered base into ConfigHub. | `cub installer upload` |
| Clone a reviewed ConfigHub Space into an environment, region, customer, or target variant. | `cub variant create` |
| Catch a derived ConfigHub variant up with its reviewed upstream Space. | `cub variant promote --dry-run -o mutations`, then `cub variant promote` |
| Bring an existing Argo, Flux, KRM, rendered-manifest, app, platform, stack, or live-cluster estate into the model. | discover/import first, then decide whether to keep imported, create variants, or graduate to a recipe |
| Prove a repo artifact or live lane has not drifted. | the relevant `npm run ...` verifier |

The durable catalog path starts at `cub installer`, not at `cub helm install`.
The fast Helm commands are still useful. They are the low-friction render and
one-shot adoption paths.

A one-shot render is only operationally safe if its inputs are recorded. For a
Helm chart, that means chart source, version, release name, namespace, values
files, `--set` flags, capability assumptions, CRD choices, and generated facts.
The catalog recipe path records those inputs today. The direct
`cub helm install` path still needs product work so upgrades and reinstalls do
not depend on someone remembering the original command line.

## What To Check Next

Each command path leaves the user at a different proof level. Check the matching
surface before making a stronger claim.

If the first question is "can I use this chart?", start with the generated
[Chart Use Guide](../../data/chart-use-guide/summary.md). It tells you whether
the chart is a public catalog entry, a promotion-review candidate, a
better-base-variant task, or a limitation-decision row. Then choose the command
path below.

| After this path | Check | What you can claim |
| --- | --- | --- |
| `cub helm template` | The rendered output and any local diff or schema check you ran. | You inspected a Helm render. No ConfigHub or live-cluster claim is implied. |
| `cub helm install` | ConfigHub Space and Unit list, labels, and diffs. | The chart was rendered into ConfigHub Units once. No maintained recipe or catalog support claim is implied. |
| `cub installer setup --pull ... --base ...` | Per-chart `CATALOG.md`, `helm-equivalence-receipt.yaml`, and `data/outcome-coverage/base-outcomes.csv`. | The selected base has a recorded recipe/package proof and render-parity status. |
| `cub installer upload` | ConfigHub Units, upload/scan/safe-operation receipts, and `data/outcome-coverage/base-outcomes.csv`. | The rendered base exists in ConfigHub with the receipt lanes that are present for that row. |
| `cub variant create` | Derived variant receipt, upstream links, changed labels/target/gates, and `data/derived-variant-target-bound/summary.md` if it was delivered live. | A reviewed uploaded base was cloned/refined post-render. It is not a Helm rerender. |
| `cub variant promote` | Dry-run mutations, changed Units, upstream links, and any changeset/approval receipts. | A downstream variant was reconciled with its upstream Space through ConfigHub, not by silently rerendering Helm. |
| OCI/GitOps delivery | Runtime/GitOps receipt, controller status, workload checks, and `data/runtime-gitops/summary.md`. | The selected row was reconciled by Argo or Flux only if a committed receipt says so. |
| Two-cluster live parity | `data/live-kind-parity/summary.md` and the row receipt. | Regular Helm and `cub installer` reached the recorded live outcome for that exact chart/base row. |

## Graduation Path

A user can move through these paths over time. They do not need to choose the
full catalog model on day one.

| Stage | Command path | Result |
| --- | --- | --- |
| Inspect | `cub helm template` | Render the chart locally and see the Kubernetes objects. |
| Adopt quickly | `cub helm install` | Load one rendered Helm result into ConfigHub Units. |
| Use a maintained catalog entry | `cub installer setup --pull <package> --base <base>` | Start from a reviewed recipe/package base with locks, values, labels, receipts, and checks. |
| Operate | `cub installer upload`, `cub variant create`, `cub variant promote`, ConfigHub changesets, scans, approvals, OCI/GitOps, observations | Manage reviewed objects as ConfigHub Units and derived variants. |

Existing apps enter through the same model without a recipe rewrite:

| Existing source | First command path | Next decision |
| --- | --- | --- |
| Argo CD Application | `cub gitops discover` / `cub gitops import` | Keep imported, create a derived variant, or graduate to a maintained recipe. |
| Flux HelmRelease or Kustomization | `cub gitops discover` / `cub gitops import` | Preserve the controller source and target before changing the render path. |
| Rendered KRM YAML or manifests | `cub unit import` or managed import workflow | Add labels, links, scans, gates, and observations. |

The important boundary is whether the user wants a one-time representation or a
maintained artifact. Direct commands are good for one-time representation.
Catalog entries are for repeatable bases, variant support, updates, patches,
and proof.

For concrete "you should see something like this" checks after each command,
use [Expected Results And Clusters](./expected-results-and-clusters.md). It also
explains when users need no cluster, a local kind cluster, their own Kubernetes
cluster, or a `cub-lk` Argo/kind rig.

## Command Roles

### `cub helm template`

Use this when you want a fast local Helm render.

It renders a chart to stdout or files. It can use values files and `--set`
flags. It does not require a ConfigHub server connection.

Good for:

- inspecting chart output;
- debugging Helm values;
- creating a plain Helm baseline;
- checking CRD/resource split;
- producing input for a future import or analysis flow.

It does not create a maintained recipe, supported base variants, scan receipts,
upload receipts, or a ConfigHub operating record.

### `cub helm install`

Use this when you want a fast one-shot Helm render loaded into ConfigHub Units.

It renders a chart and creates ConfigHub Units. It supports values files,
`--set`, namespace, target, CRD options, and wait behavior.

Good for:

- quickly getting a Helm chart into ConfigHub;
- exploring how a chart looks as Units;
- starting from an existing Helm chart without building a catalog entry first.

It does not, by itself, create the maintained catalog proof: supported base
variants, source/dependency locks, effective values, control-point reports,
Helm-equivalence receipts, scan/gate receipts, live parity receipts, upgrade
policy, or patch support.

### `cub installer`

Use this when you want the maintained recipe/package path.

In helm-expt, a `cub installer` package is the catalog artifact. It has named
base variants, rendered objects, receipts, checks, and a support story.

Good for:

- using a curated public catalog entry;
- selecting a reviewed base such as `default`, `existing-secret`,
  `server-only`, `no-crds`, or `http-clusterip`;
- proving the rendered objects match regular Helm under recorded inputs;
- uploading reviewed objects into ConfigHub;
- publishing or handing off to OCI/GitOps;
- supporting future refreshes, patches, variants, and promotion.

Use `cub installer setup` to render a package. Use `cub installer upload` to
load the rendered objects into ConfigHub.

### `cub variant create`

Use this after a reviewed base has been uploaded to ConfigHub.

It clones an upstream Space and its Units into a downstream Space, preserves
links to upstream Units, and applies variant metadata such as `Variant`,
`Environment`, `Region`, and target.

Good for:

- creating environment, region, customer, or target variants;
- assigning a target;
- setting labels, annotations, gates, and policies;
- running PostClone triggers or approved post-render functions;
- preserving a visible relationship to the reviewed base.

It should not be used to hide a Helm rerender. If the request changes Helm
render inputs, object count, object shape, or lifecycle behavior, route back to
a `cub installer` base variant.

### `cub variant promote`

Use this when a downstream Space was created by `cub variant create` and the
reviewed upstream Space has changed. This is a normal ConfigHub server
operation for components represented as upstream/downstream Spaces, not a
helm-expt-only workflow.

Start with:

```sh
cub variant promote <downstream-space> --dry-run -o mutations
```

Good for:

- seeing which downstream Units are behind their upstream Units;
- previewing mutation paths before writing;
- cloning Units that were added upstream after the downstream variant was
  created;
- associating the change with a ConfigHub changeset and change description.

It should not be treated as a Helm upgrade by another name. If the upstream
change required a Helm rerender, that rerender belongs in the `cub installer`
recipe/package path first. `cub variant promote` then carries the reviewed
upstream changes into the downstream ConfigHub variant.

### Existing Apps, Platforms, Stacks, And Live Clusters

Use this when the user asks:

```text
Can I load from my existing app, apps, platform, stack, or live cluster?
```

The answer is yes, but it is an adoption path, not the same path as starting
from a public catalog recipe.

| Existing source | First route | What the user should see first |
| --- | --- | --- |
| Argo CD Application | Discover/import the Argo app. | ConfigHub shows the app source, target, and rendered objects without changing the cluster. |
| Flux HelmRelease or Kustomization | Discover/import Flux state. | ConfigHub preserves controller source and target ownership. |
| KRM YAML or rendered manifests | Import as ConfigHub Units. | Units appear with labels and can be scanned, linked, and diffed. |
| Live cluster resources | Discover or import what exists. | A read-only inventory first, then an explicit decision to import, variant-create, or graduate. |
| Platform or stack | Represent multiple chart bases and app objects as one graph. | Components, labels, Spaces, targets, and links show what belongs together. |

Only graduate to a `cub installer` recipe when the app needs a maintained render
path, future chart refreshes, and catalog-grade proof.

## Routing Table

| Request | Route |
| --- | --- |
| "Show me what this chart produces." | `cub helm template` |
| "Load this chart into ConfigHub right now." | `cub helm install` |
| "Use the supported Redis catalog entry." | `cub installer setup --pull packages/bitnami/redis/25.5.3 --base default` |
| "Use a values file that changes storage, ingress, RBAC, CRDs, components, or topology." | create or choose a `cub installer` base variant |
| "Fill `extraDeploy`, `serverBlock`, `tpl`, sidecar, raw manifest, or config-block slots." | create or choose a reviewed `cub installer` base variant |
| "Create prod-us-east from this reviewed Prometheus base." | `cub variant create` over the uploaded ConfigHub Space |
| "Bring prod-us-east up to the latest reviewed Prometheus base." | `cub variant promote prod-us-east --dry-run -o mutations`, then promote through a changeset |
| "Change target, environment, region, gates, labels, links, or observation policy." | derived ConfigHub variant |
| "Use an existing Secret that changes chart rendering." | base variant |
| "Bind an existing Secret reference already exposed by the base." | derived ConfigHub variant plus target-fact checks |
| "Publish to Argo or Flux through OCI." | publish/upload the reviewed base or derived variant, then run GitOps/runtime verification |
| "Prove Helm and installer reach the same live outcome." | `npm run kind-parity:run ...` or the live parity lane |

## The Proposed Bridge

The proposed bridge is an import command:

```text
cub installer import helm ...
```

or equivalent product wording.

That bridge should turn a direct Helm chart, values file, or existing
`cub helm install` path into a maintained recipe/package candidate. Until that
exists as a product command, helm-expt uses repo generators and proof scripts to
build the same artifact chain.

## Repo Verifiers

The `npm run ...` commands are not product install commands. They verify the
repo corpus and live-test evidence. Keep them out of the default user path
unless the user is explicitly asking "how do I know this claim is true?"

Use them when you want to check claims:

| Need | Command |
| --- | --- |
| Check committed proof corpus quickly. | `npm run top20:verify-local-e2e` |
| Check all committed corpus artifacts. | `npm run verify` |
| Check a package/base renders like Helm. | `<chart>:compare` or `<chart>:verify-package` |
| Check strict two-cluster Helm-vs-installer parity. | `npm run kind-parity:run -- --chart <repo/chart> --version <version> --base <base>` |
| Check what live parity rows should be rerun next. | `npm run live-parity:rerun-plan` |

For the full test-command map, use [NPM Scripts](../../tests/npm-scripts.md).
