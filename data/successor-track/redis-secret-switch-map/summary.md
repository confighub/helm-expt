# Redis successor existing-secret switch map

This static witness maps two reviewed Bitnami Redis 25.5.3 values to
CloudPirates Redis 0.34.11. Both keep their names:

| Source value | Successor value | Effect checked |
| --- | --- | --- |
| auth.existingSecret | auth.existingSecret | Required Secret name for REDIS_PASSWORD and REDISCLI_AUTH |
| auth.existingSecretPasswordKey | auth.existingSecretPasswordKey | Required key for both environment variables |

The source values come from the retained reuse-existing-secret base. A second
render uses a different name and a non-default key to prove that both settings
take effect. Committed captures strip trailing line whitespace; the receipt
records that normalization. The chart archive must match the existing successor SourceLock
SHA before it is rendered. Each case is rendered twice and must be identical.

| Case | Required Secret | Required key | Objects | Rendered Secrets |
| --- | --- | --- | ---: | ---: |
| retained-values | redis-existing-secret | redis-password | 5 | 0 |
| alternate-values | redis-switch-map-probe | migration-password | 5 | 0 |

## Boundary

The target is explicitly standalone, one replica in namespace redis, with
serviceAccount.create=true. The target keeps its own digest-pinned image.
The old image.digest value is not transferable to the successor image schema.
This maps credential references only: replication, Sentinel, persistence,
storage data, service names, and other overrides need their own migration work.
The required Secret must already exist at installation; no password is copied.

This does not certify a workload migration, package equivalence, installation,
live readiness, or supported status. The retiring and successor catalog
statuses are unchanged. See #1380 and #1757.

## Evidence

- [Receipt](receipt.json), with input and render digests and observations.
- [Retained-values render](retained-values.yaml).
- [Alternate-values render](alternate-values.yaml).

Generate with `node scripts/prove-redis-successor-secret-map.mjs --generate`.
Verify committed evidence with `--verify`; run negative checks with `--self-test`.
