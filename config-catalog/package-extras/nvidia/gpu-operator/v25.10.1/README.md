# GPU Operator lifecycle actions

> **Not run on a cluster.** These files were extracted from the locked chart archive. No hook here has been run, and the package has not been published.

The gpu-operator chart renders more than the objects a base holds. It also
renders Helm hook objects, which Helm runs when a release is upgraded or
deleted. They are kept here, apart from the base, because applying them as
ordinary objects would run them at install time.

- `default`: `default/pre-upgrade.yaml` (4 objects), `default/post-delete.yaml` (4 objects).
- `driver-580.126.20`: `driver-580.126.20/pre-upgrade.yaml` (4 objects), `driver-580.126.20/post-delete.yaml` (4 objects).
- `driver-595.91.07`: `driver-595.91.07/pre-upgrade.yaml` (4 objects), `driver-595.91.07/post-delete.yaml` (4 objects).
- `preinstalled-driver`: `preinstalled-driver/pre-upgrade.yaml` (4 objects), `preinstalled-driver/post-delete.yaml` (4 objects).
- `preinstalled-driver-and-toolkit`: `preinstalled-driver-and-toolkit/pre-upgrade.yaml` (4 objects), `preinstalled-driver-and-toolkit/post-delete.yaml` (4 objects).
- `external-nfd`: `external-nfd/pre-upgrade.yaml` (4 objects).

`lifecycle-actions.yaml` records, for each base, when each set applies and what
it does. `generation-receipt.yaml` binds every file to the chart archive it was
rendered from, by SHA-256, and lists the object identities in each file.

Every action is marked `automatic: false`. ConfigHub does not run them. A
person or a delivery workflow decides whether to run each one, and records the
result. The Job images are the tags the chart renders; they are not pinned by
digest here.

These files come from `nvidia/gpu-operator@v25.10.1`. Regenerate them with
`node scripts/generate-gpu-operator-packaged-lifecycle.mjs --generate --version v25.10.1`.
