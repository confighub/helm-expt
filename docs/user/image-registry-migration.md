# Migrate a chart's image registry across a fleet

This example was run in the `helm-catalog` org on 4 July 2026 and checked again
on 26 July. The live verifier reads the five Spaces, their variant links,
revision history, images, replica counts, policy filters, and pending promotion.
It checks ConfigHub's stored configuration; it does not claim that these Spaces
were delivered to a Kubernetes cluster.

When a chart's image registry changes hands, licenses, or hosts, every environment that pulls from it has to move. This walkthrough repoints one chart's images from a public registry to an internal mirror, promotes the change across a fleet, and proves where it landed. The image digest never changes, because a digest is content-addressed: the same bytes keep the same digest at a new host.

## The starting state

The `bitnami-nginx` fleet is one base Space and four environment variants cloned from it. Every one pulls the same digest-pinned image:

```
registry-1.docker.io/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f
```

The workload is `deployment-nginx-nginx`, with two containers that carry the image: an init container `preserve-logs-symlinks` and the main container `nginx`.

## 1. Rewrite the registry on the base

Repoint both containers on the base to the internal mirror. The digest stays; only the host changes. Each edit is a recorded revision.

```bash
NEW="registry.internal.example.com/bitnami/nginx@sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f"

for container in preserve-logs-symlinks nginx; do
  cub run set-container-image \
    --container-name "$container" \
    --container-image "$NEW" \
    --space bitnami-nginx-24-0-2-http-clusterip \
    --unit deployment-nginx-nginx \
    --change-desc "Registry migration: repoint bitnami/nginx from docker.io to the internal mirror, digest unchanged."
done
```

Both calls report `Config data changed`. Read the base back and every image reference now points at the mirror.

## 2. Preview the promotion

Before promoting, see what would move. The migration touches exactly one unit per environment:

```bash
cub variant promote bitnami-nginx-fleet-dev --dry-run
# Bulk upgrade operation completed:
#   Success: 1 unit(s)
# Would add 0 unit(s) from upstream
```

## 3. Promote to the environments that should move

Promote dev, staging, and prod-us. Leave prod-eu on the old registry, so the fleet shows one environment still to migrate.

```bash
for env in dev staging prod-us; do
  cub variant promote bitnami-nginx-fleet-$env \
    --change-desc "Pull the registry migration into $env (docker.io -> internal mirror)."
done
```

Each promote reports `Success: 1 unit(s)`.

## 4. Prove where it landed

Read the registry host in every environment. Three moved; prod-eu did not.

```bash
for env in dev staging prod-us prod-eu; do
  host=$(cub unit data deployment-nginx-nginx --space bitnami-nginx-fleet-$env \
    | grep -m1 "image:" | awk '{print $2}' | cut -d/ -f1)
  echo "$env: $host"
done
# dev: registry.internal.example.com
# staging: registry.internal.example.com
# prod-us: registry.internal.example.com
# prod-eu: registry-1.docker.io
```

The revision history records the move as a promotion, not a silent edit:

```bash
cub revision list deployment-nginx-nginx --space bitnami-nginx-fleet-prod-us
# 4  UpgradeUnit  Pull the registry migration into prod-us ...
# 3  UpgradeUnit  Fleet release: pull 3 replicas ...
# 2  Invoke       Functions: set-namespace ...
# 1  CloneUnit    Initial Data ...
```

The digest is identical in the migrated and the un-migrated environments, which proves the image is the same content at a new host:

```bash
cub unit data deployment-nginx-nginx --space bitnami-nginx-fleet-prod-us \
  | grep -m1 -oE "sha256:[a-f0-9]+"
# sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f
```

## What this shows

The whole migration is recorded configuration. You can read every affected
image reference, change the host without changing the digest, promote one
environment at a time, and check exactly where the change arrived. Because
ConfigHub stores each environment's configuration, the team chooses when each
environment moves.

Dev and staging now also keep their own one-replica setting while retaining the
promoted image change. Prod-us uses the production policy. Prod-eu still uses
the old registry and reports one pending upstream Unit. This is the useful
split: a shared base can move forward while each environment keeps its own
settings.

Recheck the live org:

```bash
cub auth switch helm-catalog
npm run helm-org:fleet:verify
```

The committed result is
[data/fleet-promotion/live-nginx-registry-migration.yaml](../../data/fleet-promotion/live-nginx-registry-migration.yaml).
The offline command `npm run helm-org:fleet:receipt:verify` checks that receipt
without contacting ConfigHub.

## Rolling back

The migration is a set of revisions, so a rollback moves the head back. Restore the base to the revision before the rewrite, then promote again, or restore an individual environment's unit to its pre-migration revision. See [day-2 upgrade and rollback](./day2-upgrade-rollback.md).
