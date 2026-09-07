# Site IA — phase 3: earn trust, prompt action

Phase 1 built the section structure; phase 2 settled the IA (one page per
concept, evidence on GitHub, five-section nav). Phase 3 works the layer phase 2
left alone: the words and the wayfinding on the pages a reader actually lands
on.

## Purpose

The site is now navigable but not yet persuasive, and structure is the wrong
lever to keep pulling. So phase 3 has one job: **make every top page earn trust
and move the reader to run `cub`.** Above all, the home page must say, in order,
(a) why we are here, (b) what you can do, and (c) what you actually get — and
the rest is links. Each finished page passes two tests:

- **Trust.** Every claim is honest and traceable; no hero-level overclaim, no
  vocabulary drift, evidence one click away.
- **Action.** A newcomer knows exactly what they can DO next and why; every
  heading and lead carries a verb; the free/account/paid path is obvious; no
  page is a dead end.

## Who does what

- **The top pages: the maintainer authors, the site session implements.** The
  maintainer hand-crafts the content and structure for each top page; the
  session turns it into the generator's builders and the UX-contract terms, runs
  the full gate set, and keeps the site consistent.
- **The columns and the code-block doctrine: the site session owns them.** These
  are wayfinding and layout, not voice.

## The top pages (hand-crafted, in order)

1. `index.html` — home (fully specified below).
2. `charts/index.html` — Catalog.
3. `config.html` — Config.
4. `stack.html` — Stacks.
5. `how-it-works.html` — Operate.
6. `confighub.html` — ConfigHub Server (the conversion / product page).

Each gets its own worked section in this doc as the maintainer hands over its
content. Home is done; the rest are placeholders until then.

## Doctrine: code blocks (applies to EVERY page)

The maintainer marked this doctrine, so it is a hard rule, enforced by the UX
contract, not a per-page preference:

1. **The comment goes ABOVE its command, never after it.**
2. **No line wraps.** No command or comment line may run to two or more visual
   lines; shorten the command, the path, or the comment instead.
3. **Comments are short, relevant, and real** — one plain phrase that says what
   the command does or shows, not a label or filler.
4. **No label text bleeds into a block** (e.g. the `stack.html` block currently
   opens with "one install, three commands" as if it were code — that is a
   heading, and belongs outside the block).

Implementation: one shared code-block renderer (`commandBlock(...)` or similar)
that takes `{comment, command, result?}` rows and emits comment-above,
no-wrap-checked markup, so a block cannot be authored the wrong way. A UX-contract
check scans every generated `<pre><code>` for a command line preceded (not
followed) by its comment and for over-long lines, and fails the build otherwise.
Audit order, worst first: `charts/index.html`, `stack.html` ("one install,
three commands"), `index.html`, then the rest.

Retitle the home ladder caption `free check → certified stack → governed
release` toward **"use cub open source, or upload to ConfigHub Server."**

## The columns (left and right)

**Left column.** Content pages carry a "Sections" sidebar that is the entire
site map, repeated identically everywhere, unscoped, with inconsistent labels
(short nouns next to long questions). Phase 3:

- Give the labels one consistent style.
- Scope/highlight it to where the reader is ("you are here").
- **Home gets its own left column**: a curated **action/persona** column
  (distinct content from the Sections sidebar, same visual pattern) — the five
  persona doors expanded to 7–10 action links.

**Right column.** Today it is the on-page TOC (the current page's h2s). Keep
that, and add a short "where to go next" so the rail is not a dead end.

## Home page — worked specification (from the maintainer's notes)

Target spine: **why → what you can do → what you get → links.**

### 1. Why we are here (top, unchanged in place)
The hero ("Compose a platform or stack from the public Catalog") and the
one-line paragraph: "ConfigHub Workshop is a verified catalog of tested
configuration, stacks and platforms on demand. You can use these for apps,
platforms, and stacks in ConfigHub."

### 2. What you can do (MOVE UP, under that paragraph; improve)
The "What do you need help with?" section, moved directly under the intro
paragraph and rewritten to the maintainer's copy:

- Intro: "You need a configuration, you have one, or you want a whole platform.
  Start from where you are. Each path gives you exact files and a result you can
  keep, and the free ones need no account." + a Search entry.
- Six numbered paths: (1) You need a configuration; (2) You have one — is it
  right?; (3) You want a whole platform; (4) You already run Flux or Argo CD;
  (5) A team needs to share, approve, and promote it; (6) You run AI on GPUs.
  (Full copy in the maintainer's notes; carry it verbatim, subject to the
  32-word cap and the code-block doctrine.)
- The five-word definitions block (config, app, stack, platform, fleet), each
  pointing at its canonical page.
- The upstream-moved note (successor + digest-drift check) and the closing
  links (six worked examples, the short Redis example, choose a deployment
  method).
- A light version of "Four common Helm questions" folds in here; the full
  content moves to the Helm/`ask` page (both).

### 3. What you get (MOVE DOWN; strengthen)
"What ConfigHub Workshop is" moved below "what you can do", kept as the three
parts, strengthened per the notes: (1) A verified catalog (112 components, 139
versions; verified, certified, and signed); (2) Stacks and platforms on demand;
(3) Operate apps, platforms, and stacks correctly in ConfigHub. Each part keeps
its "What you can do" / "What problem this solves" pair.

### 4. Links and relocations
- The five persona buttons become the home **left-hand action column** (7–10
  links), same visual pattern as other pages' sidebars.
- The verb-strip ("cub is ConfigHub's command line…") comes OUT from under the
  code block into a small **"Getting started with cub"** block (install cub →
  add the plugin → what is free), not caption text.
- "Check the result and the limits" — internal jargon; fold into Catalog or
  Docs, off the home page.

## Gates (every page, before it ships)

- The code-block doctrine check (comment-above, no-wrap, no bled-in labels).
- The trust test: no unbacked claim; every "verified/certified/signed" style
  claim traceable; house voice (verbs in headings, no banned patterns, 32-word
  cap).
- The action test: each page names a next step; the free/account/paid path is
  visible.
- The full CI verifier set, run locally: `site:ux:verify`, `site:verify`,
  `verify-variant-command-surface`, `verify:machine-contract`,
  `chart-claim-integrity:verify`, `config-model:verify`, `docs:verify`,
  `verify:no-personal-names`.

## Order of work

1. The shared code-block renderer + its contract check, applied to the three
   worst pages (charts/index, stack, home).
2. The home page restructure (this spec) + its left action column.
3. The left/right column pass across the content pages.
4. Catalog, Config, Stacks, Operate, ConfigHub Server — each as the maintainer
   hands over its content.

## Open questions for the maintainer

1. The home left action column: which 7–10 links? (Draft: the five persona
   doors + Search + Catalog + Try Redis + the ten-minute demo.)
2. Do the content pages keep the full-site "Sections" sidebar, or does it also
   become scoped/curated like the home column?
3. "Check the result and the limits" — Catalog or Docs as its new home?
