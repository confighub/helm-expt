# What the AICR entries refuse, and how we know

UNOFFICIAL/EXPERIMENTAL. This page belongs to
[the AICR catalog overview](./index.md). Every other AICR page describes
something the catalog proved. This one describes what the catalog turns down,
which is the half of a governance claim that usually goes unrecorded.

```bash
npm run aicr-refusal-corpus:verify
```

## A refusal is evidence, and it was being thrown away

Each AICR lane refuses shapes it will not accept, and each one self-tests those
refusals against fixtures it builds itself. That proves the logic is right. It
does not prove the shipped command behaves that way, because the tests call the
checker's internals rather than running it. It also leaves nothing a reader can
consult. Someone asking what the catalog refuses had to read six scripts and
trust six sets of fixtures.

When one of those lanes goes red in practice, the refusal appears as a failure,
gets fixed, and disappears. The one artifact that would tell an auditor the
guard works is the one nobody keeps.

The refusal corpus keeps it. It is a set of changes a contributor could
plausibly propose, each declared with the verdict the lanes must return. Every
candidate is applied to a throwaway copy of this repository and run through the
shipped commands, unmodified. The verdicts are published at
[data/aicr-refusal-corpus/summary.md](../../../data/aicr-refusal-corpus/summary.md)
and recorded in
[the receipt](../../../runs/aicr-refusal-corpus/receipt.yaml).

## Two candidates have to be accepted

A set of lanes that refused every change would produce the same seven refusals
as a set that refused the right ones. The corpus therefore carries an unchanged
tree and an edit to prose outside every retained scope, and the evaluator
refuses a corpus in which nothing is expected to pass.

That is the whole reason to write the accepted cases down. They are what
separates a guard from a wall.

## The interesting result is which lane stayed quiet

Every candidate runs through all six lanes rather than only the one that owns
it, so the record shows the shape of the coverage rather than a single verdict.
Retained-byte parity guards the widest surface and catches five of the seven
refused candidates on its own. The two it misses are the ones that matter most.

A contributor who retains an upstream document carrying a literal NGC key, and
records its checksum correctly, has done nothing a checksum can detect. The
retention is internally consistent. Only the credential rule stands between
that and a key in a public repository, and the corpus is where that rule is
shown working rather than asserted.

The same holds for the two files the upstream signature is bound to. Editing
one leaves every digest index intact, because those files are not part of any
entry's rendered surface. The binding check is the only thing that notices.

## Regenerating does not launder an edit

One candidate exists because it is the obvious next move when a lane goes red.
A contributor edits a retained Application, sees the digest index refuse it,
and runs the generator to bring the index back in line.

The generator refuses the same drift the verifier refuses. Retention checksums
record what upstream published, so they are not a derived artifact that a
regeneration may overwrite. Recording that as a candidate makes it a property
the catalog keeps rather than a detail of how the generator happens to be
written today.

## What this proves and what it does not

It proves the shipped commands refuse these shapes today, and that they accept
changes outside the surfaces they claim to guard. It does not prove the corpus
is complete. A shape nobody thought to propose is not covered, and the honest
reading of a green run is that the listed rules hold rather than that the
entries are unbreakable.

Every rule the corpus declares has a candidate behind it, and the loader
refuses a corpus where a rule has none, so the coverage table cannot quietly go
empty as rules are added.

Everything runs offline against committed configuration bytes. No cluster, no
organization, and no network takes part, no GPU workload is claimed anywhere in
this corpus, and no credential named in it is real.
