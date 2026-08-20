# Upgrade and rollback

A Helm upgrade renders the whole release again from the new chart and values. That can
replace changes made to the Kubernetes objects after the first install. It can also
change many objects at once, which makes it hard to see which environments and
clusters will be affected.

ConfigHub keeps the rendered objects as records. A chart update can be compared with
those records, so a deliberate change to an object does not have to be put back into
the chart templates before every upgrade.

## A complete Redis upgrade

The [Redis Upgrade App proof](../../data/redis-upgrade-app-proof/summary.md) ran this
sequence from beginning to end:

1. Pull the public `bitnami/redis:25.5.3` installer package and select the
   `reuse-existing-secret` configuration.
2. Upload its 14 Kubernetes objects to ConfigHub.
3. Change `StatefulSet/redis-replicas spec.replicas` from the chart default of three
   to two.
4. Create development and staging versions from that base.
5. Prepare `bitnami/redis:27.0.0` and inspect the candidate plan.
6. Update the base. Redis changes from 8.6.3 to 8.8.0, while the replica count stays
   at two.
7. Promote the update to development, then staging.
8. Publish the reviewed staging configuration as OCI.
9. Reconcile the same OCI digest with Argo CD on two clusters.
10. Check both clusters. Each reached one ready master, two ready replicas, and
    returned `PONG`.
11. Restore every changed staging Unit to its exact revision from before the
    promotion, under a named rollback ChangeSet.
12. Publish the restored configuration as a separate OCI artifact.
13. Reconcile both Argo CD applications to that rollback artifact and check both
    clusters again. Each returned to chart 25.5.3, kept two replicas, and returned
    `PONG`.

Development reported 14 pending Units after the base changed. Staging was not pending
yet because its direct parent was development. Once development accepted the update,
staging reported its own 14 pending Units. This is the rollout order shown by the
ConfigHub variant chain.

## The Secret remains separate

The selected Redis configuration expects `redis/redis-existing-secret`, key
`redis-password`. The workload package does not contain that password. The live test
created a different temporary Secret on each cluster and did not write either
credential to the repository, OCI package, or receipt.

## What to check before promotion

Check the candidate chart and application versions, the exact object changes, any
recorded edits that must remain, and any hooks, CRDs, setup jobs, or Secrets needed by
the target.

The Redis candidate plan reported 13 changed objects, no additions, and no deletions.
It did not propose a change to `spec.replicas`.

The `cub variant promote --dry-run -o mutations` command returned a mutation preview
for both development and staging. Each dry run left the stored Units unchanged. The
real promotion ran only after that check.

## Rollback

ConfigHub keeps a revision history for every Unit. Before promotion, the Redis test
recorded the exact revision number and content digest for all 14 Kubernetes objects
and the installer record. After the candidate was running, it created the
`rollback-to-25-5-3` ChangeSet and restored only the Units whose content had changed.
Unchanged Units were left alone. The test then closed the ChangeSet before publishing
the rollback release.

The restored objects matched the pre-upgrade records exactly. ConfigHub published
them as a new OCI artifact, Argo CD reconciled both clusters to that digest, and the
live checks passed again.

This is a configuration rollback. It does not restore data inside Redis. Database
migrations, CRD schema changes, and some hooks may be irreversible even when the
Kubernetes objects can be restored. Those cases need a chart-specific route and
recovery plan.

Read [How chart hooks are handled](./chart-hooks-what-happens.md) and
[Why synced is not the same as working](./why-synced-is-not-working.md) for those two
parts of the release check.
