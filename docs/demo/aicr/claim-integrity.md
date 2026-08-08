# The numbers on these pages are checked, not typed

UNOFFICIAL/EXPERIMENTAL. This page belongs to
[the AICR catalog overview](./index.md). The other pages count things. This one
explains why those counts can be believed.

```bash
npm run aicr-claims:verify
```

## Prose does not fail a lane

The AICR pages say the v0.14.0 training entry renders seventeen Applications,
that the inference recipe resolves eight overlays into seventeen components,
and that the KServe entry retained at commit 3ef33472 holds sixteen model
shapes and ten serving runtimes. Every one
of those numbers was true when it was typed.

An entry that gains a component makes several of them false at once, and
nothing goes red. That is the ordinary way documentation rots, and it is
exactly the failure the catalog argues against everywhere else. A claim that
cannot fail is not evidence.

So each counted claim is declared in
[a register](../../../examples/aicr/claims/numeric-claims.yaml), bound to a
quantity computed from committed bytes. The lane recomputes every quantity,
compares it to the number in the sentence, and refuses a disagreement. The
current values are published at
[data/aicr-claim-integrity/summary.md](../../../data/aicr-claim-integrity/summary.md).

## A register that only listed known claims would be worse than nothing

The harder half is the claim nobody declared. A curated list of numbers looks
like coverage while a new sentence with a new count walks straight past it.

The lane therefore reads every page under `docs/demo/aicr` and finds every
occurrence of a number followed by one of the counted nouns. Anything the
register does not cover fails the lane by name. Adding a sentence with a count
in it means declaring what that count comes from, which is the point.

That check earned its place immediately. It found two claims this register's
author had missed: the seventeen Application objects the ConfigHub import
stored in one Unit, and the sixteen model-by-GPU shapes the overview cites from
the inference entry.

## The same discipline applies to which version a page means

A count is not the only claim that rots. "The training entry" is unambiguous
only while one training entry exists, and the catalog's whole argument is that
it retains exact versions. A second retained version would turn every
version-free reference on these pages into a guess.

So a page that mentions an entry has to name that entry's retained version
somewhere on it, once rather than in every sentence, and
[the entry-naming lane](../../../data/aicr-entry-naming/summary.md) refuses a
page that does not. Doing this before a second entry lands is much cheaper
than doing it after.

## Where the numbers come from

Most quantities are a directory count or the length of a list in a retained
recipe. Some are arithmetic on another quantity, such as the component
Applications being every rendered Application except the platform root that
owns them. One is a field in the published platform evidence record, so the
rung count on the overview page and the rung count in the evidence record
cannot drift apart.

One quantity is a literal. The two Applications that existed on the cluster
during the sync proof are recorded in that proof's receipt and are not derived
from any directory. The register says so and cites the receipt, because a
number dressed up as a computation would be worse than a number honestly
labelled.

## What it does not check

It checks numbers, not meaning. A page can count correctly and still describe
the wrong thing, and this lane will pass it. Writing the register surfaced one
of those: the overview said delivery was the rung the KServe entry had not
climbed, while the evidence record listed a delivery receipt for it. The count
of rungs was right and the sentence around it was stale. That correction landed
with this lane, and it is a fair illustration of the limit rather than a
footnote.

Claims that resist counting stay where they already live, in the receipts and
in the platform evidence record, which names the rungs no entry has climbed
instead of leaving them to inference.

Everything runs offline against committed bytes. No cluster, no organization,
and no network takes part.
