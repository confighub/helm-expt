# First assistant UX inspection cohort

Date: 2026-09-11. Model: gpt-5.6-luna, low reasoning. Website revision:
`ec2436da3a9f55b51af2c05da4c65638a1095b09`.
This is retained UX evidence, not a catalog proof-lane receipt or Guide admission.

Four fresh agents attempted M1: find Redis 25.5.3 default, retain its exact
record, explain contents, settings, checks, gaps and next edit ownership. The
participants received the mission, homepage URL and separate output directory;
they did not receive the reviewer answer key. No assistance was supplied.
The same brief also requested a saved result, navigation log and timing.

## Cohorts and results

The first two attempts, M1-A/B, are excluded from product scoring. The local
server initially contained site/ only, causing linked evidence files to return
404. Their corresponding public URLs returned 200. Before M1-C/D, the complete
tracked repository was extracted at the same pin and evidence routes were
checked against those bytes. This is a test-harness defect, not a published
broken-link finding.

| Trial | Retained observation | Review outcome |
| --- | --- | --- |
| M1-A, excluded pilot | Exact base record, 14-object render and substantive explanation saved. | Useful diagnostic only; incomplete local snapshot. |
| M1-B, excluded pilot | Final reply reported 13 objects and claimed result.md existed. It did not. The file named for the base record contains the render intent. | Missing/overwritten artifacts retained, not repaired after the trial. |
| M1-C, corrected snapshot | Exact base record and 14-object render match source bytes; saved explanation distinguishes historical checks from destination/post-deployment gaps and identifies edit ownership. | Task-level result is useful. Full protocol evidence is incomplete: no Catalog/selected-record identity envelope. Timing cannot be accepted as measured completion time. |
| M1-D, corrected snapshot | Exact base record, values, render intent and render match source bytes. Final reply claims result.md and trial-log.md exist; neither exists. | Incomplete handoff; no saved explanation or timing log. Do not accept the completion claim. |

No participant used the existing exact-record lookup exercise. The corrected
pair shows that the chart page and linked files support discovery, but not that
the protocol's complete inspection handoff is discoverable or reliably saved.
Neither result satisfies every evidence requirement of the preparation
protocol. This sample does not establish a population pass rate.

## Scoring against the preparation protocol

| Trial | Setup | Help | Correctness | Evidence understanding | Mission understanding | Useful-result time |
| --- | --- | --- | --- | --- | --- | --- |
| M1-C | 2: no failed setup reported | 2: no intervention | 1: exact source retained, identity envelope missing | 2: saved explanation separates recorded evidence and untested destination/runtime outcomes | 2: concrete target review and valid next-edit location | Not validated |
| M1-D | Not independently scored: navigation log absent | 2: no intervention | 1: correct source artifacts but requested report and identity envelope missing | Not scorable from the absent report; final summary alone is insufficient | Not scorable | Not recorded |

The identity envelope is a protocol requirement, but the short participant
brief did not explicitly enumerate its fields. Treat that mismatch as a test
specification/discoverability question, not proof the agent failed a plainly
stated user request. Do not turn this strict protocol score into a claim that
neither agent could find Redis.

The M1-C log reports completion at 15:01:39 UTC, but its report was written at
15:01:58 and its final linked artifacts at 15:02:02. It labels an earlier saved
chart page as the first useful result. These are not externally instrumented
mission completion times. File mtimes are retained as observations; no speed
benchmark is claimed. Pilot timing is also excluded.

## Boundaries and follow-up

These were HTTP-reading assistants with shell tools, not visual browser trials,
human participants, cub execution or hosted live-chat API tests. Forks excluded
conversation history but inherited platform/tool instructions. Shared files
were prohibited by prompt rather than hidden by filesystem isolation. The
reviewer has participant artifacts and final summaries, not a complete tool
transcript. This limits claims about exact navigation and timing.

Follow-up [#1894](https://github.com/confighub/helm-expt/issues/1894) covers clearer
exact-record handoffs, distinct file identities, independently checked saved
outputs and external timing. Fix the measurement gaps before scaling. Remaining
missions M2–M6 have not run in this cohort. Argo and Flux onboarding remain
#1870 and #1893; no onboarding or Guide admission status is promoted.

## Retained files

[environment.json](./environment.json) records the lock and deviations. Each
trial directory contains available Markdown/YAML artifacts, an
artifact-manifest.json and a clearly labelled reviewer summary of its final
message. Missing files are deliberately not manufactured. Original hashes and
mtimes are retained; local absolute links in Markdown were replaced with
relative links, with separate retained hashes. HTML downloads are identified by
hash rather than duplicated; they match the pinned repository pages. The
operator independently compared corrected-trial source artifacts with the
pinned repository. No cluster, registry, login or shared plugin change occurred.
