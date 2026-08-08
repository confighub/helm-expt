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
| redis | redis chart | CloudPirates | plain chart, keeps the engine |
| nginx | nginx chart | CloudPirates | plain chart |
| postgresql | CloudNativePG operator and cluster charts | CNCF project | operator |
| mysql | MySQL Operator and InnoDB cluster charts | MySQL team | operator |
| mongodb | Percona operator and database charts | Percona | operator |
| rabbitmq | rabbitmq chart | CloudPirates | plain chart |

## The two decisions the survey cannot make

**The redis engine question.** A second-pass catalog sweep (Artifact Hub and
charts.openshift.io) surfaced a plain chart that keeps the Redis engine with
a near-identical values surface, now ranked first: the same verified
publisher as the nginx and rabbitmq picks, digest-pinned Redis 8 by default.
The engine consideration does not disappear: Redis 8 carries the post-7.4
tri-license with AGPLv3 as the open-source option, and buyers who avoid AGPL
will prefer the valkey chart (rank two, BSD-3-Clause fork, ACL auth surface).
There is still no anonymous official Redis chart, and the Red Hat catalog
holds only OpenShift template wrappers; both were verified, not assumed.
The remaining call is licensing posture, not chart availability.

**The operator shape tax.** Three recommendations are operators. An operator
entry changes the catalog contract: CRDs before CRs, render-late lifecycle
routes, and values that move from chart keys into CR specs. The catalog
already has the doctrine for this, but each migration is real reviewed work,
not a pin bump.

## Concentration note

Three recommendations now share one small commercial publisher (CloudPirates).
Both charts measured well: Apache-2.0, digest-pinned upstream images, cosign
signatures, near-Bitnami values names. The concentration is still a risk to
weigh; the survey records ranked alternates for both components.

## Proposed order

1. nginx and rabbitmq first: plain charts, near drop-in values, and nginx is
   already broken at its pin while rabbitmq still serves.
2. redis next: the ranked pick keeps the engine and the values surface, so it joins the near-drop-in group once the licensing posture is confirmed.
3. The three operators one at a time, postgresql first because the CNCF
   publisher clears the quality bar most cleanly.

## Decisions recorded 2026-08-08

Both redis engines enter the catalog as separate entries: the redis chart
(keeps the engine; tri-licensed image with AGPLv3 as the open-source option)
and the valkey chart (BSD-3-Clause fork). Buyers pick by license posture,
and the catalog states both licenses plainly instead of choosing for them.

Licenses become a visible catalog surface. The chart dossier now accepts a
`spec.licenses` block (chart license with evidence, plus per-image licenses
with notes), the artifact index and each entry's CATALOG.md render it, and
the generator refuses a successor-publisher entry that omits it. Legacy
entries backfill through their own reviewed work.

The nginx migration is approved to start.

## The nginx work order

1. Placement: a successor track beside the fixed corpora (the next80 corpus
   is contract-locked at eighty charts), keyed
   `cloudpirates/nginx@0.16.1`, recipe at `recipes/cloudpirates/nginx/0.16.1`.
2. Source lock: the OCI reference `oci://registry-1.docker.io/cloudpirates/nginx`
   version 0.16.1, appVersion 1.31.3, with the chart digest recorded from an
   anonymous pull at import time.
3. Licenses block, required by the generator for this publisher: chart
   Apache-2.0 (evidence: the artifacthub license annotation inside the pulled
   chart), image `nginx` with the license read from the image's upstream
   LICENSE at import time, stated with its evidence.
4. Values mapping from the retired entry: the surface is near-identical;
   record the switch-map deltas the survey noted for this publisher's charts
   (existing-secret key names match; confirm probe and service keys at
   import).
5. Proofs in the established order: render proof and package first, kind
   install proof next, live-parity later and serial. The verify chain must
   stay green at every slice; no receipt is claimed before its lane runs.
6. rabbitmq follows the same order with `cloudpirates/rabbitmq@0.21.13`;
   redis and valkey follow once their entries are scaffolded, each carrying
   the licenses block from day one.

## Boundary

This survey names verified options and their measured availability, records
the engine and license decisions above, and adds the license machinery the
successor entries require. It still changes no recipe, receipt, or catalog
entry, and it makes no claim about any vendor beyond the recorded fetch
results.
