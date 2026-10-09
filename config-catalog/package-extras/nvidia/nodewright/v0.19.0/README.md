# NodeWright lifecycle actions

> **Not run on a cluster.** These files were extracted from the locked chart archive. No hook here has been run, and the package has not been published.

The nodewright chart renders more than the objects a base holds. It also
renders Helm hook objects, which Helm runs before an upgrade and before a delete. They are
kept here, apart from the base, because applying them as ordinary objects would
run them at the wrong time.

- `default`: `default/pre-upgrade.yaml` (4 objects), `default/pre-delete.yaml` (2 objects).
- `aicr-eks-training`: `aicr-eks-training/pre-upgrade.yaml` (4 objects), `aicr-eks-training/pre-delete.yaml` (2 objects).

`lifecycle-actions.yaml` records, for each base, when each set applies and what
it does. `generation-receipt.yaml` binds every file to the chart archive it was
rendered from, by SHA-256, and lists the object identities in each file.

Every action is marked `automatic: false`. ConfigHub does not run them. A
person or a delivery workflow decides whether to run each one, and records the
result. The Job images are the tags the chart renders; they are not pinned by
digest here.

These files come from `nvidia/nodewright@v0.19.0`. Regenerate them with
`node scripts/generate-gpu-operator-packaged-lifecycle.mjs --generate --chart nodewright --version v0.19.0`.
