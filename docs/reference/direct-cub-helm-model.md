# Direct Cub Helm Model

This note covers the optional `cub-helm` plugin commands. The plugin is
released separately from the core `cub` CLI. The short Redis exercise uses
`cub installer` and does not require this plugin. The bring-your-own Helm
example uses it for an arbitrary chart and values.

Both commands are available now. They are not the maintained catalog recipe
path by themselves.

Current command references:

- [`cub helm template`](https://docs.confighub.com/developer/cli/cub_helm_template/)
- [`cub helm install`](https://docs.confighub.com/developer/cli/cub_helm_install/)

For the shorter user-facing routing guide, see
[Choosing Commands](../user/choosing-commands.md).

## Command Roles

| Command | Role | Use it when | What it does not try to be |
| --- | --- | --- | --- |
| `cub helm template` | Local Helm renderer. It renders a chart to stdout or local files and does not require a ConfigHub server connection. It includes CRDs unless `--skip-crds` is set. | You want quick local inspection, a baseline for comparison, or the first input to recipe analysis. | A durable ConfigHub catalog entry. |
| `cub helm install` | Direct Helm-to-ConfigHub action. It creates a base Space for rendered Units and a Helm source Space that records the chart, values, and render options. | You want to store an arbitrary chart and its inputs in ConfigHub without first building a catalog package. | A maintained recipe with supported variants, receipts, lifecycle routes, and update policy. |
| `cub installer` package path | Maintained catalog path. It renders from a reviewed recipe/package with named bases, receipts, scans, upload/publish evidence, and live checks. | You want repeatable, supportable, variant-aware Helm-derived configs. | The shortest one-off render/install command. |

## Direct Render

```sh
cub helm template redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis \
  --output-dir out/redis
```

This path is deliberately low ceremony:

```text
chart + values + flags
-> rendered YAML
```

It is the right first tool for:

- seeing what a chart produces;
- creating a regular Helm baseline;
- debugging values;
- checking CRD/resource split;
- feeding a future import/analyze workflow.

It does not create a reusable recipe, base variant, package, scan receipt,
upload receipt, or maintenance record. Hook manifests are dropped by default.
`--include-hooks` keeps them as ordinary resources; it does not run Helm's hook
lifecycle. Helm `lookup` returns no objects and capabilities use Helm defaults,
so charts that require live-cluster data are outside this direct path.

## Direct Install

```sh
cub helm install redis redis \
  --repo https://charts.bitnami.com/bitnami \
  --version 25.5.3 \
  --namespace redis
```

This path creates two ConfigHub Spaces:

```text
Helm chart
-> <component>-helm: one HelmSource Unit with chart, values, and options
-> <component>-base: the rendered Kubernetes Units
```

The base is not assigned to a target. If `--namespace` is omitted, the chart is
rendered with the `confighubplaceholder` namespace. A deployment variant later
sets its real target and namespace:

```sh
cub variant create redis-prod redis-base \
  --target prod/prod-cluster \
  --namespace redis
```

The command does not apply anything to Kubernetes. Hook manifests are dropped
by default. `--include-hooks` stores them as ordinary resources but does not
run Helm's hook lifecycle. CRDs are included unless `--skip-crds` is set.
Charts that need live `lookup` results or non-default capabilities are outside
this direct path.

This is the fast path when a user wants to store an arbitrary chart and its
render inputs in ConfigHub. It should stay simpler than the catalog path.

It does not, by itself, answer the maintained-catalog questions:

- Which base variants are supported?
- Which values, facts, capabilities, hooks, CRDs, and secrets were reviewed?
- Is the output equivalent to regular Helm under recorded inputs?
- Which scans, gates, promotion rules, live checks, and receipts apply?
- How will future chart versions and old-version patches be maintained?

## Maintained Catalog Path

```text
chart + values + flags
-> cub helm template baseline
-> recipe analysis
-> cub installer recipe/package
-> named base variants
-> rendered objects
-> Helm-equivalence receipts
-> scans, gates, upload/publish receipts, live evidence
```

The paths can be used in sequence:

| Stage | Command path | What the user learns or gains |
| --- | --- | --- |
| Inspect | `cub helm template` | What Kubernetes objects the chart renders under chosen inputs. |
| Adopt quickly | `cub helm install` | Store the rendered Units and a separate HelmSource record of the chart, values, and options. |
| Standardize | `cub installer setup --pull <installer OCI ref> --base <base>` | Whether a maintained recipe/base already covers the intended use case. |
| Operate | `cub installer upload`, `cub variant create`, ConfigHub checks, changesets, approvals, OCI/GitOps, observations | How the reviewed objects are managed, varied, promoted, delivered, and observed. |

Existing Argo CD, Flux, KRM, and rendered-manifest estates should enter through
their direct import paths first. A team can then decide whether to keep the
imported representation, create derived ConfigHub variants, or graduate the app
to a maintained `cub installer` recipe/package.

One possible future product bridge is:

```text
cub installer import helm
```

This command does not exist. Such a bridge could graduate a direct Helm render
or install into a maintained recipe/package candidate. Today, helm-expt uses
repo generators and proof scripts to build and verify that artifact chain.

The bridge should preserve the useful low-friction paths:

```text
curious user
  -> cub helm template
  -> inspect rendered objects

fast ConfigHub user
  -> cub helm install
  -> get a Helm source Space and rendered base Space now

supported catalog user
  -> cub installer setup --pull <installer OCI ref> --base <base>
  -> use a reviewed recipe/base variant with receipts

promotion or production user
  -> ConfigHub variants, scans, changesets, approvals, OCI/GitOps, observations
```

That is the big-picture rule for the Helm command family. Fast paths should stay
fast. The catalog path should be chosen when the user wants repeatability,
variant support, proof, and maintenance.

## Current Redis Compatibility Check

Use these commands to reproduce the current Redis `cub installer` compatibility
check:

```sh
go install sigs.k8s.io/kustomize/kustomize/v5@v5.8.1
export PATH="$PATH:$(go env GOPATH)/bin"
cub plugin install confighub/installer

export REDIS_PACKAGE=./packages/bitnami/redis/25.5.3
export WORK_DIR=/tmp/confighub-helm-redis

cub installer doc "$REDIS_PACKAGE"
cub installer setup \
  --pull "$REDIS_PACKAGE" \
  --work-dir "$WORK_DIR" \
  --non-interactive \
  --namespace redis

npm run redis:compare
```

The comparison verifies the `cub installer` output against the regular Helm
baseline and explains the intentional Namespace support object.
