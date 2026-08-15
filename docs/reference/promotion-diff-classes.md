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

## The honest limit

The same receipt notes that the live `cub variant promote --dry-run` printed no
mutation preview. Until the product's preview fills in, this classification
comes from comparing the exact object sets on both sides, not from a
server-side plan. That is also the reason a promotion review must classify
entries itself: a preview that can be empty cannot be the thing that tells a
reviewer what moved.
