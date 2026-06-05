# cub Variant Command Surface

**UNOFFICIAL/EXPERIMENTAL**

This page records the current `cub variant` surface used by the tutorial and
Creator-style docs. Treat local CLI help as the source of truth.

Current command:

```text
cub variant create
```

Not current local commands:

```text
cub variant upload
cub variant promote
cub variant release
```

Those may be useful product lanes, but user docs should describe them only as
planned or candidate work until the CLI exposes them.

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
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

This creates a derived ConfigHub variant. It does not run Helm again and it
does not create a new `cub installer` base.

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

Use a `cub installer` base variant when Helm must render a different object
set, object shape, topology, dependency set, or lifecycle behavior.

Short rule:

```text
Helm render or object shape changes -> cub installer base variant.
Approved post-render ConfigHub refinements -> cub variant create.
Delivery blockers -> delivery prerequisite before GitOps or OCI handoff.
```

## Common Mistakes

Do not write current examples with `--extends` or `--space`. The current CLI
uses positional arguments:

```text
<variant-name> <upstream-space>
```

Do not describe `upload`, `promote`, or `release` as current `cub variant`
subcommands. Use `cub installer upload` for uploading a reviewed base into
ConfigHub. Treat promote/release as product design lanes until implemented.

## Related Docs

- [Creating Variants](./creating-variants.md)
- [Tutorial Sequence](./tutorial-sequence.md)
- [Prometheus Promotion Example](./prometheus-overlay-promotion-example.md)
- [Variant Creator Reference](../reference/variant-creation-artifact.md)
