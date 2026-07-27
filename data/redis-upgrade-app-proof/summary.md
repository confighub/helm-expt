# Redis upgrade and rollback

This live test starts from the public Redis `25.5.3` installer package.
It records a change from three replicas to two, prepares Redis
`27.0.0`, and checks that the upgrade does not put the replica count
back to the chart default. ConfigHub then promotes the candidate through development
and staging. The reviewed staging configuration is packaged once and reconciled by
Argo CD on two throwaway clusters.

The test then restores the exact staging Unit revisions recorded before the promotion.
It publishes that restored configuration as a separate OCI artifact and checks both
clusters again. This is a rollback of desired Kubernetes configuration. It does not
claim to reverse database data or an irreversible migration.

## Result

**pass.** A Redis chart upgrade from 25.5.3 to 27.0.0 kept a recorded post-render replica change, exposed two affected environment variants, promoted the candidate through development and staging, and reconciled the same reviewed OCI digest on two Argo CD clusters. The test then restored the exact pre-upgrade staging revisions, published a separate rollback OCI, and reconciled both clusters back to chart 25.5.3 with two replicas. Both forward and rollback states passed exact-object, workload-convergence, and PONG checks.

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
| Publish the ConfigHub release | pass | `sha256:347293667741cf5235b716438cd7f39a16a3b7ab005721210c8d7a7ca66ec7c5`. |
| Build and pull the portable OCI | pass | 14 objects at `sha256:40be80f19dacbc9d2e2f32d2b77967ef60a872c0c4b3b3f6fd54b5f6fa2ffe0f`; pulled files matched the reviewed staging files. |
| Roll out to two clusters | pass | Both Argo CD applications reported the same OCI digest and both Redis installations became ready. |
| Restore the prior revisions | pass | 14 changed Units were restored under ChangeSet `rollback-to-25-5-3`; 1 unchanged Unit was left alone. |
| Publish the rollback OCI | pass | 14 objects at `sha256:0fdd44e42cf01fdb8b8a7200871a8f6647f65298aacb1f4d880c54e9d99f34c6`; pulled files matched the restored staging Units. |
| Reconcile the rollback | pass | Both Argo CD applications reported the rollback digest and both Redis installations became ready on chart 25.5.3. |

## Candidate results

| Cluster | Chart | Argo sync | Argo health | Master | Replicas | Redis check | Exact objects | Current workloads |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hx-redis-upgrade-20260727-w12-a` | 27.0.0 | Synced | Healthy | 1/1 | 2/2 | PONG | [objects](../../runs/redis-upgrade-app-proof/observations/target-a-object-set.json) | [workloads](../../runs/redis-upgrade-app-proof/observations/target-a-workloads.json) |
| `hx-redis-upgrade-20260727-w12-b` | 27.0.0 | Synced | Healthy | 1/1 | 2/2 | PONG | [objects](../../runs/redis-upgrade-app-proof/observations/target-b-object-set.json) | [workloads](../../runs/redis-upgrade-app-proof/observations/target-b-workloads.json) |

## Rollback results

| Cluster | Chart | Argo sync | Argo health | Master | Replicas | Redis check | Exact objects | Current workloads |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `hx-redis-upgrade-20260727-w12-a` | 25.5.3 | Synced | Healthy | 1/1 | 2/2 | PONG | [objects](../../runs/redis-upgrade-app-proof/observations/target-a-rollback-object-set.json) | [workloads](../../runs/redis-upgrade-app-proof/observations/target-a-rollback-workloads.json) |
| `hx-redis-upgrade-20260727-w12-b` | 25.5.3 | Synced | Healthy | 1/1 | 2/2 | PONG | [objects](../../runs/redis-upgrade-app-proof/observations/target-b-rollback-object-set.json) | [workloads](../../runs/redis-upgrade-app-proof/observations/target-b-rollback-workloads.json) |

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
- A named ChangeSet can restore the staging Units to their exact pre-upgrade
  revisions while retaining the two-replica edit.
- The restored result can be published as a separate OCI artifact and reconciled by
  the same two Argo CD clusters.
- Both clusters matched the reviewed object set, reached one ready Redis master and
  two ready replicas, and returned `PONG` before and after rollback.

## Limits

- The required Redis Secret was created separately on each throwaway cluster. The workload OCI does not contain the password.
- cub variant promote --dry-run -o mutations returned no text in this run. The proof checked that the dry run changed no stored data, but it does not claim that the current CLI shows a useful mutation preview.
- The portable output OCI used a temporary local registry. Public registry publication is a separate receipt.
- The OCI keeps the reviewed ConfigHub objects. The cub-scout input removes only explicit null fields that the Kubernetes API omits before comparison.
- The rollback restored the desired Kubernetes objects and checked workload health. It did not restore database data or exercise an irreversible migration.
- This proves one Redis base, one post-render field change, two environment promotions, one manifest rollback, and two throwaway clusters. It does not prove every chart upgrade, rollback, or production scale.
- The cub-scout observations were recorded locally and were not submitted to ConfigHub observation storage.

Receipt: [`runs/redis-upgrade-app-proof/receipt.yaml`](../../runs/redis-upgrade-app-proof/receipt.yaml).
