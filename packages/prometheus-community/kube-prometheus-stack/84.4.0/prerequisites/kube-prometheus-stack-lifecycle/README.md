# kube-prometheus-stack lifecycle actions

> **Not run on a cluster.** These files were extracted from the locked chart archive. No hook here has been run, and the package has not been published.

The kube-prometheus-stack chart renders more than the objects a base holds. It also
renders Helm hook objects, which Helm runs before and after an install or an upgrade. They are
kept here, apart from the base, because applying them as ordinary objects would
run them at the wrong time.

- `default`: `default/pre-install-pre-upgrade-post-install-post-upgrade.yaml` (5 objects), `default/pre-install-pre-upgrade.yaml` (1 object), `default/post-install-post-upgrade.yaml` (1 object).
- `aicr-eks-training-v0-20-0`: `aicr-eks-training-v0-20-0/pre-install-pre-upgrade-post-install-post-upgrade.yaml` (5 objects), `aicr-eks-training-v0-20-0/pre-install-pre-upgrade.yaml` (1 object), `aicr-eks-training-v0-20-0/post-install-post-upgrade.yaml` (1 object).
- `aicr-eks-training-v1-0-0`: `aicr-eks-training-v1-0-0/pre-install-pre-upgrade-post-install-post-upgrade.yaml` (5 objects), `aicr-eks-training-v1-0-0/pre-install-pre-upgrade.yaml` (1 object), `aicr-eks-training-v1-0-0/post-install-post-upgrade.yaml` (1 object).

`lifecycle-actions.yaml` records, for each base, when each set applies and what
it does. `generation-receipt.yaml` binds every file to the chart archive it was
rendered from, by SHA-256, and lists the object identities in each file.

Every action is marked `automatic: false`. ConfigHub does not run them. A
person or a delivery workflow decides whether to run each one, and records the
result. The Job images are the tags the chart renders; they are not pinned by
digest here.

These files come from `prometheus-community/kube-prometheus-stack@84.4.0`. Regenerate them with
`node scripts/generate-gpu-operator-packaged-lifecycle.mjs --generate --chart kube-prometheus-stack --version 84.4.0`.
