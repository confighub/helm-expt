# Inspection retest after the first fixes

Two fresh gpt-5.6-luna agents, low reasoning, used the public website at
`2d6eace52cd846582a445276f5fba42de60cf730`. Each received a separate pinned
checkout, the homepage, and explicit record.json/result.md/trial-log.md
requirements, including the full record and Catalog/selected-record hashes.
This is an HTTP/CLI cohort with provided setup, not browser or human testing.
Do not pool it with the prior brief or deployment.

## Results

| Trial | Observed outcome | Correctness | Help | Evidence understanding |
| --- | --- | --- | --- | --- |
| M1-E | Found Redis and 14-object configuration; saved all files in assigned directory. Hand-built a nonstandard envelope with placeholders instead of full records and the chart README hash instead of the Catalog index hash. | 0: wrong identity and incomplete record | 2: none | 2: narrative distinguishes recorded checks and untested target/runtime |
| M1-F | Found Redis and 14-object configuration; saved full source material in a custom envelope. Also used the chart README hash as the Catalog index hash and the YAML byte hash as the canonical selected-record hash. | 0: wrong required identity | 2: none | 2: narrative distinguishes recorded checks and untested target/runtime |

Both exact-handoff checks exited 1. Both narratives describe useful source and
operational boundaries, but neither completed the required identity handoff.
The shared checkout remained clean at observed samples and final inspection;
both supplied source checkouts remained clean. This corrects the previous
output-placement problem without establishing overall task success.

The repeated value `3948d0a09658264a210c1fae4661977f0c93d4a3792ce1716483f04dad214dcd`
was independently matched to recipes/bitnami/redis/25.5.3/CATALOG.md. The locked
index hash is in environment.json. Raw YAML hashing and the canonical JSON
selected-record hash are also distinct. The participants did not reach the
existing exact-lookup exercise, despite its additional links.

The parent observed all required files 64.1 seconds after dispatch for M1-E
and 66.3 seconds for M1-F. These are first observations of invalid handoffs,
not useful-result times or a speed benchmark. The observer polled roughly every
two seconds plus command overhead; events.jsonl retains samples. Transient
outside-directory activity between samples cannot be excluded. No participant
was coached, and self-reported clocks are not used. Setup time is excluded
because pinned checkouts were supplied.

M1-E additionally ran cub installer inspect and retained its output. That is
not the Catalog lookup or proof that its handcrafted identity is correct.
The participant reports no credential or cluster use; the reviewer has retained
artifacts and its log rather than a full tool transcript. No broader live or
anonymous-registry result is claimed here.

## Fix and next decision

Provide the exact generated CatalogRecordLookup JSON directly on the Redis
base and Guide entry points, with a clear distinction between the record index
and chart README. Compare the entire published envelope with the existing CLI
in the site UX gate. This is a static inspection download, not a hosted action
API or a new runtime proof.

Per the trial plan, hold M2–M6 expansion until a fresh inspection pair passes.
Retain these failures unchanged. Validate a new public baseline before the next
pair; do not call the code change itself a UX improvement already proved.

## Retention

Environment, dispatch times, observer events and checker outputs are retained
beside per-trial outputs. Each manifest hashes original files and retained
versions. Absolute trial paths in text were replaced with relative paths;
HTML downloads are represented by their hashes. No records were corrected into
passing results. The changed prompt required the three files and exact identity
but provided no command, answer key or reviewer test source.
