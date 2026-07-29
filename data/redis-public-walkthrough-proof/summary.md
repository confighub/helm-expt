# Redis public walkthrough proof

This run exercises the public part of the Redis walkthrough without a
ConfigHub account, a registry login, or a Kubernetes cluster.

It pulls the published Redis `25.5.3` installer package, selects the
`reuse-existing-secret` base, writes the 14 rendered Kubernetes objects to
files and a local OCI layout, and pulls that OCI back for comparison. It then
pulls Redis `27.0.0` into the same work directory with `--reuse`. The
installer retains the selected existing-Secret base and verifies a second
14-object OCI.

## Result

**pass.** With no ConfigHub account, registry login, or Kubernetes cluster, cub installer anonymously pulled Redis 25.5.3, rendered the existing-Secret base as 14 non-secret objects, wrote and verified a local OCI, upgraded the same work directory to 27.0.0, retained the selected base, and wrote and verified the newer 14-object OCI.

| Chart | App | Selected base | Objects | Secrets in output | Public package digest | Rendered object digest | OCI pull-back |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
| `25.5.3` | `8.6.3` | `reuse-existing-secret` | 14 | 0 | `sha256:7ad5fa6de0aa9c29df8cd26650893ebae6ad149a7c5ac33a8beedf5b02e2ac33` | `sha256:518db60ad92b59818c9e84042b12cc7b3d850a583ab7ca565bbf09f6806e4324` | pass |
| `27.0.0` | `8.8.0` | `reuse-existing-secret` | 14 | 0 | `sha256:f7abbebaa196753028c1ece5c24a32a0f40ac08aeda7ad3a5ec225e019a90780` | `sha256:222cdae547665b7be00a61001ee6789582ff387e687890a46da9112232bd1ebc` | pass |

The package and output OCI contain no Secret object. A deployment still needs
`redis/redis-existing-secret`, key `redis-password`, supplied through the
operator's normal secret-management path.

## Where ConfigHub starts

The public run keeps a package choice. It does not claim to keep an arbitrary
edit to a rendered Kubernetes object.

The [managed Redis upgrade proof](../redis-upgrade-app-proof/summary.md) covers
that next step. It changes the rendered replica StatefulSet from three replicas
to two, upgrades the chart from `25.5.3` to `27.0.0` without resetting the
replica count, promotes the result through development and staging, reconciles
the same reviewed OCI on two Argo CD clusters, and restores the prior revisions
as a rollback.

## Limits

- This public run proves anonymous package pulls, local rendering, local OCI output, OCI pull-back verification, and retention of the selected base across a package upgrade.
- The selected existing-Secret base keeps credential bytes out of the rendered files and OCI. A deployer still has to create or bind redis/redis-existing-secret.
- The no-account run does not keep arbitrary edits to rendered Kubernetes objects. The separate ConfigHub proof covers a post-render replica edit, promotion, two-cluster rollout, and rollback.
- This run does not apply either version to Kubernetes. The separate serverless install parity proof covers live Helm and cub installs.

Receipt:
[`runs/redis-public-walkthrough-proof/receipt.yaml`](../../runs/redis-public-walkthrough-proof/receipt.yaml).
