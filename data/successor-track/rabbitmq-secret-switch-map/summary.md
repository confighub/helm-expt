# RabbitMQ successor credential switch map

The retained Bitnami RabbitMQ 16.0.14 configuration uses two Secrets:
password from rabbitmq-auth, cookie from rabbitmq-erlang-cookie.
CloudPirates RabbitMQ 0.21.13 uses one auth.existingSecret for both.
The original two Secret names therefore cannot be transferred unchanged through
these successor auth settings. This is a credential consolidation prerequisite,
not a completed migration. See #1380 and #1757.

| Source | Successor | Required preparation |
| --- | --- | --- |
| auth.existingPasswordSecret | auth.existingSecret | Consolidate password and cookie into one existing Secret |
| auth.existingErlangSecret | auth.existingSecret | Use that same existing Secret |
| rabbitmq-password key | auth.existingPasswordKey | Set the retained key explicitly |
| rabbitmq-erlang-cookie key | auth.existingErlangCookieKey | Set the retained key explicitly |

Two deterministic renders prove explicit Secret-name and key selection, including
the init container cookie reference. Neither render emits a Secret. The alternate
case changes all three settings. The chart archive is checked against SourceLock
before rendering; captures trim trailing line whitespace after raw repeat equality.

| Case | Required Secret | Password key | Cookie key | Objects |
| --- | --- | --- | --- | ---: |
| consolidated-keys | rabbitmq-consolidated | rabbitmq-password | rabbitmq-erlang-cookie | 4 |
| alternate-keys | rabbitmq-switch-map-probe | migration-password | migration-cookie | 4 |

## Boundary and operator action

The operator must provision the consolidated Secret in namespace rabbitmq,
preserving the intended password and Erlang cookie, before installation. No
credential values are read, copied, or created by this proof. Target scope is one
replica with its own digest-pinned image and default username; username, topology,
storage, service names, and other overrides still require migration review.
This does not prove installation, package equivalence, data migration, cluster
readiness, or supported status. Catalog verdicts remain unchanged.

## Evidence

- [Receipt](receipt.json) binds source files and rendered observations.
- [Consolidated keys render](consolidated-keys.yaml).
- [Alternate keys render](alternate-keys.yaml).

Generate with `node scripts/prove-rabbitmq-successor-secret-map.mjs --generate`.
Use `--verify` for retained evidence and `--self-test` for negative checks.
