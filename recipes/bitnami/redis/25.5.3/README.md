# Redis Proof: bitnami/redis 25.5.3

## Readiness Card

| Field | Result |
| --- | --- |
| Chart | bitnami/redis 25.5.3 |
| Variants | default, reuse-existing-secret |
| Status | usable with controls |
| Helm objects | default: 14; reuse-existing-secret: 13 |
| ConfigHub/cub installer objects | default: 15; reuse-existing-secret: 14 |
| Explained difference | installer namespace support object; default also separates rendered Secret |
| Helm match | default: 14/14; reuse-existing-secret: 13/13 semantic object matches |
| Secrets | default renders 1 Secret; reuse-existing-secret renders 0 Secrets and requires target Secret redis-existing-secret/redis-password |
| Scan/gate | local scan warns; production blocked; local-test warning only |
| Scan findings | default: 2 high, 2 medium; reuse-existing-secret: 2 high, 2 medium |
| Variant diff | default -> reuse-existing-secret removes Secret/redis, retargets two StatefulSets, adds target Secret requirement |
| Next action | resolve or waive local scan findings, then publish through ConfigHub OCI |
| Proof | equivalence, render, scan, and gate receipts |

## Variant Secret Handling

The `default` variant renders `Secret redis/redis` from the pinned demo
`auth.password`. `cub installer` separates that rendered Secret from normal
manifests, so direct local tests apply `out/secrets`, while ConfigHub upload
records workload references instead of storing the rendered Secret as a Unit.

The `reuse-existing-secret` variant renders no Redis Secret. It retargets the
Redis StatefulSets to `Secret redis/redis-existing-secret` key
`redis-password`, records that requirement as a variant target fact, and the
installer package exposes it as an external requirement.

## Current Proof Commands

```sh
npm run redis:compare
npm run redis:verify-proof
```

This proof renders Redis with regular Helm under pinned inputs, stores the
recipe/variant/revision proof artifacts under this directory, and verifies the
current `packages/bitnami/redis/25.5.3` cub installer package against that
regular Helm output.
