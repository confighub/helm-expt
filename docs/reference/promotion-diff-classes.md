# What a promotion diff should show, class by class

**UNOFFICIAL/EXPERIMENTAL.** A promotion review lives or dies on how it presents
differences. This page defines the four classes every entry in a variant diff
falls into, states the presentation each class deserves, and walks one committed
promotion through them. Issue #152 asked for this vocabulary; the promotion
pages and any future product UI should use it rather than inventing another.

## The four classes

| Class | Meaning | How to present it |
| --- | --- | --- |
| inherited | The value is identical in the variant and its base. Nothing departed and nothing arrived. | Keep it out of the way. Inherited content is the bulk of every diff, and a reviewer who scrolls past forty inherited objects stops reading before the entry that matters. |
| overridden | The variant departs from the base on purpose, and the departure survives the promotion. | Show it as a kept difference with its origin: which environment set it and what it protects. Survival is not a change, and presenting it as one teaches reviewers to ignore the diff. |
| upstream-added | The base moved and the variant has not yet absorbed the change. This is what a promotion actually moves. | Give it the headline. Name the object, the field path, and both values. This class carries the risk and deserves most of the screen. |
| no-op | The text differs but the object does not: reordered keys, defaulted fields, formatting. | Suppress it by default behind a count and a toggle. Twelve visible no-ops bury the one real change. |

## One committed promotion, walked

`runs/byo-helm-values-promotion-proof/receipt.yaml` records the bring-your-own
NGINX review promoted from development into staging.

Before the promote, staging's diff against its base held two kinds of entries.
Its own deliberate departures were the overridden class, and they protect
staging-only decisions. The reviewed replica change, `spec.replicas` moving from
3 to 4, sat on the base side as the upstream-added class: approved, tested in
development, and not yet absorbed.

The promote moved exactly the upstream-added entry. The receipt records
`pendingUpstreamChanges: 0` afterwards, which is the machine form of "nothing
approved is still waiting". The overridden entries survived unchanged, and the
rest of both object sets stayed inherited and identical.

A reader of that promotion needed one headline (replicas 3 to 4), one kept-differences
list (staging's departures, untouched), and silence about everything else. That
is the whole presentation contract.

## Four object sets show where a field came from

A source-aware review compares four exact object sets:

1. the old source render;
2. the old accepted configuration after later edits;
3. the new source render;
4. the proposed accepted configuration.

The first pair shows existing post-render edits. The second pair shows the proposed
ones. Comparing the two source renders identifies chart, values, AICR, or other
source changes. This prevents a review from calling every changed field a Helm change
or every retained field a ConfigHub change.

When the new source and a later edit both affect the same field, the review marks an
overlap. A retained override may still be correct, but it must be reviewed against the
new source behavior before promotion. One field must not have two silent owners.

Formatting, comments, and mapping key order remain no-ops because the comparison uses
parsed YAML objects rather than raw text.

## The server preview and the independent comparison

The current Redis receipt records that
`cub variant promote --dry-run -o mutations` returned mutation detail for both
development and staging. It also checked that each dry run left stored data unchanged
before the real promotion ran.

The Workshop still compares the exact object sets itself. That gives a useful review
before a ConfigHub Space exists and provides an independent check of the later server
preview. The browser result is not evidence that ConfigHub performed a promotion; the
live Redis receipt supplies that separate evidence.
