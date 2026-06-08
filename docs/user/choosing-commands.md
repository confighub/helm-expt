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
| Prove a repo artifact or live lane has not drifted. | the relevant `npm run ...` verifier |

The durable catalog path starts at `cub installer`, not at `cub helm install`.
The fast Helm commands are still useful. They are the low-friction render and
one-shot adoption paths.

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

## Routing Table

| Request | Route |
| --- | --- |
| "Show me what this chart produces." | `cub helm template` |
| "Load this chart into ConfigHub right now." | `cub helm install` |
| "Use the supported Redis catalog entry." | `cub installer setup --pull packages/bitnami/redis/25.5.3 --base default` |
| "Use a values file that changes storage, ingress, RBAC, CRDs, components, or topology." | create or choose a `cub installer` base variant |
| "Promote this reviewed Prometheus base to prod-us-east." | `cub variant create` over the uploaded ConfigHub Space |
| "Change target, environment, region, gates, labels, links, or observation policy." | derived ConfigHub variant |
| "Use an existing Secret that changes chart rendering." | base variant |
| "Bind an existing Secret reference already exposed by the base." | derived ConfigHub variant plus target-fact checks |
| "Publish to Argo or Flux through OCI." | publish/upload the reviewed base or derived variant, then run GitOps/runtime verification |
| "Prove Helm and installer reach the same live outcome." | `npm run kind-parity:run ...` or the live parity lane |

## The Proposed Bridge

The useful future command is an import bridge:

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
repo corpus and live-test evidence.

Use them when you want to check claims:

| Need | Command |
| --- | --- |
| Check committed proof corpus quickly. | `npm run top20:verify-local-e2e` |
| Check all committed corpus artifacts. | `npm run verify` |
| Check a package/base renders like Helm. | `<chart>:compare` or `<chart>:verify-package` |
| Check strict two-cluster Helm-vs-installer parity. | `npm run kind-parity:run -- --chart <repo/chart> --version <version> --base <base>` |
| Check what live parity rows should be rerun next. | `npm run live-parity:rerun-plan` |

For the full test-command map, use [NPM Scripts](../../tests/npm-scripts.md).
