# Workshop strategy: context, decisions, and handoff

**Status:** handoff package for the catalog backend session (Codex) to take a
fresh, independent pass. Anonymised for the public repo: people appear as roles,
prospects appear generically. The maintainer holds a named copy privately.

## 0. What this is, and what we ask you to take on

Over an extended session, the website session developed the ConfigHub Workshop
strategy with the maintainer; you reviewed it and gave sharp, correct feedback
(bound claims to evidence; separate demonstrated from proposed; keep hosting
apart from pricing). This document packages the whole of that analysis — the
plan docs, the decision log behind them, the entry-point and first-value
inventory, and the open decisions — so you can take it on.

**What to take on.** Given the entry-point inventory (section 4) and the open
decisions (section 5), take an independent pass and propose: the smallest first
delivery for **one** of the three testable experiences, the concrete build items
behind it, and how you would measure the trial. Keep the maintainer's decisions
open — catalogue options, do not pick the answer.

**Working agreements (both sessions).**
- **Present options, don't decide.** On strategy, positioning, and ladders,
  catalogue the options with sources; do not consolidate into one framing or
  pick the rung-1 / marketplace / experience answers for the maintainer.
- **Keep three buckets distinct:** demonstrated (evidence exists), product gap
  (to build), commercial hypothesis (to test). Bound every claim to its receipt.
- **No personal names in repo files** (the no-personal-names gate is live). The
  cohort is anonymised here; the maintainer holds a named copy off-repo.
- **Parallel work:** the website session is executing the AICR NVIDIA-catalog
  mirror (below) in parallel. Coordinate via issue #1757; do not duplicate it.

## 1. The package (supporting docs, all in this repo)

- [workshop-frictionless-entry-plan.md](./workshop-frictionless-entry-plan.md) —
  the umbrella. Config as data; Castle and Moat; the ten ladder framings as
  options (section 4); the pull-and-make flywheel; section 0a records the review
  and its demonstrated/gap/hypothesis discipline; section 13 lists the open
  decisions.
- [workshop-stories-entry-mid-keystone.md](./workshop-stories-entry-mid-keystone.md)
  — the per-band stories: the doctrine's worked examples (the assistant does the
  easy part, the gate does the safe part), the six personas' success signals,
  the app proofs, and the three cohort wins, evidence-bounded.
- [workshop-ai-api-plan.md](./workshop-ai-api-plan.md) — the AI-first API plan:
  the surface that exists today, the concrete gaps, the static-or-SaaS split, the
  foundation mapping, the developer's ladder, machine cards, and delivery options.

Held privately by the maintainer, not in the repo (real names and logos): an
SLT/VC one-pager, and named copies of the three docs above.

## 2. The mission and the SLT context

- **The mini-pivot (leadership, Sep 1).** The product lead's anchor: model
  weights just come from Hugging Face without anyone choosing it; configuration
  should work the same way. A hub where you say "I want this kind of system," get
  the pieces and templates, press a button, and it lands in your own org and sets
  up your clusters. Supply side: chart maintainers as marketplace participants.
  Differentiator: everything queryable, so placement is a query.
- **The frictionless-entry thread (leadership, Sep 8).** The theme was
  **usefulness before friction**: an individual will not adopt without an
  immediate problem solved better than their current tools. The meeting settled
  a framing (Castle and Moat; the maintainer's Castle = database and control
  plane, Moat = UI, catalogs, community tools) but **did not choose the entry
  problem**. The strongest connecting story was **individual-to-team**. A
  co-founder's standing challenge: config is not enough, there has to be code
  behind it.
- **Two doors.** The AI-led marketplace is the growth motion (developers,
  agents); control, governance, and compliance is the enterprise sale (a large
  bank wants control first; a regulated prospect's agreement stipulates genAI
  terms). Never lead with AI in a regulated-buyer room. A database company's
  product-led-growth motion is the model to study for the open door.
- **The cohort as first trial.** Three real design partners, one per band: a
  product owner at the entry, a platform-generator maintainer at the compose
  stage, and a large GPU-fleet operator at the keystone.

## 3. The decision log (the framing, developed and corrected turn by turn)

Load-bearing points the maintainer confirmed in discussion:

- **Config as data is the category.** Every format flattens to the same exact
  Kubernetes objects, in OCI, with a receipt. Never say the noun without the
  verbs. The four flattening verdicts are the honest boundary (what must stay
  code is labelled).
- **ConfigHub is the foundation.** Every marketplace verb maps to an existing
  primitive: fork → derived variant, build → stack + certify, the button →
  `cub fleet up`, a listing → a base variant or released OCI, placement → Where /
  labels / fleet. The new code is small and nameable: the composer, the
  publish-back loop, the placement-query surface, per-listing JSON.
- **The Workshop = catalog + tools + a frictionless doorway** into ConfigHub.
  The doorway is a reward, not a toll; `cub server` runs ConfigHub locally in
  about twenty seconds. The gate is a doorway, not a strict filter (gate ≠
  certify).
- **Independent axes.** Data locality (public static vs private per-org),
  execution locality (local `cub` / `cub server` vs hosted SaaS), and entitlement
  (free vs paid) are separate decisions. Private state does not by itself require
  paid SaaS.
- **MCP is distribution, not foundation.** The moat is the corpus and the certify
  gate, not the protocol. Hyperscaler cluster-MCPs (EKS/GKE/AKS) are a commodity
  we do not compete on. For a coding-agent user the skill plus `cub` plus the
  static catalog is already the interface.
- **People make more config with AI, not just pull it.** The flywheel: pull,
  make, keep, publish back. Where they make it — in ConfigHub, as certified data
  with lineage — is the point; made as loose files it is untrusted code.
- **Certification is a scoped claim.** Distinguish an advisory local check, a
  composition-certify verdict proved on named examples, and a revision-bound
  ConfigHub apply gate. "Nothing runs until certified" is the design intent of
  that gate, not a property flattening confers.
- **Individual-to-team is the strongest story.** Not a solo laptop developer:
  "I got something working; now I want to share it, adapt it for our environment,
  keep it, and come back to it."
- **"This" is the full range** (configs, charts, addons, apps, stacks,
  platforms). Helm is the first evidence-rich case, not the ceiling.
- **The SLT decision is one of three testable experiences** — adapt for our
  environment; create and share a working environment; assemble and manage a
  heterogeneous stack — plus the system size, proven with a measured trial.

## 4. Entry points and first steps to value (the inventory)

A catalogue of how a user can arrive and get first value, with whether the site
supports it today and the gap. It is not a choice; it is the map behind the
first-experience decision.

| # | Arrives with / wants | First step to value | Zero-install | Today | Gap |
|---|---|---|---|---|---|
| 1 | "I have a chart and values — is it right?" | browser check renders and inspects it | yes | shipped (`ask.html`) | not the hero; no agent-driven version |
| 2 | "What will this popular chart install, and what must exist first?" | search Catalog, open entry: objects, hooks, CRDs, receipt | yes | shipped (Catalog + chart pages) | no per-listing JSON for one-fetch agent answers |
| 3 | "I want a whole platform, not one config" | `cub stack sandbox eks-inference` → CERTIFIED, free | needs cub | shipped (Stacks) | no composer (goal → certified stack) |
| 4 | "I run AI on GPUs / need an inference platform" | inspect an AICR / NIM platform, no GPU | partial | shipped (`try-aicr`, 7 entries) | the 100% NVIDIA mirror (in flight); NIM discoverability |
| 5 | "I run Flux / Argo — give me a reviewed OCI" | pull a reviewed OCI by digest | needs cub | shipped (`deploy-with-flux-or-argo`) | solid |
| 6 | "I have a platform-generator platform" | `cub stack from-kubara .` → certify it | needs cub | shipped (generator page) | solid |
| 7 | "Promote / govern a reviewed config" | release, promote, gate, roll back | account | shipped (`Operate`) | mid/keystone, not a cold-entry first value |
| 8 | "My agent wants to use ConfigHub" | agent loads the skill / fetches `llms.txt` | yes | partial (contract + skill) | skill not ladder-aware; no per-listing JSON; no one-line pull; no MCP |
| 9 | "I got it working — now share/adapt/keep it with my team" | (no first-class flow) | needs cub | partial (`cub server` + upload exist) | no site flow for the individual-to-team story (the strongest one) |
| 10 | "Show a teammate a running tool, don't make them install it" | (nothing) | — | missing | the dev-environment-visibility idea, not built |
| 11 | "What do you even support?" | the formats-and-patterns panel | yes | shipped | done |

**What is really missing (the pattern across the gaps):**
1. The **zero-install first-value surface is thin** — only rows 1, 2, 11 give
   value with nothing installed; the frictionless "paste your config, see what it
   does" moment exists but is not the front door.
2. The **individual-to-team share/keep/adapt flow (row 9) has no entry point** —
   the strongest story, with no first-class site experience. Likely the biggest
   hole.
3. The **agent-first loop (row 8) is half-built** — the skill answers questions
   but does not guide install → doorway; no per-listing JSON; no one-line pull.
4. The **composer (row 3) and "show a running thing" (row 10) do not exist.**

Honest read: the site is strong at **inspect-or-pull-a-known-thing** and weak at
**make-something-then-share-and-keep-it-with-my-team** — exactly the experience
the leadership transcript pointed at.

## 5. Open decisions (maintainer / SLT only)

- **Which experience to prove first, and the system size** (adapt /
  create-and-share / assemble-and-manage; one chart, an app, a stack, a platform).
- **Which ladder framing leads** (the ten options in umbrella section 4).
- **What kind of marketplace** (self-certified catalog / many-vendor hub /
  hybrid).
- **MCP** (lead with it / distribution-only-later / skip it).
- **The composer's free and paid line** (open over the public catalog / learns
  from an org's derivation graph / both).
- **The two doors** — whether and how to say the AI-led and compliance stories
  publicly.

## 6. Shipped since your review (so you are current)

- **Site (website session):** the home hero explains config-as-data; the Catalog
  surfaces the trust case; Config gained an on-ramp and progressive disclosure;
  Stacks folded its two reference sections; Operate's header polished; and every
  supported format is now discoverable (a Format filter, a Catalog
  formats-and-patterns panel, and a home Supports strip).
- **Plans:** the three plan docs merged and were amended for your review
  feedback (the demonstrated/gap/hypothesis discipline, the three experiences,
  individual-to-team, "this" as the full range).
- **AICR (parallel, in flight):** we found that AICR is NVIDIA's own open recipe
  system (github.com/NVIDIA/aicr, Apache-2.0): 47 components and 119
  GPU×cloud×workload overlays. The website session is proving the single-entry
  ingestion on one overlay, then fanning out cheap agents to mirror the corpus
  (issue #1757, task in flight). Our catalog already certifies one of NVIDIA's
  overlays (`eks-inference`, 130 objects), so the count of 7 scales toward the
  full corpus by ingestion, not authoring.
