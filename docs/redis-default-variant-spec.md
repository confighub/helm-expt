# Redis Default Variant Spec

The first Redis proof variant must be named `default`, not `standalone`.

Reason:

```text
bitnami/redis@25.5.3 default render includes:
- redis-master StatefulSet with 1 pod
- redis-replicas StatefulSet with 3 pods
```

Calling this `standalone` is misleading. It weakens trust because the proof
label would contradict the rendered objects.

## Required Rename

Rename:

```text
variants/standalone/variant.yaml
revisions/standalone/r001/
```

to:

```text
variants/default/variant.yaml
revisions/default/r001/
```

All receipts, run evidence, README cards, verifier scripts, and e2e scripts
must refer to the `default` variant.

## Invariant

The verifier must prove:

```text
variant metadata.name == default
variant revision path == revisions/default/r001/variant-revision.yaml
observation receipt variantRevision points at revisions/default/r001/variant-revision.yaml
```

No proof file should present the default Bitnami Redis render as standalone.
