# The certified bundle track, concluded

The track built one receipt shape, 90 decided flattening lanes, 71 published
bundles, 45 routes and six gates, spread across the schemas, scripts and pages
that use them. This is the one place that says what the whole thing proves, what
it refuses to claim, and what it leaves.

The model itself is [the certified bundle spec](../reference/certified-bundle-spec.md).
How a lane gets decided is [deciding-a-flattening-lane.md](../reference/deciding-a-flattening-lane.md).
The evidence discipline both inherit is rules 10 and 11 of
[the doctrine](../../tests/doctrine.md).

## What it proves

**Render-early and render-late stop being a matter of taste.** The catalog
answers the question per base, by evidence: 90 audited bases across 82 chart
versions carry a decided lane. 42 are safe to flatten, 32 need named companions,
16 are unsafe to flatten and keep the installer package as their certified route.

**One receipt shape fits five producers.** 85 receipts, from the catalog,
Kubara, eks-inference, AICR and the Sveltos example, including eight describing
bundles this repository did not build. The shape was adopted from the producer
who had already solved the packaging, not invented to replace it.

**The catalog sells two products.** 71 published certified bundles alongside an
installer package for every entry. Each bundle carries three artifact classes:
the rendered configuration, the routes that say how to apply it, and the words
an operator needs beside them.

**A refusal is mechanical, not remembered.** A strict consumer admits all 85
receipts and proves 17 distinct refusals by breaking a real one. An unsafe base
cannot acquire a bundle: the publisher refuses on the lane.

**Two routes are observations rather than readings.** Gatekeeper's 14 stages and
tigera-operator's teardown are the checks a recorded live run watched, each
citing an evidence file whose hash the verifier recomputes on every pass. A route
cannot outlive the observation it claims.

## What it refuses to claim

**No route has a proven runtime.** Zero of 45. A human applies every one.
`proven` requires a `provenBy` receipt that exists, and every flag is false.

**No receipt records convergence.** The model certifies rendering and packaging,
never runtime health. Nothing here claims a bundle reached a cluster or that a
workload became ready.

**No bundle pins what it runs.** 96 of 103 image references are tags, which can
be repushed under the same string. Every receipt records the references, how each
is pinned, and a sentence saying which of the two it covers.

**Roughly forty charts have a witness and no decided lane**, and the remainder
are the hard cases rather than the cheap ones. Their pages say undecided, and say
that undecided is not the same as safe.

All four are recorded in machine-checked form rather than only in prose. That is
the difference between a gap that is known and a gap that is hidden, and it is
why the track can close with all four outstanding.

## Five lessons that outlived the artifacts

All five are doctrine now, at rules 10 and 11, each earned rather than invented:

- **A claim must be openable.** Eight routes claimed a proven runtime and cited
  nothing, while the run that looked like the proof recorded zero syncs.
- **Declare a debt; never read one out of prose.** Inferring it reported four
  resolutions as debts.
- **A check that stops checking is worse than no check.** Ours went blind four
  ways, all silent, and a fifth arrived during the rename that closed this track.
- **Evidence is not a decision, and one scanner never settles everything.** The
  witness is blind to a literal credential; a chart rendering
  `MINIO_ROOT_PASSWORD` reported zero generated secrets.
- **Permission is derived from a property, never asserted per entry.** Which is
  why the lane reads `unsafe-to-flatten` and not `do-not-flatten`.

Three gates keep working after nobody is thinking about this track:
companion debt, verdict-against-render parity, and `provenBy`.

## What is deliberately left

**Blocked on a cluster, not on a decision.** Proving a route executes under Argo,
then Flux, then the cub-direct applier. Observing cert-manager's startupapicheck
before routing it. The nearest existing evidence is worth knowing before anyone
starts: `runs/oci-hook-delivery-proof` watched a routed hook run under all three
runtimes from one OCI bundle, which proves the mechanism for a fixture and not
for any shipped route.

**Blocked on nothing but time.** Roughly forty undecided charts, each needing the
webhook RBAC read or a hook observation that does not exist. One qualifying base,
nvidia's `nfd-enabled`, stays unpublished because its render carries eight hook
objects with no observation to route them, and the companion-debt check refuses
it. That absence is the gate working and is recorded rather than silent.

**Open decisions, stated rather than dated.** Image references should be pinned
to digests, and the mechanism matters: resolve at the point the recipe pins the
chart and commit the digest, not during the push, or the published bytes stop
matching the committed bytes the receipt hashes. Pinning also creates an
obligation — the weekly refresh watches chart bytes, not image digests, so a pin
without that extension trades unpinned for quietly stale.

**Named as large.** Teaching a delivery runtime to read a route. Everything the
track built produces routes a human applies, and the model claims the runtime
executes them.

## One fragility for whoever touches it next

The lane vocabulary now contains a substring collision: `unsafe-to-flatten`
contains `safe-to-flatten`. The claim-integrity gate matched by substring and
read all sixteen refusing pages as claiming safety, reporting the exact opposite
of the truth on the most consequential lane. It matches whole tokens now, and any
new check that reads a lane out of text must do the same.

## Verified

At the close: verdicts, render parity, evidence, receipts, strict ingest over 85
receipts with 17 proven refusals, claim integrity at 0 HARD, the doc map, site
verify, and both text-hygiene gates. Six steps of the verify chain belong to this
track. The site diff is content-only with the timestamp pinned.
