# Registry migration, live receipt

Run 2026-07-04 in the helm-catalog org on the bitnami-nginx fleet. No new
spaces (org at 978/1000 links); the migration ran on the existing tree.

## What ran

- Rewrote `deployment-nginx-nginx` on the fleet base, both containers
  (`preserve-logs-symlinks`, `nginx`), from
  `registry-1.docker.io/bitnami/nginx@sha256:805bcc...` to
  `registry.internal.example.com/bitnami/nginx@sha256:805bcc...`. Digest
  unchanged; only the host moved. Two recorded revisions.
- Promoted the base to `bitnami-nginx-fleet-dev`, `-staging`, `-prod-us`
  (one `UpgradeUnit` revision each). Left `bitnami-nginx-fleet-prod-eu` on
  the old registry as the visible laggard.

## Proof

| Environment | Registry host after |
| --- | --- |
| dev | registry.internal.example.com |
| staging | registry.internal.example.com |
| prod-us | registry.internal.example.com |
| prod-eu | registry-1.docker.io (not migrated) |

- prod-us revision 4 is `UpgradeUnit` with the migration change description.
- Digest identical in migrated and un-migrated environments
  (`sha256:805bcc863fc3f602589fc75cae91eeedebad234d5ce5a476c96b03a747821e7f`),
  proving the content-addressed image survived the host move.
- 8 internal-mirror references live across base + three environments (two
  containers each).

## Walkthrough

[docs/user/image-registry-migration.md](../../docs/user/image-registry-migration.md)
carries the verbatim commands. This receipt is the record that the walkthrough
was executed live, not asserted.
