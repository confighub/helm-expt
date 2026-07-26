# Registry migration, live receipt

Run 2026-07-04 in the helm-catalog org on the bitnami-nginx fleet, then checked
again on 2026-07-26. No new Spaces were needed; the migration ran on the
existing tree.

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
- Dev and staging each keep a one-replica environment setting. Prod-us keeps
  three replicas. The shared image change is present in all three.
- Prod-eu reports one pending upstream Unit and still uses the old registry.
- All five Spaces carry the `catalog-standard` policy profile. The two
  production Spaces use the approval-bearing production filter.

The machine-readable result is
[live-nginx-registry-migration.yaml](../fleet-promotion/live-nginx-registry-migration.yaml).
Run `npm run helm-org:fleet:receipt:verify` offline, or
`npm run helm-org:fleet:verify` while logged into the live org.

## Walkthrough

[docs/user/image-registry-migration.md](../../docs/user/image-registry-migration.md)
carries the commands and explains what the live verifier checks.
