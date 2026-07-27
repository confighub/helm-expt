# Redis upgrade: keep a change, promote it, and check the rollout

This live test starts from the public Redis `25.5.3` installer package.
It records a change from three replicas to two, prepares Redis
`27.0.0`, and checks that the upgrade does not put the replica count
back to the chart default. ConfigHub then promotes the candidate through development
and staging. The reviewed staging configuration is packaged once and reconciled by
Argo CD on two throwaway clusters.

## Result

**pass.** A Redis chart upgrade from 25.5.3 to 27.0.0 kept a recorded post-render replica change, exposed two affected environment variants, promoted the candidate through development and staging, and reconciled the same reviewed OCI digest on two Argo CD clusters. Both clusters reached one ready master and two ready replicas, returned PONG, and passed exact-object and workload-convergence checks.

| Step | Result | What was checked |
| --- | --- | --- |
| Resolve the public packages | pass | `25.5.3` is `sha256:7ad5fa6de0aa9c29df8cd26650893ebae6ad149a7c5ac33a8beedf5b02e2ac33`; `27.0.0` is `sha256:f7abbebaa196753028c1ece5c24a32a0f40ac08aeda7ad3a5ec225e019a90780`. |
| Import the current package | pass | 14 Kubernetes objects, Redis 8.6.3, chart 25.5.3. |
| Record the user change | pass | `StatefulSet/redis-replicas spec.replicas` changed from 3 to 2. |
| Check the candidate plan | pass | 0 add, 13 change, 0 delete; no replica reset proposed. |
| Reconcile the base | pass | Chart 25.5.3 became 27.0.0; Redis 8.6.3 became 8.8.0; replicas stayed 2. |
| Show downstream impact | pass | 2 environment Spaces are in the path: development was pending first, and staging became pending after the development wave. |
| Promote development | pass | Chart 27.0.0; replicas 2; dry run left stored data unchanged. |
| Promote staging | pass | Chart 27.0.0; replicas 2; dry run left stored data unchanged. |
| Publish the ConfigHub release | pass | `sha256:07f1e5cd3bef7472e955149bfe32e548e491f86ff926d6f84bf1212b5452315b`. |
| Build and pull the portable OCI | pass | 14 objects at `sha256:8e129cd6a55b438b7c90731afed414ed929525fe9a05ba80beb1114dbe8ab663`; pulled files matched the reviewed staging files. |
| Roll out to two clusters | pass | Both Argo CD applications reported the same OCI digest and both Redis installations became ready. |

## Live results

| Cluster | Argo sync | Argo health | Master | Replicas | Redis check | Exact objects | Current workloads |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hx-redis-upgrade-20260726-15p2-a` | Synced | Healthy | 1/1 | 2/2 | PONG | [objects](../../runs/redis-upgrade-app-proof/observations/target-a-object-set.json) | [workloads](../../runs/redis-upgrade-app-proof/observations/target-a-workloads.json) |
| `hx-redis-upgrade-20260726-15p2-b` | Synced | Healthy | 1/1 | 2/2 | PONG | [objects](../../runs/redis-upgrade-app-proof/observations/target-b-object-set.json) | [workloads](../../runs/redis-upgrade-app-proof/observations/target-b-workloads.json) |

## The Secret is separate

The selected `reuse-existing-secret` configuration refers to
`redis/redis-existing-secret`, key `redis-password`. The package and
portable workload OCI do not contain that password. This test created a different
temporary Secret on each target through standard input. No credential bytes were
written to the repository or receipt.

## One current CLI gap

`cub variant promote --dry-run -o mutations` returned no text for both promotions.
The command changed no stored data, and the real promotions completed, but the empty
preview is not useful to a person reviewing the upgrade. This receipt records that as
a known presentation gap rather than describing the preview as complete.

## What this proves

- A public installer package can become a recorded ConfigHub base.
- A change to the rendered Kubernetes objects can remain in place when a newer chart
  package is reconciled.
- ConfigHub can show which environment variants are waiting for the candidate and
  promote them in order.
- The reviewed result can leave ConfigHub as OCI and reconcile at the same digest on
  two Argo CD clusters.
- Both live clusters matched the reviewed object set, reached one ready Redis master
  and two ready replicas, and returned `PONG`.

## Limits

- The required Redis Secret was created separately on each throwaway cluster. The workload OCI does not contain the password.
- cub variant promote --dry-run -o mutations returned no text in this run. The proof checked that the dry run changed no stored data, but it does not claim that the current CLI shows a useful mutation preview.
- The portable output OCI used a temporary local registry. Public registry publication is a separate receipt.
- The OCI keeps the reviewed ConfigHub objects. The cub-scout input removes only explicit null fields that the Kubernetes API omits before comparison.
- This proves one Redis base, one post-render field change, two environment promotions, and two throwaway clusters. It does not prove every chart upgrade or production scale.
- The cub-scout observations were recorded locally and were not submitted to ConfigHub observation storage.

Receipt: [`runs/redis-upgrade-app-proof/receipt.yaml`](../../runs/redis-upgrade-app-proof/receipt.yaml).
