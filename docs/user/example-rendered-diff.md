# One real rendered diff: redis 25.5.3 to 27.0.0

This page shows what a version bump actually changes in the rendered objects,
computed from the two committed renders rather than described. Both renders
are in this repository, so every number here is checkable.

Source renders:

- `recipes/bitnami/redis/25.5.3/revisions/default/r001/rendered/release-objects.yaml`
- `recipes/bitnami/redis/27.0.0/revisions/default/r001/rendered/release-objects.yaml`

## The shape of the change

Both versions render the same 14 objects with the same identities: no object
is added, removed, or renamed by this upgrade. The diff is 85 lines across
those objects.

Three changes matter operationally:

1. **The `users.acl` block is gone from the configuration ConfigMap in
   27.0.0.** If you relied on it, the upgrade removes it silently.
2. **The `checksum/configmap` pod annotations rotate.** That is by design in
   the chart, and it means the upgrade restarts the pods even though your
   values did not change. Plan the upgrade window accordingly.
3. The chart and app version labels move, which is cosmetic.

## Why this page exists

`helm upgrade` shows you none of this until apply time. Rendering both
versions and diffing them shows all of it before you schedule the change. The
[day-2 upgrade guide](./day2-upgrade-rollback.md) shows the same comparison
done through recorded revisions, where the diff also survives as a record.
