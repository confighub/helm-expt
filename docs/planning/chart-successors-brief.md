# Brief: successor charts for the six affected components

Status: survey complete, 2026-08-08. The measured survey lives in
[data/bitnami-successors](../../data/bitnami-successors/successors.md); this
brief carries the decisions it supports. Nothing in the catalog changes until
each migration lands as its own reviewed work.

## Why now

The catalog sources six components from one upstream publisher whose public
chart archive is closing. Measured on 2026-08-08: the pinned tgz paths for
redis 25.5.3, nginx 24.0.2, postgresql 18.6.7, and mongodb 19.0.7 return 403;
mysql 14.0.3 and rabbitmq 16.0.14 still return 200. The repository index
still lists every pinned version but points its download entries at a
registry namespace instead of the direct archive, so the remaining 200s
should be treated as a closing window, not stability.

Verify lanes never fetch charts and keep passing on committed receipts. The
lanes that fetch at run time are the generate-proof and live-parity lanes,
so refresh and re-record work breaks first.

## The recommendations

Each pick was found and live-verified by one pass and independently
re-verified by a second; every source status is a measured anonymous fetch.

| Component | Recommendation | Publisher | Shape |
| --- | --- | --- | --- |
| redis | valkey chart | Valkey project | plain chart, engine swap |
| nginx | nginx chart | CloudPirates | plain chart |
| postgresql | CloudNativePG operator and cluster charts | CNCF project | operator |
| mysql | MySQL Operator and InnoDB cluster charts | MySQL team | operator |
| mongodb | Percona operator and database charts | Percona | operator |
| rabbitmq | rabbitmq chart | CloudPirates | plain chart |

## The two decisions the survey cannot make

**The redis engine question.** The strongest maintained plain chart deploys
Valkey, the Linux Foundation fork, which is an engine swap with an ACL-based
auth surface rather than the single-password shape the catalog documents
today. Keeping the Redis engine means either the OT-Container-Kit operator
(shape change, default image lags upstream) or the community redis-ha chart
(closest drop-in shape, single maintainer, and the Redis 8 image carries the
post-7.4 tri-license). There is no anonymous official Redis chart; that was
verified, not assumed. This is a product call, not a technical one.

**The operator shape tax.** Three recommendations are operators. An operator
entry changes the catalog contract: CRDs before CRs, render-late lifecycle
routes, and values that move from chart keys into CR specs. The catalog
already has the doctrine for this, but each migration is real reviewed work,
not a pin bump.

## Concentration note

Two recommendations share one small commercial publisher (CloudPirates).
Both charts measured well: Apache-2.0, digest-pinned upstream images, cosign
signatures, near-Bitnami values names. The concentration is still a risk to
weigh; the survey records ranked alternates for both components.

## Proposed order

1. nginx and rabbitmq first: plain charts, near drop-in values, and nginx is
   already broken at its pin while rabbitmq still serves.
2. The redis engine decision, then its migration.
3. The three operators one at a time, postgresql first because the CNCF
   publisher clears the quality bar most cleanly.

## Boundary

This survey names verified options and their measured availability. It
changes no recipe, receipt, or catalog entry, and it makes no claim about
any vendor beyond the recorded fetch results.
