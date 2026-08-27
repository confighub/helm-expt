# Handoff: register audit branch

Branch: `register-audit`, cut from `main` @ ab65780d.

## What is in this branch

`tools/slopscan/` only. No site copy is edited. Nothing under `site/`,
`docs/`, `packages/`, `recipes/` or `config-catalog/` is touched, so this
branch should merge into anything without conflict.

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

## What is NOT in this branch, deliberately

The copy edits. They were discussed but not made, because they land in
`site/index.html` and the other authored pages, which is where a concurrent
worktree is most likely to be working. Proposed changes, for whoever picks
them up:

- Homepage hero: 6 paragraphs / 211 words before the first CTA, reduced to
  one paragraph. The displaced content is duplication, not information.
- The four assessment questions move from a run-together hero sentence to
  the evidence section as the doctrine's own table (question / required
  input / what it may claim). Doctrine requires them kept *separate*; a
  single 20-word sentence with question marks is the least separated form.
- Stated limits move out of running prose into a marked Limits block per
  page. They must not be deleted: doctrine requires stated limits in the
  public result.
- The ten practical questions and their "n of 40 discussions" counts are
  protected copy per doctrine and must survive any rewrite.

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
