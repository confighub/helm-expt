# Redis Creator Golden

This generated golden shows how a reviewed Redis base can become a production
ConfigHub variant.

```text
from: redis/default
blueprint: environment-clone
target variant: redis/prod-us-east
preview: 15 Units, 3 changed paths, 1 link change
checks: source-revision-bound, no-hidden-helm-rerender, unit-count-preserved, redis-secret-mode-preserved, existing-secret-request-routes-back-to-installer, scan-disposition-carried-forward
```

The source base is the Redis `default` base from
`packages/bitnami/redis/25.5.3`. The Creator contract is post-render: it
clones the reviewed ConfigHub Space and Units, sets operating labels and target,
applies an explicit namespace TransformPaths mutation, preserves upstream links,
and writes receipts.

The promotion model uses the same substrate as the ConfigHub promotions
example: Spaces and Units carry component and variant labels, and cloned Units
retain upstream links back to the source Units. The graph is not a separate
artifact invented by this repo.

Secret handling is part of the proof. The `default` base preserves the
generated Redis Secret reference from Helm output. It does not silently switch
to `redis-existing-secret`. A request to use an existing Secret routes back to
the maintained `reuse-existing-secret` base or to a new `cub installer`
render.

Generated files:

- `creator-contract.yaml`
- `preview.yaml`
- `ux-preview.md`
- `ax-task.yaml`
- `fx-matrix.yaml`
- `receipts/clone-receipt.yaml`
- `receipts/mutation-receipt.yaml`
- `receipts/check-receipt.yaml`
- `receipts/route-back-receipt.yaml`
