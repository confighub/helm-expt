# Handoff: register audit branch

Branch: `register-audit`, cut from `main` @ ab65780d.

## Read this first: site/*.html is generated output

`site/` is built by `scripts/generate-public-site.mjs`. Editing the HTML
directly appears to work and is silently reverted by the next generator run.
Two commits on this branch (`64e5cea6`, `f1062551`) made that mistake. The
later commits move every one of those edits into the generator, which is the
source of truth, and regenerate. If you are editing site copy, edit
`scripts/generate-public-site.mjs`, then run:

    node scripts/generate-public-site.mjs --generate

## Conflict surface

`scripts/` and `data/`, not `site/`. Specifically:

- `scripts/generate-public-site.mjs` - 65 copy replacements
- `scripts/generate-confighub-example-guides.mjs` - the 195-page guide template
- `scripts/verify-site-ux-contract.mjs` - pinned copy terms, and the sentence cap
- `scripts/verify-configuration-review-contract.mjs` - pinned heading terms
- `scripts/verify-doc-map.mjs` - one line allowing `tools/<name>/*.md`
- `tools/slopscan/` - new, no conflict surface

`site/` and `data/confighub-example-guides/` are regenerated output. On a
conflict there, take either side and re-run the generators.

## The sentence cap

`verify-site-ux-contract.mjs` enforced a hard 25-word ceiling on every
sentence in the technical-English pages. That rule is the mechanical cause of
the register problem this audit was asked to fix: 51% of sentences carried no
comma and no subordinator, and burstiness sat at 0.60. A 25-word ceiling makes
subordination impossible, and without subordination consecutive sentences
cannot differ in shape.

Raised to 32, with the reasoning in a comment at the rule. **This is a change
to a deliberate house rule that I did not set.** Revert to 25 if the shorter
ceiling exists for a reason outside the prose register.

Note that raising the cap does not improve anything by itself. It removes the
constraint; the writing still has to happen.

## What the audit found

Full detail in `FINDINGS.md`. Four results that matter:

1. **The corpus is clean of LLM vocabulary.** Across 1.03M words: zero
   `delve`/`tapestry`/`robust`-class hits on the 42 authored pages, four in
   977k words of rendered docs. Generic AI-slop word lists and detectors return
   nothing here. Do not spend time on vocabulary.

2. **The real signals are structural**: enumeration load (one 3+ item comma
   list every 16 sentences, 41% of them 5+ items), sentence monotony (above),
   and negative specification (median 18% of sentences carry a negation, worst
   page 46%, longest unbroken run 7 sentences on `promote.html`).

3. **Doctrine breach: competing full summaries.** `config-catalog-doctrine.md`
   says pages should link to the canonical statement rather than maintain a
   competing full summary. Eleven of 42 top-level pages restated all four
   assessment questions in full. "without an account" appeared 34 times at top
   level and 606 times in the rendered docs.

4. **Doctrine breach: generic handoff.** Doctrine specifies "Keep this reviewed
   result in ConfigHub", not a generic account request. The generic form
   outnumbered it six to three.

## What was changed

- **Homepage**: hero from six paragraphs (211 words before the first CTA) to
  two (104). The four assessment questions moved from a run-together hero
  sentence into the evidence section as the doctrine's table, with input and
  permitted-claim columns. Doctrine requires them kept *separate*; one sentence
  with question marks was the least separated form available.
- **Copy pass** on try, existing-apps, security, guides, journey, ai,
  operations, variants, offering, confighub, promote, how-it-works.
- **Repeated boilerplate**: the "New to cub" block (18 pages) and the installer
  note (6 pages), each three sentences carrying two negations.
- **21 title-case headings** across 12 pages to sentence case.
- **The 195-page guide template**: eight boilerplate paragraphs.
- **Quality floor**: visible keyboard focus and `prefers-reduced-motion`, added
  to all three CSS functions in the site generator. Neither existed anywhere on
  1,275 pages, while 38 pages use transitions or animation.

## The four rules the copy edits apply

1. One negation per paragraph. Bounds move into a marked `Limits` line. Limits
   are never deleted: doctrine requires stated limits in the public result.
2. Comma enumerations capped at three items.
3. Subordination, so consecutive sentences differ in shape.
4. The page's number or oddity leads.

## Honest measurement

Per-page deltas on edited pages are real: `security.html` 47% to 33% simple
sentences, `try.html` 32% to 19% negations, `index.html` 6 enumerations (5 of
them 4+ items) down to 4 (2).

**The site-wide aggregate barely moved**: median negation share 18% to 16%,
enumerations 150 to 144, burstiness unchanged at 0.60. Roughly 50 rewritten
paragraphs against a 2,421-sentence authored corpus is dilution, and the
977k-word generated layer is untouched apart from one template. Do not read
the per-page numbers as a site-wide result.

## Protected copy, untouched

- The ten practical questions and their "n of 40 discussions" counts. Doctrine
  flags these as a standing user-test set, not rewritable copy.
- All stated limits, and the blocked / not-run vs failed distinction.
- The four assessment questions, given more separation rather than less.

## Verification run on this branch

    node scripts/generate-public-site.mjs --verify        1275 pages
    node scripts/verify-site-ux-contract.mjs              40 pages, 26 guides
    node scripts/verify-configuration-review-contract.mjs
    node scripts/verify-config-workshop-machine-contract.mjs
    node scripts/verify-doc-map.mjs                       1745 markdown files
    node scripts/verify-knowledge-layer.mjs
    node scripts/verify-no-personal-names.mjs
    node scripts/verify-no-temp-paths.mjs
    node scripts/generate-confighub-example-guides.mjs --verify   195 guides
    node scripts/generate-helm-catalog-readmes.mjs --verify        72 READMEs
    node scripts/generate-npm-script-catalog.mjs --verify
    node scripts/test-config-workshop-yaml.mjs

All pass. The full `npm run verify` was NOT run: it includes live cluster and
ConfigHub lanes that need credentials unavailable here.

## Known limits of this work

- `site/charts/**` (140 pages) not scanned.
- Vocabulary is scored against `wordfreq` (general English), the wrong baseline
  for a technical corpus: it ranks `webhooks` and `cluster-rbac` as the most
  over-represented words. `BASELINE.md` has the swap to docs.confighub.com.
  Sub-pages of docs.confighub.com returned HTTP 404 to an automated fetcher on
  2026-08-27 while the root served fine; unverified whether that affects other
  crawlers.
- `scan.py` holds loose first-pass regexes that over-report by roughly 20x on
  two categories; `refine.py` holds the tightened versions. Trust `refine.py`.
- Three of my own metrics produced false positives and were corrected: an
  "empty code span" defect count (1,057) was my extractor dropping inline
  `<code>`; a heading-stack metric was matching table cells; and the first
  colon and triple detectors over-reported 164 and 237 against real counts of
  7 and 4. Assume the same failure mode for any new rule.
- Doctrine read: business purpose, user journey, business model and
  practical-question-contract sections of `config-catalog-doctrine.md` plus its
  heading list. NOT read: the rest of that file, `catalog-doctrine.md`,
  `lane-test-doctrine.md`.
- No visual design work. The remaining gap against comparable developer sites
  is typographic and structural, not lexical: a system font stack with no
  characteristic face, and a static terminal block in a hero for a site whose
  thesis is live evidence. Not attempted because nothing here can render or
  screenshot a page, and an unverified re-skin across 1,275 pages is not worth
  the risk.

## Still to do

22 of the 34 authored prose pages are unedited. `results/edit_queue.csv` ranks
them; `docs.html` and `verification.html` are next. `journey.html` was edited
but its nine enumerations are genuine field sets that want to be tables, which
is a markup change in the generator rather than a copy change.
