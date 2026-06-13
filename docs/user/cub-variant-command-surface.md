# cub Variant Command Surface

**UNOFFICIAL/EXPERIMENTAL**

This page records the current `cub variant` surface used by the tutorial and
Creator-style docs. Treat local CLI help as the source of truth.

Current commands:

```text
cub variant create
cub variant promote
cub variant upload
```

Not current local command:

```text
cub variant release
```

`cub variant release` may become a useful product lane, but user docs should
describe it only as planned or candidate work until the CLI exposes it.

## What Create Does

`cub variant create` creates a downstream ConfigHub Space by cloning an
upstream Space and its Units.

Current shape:

```sh
cub variant create <variant-name> <upstream-space> [flags]
```

The first argument becomes the downstream Space's `Variant` label. The second
argument is the upstream Space slug or UUID.

Example:

```sh
cub variant create prod-us-east helm-prometheus-server-only \
  --environment Prod \
  --region us-east \
  --space-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --namespace monitoring-prod \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

This creates a derived ConfigHub variant. It does not run Helm again and it
does not create a new `cub installer` base.

The clone should preserve the reviewed Unit data. Any post-clone data change
needs an explicit allowed mutation path and receipt. If decoded Kubernetes data
changes without that receipt, classify it as drift and repair or block the
variant before promotion.

## Space And Unit Mapping

The upstream Space usually comes from `cub installer upload`.

```text
cub installer package/base
-> cub installer upload
-> upstream ConfigHub Space with Units
-> cub variant create
-> downstream ConfigHub Space with cloned Units and upstream links
```

The downstream Space inherits labels from the upstream Space, then overrides
`Variant` with the first positional argument. Use `--environment` and
`--region` for common Space label changes.

Use `--variant-labels` for additional Space labels. Use
`--space-annotation` for Space annotations. Use `--target` only when the target
already exists; it also sets the downstream Space's `TargetID` annotation.
Use `--namespace` when the upstream Space was uploaded with a placeholder
namespace and the derived variant should set a concrete namespace by running
`set-namespace` on cloned Kubernetes/YAML Units.

Unit metadata is separate:

```text
--unit-annotation
--unit-delete-gate
--unit-destroy-gate
```

These are applied to every cloned Unit. Cloned Units keep their source base
labels unless a PostClone trigger or later operation changes them.

## Current Boundary

Use `cub variant create` when the reviewed object set stays the same and the
change is post-render ConfigHub metadata, target, gates, links, facts, checks,
or approved field fills.

Use `cub variant promote` when a downstream Space created by `cub variant
create` should catch up with changes in its upstream Space. Start with
`--dry-run -o mutations` so the changed Units and mutation paths are reviewed
before writing.

The normal chart lifecycle is:

```text
cub installer recipe/base refresh
-> cub installer upload to the reviewed upstream Space
-> cub variant promote downstream Spaces
-> changeset, approval, apply or OCI/GitOps delivery
```

This is a ConfigHub server capability, not a helm-expt-only harness trick. Any
component that is represented as an upstream ConfigHub Space with downstream
Spaces created by `cub variant create` can use the same staging and rollout
pattern. helm-expt uses Helm charts to show the pattern, but the promotion
operation belongs to ConfigHub.

The command being available does not mean every chart/base is already proven
safe to promote in production. A chart/base should claim promotion support only
after its promotion receipt covers changed Units, added Units, local field
ownership, and any deletion or refusal case relevant to that base.

Use `cub unit set-predicates` for explicit field ownership when a downstream
variant should keep a local override during future promotion. For example, a
production variant can protect one workload's `spec.replicas` field, then
reopen that path later.

Use `cub variant upload` for already-rendered manifests that you want to ingest
directly as a ConfigHub variant Space. In helm-expt's curated catalog path,
`cub installer upload` remains the preferred upload step because the package
receipt, base, and recipe proof are part of the contract.

Use a `cub installer` base variant when Helm must render a different object
set, object shape, topology, dependency set, or lifecycle behavior.

Short rule:

```text
Helm render or object shape changes -> cub installer base variant.
Approved post-render ConfigHub refinements -> cub variant create.
Delivery blockers -> delivery prerequisite before GitOps or OCI handoff.
```

## Common Mistakes

Do not write current `cub variant create` examples with `--extends` or
`--space`. The current create command uses positional arguments:

```text
<variant-name> <upstream-space>
```

Do not use the old `--space-name-pattern` flag. The current flag is
`--space-pattern`.

Do not describe `release` as a current `cub variant` subcommand.

## Related Docs

- [Creating Variants](./creating-variants.md)
- [Tutorial Sequence](./tutorial-sequence.md)
- [Prometheus Promotion Example](./prometheus-overlay-promotion-example.md)
- [Variant Creator Reference](../reference/variant-creation-artifact.md)
