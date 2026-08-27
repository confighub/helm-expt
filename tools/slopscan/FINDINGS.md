# Config Workshop: AI-speak audit

Corpus: `confighub/helm-expt` @ HEAD, site generated 2026-08-22T19:08:54Z.
Scope: `site/` only. 1,275 HTML pages in three layers.

| Layer | Pages | Words | What it is |
|---|---|---|---|
| Top-level authored | 42 | 58,314 | The site proper. 4 are table dumps, 4 are redirect stubs |
| `site/d/**` | 1,092 | 976,833 | Repo markdown rendered to HTML |
| `site/charts/**` | 140 | not scanned | Data-driven chart pages |

Prose subset used for rhythm metrics: 38 authored pages, 2,440 sentences.

---

## 1. The lexical AI tells are absent

Across 1.03M words, the standard slop vocabulary barely registers.

| Category | Top-level (58k words) | Rendered docs (977k words) |
|---|---|---|
| LLM vocabulary (`delve`, `tapestry`, `realm`, `underscore`, `showcase`, `pivotal`, `myriad`) | 0 | 4 |
| Puffery (`seamless`, `robust`, `leverage`, `unlock`, `empower`, `game-changer`) | 0 | 25 |
| Signposting (`in this section`, `let's dive in`) | 0 | 2 |
| Ritual summary (`in summary`, `the bottom line`) | 0 | 2 |
| Precision hedge (`it's worth noting`, `that said`) | 0 | 2 |
| Negation reframe (`not just X, it's Y`) | 0 | 54 |
| Anointment (`stands as`, `plays a vital role`) | 0 | 6 |
| Em dash | 4 | — |

For comparison, `robust` alone typically appears several hundred times per million
words in LLM-drafted technical marketing copy. Twenty-five puffery hits per
million words is a clean corpus by that measure.

**Consequence.** Every generic tool from the earlier list — the Vale AI-tells
packages, slop-gate, the Kobak excess-vocabulary list, the antislop phrase list —
will return near-zero on this site. Buying them solves nothing here. A
perplexity classifier (Binoculars, Fast-DetectGPT) would likely score the site as
machine-generated, but would not identify a single sentence to change.

The first two runs of my own scanner reported 164 `colon-then-payoff` and 237
`escalating-triple` hits on the top-level pages. Both were regex artefacts: the
colon rule was matching table cells and `Label:` prefixes, the triple rule was
matching any Oxford-comma list of technical nouns. Tightened to require a finite
verb before the colon and abstract morphology in the triple, the real counts are
**7** and **4**. Treat any word-list tool's raw output the same way.

---

## 2. What is actually wrong: structure, not vocabulary

### 2.1 Enumeration load

The dominant real signal. One three-or-more-item comma enumeration every
**16 sentences** on the authored pages.

| | Top-level prose | Rendered docs |
|---|---|---|
| Enumerations of 3+ items | 150 | 1,560 |
| Per 1,000 sentences | 61.5 | 33.3 |
| Of which 5+ items | 61 (41%) | 776 (50%) |
| Longest observed | 7 items | 10 items |

Examples from `index.html`:

- "find, render, inspect, compare, and keep files or OCI"
- "shared, changed, approved, promoted, released, or compared with live systems"
- "the exact objects, important differences, findings, and checks that did not run"

Each is grammatical and each is accurate. Cumulatively they are the thing that
reads as machine-written: the sentence stops making a claim and starts
enumerating a field set.

### 2.2 Sentence rhythm

| Metric | Authored prose | Note |
|---|---|---|
| Mean sentence length | 13.7 words | short |
| Standard deviation | 8.3 | |
| Burstiness (sd/mean) | 0.60 | |
| Sentences ≤14 words | 64% | |
| Sentences ≥25 words | 6% | |
| Simple sentences (no comma, no subordinator) | 51% | |

Half the corpus is subject-verb-object with no subordination and no comma. Two
consecutive sentences almost never differ in shape. This is Kassorla's
"simple sentence chaining / syntactic monotony", and it is the tell a reader
registers before they can name it.

The house style asks for "short sentences flowing in paragraphs". The sentences
are short. They are not flowing: at 51% simple and 6% long, there is nothing for
them to flow into. This is the seam between the style rule as written and the
output it produced.

### 2.3 Template ritual

Fixed section headings repeat across the corpus at scale:

| Heading | Pages |
|---|---|
| Why this preset exists | 217 |
| What this is | 196 |
| What to check | 196 |
| The chart journey | 195 |
| Why you can trust it | 195 |
| Fast path with no ConfigHub account: | 195 |
| Prerequisites and lifecycle steps | 195 |

On the authored pages the ritual is smaller but visible: the four-question block
("What do I have? / What will it produce? / Can this destination accept it? /
Did it work?") appears on 9 of 38 pages, and the closing sequence
"See one example → Check the record → Do this next → Start this check" on 4.

Repetition at 195 pages is a generator, not a writer. Whether that is a defect
depends on whether those pages are read as a catalog (fine) or found individually
via search (not fine).

### 2.4 Sentence-level page footer

A single 5-gram appears on all 1,092 rendered pages: the "generated from the
committed markdown file / the source file is the authoritative version" footer.
Expected for generated pages; noted because it will dominate any n-gram
over-representation analysis you run and needs excluding first.

---

## 3. Baseline problem, quantified

Scoring vocabulary against `wordfreq` (general English) produces this as the
most over-represented vocabulary in the corpus:

```
117617x  webhooks        88197x  cluster-rbac      64500x  no-crds
 32356x  stateful-storage 23602x  redis             21984x  rbac
```

All true, all useless. A general-English baseline cannot distinguish domain
vocabulary from register. This is the concrete reason the earlier recommendation
was to use docs.confighub.com as the baseline rather than a published word list.

**NOT OBSERVED:** the docs.confighub.com baseline. Sub-pages
(`/background/config-as-data/`, `/guide/change-apply/`, `/background/why-confighub/`)
returned HTTP 404 to an automated fetcher on 2026-08-27, although the site root
served fine and links to all three. Worth checking independently — it may affect
crawlers and search indexing, not just this scan. `BASELINE.md` has the steps to
wire the baseline in once the corpus is reachable.

---

## 4. Toolchain fit, revised

| Tool | Verdict here |
|---|---|
| Vale + `vale-signs-of-ai-writing` / `vale-ai-tells` | Keep as a regression guard. Will fire ~0 times on the current corpus |
| slop-gate, antislop phrase lists, Kobak excess-vocab CSV | Not useful. Wrong corpus, wrong register |
| Binoculars / Fast-DetectGPT | Not useful. Produces a score, not an edit |
| SlopSift (dependency parsing) | Plausible fit for the sentence-monotony signal. Untested here |
| This repo | Handles the three signals that actually fire: enumeration load, rhythm, template ritual |

The generic packages are worth installing precisely because they return zero:
they lock in the property the corpus already has. The editing work is elsewhere.

---

## 5. What the edit actually is

Not a find-and-replace pass. Three mechanical changes, each verifiable:

1. **Cap enumerations at three items.** 61 instances of 5+ items on the authored
   pages, 776 in the docs. Where the list is a field set, move it to a table or a
   list block. Where it is rhetorical, cut it to the two items that carry the claim.
2. **Raise burstiness.** Target the docs.confighub.com band once measured. The
   lever is subordination, not length: joining adjacent simple sentences with
   `because`, `once`, `unless` reduces the 51% simple share directly.
3. **Break the ritual, or own it.** Either vary the section headings on the
   authored pages, or accept the template on generated pages and exclude them
   from the audit. Doing neither is what produces the current reading.

Ranked edit queue for the 31 authored prose pages with enough text to score:
`edit_queue.csv`. Top of the queue by combined enumeration density and simple-sentence
share: `existing-apps.html`, `security.html`, `docs.html`, `journey.html`,
`guides.html`, `verification.html`.

---

## Scope caveats

- `site/charts/**` (140 pages) not scanned. Data-driven, likely all template.
- Sentence segmentation is regex-based. Abbreviations and version strings split
  incorrectly at a low rate; the 4 table-dump pages were excluded from rhythm
  metrics for this reason (`matrix.html` alone produced 73-word "sentences").
- The pattern regexes in `scan.py` are the loose first-pass versions and
  over-report. `refine.py` holds the tightened versions. Both are shipped so the
  gap is visible.
- No claim is made here about whether any given page was AI-written. The metrics
  measure register, not provenance.
