# Flattening witness coverage

A witness is a static scan of a packaged chart: what hook annotations, keep policies, lookup calls, capability branches, credential generation, webhook configurations, CRDs, and subchart condition gates it actually contains, each with file-and-line evidence. It states what is in the chart and stops there. Deciding whether the chart may ship as flattened YAML is the flattening-safety verdict's job, and those are recorded separately.

132 of 135 catalog entries have a witness.

| status | entries | meaning |
| --- | --- | --- |
| scanned | 114 | scanned in this sweep against the hash its recipe locks |
| current | 18 | a committed witness already described the locked bytes |
| hash-mismatch | 2 | upstream republished this version under different bytes, so scanning it would describe something the catalog never locked |
| unavailable | 1 | the pinned artifact could not be fetched |

A hash mismatch is a finding about upstream rather than a gap here: the version string stayed still while the bytes moved. Those entries keep no witness until the catalog decides whether to relock.

Rerun with `npm run flattening-witnesses`. Entries whose witness already matches their lock are skipped, so a rerun fetches only what changed.
