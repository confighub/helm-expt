# NIM Operator lifecycle actions

> **Not run on a cluster.** These files were extracted from the locked chart archive. No hook here has been run, and the package has not been published.

The k8s-nim-operator chart renders more than the objects a base holds. It also
renders Helm hook objects, which Helm runs when a release is upgraded. They are
kept here, apart from the base, because applying them as ordinary objects would
run them at install time.

- `default`: `default/pre-upgrade.yaml` (4 objects).
- `aicr-eks-inference`: `aicr-eks-inference/pre-upgrade.yaml` (4 objects).

`lifecycle-actions.yaml` records, for each base, when each set applies and what
it does. `generation-receipt.yaml` binds every file to the chart archive it was
rendered from, by SHA-256, and lists the object identities in each file.

Every action is marked `automatic: false`. ConfigHub does not run them. A
person or a delivery workflow decides whether to run each one, and records the
result. The Job images are the tags the chart renders; they are not pinned by
digest here.

These files come from `nvidia/k8s-nim-operator@3.1.0`. Regenerate them with
`node scripts/generate-gpu-operator-packaged-lifecycle.mjs --generate --chart k8s-nim-operator --version 3.1.0`.
