# Kubara mini-IDP reconciliation performance

This page records the measured cost model and safety boundaries for
`scripts/reconcile-kubara-mini-idp.mjs`. It is an engineering baseline, not a
service-level promise. The reconciler emits a sanitized `kubara-performance`
JSON line on exit, and a successful live verification writes the same evidence
under `spec.execution.performance` in the mini-IDP receipt.

## Baseline measurements

The ConfigHub reads below were measured serially on 2026-08-05 against the
quiescent Kubara organization. They describe this organization and client at
that point in time; they are not portable latency claims.

| Read | Calls | Elapsed | Mean per call |
| --- | ---: | ---: | ---: |
| `unit get` | 10 | 5.95 s | 0.595 s |
| `unit data` | 10 | 5.72 s | 0.572 s |
| organization-wide Link list | 1 | 4.60 s | 4.60 s |
| organization-wide published-release list | 1 | 0.43 s | 0.43 s |
| `context get` | 10 | 0.61 s | 0.061 s |
| organization list | 5 | 2.69 s | 0.538 s |
| control-Space get | 5 | 2.73 s | 0.546 s |
| organization-wide Unit list (105 Units) | 1 | 3.10 s | 3.10 s |

A full context, organization, and control-Space pin revalidation adds about
1.15 seconds before each mutation. This is deliberately retained: selecting
the right organization and control Space is a safety property, not an
eventual-consistency optimization target.

The organization-wide shape probe observed 105 Units, 39 Links, 35 published
releases, and 4 targets. The target-list duration was not isolated, so no
target-list latency is claimed here. The Link sample predates the 25
NeedsProvides Links in the completed 64-Link organization and must be
remeasured before it is used as a current Link-list baseline.

The pre-change offline runs on the same host were 8.72 s, 8.57 s, and 8.58 s
for `--plan`, and 7.83 s for `--self-test`. Instrumented process profiles ranged
from 7.74 s to 7.95 s. Every run stopped at the same pre-existing stale faithful
hub/spoke receipt after concurrent generated-example changes. These values show
that instrumentation did not create an obvious regression on that failure
path; they do **not** prove a successful end-to-end speedup. The instrumented
plan reported about 0.13 s in its single child command, which suggests that
local rendering, YAML, checksumming, and contract work dominate this particular
failure path. That last statement is an inference from the profile, not a
standalone benchmark.

## What “63 Units means more than 100 round trips” actually means

The sentence is directionally right but substantially understates the old
client shape. A Unit is not one request. The steady-state reconciler used to
read each managed Unit's metadata three or four times, read its body, then
repeat endpoint, target, release-boundary, and final-verification reads. Static
call-path accounting found 537 `cub` reads in the final verification body alone
and a lower bound of hundreds more before the first Argo convergence wait.

This is an N+1 client problem, not a reason to collapse the platform into fewer
governed Units. The useful unit of analysis is:

```text
inventory snapshots + content reads + changed-object writes + convergence
```

not `Unit count × an assumed constant`.

## Bottlenecks and the implemented read optimizations

Per-Unit metadata and data reads cost roughly 0.57--0.60 seconds each in the
sample. Repeating those reads makes verification grow with the number of Units.
An organization-wide Link list is individually expensive, but one list is still
preferable to repeating it for every Space.

Read-only verification now captures organization-wide Unit, Link, published
release, and target snapshots. For the current fixture, the Unit snapshot
replaces the static shape of 42 per-Space Unit lists, 63 primary Unit gets, and
35 upstream Unit gets with one initial Unit list. A second Unit list closes the
snapshot. Unit data remains an explicit per-Unit read because the current proof
compares canonical content, not just metadata.

The static final-verification body falls from 537 `cub` reads to 128: the 55
per-Space Unit lists, 247 Unit gets, 80 Link lists, 27 release lists, and 8
target gets are replaced by eight measured organization-wide lists. The 104
content reads and the small Space/policy read set remain explicit. This is a
call-shape result, not yet an end-to-end latency result.

The apply path also removes three separate multipliers:

- an unchanged managed Unit reuses its one fresh metadata observation instead
  of fetching the same metadata three or four times;
- each delivery Application Space is listed once per metadata pass instead of
  fetching every Application Unit separately, and the already-read Unit is
  reused while checking its Application contract;
- all Application Units are reconciled before delivery, then the complete
  delivery root is published once per cluster, lazily just before that
  cluster's first source Application converges. The previous implementation
  republished and fully revalidated the same cluster root for every one of 27
  deployments. Static accounting falls from about 1,302 reads for that repeated
  root path to 182 for four root publications plus the closing currency checks.

Source-release checks now use a boundary-local read snapshot. Each independent
opening and closing boundary still reads every exact Unit body, Space, target,
Link inventory, source Unit inventory, and upstream Unit inventory, but all
assertions inside that boundary reuse those observations. No snapshot survives
a release mutation. Across the 27 source Spaces, the steady-state release path
falls from 798 reads to 367: 23 one-Unit Spaces fall from 26 to 13 reads each,
and four three-Unit `hx-web` Spaces fall from 50 to 17 reads each. That is 431
fewer reads (54.0%) while retaining independent opening and closing evidence.

After those changes, static steady-state accounting gives a lower bound of at
least 469 ConfigHub reads before the first Argo convergence starts: 196 for
managed-Unit comparison, 81 for Application materialization, 54 list/allowlist
reads, 70 variant Space/Target reads, 55 for the first cluster's delivery-root
boundary, and 13 for the first source release. Preflight and several
Space/policy reads are additional, so 469 is deliberately a lower bound rather
than a promised total. The original “well over 100” statement is true but not
specific enough for capacity or latency planning.

These are API-backed `cub` reads, not literal wire round trips. A read-only
client trace showed that space-scoped `unit list`, `unit get`, and `unit data`
each issue two authenticated application requests: one resolves the Space and
one queries the Unit endpoint. The organization-wide Unit snapshot issues one.
The corresponding application-request count is therefore in the high hundreds
and may approach twice the CLI-read count, but an exact full-run wire count is
not claimed. The current `cub --debug` output is unsuitable for receipts or CI
because raw debug traces can contain sensitive headers and request/response
bodies. Safe instrumentation must count sanitized route templates and
status/latency in the
client transport, and use wire-level hooks separately for transmitted attempts,
connection reuse, and TLS cost.

The receipt records a dedicated
`apply-start-to-first-argo-convergence` phase. That measurement matters because
optimizing total runtime and optimizing time to the first converged Application
are not always the same tradeoff.

The initial and final Unit/Link/release/target snapshots must have identical row
counts and a canonical fingerprint. Every row must belong to the pinned Kubara
organization and a known Space. If those four resource sets differ at the
closing observation, the run fails and asks for a retry against a quiescent
organization. This is an opening/closing net-state check, not an event stream:
an ABA change between the two observations is outside the claim, as are
concurrent Space/Trigger/Filter changes. Snapshot data is available only inside
`verifyLive`; reconciliation and mutation paths continue to perform fresh
reads.

Canonical Kubernetes and AppConfig YAML is memoized by content digest within a
single process. Cache keys also retain a length/head/tail collision check, and
the profile records requests, hits, misses, entries, and parse time. No
cross-run cache is trusted.

## Concurrency and safety boundary

All commands remain serial and deterministically ordered. Organization-wide
reads are batched by resource, not executed concurrently. The four snapshot
lists are independent and could be parallelized later, as could some Unit data
reads, but doing so needs server-load and stable-evidence testing first.

The following remain strictly serial:

- every ConfigHub mutation and its full pinned-target revalidation;
- release publication, approvals, promotion, and operation-journal changes;
- cluster and Argo convergence checks whose observations depend on earlier
  actions;
- the opening and closing snapshot barriers.

A possible future optimization is to validate the full target once at a
well-defined mutation-batch barrier, then verify a locally pinned context token
before each mutation. It is intentionally not implemented: it must first prove
equivalent protection against context and organization changes.

## Other things that can slow the platform down

In priority order for this example:

1. **Repeated authenticated reads.** Per-object CLI calls pay process startup,
   TLS, authentication, API routing, and JSON decoding every time. Bulk read
   APIs and boundary snapshots are the main remaining product opportunity.
2. **Per-mutation target pinning.** A context, organization, and control-Space
   revalidation costs about 1.15 seconds before every write. It remains intact;
   the safe product fix is a server-enforced organization/batch boundary, not a
   weaker client check.
3. **Release-boundary verification.** Source releases deliberately prove Unit
   data, endpoint identity, target, labels, Links, and a stable before/after
   boundary. A boundary-scoped bulk API could retain those invariants with far
   fewer round trips.
4. **OCI work.** Rendering, hashing, uploading immutable layers, publishing a
   release, registry propagation, and controller pulls all add latency. Cache
   hits help, but exact digests and retained versions must not be discarded.
5. **Argo polling.** Serial five-second polls make quiet convergence easy to
   reason about but add tail latency. A watch/event path can improve this later
   if it preserves the exact revision and operation-journal deadlines.
6. **Kubernetes controller dependencies.** CRDs, webhook readiness,
   cert-manager issuance, ESO reconciliation, Ingress status, and workload
   health are real dependency barriers; parallelizing across them blindly can
   make the run slower and less reproducible.
7. **Image pulls and target capacity.** Cold images, registry throttling, CPU,
   memory, disk, DNS, and the single-node kind topology can dominate once API
   chatter is reduced.
8. **Local parsing and subprocesses.** YAML canonicalization and one process per
   `cub`/`kubectl` command are measurable overhead. Process-local canonical-YAML
   memoization is implemented; a long-lived API client would remove more.
9. **GUI query shape.** Component matrices, wiring Links, history, and health
   views should query by indexed labels and page/batch results. Rendering every
   revision or edge eagerly would move the same N+1 problem into the browser.
10. **Source and catalog hand-off.** Kubara generation, Git fetch/checkout,
    lock and checksum verification, exact catalog-version resolution, and CI
    gates add deterministic latency before import. Cache by Git revision and
    catalog lock, but never replace exact-version failure with a silent upgrade.

## Performance guardrails

These are regression budgets for this implementation, not user-facing SLAs:

- verification uses exactly two organization-wide list calls per cached
  resource: one opening and one closing Unit, Link, release, and target list;
- active verification must issue no per-Unit metadata get or per-Space Unit
  inventory list; Unit data reads remain explicit;
- each source-release boundary reads the source Unit inventory and each unique
  upstream inventory once, issues no point Unit metadata gets, and clears its
  cache before any release mutation;
- mutations remain serial and keep full target-pin validation;
- the opening and closing fingerprint must match before evidence can say
  `stability: pass`;
- command evidence contains sanitized resource/verb labels only, never names,
  arguments, paths, tokens, or payloads;
- canonical-cache hit/miss accounting must balance and every miss must create
  exactly one process-local entry;
- on the same host and fixture, an offline failure-path plan or self-test above
  10 seconds should be investigated against the approximately 8.6/7.8-second
  baseline;
- no live wall-time budget will be set until a successful post-change run has
  produced repeatable receipts. The receipt is the authority for that run.
