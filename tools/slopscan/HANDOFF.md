# Handoff: register audit branch

Branch: `register-audit`, cut from `main` @ ab65780d.

## What is in this branch

Two commits.

1. `tools/slopscan/` - the audit tooling. Pure addition, no conflict surface.
2. Copy rewrites to six pages under `site/`: `index.html`, `try.html`,
   `existing-apps.html`, `security.html`, `guides.html`, `journey.html`.
   **This is the conflict surface.** If a concurrent worktree has touched any
   of those six, take theirs and re-apply these rules rather than merging
   blind. Nothing under `docs/`, `packages/`, `recipes/` or `config-catalog/`
   is touched.

## What it found

Full detail in `FINDINGS.md`. Four results that matter for anyone editing
site copy:

1. **The corpus is clean of LLM vocabulary.** Across 1.03M words: zero
   `delve`/`tapestry`/`robust`-class hits on the 42 authored pages, four in
   977k words of rendered docs. Generic AI-slop word lists and detectors
   return nothing here and are not worth installing except as a regression
   lock. Do not spend time on vocabulary.

2. **The real signals are structural.** Enumeration load (one 3+ item comma
   list every 16 sentences, 41% of them 5+ items), sentence monotony (51% of
   sentences have no comma and no subordinator, burstiness 0.60), and
   negative specification (median 18% of sentences carry a negation, worst
   page 46%, longest unbroken run 7 sentences on `promote.html`).

3. **Doctrine breach: competing full summaries.** `config-catalog-doctrine.md`
   says pages should link to the canonical statement rather than maintain a
   competing full summary. Eleven of 42 top-level pages currently restate all
   four assessment questions in full. "without an account" appears 34 times
   at top level and 606 times in the rendered docs.

4. **Doctrine breach: generic handoff.** Doctrine specifies the ConfigHub
   handoff is "Keep this reviewed result in ConfigHub", not a generic account
   request. The doctrinal phrasing appears 3 times; the generic form
   ("ConfigHub becomes useful when you want to...") appears 6 times.

## The four rules the copy edits apply

1. One negation per paragraph. Bounds move into a marked `Limits` line
   instead of being interleaved with instructions sentence by sentence.
   Limits are never deleted: doctrine requires stated limits in the public
   result.
2. Comma enumerations capped at three items. Longer ones split into
   sentences or become a table.
3. Subordination added so consecutive sentences differ in shape. The target
   is the simple-sentence share, not sentence length.
4. The page's number or oddity leads. On `try.html` that is the fourteenth
   object being a Namespace `cub` adds.

Measured on the six edited pages:

| Page | %simple | %negation | enumerations (4+ items) |
| --- | --- | --- | --- |
| index.html | 56 -> 48 | 16 -> 15 | 6 (5) -> 4 (2) |
| try.html | 59 -> 56 | 32 -> 19 | 1 (1) -> 1 (1) |
| existing-apps.html | 31 -> 33 | 8 -> 7 | 6 (6) -> 4 (4) |
| security.html | 47 -> 33 | 21 -> 14 | 3 (3) -> 3 (2) |
| guides.html | 30 -> 35 | 20 -> 10 | 3 (3) -> 2 (2) |
| journey.html | 31 -> 32 | 12 -> 10 | 9 (9) -> 9 (9) |

Total words across the six went **up** by 63, from 3,361 to 3,424.
Subordination costs words. The homepage hero fell from 211 words before the
first CTA to 104, and that reduction was duplication rather than
information; the rest of the corpus is not over-long, it is over-compressed
into lists.

`journey.html` barely moved on enumerations. Its nine are mostly genuine
field sets that want to be tables, which is a markup change rather than a
copy change, and it has not been done.

## Protected copy, untouched

- The ten practical questions and their "n of 40 discussions" counts.
  Doctrine flags these as a standing user-test set, not rewritable copy.
- All stated limits, and the blocked / not-run vs failed distinction.
- The four assessment questions, kept and given more separation, not fewer.

## Still to do

28 of the 34 authored prose pages are unedited. `results/edit_queue.csv`
ranks them; `docs.html` and `verification.html` are next.

## Known limits of this work

- `site/charts/**` (140 pages) not scanned.
- Vocabulary is scored against `wordfreq` (general English), which is the
  wrong baseline for a technical corpus: it ranks `webhooks` and
  `cluster-rbac` as the most over-represented words. `BASELINE.md` has the
  swap to docs.confighub.com. Sub-pages of docs.confighub.com returned HTTP
  404 to an automated fetcher on 2026-08-27 while the root served fine;
  unverified whether that affects other crawlers.
- `scan.py` holds loose first-pass regexes that over-report by roughly 20x
  on two categories; `refine.py` holds the tightened versions. Both ship so
  the gap is visible. Trust `refine.py`.
- Two of my own metrics produced false positives and were corrected: an
  "empty code span" defect count (1,057) was my extractor dropping inline
  `<code>`, and a heading-stack metric was matching table cells. Neither is
  a site defect. Assume the same failure mode for any new rule.
- Doctrine read: business purpose, user journey, business model and
  practical-question-contract sections of `config-catalog-doctrine.md` plus
  its heading list. NOT read: the rest of that file, `catalog-doctrine.md`,
  `lane-test-doctrine.md`.
