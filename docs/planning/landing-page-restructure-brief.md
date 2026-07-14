# Landing page restructure brief

**UNOFFICIAL/EXPERIMENTAL.** A brief for Codex: restructure the generated homepage
(`site/index.html`, built by `parityFirstHomeHtml` in `scripts/generate-public-site.mjs`)
around one narrative spine — look first, prove it on a cluster, change it and keep it —
so the page makes one pitch instead of nine. House voice (`house-voice.md`) and house
layout (`house-layout.md`) throughout.

## Where this came from

A reader walked the site with the maintainer and reported three problems: the
no-server message was buried, the Get Started page was easier to follow than the
homepage, and the chart/recipe/variant vocabulary was hard to explain. PR #1098
and #1099 fixed the buried claim (hero now leads with "Try a catalog package with
no server, no cluster, and no account") and the self-contradicting heading. This
brief executes the rest.

## What's wrong now

- **The page is a stack of complete pitches, not one pitch.** After the hero there
  are eight more sections (How we help, Examples, What this is, four separate
  "Try It Now with …" sections, Editing versus buying), and each restates the whole
  story. The Get Started page reads better because it has a spine: pick a chart →
  read what it installs → check what it needs → change it and keep it. The homepage
  should borrow that spine, not compete with it.
- **The litany repeats.** "Hooks, CRDs, prerequisites, and known footguns" appears
  three times verbatim, plus close variants. House voice caps lists at three and
  says a noun pile-up signals breadth and informs nothing. Say it in full once.
- **Six nouns carry three ideas.** Chart, package, recipe, base variant, variant,
  and render intent all appear on one page, and "variants" is used before it is
  defined. A first-time reader cannot retell the model, which is the test that
  failed in the field.

## The new structure

Seven sections down from ten. The hero stays as landed in #1098/#1099.

1. **Hero** — unchanged. H1, lead, the four promise lines, the AI-key terminal
   card. It already leads with the no-server claim.
2. **Look first (no server, no Kubernetes, no account)** — merge the current
   "Try It Now without a server and without Kubernetes" section with the
   "Pre-flight checks" journey card. This is the top of the funnel and the first
   step of the spine. The full hooks/CRDs/prerequisites/footguns list lives here
   and only here.
3. **Prove it on a cluster** — the current "Try It Now with Kubernetes" section,
   kept tight: the two terminal cards (plain Helm; cub render then apply), the
   parity sentence, the installer availability note, one link to Get Started.
4. **Change it and keep it** — the current "Try It Now with ConfigHub" section.
   This is where "variant" gets its one-sentence definition (see vocabulary).
   Keep the four cards (store, edit-and-keep, custom apps, promote) and the
   demo-org link; they are the account-tier value ladder.
5. **The catalog** — fold the "Helm Ops Catalog" journey card and the
   "Try It Now with our Helm Ops Catalog" section into one short section: what a
   chart page gives you (rendered objects, render record, route information),
   one example link, one link to the catalog index.
6. **Editing charts versus buying charts** — keep as is (landed in #1078).
7. **What this is** — keep the honesty section, moved to the end as the footer
   note before the actual footer. Proven versus sketched, demo org, unofficial.

The three "Examples" audience notes (values files, upgrades, private platform)
restate the pitch; move them to `how-it-works.html` or cut them. If kept anywhere
on the homepage, they must shrink to one line each and appear once. The CTA button
row (Get started / Pick a chart / How it works / Check Tests) moves to the end of
section 3, where the reader has just seen the commands.

## Vocabulary

One sentence per noun, used identically wherever the noun first appears on a page:

- A **chart** is what the vendor ships: a template for Kubernetes objects.
- A **variant** is a supported way to run that chart, rendered to plain files you
  can read, check, and edit.
- A **recipe** is the recorded instructions that produced a variant: the values,
  version locks, and checks.

The homepage teaches only chart → variant. "Recipe" comes off the homepage
entirely: `how-it-works.html` and the chart pages define it, and the "What this
is" section already says recipes are sketches, so the front page must not sell
them. "Package" may appear only next to a `--pull` command, where it names a
concrete thing the reader is pulling.

## Generator notes for Codex

- `site/index.html` is byte-checked by `npm run site:verify`, so this is a
  `generate-public-site.mjs` change, not a hand-edit. Regenerate with
  `HELM_EXPT_SITE_GENERATED_AT` pinned to the committed `site/generated-at.txt`
  value so the diff stays content-only. Run only `site:generate`, `site:verify`,
  and `site:ux:verify`; the full verify suite is not needed for a homepage change.
- Update the `checks` entry for `site/index.html` in
  `scripts/verify-site-ux-contract.mjs`. It currently pins "Examples",
  "Try It Now with ConfigHub", "Try It Now with our Helm Ops Catalog", and
  "Store chart configurations" — several of these headings disappear. Pick stable
  replacements from the new section names (for example "Look first",
  "Editing charts versus buying charts", "What this is").
- The `guideOpeningChecks` header terms for `site/index.html` ("Helm Ops made
  simple", "AI-friendly Helm tools", "Preview your installs") describe the hero,
  which does not change; they should keep passing. `site/index.html` also sits in
  `menuGuidePages` and `humanSplitPages` — keep the nav and the human-split marker
  intact.
- The installer availability note (corrected in #1099) must stay attached to any
  command block that uses `cub installer`.
- Keep every claim backed. The chart-claim-integrity lane
  (`chart-claim-integrity:verify`) exists because pages drifted from their
  receipts; do not introduce new claims while moving copy. The demo-org link must
  stay reachable from the homepage (#1073).
- Self-check the finished page against `house-voice.md` (Flesch 60–70 leads, lists
  capped at three, no template tics) and `house-layout.md` (narrow prose, hairline
  sections, terminal cards, one accent).

## Acceptance

- Each idea appears once: one full litany, one account pitch, one catalog pitch.
- A first-time reader can answer, from the homepage alone: what is a chart, what
  is a variant, what can I try with nothing installed, and what does an account
  add.
- `npm run site:verify` and `npm run site:ux:verify` pass.
