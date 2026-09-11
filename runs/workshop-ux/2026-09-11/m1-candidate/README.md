# Inspection candidate retest

Two fresh gpt-5.6-luna agents with low reasoning inspected the fixed local
candidate `16c90e0942272a4cf31f75570eb1f513b3f5eee3`. Each had a separate
pinned checkout, the homepage URL, and the same explicit handoff requirements
as M1-E/F. The full tracked repository was served, including evidence routes.
This is an HTTP/CLI cohort with supplied setup, not a public deployment,
browser, human, or hosted API trial. Do not pool it with the earlier cohorts.

Both downloaded the exact static JSON without constructing a new envelope.
Both retained byte-identical records, correct Catalog and selected-record
hashes, and explanations of the 14 objects, inputs, edit location, historical
checks and untested destination/runtime. The read-only handoff checker passed
both outputs; the reviewer separately accepted the explanations. Both passed
the bounded inspection mission with correctness 2, evidence understanding 2,
mission understanding 2 and help 2. No coaching was supplied.

M1-G recovered from incorrect URL resolution when fetching evidence under
the site directory. Count this as navigation friction, not a broken server
route: the full snapshot's root evidence paths work. M1-H reported no errors.
Setup was supplied and was not evaluated as first-use installation.

All required final artifacts were first observed 63.5 seconds after dispatch
for M1-G and 51.1 seconds for M1-H. They were subsequently validated unchanged.
These are external observations with polling overhead, not participant clocks
or population speed claims. Shared-checkout samples and final source-checkout
checks were clean; prompt-only isolation is not a filesystem sandbox.

The two passing candidate trials permit expansion to executable local missions.
They do not establish public deployment or broad usability. Earlier failures
remain retained in the [live retest](../m1-retest/README.md).

Environment, dispatch, observer samples, checker results, reviewer timing and
per-artifact original/retained hashes are adjacent. Absolute trial paths in
retained text are replaced with relative paths; records are unchanged.
