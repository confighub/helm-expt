# Redis Proof: bitnami/redis 25.5.3

## Readiness Card

| Field | Result |
| --- | --- |
| Chart | bitnami/redis 25.5.3 |
| Variants | default, reuse-existing-secret |
| Status | usable with controls |
| Helm objects | default: 14; reuse-existing-secret: 13 |
| ConfigHub/cub install objects | default: 15; reuse-existing-secret: 14 |
| Explained difference | installer namespace support object; default also separates rendered Secret |
| Helm match | default: 14/14; reuse-existing-secret: 13/13 semantic object matches |
| Secrets | default renders 1 Secret; reuse-existing-secret renders 0 Secrets and requires target Secret redis-existing-secret/redis-password |
| Scan/gate | local scan warns; production blocked; local-test warning only |
| Scan findings | default: 2 high, 2 medium; reuse-existing-secret: 2 high, 2 medium |
| Variant diff | default -> reuse-existing-secret removes Secret/redis, retargets two StatefulSets, adds target Secret requirement |
| Installer package | packages/bitnami/redis/25.5.3 with bases default and reuse-existing-secret |
| Package proof | deterministic `cub install package`; both bases verified through `cub install setup --base` |
| ConfigHub upload | Kubara spaces helm-redis-default and helm-redis-reuse-existing-secret |
| ConfigHub OCI | unit-level OCI manifests verified for representative StatefulSet Units |
| Next action | resolve or waive local scan findings before production promotion |
| Proof | equivalence, render, scan, gate, package, upload/OCI, and local observation receipts |

## Current Proof Commands

```sh
npm run redis:compare
npm run redis:verify-proof
npm run redis:verify-package
```

Remote ConfigHub evidence is recorded at:

```text
runs/redis-confighub/latest/upload-oci-receipt.yaml
```

This proof uses the archived Redis render as a compatibility fixture and stores
new recipe/variant/revision proof artifacts under this directory. The archive
is not the product pathway; it is the golden comparison input until a first
class Helm recipe importer exists.
