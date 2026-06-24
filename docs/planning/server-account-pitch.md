# Account pitch — "your versions, your apps, your releases"

**UNOFFICIAL/EXPERIMENTAL.**

## The thesis

The second rung of the ladder: free serverless (look before you install) → an account (run
your own). The pain that pushes you here is simple — one chart becomes many, and now you need
your own versions, your own apps, and a safe way to release them.

The pitch is the table of contents for this rung, so we **unite it with what already exists**
instead of adding a page:

- **versions** → the homepage "Manage Helm Variants" box (and the Variants page)
- **apps** → the "Apps" button (the homepage "Your Own Live Apps" box → journey.html)
- **releases** → the promote/stage/release flow that runs through both

The rung below this one is the free-path pitch (`free-path-pitch.md`).

## The pitch (plain)

### Your versions, your apps, your releases

The free path is for trying public charts. An account is for running your own.

**Custom versions and variants.** Start from one base and make as many versions as you need —
dev, staging, prod, one per region or customer — all from that one base, not nine separate
copies.

**Your own apps.** Not just public charts. Bring your own apps and configs into the same place,
managed the same way.

**Promote, stage, and release.** Move a change from dev to staging to production through checks,
with a record of what changed.

**Deliver with what you already run.** Hand off to your Argo, Flux, or OCI — no new tool to
roll out.

Helm still renders. Your controller still delivers. The account is where you keep, change, and
release everything in between.

## Shipped vs frontier

- **Shipped (rough but real):** `cub variant create` (versions and variants, with links back to
  the base), importing your own apps and configs as Units, promote/stage/release through gates
  and receipts, and GitOps/OCI delivery.
- **Frontier (keep off the page):** one value rippling across the whole fleet on its own, and
  pulling live drift back into the graph. `offering.md` already lists fleet-wide propagation and
  reverse live→desired as bounded frontiers. The variant workflow today is the current
  substrate, not a polished Creator UI — true, but not worth putting in hero copy.

## Placement — unite, don't add a page

### Homepage box "Then" (→ variants.html)

- From: "Manage Helm Variants — Create customised variants of your chart, promote through
  environments, and manage target-specific choices before app delivery."
- To: **"Your versions"** — "Start from one base and make as many versions as you need: dev,
  staging, prod, one per region or customer."

### Homepage box "Later" (→ journey.html / Apps)

- From: "Your Own Live Apps — Combine public charts, custom app pieces, and stacks, then deploy
  and operate them once the app is running."
- To: **"Your apps, your releases"** — "Add your own apps alongside public charts, then move them
  from staging to production."

### Apps page (journey.html) opening line

- Add as the lead, above the existing "Apps Guide" content: "The free path is for trying public
  charts. An account is for running your own — your apps, your custom versions, and releases you
  move from staging to production."

### Ladder coherence

When the free pitch ships, the homepage "First" box ("See How It Works") should become
**"Look before you install"** so the whole ladder reads as one story: look first (free) → your
versions, your apps, your releases (account).

## Generator notes (Codex)

- All in `scripts/generate-public-site.mjs`; regenerate; keep `npm run site:verify` passing.
- If the journey.html opening change moves the checked terms, update `verify-site-ux-contract.mjs`
  (the journey.html opening currently tests "public Helm charts", "Start by choosing what you
  already have", "safe first result is visibility").
- Keep the experimental banner. Plain house voice, house layout.
- Do not claim the frontier items (auto-propagation, drift write-back).
