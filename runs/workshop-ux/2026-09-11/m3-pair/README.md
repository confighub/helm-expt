# Adapt mission results

Two fresh gpt-5.6-luna agents used the locked local candidate and separately
supplied pinned plugin checkouts. Both preserved the Prometheus input, saved
the replica-only 1-to-2 candidate and its bound JSON comparison, and retained
a separate candidate with an additional field. Both explanations call for
review rather than treating a successful comparison as approval or runtime
evidence. No coaching was supplied.

The reviewer checked input byte hashes against both receipts, the exact
`/spec/replicas` change, and two fields in each extra-change receipt. Original
plugin inputs remained unchanged. This fulfills the bounded change/detection
mission, but is not a pair of complete Guide walkthroughs:

- M3-A invoked the plugin's Node entry point directly with `--exit-code`,
  obtaining exit 1. Its additional field was terminationGracePeriodSeconds
  300 to 301. It reported and recovered from an edit-path typo.
- M3-B used `cub config diff`, obtaining ordinary exit 0. Its additional field
  was revisionHistoryLimit 10 to 11. It retained the unexpected change for a
  review hold. Its initial status command used a non-repository directory.

Both have correctness 2 and evidence understanding 2 for the stated mission,
with help 2 and a specific valid next decision. Keep entry-point differences
visible: only M3-B establishes the supplied `cub` path, and neither establishes
every Guide step or both exit modes. The exact Guide teaching example uses a
different extra-field value. No upstream merge, schema validity, protected-field
preservation or deployment is established.

Reports, comparisons, original/retained manifests and complete compressed
local outputs are retained. Logs are participant accounts, not a full external
tool transcript; their navigation attribution is not independently verified.
Dispatch and artifact observations are external. Setup was supplied, and no
population performance claim is made.
