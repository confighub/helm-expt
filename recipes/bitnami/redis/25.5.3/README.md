# Redis Proof: bitnami/redis 25.5.3

## Readiness Card

| Field | Result |
| --- | --- |
| Chart | bitnami/redis 25.5.3 |
| Variant | standalone |
| Status | usable with controls |
| Helm objects | 14 |
| ConfigHub/cub install objects | 15 |
| Explained difference | installer namespace support object |
| Helm match | 14/14 semantic object matches |
| Secrets | 1 rendered Secret separated from uploaded manifests |
| Scan/gate | local scan warns; production blocked; local-test warning only |
| Scan findings | 2 high, 2 medium |
| Next action | resolve or waive local scan findings, then publish through ConfigHub OCI |
| Proof | equivalence, render, scan, and gate receipts |

## Current Proof Commands

```sh
npm run redis:compare
npm run redis:verify-proof
```

This proof uses the archived Redis render as a compatibility fixture and stores
new recipe/variant/revision proof artifacts under this directory. The archive
is not the product pathway; it is the golden comparison input until a first
class Helm recipe importer exists.
