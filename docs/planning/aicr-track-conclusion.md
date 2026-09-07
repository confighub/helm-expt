# The AICR track, concluded

Status: closing record, written 2026-08-09. The track ran from the first
retained entry through to a catalog that holds five AI-platform shapes, each
pinned by a digest and guarded by lanes that fail when a claim stops being
true. This says what exists, what it proves, what it refuses to claim, and what
is deliberately left undone.

The reader-facing entrance is
[the AICR catalog overview](../demo/aicr/index.md). This page is for whoever
picks the work up next.

## What exists

Five entries, each with a digest-bound index compiled from committed bytes.

| Entry | Provenance | Ladder rungs with receipts |
| --- | --- | --- |
| `eks-h100-training-kubeflow` | AICR v0.14.0, retained | 2 |
| `eks-h100-training-kubeflow-v0-18-0` | AICR v0.18.0, retained | 0 |
| `eks-h100-inference-nim` | AICR v0.14.0 with `platform: nim`, retained | 1 |
| `kserve-nim-inference` | nim-deploy KServe subtree at commit `3ef33472` | 2 |
| `cpu-starter` | derived from the v0.14.0 training entry by recorded rules | 3 |

Behind them: eleven committed receipts, nineteen generated data surfaces, eight
hand-authored registers, eight demo pages, three reference documents, and
forty-one steps in the verify chain. Every one of those steps runs in CI now,
which was not true when the track started.

## What it proves

**A platform shape can be pinned.** One digest covers the upstream source, the
recipe criteria, and every rendered Application. Change a byte anywhere and the
digest moves.

**Provenance can run from an upstream signer to bytes on disk.** The v0.18.0
release signature verifies offline against a committed sigstore trust root, its
attested subject is recomputed from the two files the catalog retains, and the
binary that generated the entry reports the same build commit the signature
names. The trust root itself is reviewed against the one sigstore publishes,
and it cannot change without that review.

**Governed change works on platform configuration.** Entries import into
ConfigHub, carry reviewed overrides, promote through environments, and deliver
to a cluster at the config plane. The blast-radius checker holds each declared
control point to the documents it actually reaches, in both directions.

**Refusals are evidence.** Nine candidate changes run through the shipped
commands in a throwaway worktree, and the verdicts are published. Two of them
must be accepted, because lanes that refused everything would look identical to
lanes that refused the right things.

**Counted claims fail when they stop being true.** Every number on an AICR page
is bound to a quantity computed from committed bytes, and a counted claim
nobody declared fails the lane by name.

## What it refuses to claim

No GPU workload ran, anywhere, for any receipt in this track. Every proof is
config-plane: import, render, digest pinning, variant, promotion, delivery
wiring, acceptance by an API server. The boundary is stated in each receipt
rather than left to a reader to infer.

No gated artifact was mirrored. Ten gated references are enumerated, one has
its terms read and recorded, and the other nine say plainly that their catalog
pages sit behind bot detection and were not read. The gap is published rather
than filled with a guess.

The v0.18.0 entry has climbed no rung beyond retention, and the evidence record
lists it with an empty ladder for exactly that reason.

## What the track taught, beyond AICR

Four lessons outlived the entries that produced them, and all four are doctrine
or shared machinery now.

**A parity check should verify the property, not the shape it took in the
version you wrote it against.** Upstream moved to parallel deployment, and two
of our checks refused an entry for doing what upstream now intends. Both
compared against a total order that had never been the claim. Ordering is now
checked against the dependency edges the recipe carries.

**A rule discovered in one place usually belongs everywhere.** The credential
guard the inference compiler carried since the NGC license read now applies to
every producer in the repository. The gated-artifact rules moved from a
planning note into doctrine.

**A cadence keyed to a date goes stale quietly; key it to the thing that
changes.** Gated references are keyed to their exact tag, so a version bump
produces a reference nobody enumerated and the lane refuses it. Nothing fails
when a date passes.

**An unanswered question is not a negative answer.** Provenance that could not
be asked about is recorded as unknown, never as unsigned. Receipts that carry
no date are counted, not assumed fresh.

## What is deliberately left

The remaining backlog is real work rather than tidying, and it splits three
ways.

**Surfacing.** Theme 6 is untouched: the Platforms section on the site, the
buyer-facing page, an AICR route on the Examples page, and the CPU starter as a
runnable first exercise. The evidence exists and is published in
`site/catalog.json` under `platformEvidence`; what is missing is the reading
experience on top of it.

**Deeper parity and generation.** Field-level parity against platform shapes
and the first Pilot generation gated by it are the largest remaining pieces.
The refusal corpus and the blast-radius locators are the groundwork; neither
finishes the job.

**The AICR CLI comparisons.** `aicr trust`, `aicr mirror` and `aicr skill` each
are now compared against v0.20.0 in the [maintained reference](../reference/aicr-evidence-and-our-receipts.md#trust-mirror-and-skill-comparison-v0200). The comparison distinguishes TUF acquisition from reviewed root retention, recipe image discovery from retained chart locks, and CLI skills from chart playbook selection. Full mirror discovery and authenticated trust-root acquisition remain separate work.

Two smaller items stay open with reasons rather than dates. The per-artifact
terms for nine gated references need a person to read nine catalog pages.
`NIM_TELEMETRY_MODE` needs a structural editing path that ConfigHub's
single-token substitution does not offer today, which is a product gap rather
than an entry gap.

## One thing worth fixing early

The credential-boundary lane hashes every document in its scope, so any
concurrent merge that adds one makes it stale. It tripped three times in a
single afternoon for that reason alone. Scoping it to a manifest would keep the
guarantee and drop the fragility, and whoever touches it next should do that
rather than rebase around it.

## Where the record lives

- [The catalog overview](../demo/aicr/index.md), for a reader.
- [The task backlog](./aicr-nim-track-backlog.md), with the progress log of
  what each increment found.
- [The platform evidence record](../../data/aicr-platform-evidence/summary.md),
  which names every rung climbed and every rung not.
- [The refusal corpus](../demo/aicr/refusal-corpus.md) and
  [the claim-integrity lane](../demo/aicr/claim-integrity.md), which are how
  the pages stay honest as they age.
