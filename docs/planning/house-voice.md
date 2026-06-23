# The house voice

**UNOFFICIAL/EXPERIMENTAL.** How we write every word a user reads. The standard for all
tech copy on the site and in `docs/user/*`. Born from the serverless-mode rewrite, which
reads at Flesch 76 (plain English) where the old site averaged ~43 (college-level).

## Who is writing

Imagine one author with three habits.

- **Martin Fowler** keeps it *exact*. A thing is named, then used. "A Helm chart is not
  Kubernetes objects. It is a template *for* them." No hand-waving, no borrowed jargon
  left undefined.
- **Steve Jobs** removes everything inessential. Short. Declarative. The benefit first,
  the mechanism second. "Seeing is only half. The other half is that it installs and
  works."
- **Charles Dickens** gives it rhythm and a human pulse. A line you remember. "Nothing
  is hidden, and nothing is taken on trust."

One voice, not three taking turns: precise *and* plain *and* alive.

**When they disagree, Jobs wins.** Dickens earns a memorable line only when it is also the
plainest true one. The moment a phrase calls attention to itself as writing — a metaphor
reaching for effect, a flourish you would never say aloud — cut it. The test: would Jobs
say it on a stage? *"It just works"* — yes. *"We pull them into the light"* — never. Rhythm
and warmth, never ornament.

## The rules

1. **One idea per sentence.** Keep them short. Vary the length so the page has a pulse.
2. **Cap every list at three.** Need more? Give two examples and "and more." A reader
   cannot hold a nine-noun pile-up; it signals breadth and informs nothing.
3. **Define each coined word the first time, in the same breath.** Unit, render, base,
   variant, OCI, receipt. If the reader has to already know it, you have already lost them.
4. **Benefit first, mechanism second.** Say what it does for them, then how it works.
5. **Use the promise → fact frame.** Helm hides; we show. State the contrast plainly and
   let it carry the page.
6. **Say the edges out loud.** A page that only flatters itself is not trusted. Name the
   caveat gracefully — never bury it, never drop it.
7. **No build exhaust in human copy.** Timestamps, source-attributions, internal IDs, and
   raw file paths belong in a footer or nowhere. They never open a sentence.
8. **No template tics.** Ban "[concession], but X until Y," "not X; it is Y," and
   "Use it for: [noun, noun, noun]." Once you see them you cannot unsee them.
9. **Aim Flesch 60–70 on every lead paragraph.** Plain English. Measure it; do not guess.
10. **Keep the proof.** Never make the copy prettier than the evidence. Every claim stays
    backed; the voice earns trust, it does not borrow it.

## Front-door rewrites (ready to apply)

Three real surfaces, before and after. Paste the *after* into the generator.

### Get Started (`site/try.html`)

> **Before.** "Start here if you want to see the idea with one chart. The choice is
> simple: run Helm directly, or render the same chart with cub installer so you can
> inspect the objects before delivery. Use Prometheus for the first pass. Run normal Helm
> if you only want a quick install. Use cub installer if you want the same chart…"

> **After.** "Pick one chart and watch the idea work. Run it with Helm, the way you always
> have. Then render the same chart with cub installer and read the exact objects — every
> one of them — before a single one is applied. Same chart, same result. The difference is
> that you see it first."

### How It Works (`site/how-it-works.html`)

> **Before.** "Use this page when you want the basic model before trying commands. A Helm
> chart is rendered first, then chart-specific behavior is routed, delivered, and observed
> instead of being hidden in one install step. Read the four cards from left to right."

> **After.** "Helm installs in a single step and hides what it did. We split that step into
> four you can watch. **Render** the chart into real Kubernetes objects. **Route** the tricky
> parts — a hook, a CRD — into steps you can see. **Deliver** the result. Then **observe** it:
> watch the workload actually run, not just report success. That is the whole model."

### Chart-page intro (`site/charts/*.html`)

> **Before.** "bitnami/redis. Generated at: 2026-06-23T08:32:01.928Z UTC · source:
> committed helm-expt evidence for this chart status page. This page tells you what
> ConfigHub knows about this Helm chart today: how to run it with cub, which variants are
> available, what evidence exists, and what is still watch or blocked."

> **After.** "Everything we know about **bitnami/redis**, on one honest page: how to run
> it, which variants exist, what we have proven, and what we have not. The green is
> earned; the gaps are named." *(Move the `Generated at:` line to the footer — build
> exhaust never opens a chart page. Rule 7.)*

## Where to apply it, in order

1. The homepage hero and the four journey cards.
2. Get Started, How It Works, the chart-page intro (above).
3. The FAQ answers and the Variants / Apps / Ops intros.
4. Every `docs/user/*` lead paragraph as it is next touched.

## How to check it

Run the lead paragraph through a readability check (target Flesch 60–70), and read it
once out loud. If a sentence has more than three items in a row, or opens with a
timestamp, or uses a banned tic, it fails the voice — fix it before it ships. The
serverless guide ([`docs/user/serverless-mode.md`](../user/serverless-mode.md)) is the
worked reference.
