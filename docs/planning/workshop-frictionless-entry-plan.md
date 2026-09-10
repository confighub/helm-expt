# ConfigHub Workshop: a frictionless entry for individual developers

**Status:** consolidated draft for the maintainer. Supersedes and absorbs the
config-as-data draft. Anonymised for the public repo: people appear as roles,
prospects appear generically.

**How to read it.** Section 0a records a review of this plan and the discipline
it asks for: keep demonstrated capabilities, product gaps, and commercial
hypotheses distinct, and keep this proposed direction distinct from agreed
decisions. Sections 1 to 3 and 7 to 10 state what has been developed and
confirmed in discussion. Section 4 lists the ladder framings we have looked at,
as options, on their own terms; it does not choose among them. Section 13 lists
the open decisions with their options. Choosing is the maintainer's.

**Companion documents.** This plan is the umbrella; two companions carry the
detail it summarises.

- `workshop-stories-entry-mid-keystone.md`: the stories behind each band, told
  in full and anonymised. The doctrine's worked examples (the assistant does the
  easy part, the gate does the safe part), the six personas' success signals,
  the app proofs, and the three real wins, each mapped to its band and to the
  ladder options it exemplifies. Section 10 here is its summary.
- `workshop-ai-api-plan.md`: the API for AI use cases. The premise that the
  user is AI-first, the nine things an agent needs to do, the surface that
  exists today, the concrete gaps, the static-or-SaaS split, the foundation
  mapping, the flywheel, the developer's ladder in full, machine cards, and the delivery
  options with a proposed sequence. Sections 6 and 9 here are its summary.

## 0. The plan in one paragraph

The leadership team is exploring a frictionless entry point for individual
developers, to reduce sales friction and expand the user funnel. ConfigHub
Workshop is that entry point. It is the Moat around the ConfigHub Castle: a
catalog to pull certified configuration from, tools to make and check your own
with your AI, and a frictionless doorway into ConfigHub itself, where what you
made is kept, placed, and governed. Its position is config as data. Its growth
engine is a flywheel in which people pull, make, keep, and publish back. How the
climb through it is drawn has been proposed several ways over the months; this
plan lists those framings for decision.

## 0a. The review, and what it sharpened

A review of these documents (a second engineering session, and the fuller
transcript of the leadership meeting on 8 September) validated the direction and
asked for one discipline throughout: distinguish what is **demonstrated** from
what is a **product gap** from what is a **commercial hypothesis**, and
distinguish this **proposed direction** from **agreed decisions**. Nothing here
is an agreed decision unless it is marked as one. The leadership meeting settled
a framing (Castle and Moat, usefulness before friction); it did not choose the
entry problem.

**Demonstrated today, gap, or hypothesis.** Read every capability in this plan
through this lens.

| Demonstrated (evidence exists) | Product gap (still to build) | Commercial hypothesis (to test) |
|---|---|---|
| the read-only machine surface (`llms.txt`, `catalog.json`, records, schemas, the skill) | per-listing JSON and machine cards | that a frictionless individual entry expands the funnel |
| bounded composition certification (`eks-inference` certified, `metrics-double` refused) | the composer (goal into a candidate) | that keeping the result in ConfigHub solves the user's next problem |
| a demonstrated upgrade-and-rollback workflow, within its receipt's scope | the fleet-fit placement query | that maintainers will publish as marketplace participants |
| local checks and a revision-bound apply gate | automated publishing and the discovery edges | that a hosted service, not local ConfigHub, is where teams pay |

**The entry is not chosen.** The transcript's repeated conclusion was usefulness
before friction: an individual will not adopt ConfigHub without an immediate
problem it solves better than their current tools. It did not pick the Catalog,
or chart inspection, as that problem. Kubernetes is an implementation detail,
not necessarily the user's starting requirement.

**The strongest connecting story is individual-to-team.** Not a solo developer
on a laptop, but a person inside a team: "I got something working; now I want to
share it, adapt it for our environment, keep it, and come back to it." The
concrete win named in the room was showing someone an already-running tool
rather than asking them to install one. The individual-to-team transition, and
the production concerns it drags in (permissions, monitoring, resources, CRDs),
deserve more prominence than a solo-laptop framing.

**"This" is the full range.** Configs, charts, addons, apps, stacks, and
platforms, not just Helm charts. The entry question is "find or help me build
the right configuration or system for my goal; show me what it contains, what it
needs, what has been checked, and what remains uncertain." Helm is an
evidence-rich first case, not the product's ceiling, and the common machine
interface should be designed for the whole range.

**Three testable experiences frame the decision.** The review proposes choosing
the first user problem and system size to prove from three candidates, keeping
all three in the vision:

1. **Adapt something for our environment** — take a working configuration or
   system and make it fit here.
2. **Create and share a working environment** — stand something up and let a
   teammate see and reuse it.
3. **Assemble and manage a heterogeneous stack** — compose several parts and
   operate them together.

Choose one to demonstrate with real users, from first request through a useful,
retained result, and measure whether they reach a useful decision and whether
keeping it in ConfigHub solves their next problem. Section 13 carries this as an
open decision.

**Workshop is a path into the core, not the platform.** The Castle is a narrow
ConfigHub core (the database and control plane) with catalogs, tools, examples,
and a possibly pluggable UI around it. The Workshop demonstrates a useful path
into that core; it does not try to become the whole platform product.

**Hosting and pricing are separate from governance.** Authenticated governance
can run locally (`cub server`) or in a hosted service; its value does not
inherently require SaaS. Keep deployment (hosted or self-hosted) and entitlement
(free or paid) independent of the read/action boundary.

## 1. Why now: the leadership thread and the mission

**The leadership meeting on Sep 8** explored "creating a frictionless entry
point for individual developers to reduce sales friction and expand the user
funnel." Four things from that discussion shape this plan.

- **The co-founder's test.** Non-enterprise users will not adopt ConfigHub
  "without a clear, immediate problem-solving use case." Whatever the first
  rung is, it has to solve a real, frequent problem before anything is asked of
  the user. Which problem that is remains a decision (section 13).
- **Castle and Moat.** The maintainer defined the Castle as the database and
  control plane, and the Moat as the UI, the catalogs, and the community-facing
  tools. In this plan: **the Castle is ConfigHub itself; the Moat is the
  Workshop.** The moat leads to the castle gate.
- **A second candidate entry.** The product lead proposed that ConfigHub could
  give developers visibility into local and cloud-hosted dev environments for
  shared debugging. This is a different immediate problem from the configuration
  catalog, and it is listed as an option in section 4.
- **The keystone confirmed.** Heterogeneous deployments and complex GPU-based
  stacks were named as the areas of highest enterprise frustration and
  opportunity.

Two market signals from the same meeting: a database company's enterprise
product-led-growth strategy, which prefers frictionless trials to sales cycles,
is the model to study (with the open question of which frictionless strategies
do not depend on open source); and a compliance-tooling partner reported that
compliance, not AI, is the primary enterprise driver for combining their tool
with ConfigHub at a GPU vendor.

**The leadership meeting on Sep 1** set the mission the entry point serves. The
product lead's anchor: model weights just come from Hugging Face without anyone
choosing it, and configuration should work the same way. Runnable systems, not
weights. A hub where you say "I want this kind of system," get the pieces and
templates, press a button, and it lands in your own org and sets up your
clusters, with everything flowing from the catalog. Its supply side is chart
maintainers as marketplace participants. Its technical differentiator is that
everything is queryable, so placement is a query: put this here because this
cluster has the right GPU.

Hugging Face's hub grew because people made things on it: pull a base, fine-tune
it, push the derivative back. So the mission has two halves in one flywheel:
people **pull** certified systems from ConfigHub, and people, with their AI,
**make** new configs, apps, addons, and stacks on ConfigHub, so what they make is
data, certified, traceable, and pullable by the next person. The name already
says it. ConfigHub **Workshop**: the hub you pull from, the workshop you make in.

**Two doors, one product.** The same meeting notes record that a large bank
wants control adherence and change management ahead of aggressive AI adoption,
so the team will lead there with a general product introduction rather than an
AI pitch; and that a regulated prospect's agreement now carries stipulations on
generative AI in delivery. Meanwhile the mission is AI-led. These reconcile
because the doors differ. **The AI-led marketplace is the Moat's growth motion,
for developers and their agents. The Castle sells control, governance, and
compliance, to regulated buyers.** The plan says this out loud so the AI story
never leads in a regulated-buyer room.

## 2. The position: config as data

Every format the Workshop takes in (Helm, AICR, Kubara, Timoni, plain YAML, OCI)
flattens into one shape: the exact Kubernetes objects, as data, carried in OCI
with a receipt. The source is a producer. The output is data. "Config as data"
names that and makes it a category.

- **It counter-positions Infrastructure-as-Code.** IaC made infrastructure
  programmable, and opaque: you cannot query a template, diff it, or know what
  it does without running it. Data you can. *IaC made infrastructure
  programmable. Config as data makes it provable.*
- **It restores what Kubernetes intended.** The Kubernetes API is declarative
  data. Templating and patching turned it back into code. The Workshop flattens
  it back to data, now with provenance, variants, and certification.
- **It completes the Hugging Face analogy.** Hugging Face is models as data.
  Config as data is the same move for systems.

**The rule:** never the noun without the verbs. "Config as data" alone is a data
lake. "Config as data, so you can certify, place, and govern it" is a product.

**The honest boundary makes it credible.** The four flattening verdicts are a
config-as-data maturity scale, and the Workshop says where config must stay code.

| Verdict | Meaning |
|---|---|
| `born-flattened` | already data: plain YAML, literal OCI |
| `safe-to-flatten` | code that fully reduces to data |
| `flatten-with-routes` | data, plus declared lifecycle work that travels beside it |
| `unsafe-to-flatten` | must stay code (live lookups, generated state); said plainly and routed late |

## 3. Castle and Moat: what the Workshop is

```
   THE MOAT: ConfigHub Workshop (open, free, no account)
   ┌──────────────────────────────────────────────────────────┐
   │   CATALOG            TOOLS                DOORWAY        │        THE CASTLE
   │   pull certified  →  make and check   →   walk into   ───┼─→     ConfigHub itself
   │   config-as-data     with cub:            ConfigHub       │       the database and
   │                      compose, vary,       cub server,     │       control plane:
   │                      render, publish,     upload,         │       custody, variants,
   │                      certify              your org        │       placement, govern
   └──────────────────────────────────────────────────────────┘
```

**Catalog.** The open store of certified config-as-data: exact objects in OCI
with a verdict and a receipt, 139 retained package versions across 112
components today. Where you pull from. Free, no account, crawl-free for agents.

**Tools.** The `cub` workshop plugin: check, compose, vary, render, publish,
verify, certify. Where you make things, with your AI. Free, local, no account.
Certify lives here; it is a check you run, and you can run it all day without
touching ConfigHub. The AI composer lives here too.

**Doorway.** The on-ramp into ConfigHub itself. A ramp, not a wall, whose first
step needs no account: `cub server` runs ConfigHub locally in about twenty
seconds (the product lead's framing: like GitHub and the `gh` CLI, a stepping
stone); `cub variant upload` and `cub stack upload` move what you made into a
Space in your org; the org is where it becomes shared, placed, and governed.
**The design goal at the doorway is frictionless entry, not strictness.** Upload
runs certify first as a safety behaviour, but that is what upload does, not what
the doorway is.

**The Castle.** ConfigHub itself: the database and the engine over
config-as-data (section 7).

## 4. The ladder: the options we have looked at

Over the months the climb has been drawn several ways. This section lists them
as options, each on its own terms, with its source, what it optimises for, and
what it leaves out. It does not pick one. Which framing leads, and whether
several combine, is the maintainer's decision (section 13).

**Option 1. The verb ladder, on the spine.**
Source: `docs/planning/ladder-on-spine.md`, `docs/planning/cub-noun-vocabulary.md`.
Rungs: free `check` and `deploy`; account `upload`, `release`, `promote`; paid
`govern`; with `stack certify` and `sandbox` as the composition rung. The finding
that produced it: the site jumped from check to promote and skipped the middle;
`upload` and `release` had no first-class page.
Optimises for: one `cub` verb per commercial tier; the site's spine; "read it as
a ladder."
Leaves out: who the user is and how they arrive.

**Option 2. The adoption bands: entry, spine, keystone.**
Source: `docs/planning/demand-to-verbs.md`; the website ladder review of Sep 1.
Rungs: entry (the three questions: I need a configuration; I have one, is it
right; I have an accepted one, can I promote it), spine (mid), keystone (the
platform; Kubara). The funnel is measured: of forty sampled demand questions,
nineteen are answered at the entry, fourteen on the spine, seven at the
keystone. The build order follows the counts: `cub check` and `cub app` first,
`cub stack` as the altitude jump.
Optimises for: demand-driven build order; personas mapped to bands.
Leaves out: a single user's step-by-step path.

**Option 3. The product lead's funnel.**
Source: product and leadership discussions, late August.
Rungs: free, account, paid. "Check my config" as the primary call to action.
`cub server` as the stepping stone into the account path, "like GitHub and the
`gh` CLI," a twenty-second exercise to run ConfigHub locally.
Optimises for: conversion at the front door; the individual-to-org transition.
Leaves out: what happens above the account.

**Option 4. The marketplace ladder: the mini-pivot.**
Source: leadership meeting Sep 1.
Rungs: go to the hub; say "I want this kind of system"; get the pieces,
templates, and scaffolding; press a button; it lands in your own org and sets
up around ten clusters; everything flows from the catalog. A supply side where
chart maintainers participate: push a chart, do the steps, and it is ready for
the people building AI systems. Differentiator: everything queryable, so
placement is a query.
Optimises for: the destination state and the vision; a hub that grows.
Leaves out or leaves open: the co-founder's "config is not enough, there has to
be code behind it"; what kind of marketplace (section 13). Three of its five
parts exist today: the variant is the listing, the stack manifest is the system
template, `cub fleet up` is the button.

**Option 5. The Workshop columns.**
Source: this week's discussion with the maintainer.
Rungs, as columns: catalog, tools, frictionless doorway, then the Castle
(section 3).
Optimises for: the structure of the open product and the boundary to the paid
one; the Castle and Moat framing.
Leaves out: it is a product architecture, not one user's journey.

**Option 6. The developer's agent rungs.**
Source: the maintainer, this week. The developer is a persona: someone who uses Claude
Code all day and starts from zero.
Rungs: hit a public API (nothing installed); use a skill to make `cub` and
ConfigHub calls; this encourages or eventually requires installing `cub` and the
workshop plugin; then the doorway; then make and publish. Progressive
disclosure with a win at every rung, from inside the agent.
Optimises for: the agent-first individual developer's first touch.
Depends on: per-listing JSON at predictable URLs (today there is none, only the
monolithic record set); a ladder-aware skill (today's skill covers the four
tasks but does not route zero-install first, offer the one-line install, or
teach the doorway).
Leaves out: agents without a shell.

**Option 7. The flywheel: pull, make, keep, publish back.**
Source: this week; Hugging Face's pull, fine-tune, `push_to_hub`.
Shape: a loop rather than a ladder. Pull a certified system; make a derivative
with your AI (fork is a variant, addon is a component, a new stack is a
manifest); walk it through the door; publish it back as a listing.
Optimises for: the growth mechanism; creation as the lever; derivatives
compounding the data.
Leaves out: a single user's ordered steps.

**Option 8. The scale ladder: individual, team, fleet.**
Source: recurring across discussions.
Rungs: individual (free), team (account), fleet (paid).
Optimises for: the org-scale reading of the commercial tiers.
Leaves out: the product steps inside each scale.

**Option 9. The website ladder.**
Source: the website ladder review of Sep 1.
Rungs tied to where they live on the site. Entry: see what a chart installs in
the browser with no login (Check my config); certify and render a whole
platform for free (the ladder terminal, `cub stack sandbox`). Mid: land
CI-rendered YAML as governed data (the CI-rendered catalog journey); promote
through an approval gate that refuses first (the operator ladder). Keystone:
build a platform and run apps through it (Kubara, recorded live); speak a
platform as one certified stack (the stack manifest spec and receipts);
generate and read a governed fleet from manifests (starting question six).
Optimises for: the site delivering each rung with a page.
Leaves out: anything not on the site.

**Option 10. The dev-environment visibility entry.**
Source: leadership meeting Sep 8, the product lead.
Shape: a different first rung. ConfigHub gives developers visibility into local
and cloud-hosted dev environments, to make shared debugging possible.
Optimises for: an immediate individual-developer problem, in the sense of the
co-founder's test, that is not tied to the configuration catalog.
Leaves out or leaves open: a different first user and product surface; not
built; its relationship to the catalog entry.

**How they relate, descriptively.** Options 1, 3, and 8 all use the free,
account, paid tiers. Options 2 and 9 both use entry, spine (mid), keystone.
Options 5 and 6 are this week's product-shape and agent-first views. Option 7
is a loop rather than a line. Options 4 and 10 are both the product lead's: one
the destination, one an alternative first step. None of this settles which
leads.

## 5. The supply side, as it follows from the marketplace option

If the marketplace framing (option 4) leads, the demand climb ends by feeding a
supply climb. This is an elaboration for the maintainer to accept, adjust, or
drop.

| Step | What a maintainer does | What they get |
|---|---|---|
| **Publish once** | a one-time install (a workflow file or an agent skill) so their own CI runs `cub config check --out oci://...` on every release | a certified listing, refreshed automatically; no ongoing labour |
| **Become a listing** | the base variant, with its verdict, receipt, and system card, appears in the catalog | reach to every developer and agent that pulls from the hub |
| **Be composed** | others fork it (a derived variant), add it to stacks (an addon), or build platforms on it | distribution through the derivation graph |
| **Receive derivatives** | derivatives are published back with lineage to the maintainer's base | a record of how their configuration is used and adapted |

The product lead's phrase, "push your chart and it becomes ready for the people
building AI systems," would then be one workflow file. Certification would be
the value offered to a vendor.

## 6. The developer's first touch: the agent-first view

The developer here is a persona, not a person: someone at work who uses Claude
Code all day, starting from zero with a real question. This is an individual
**working within a team**, not a solo developer on a laptop, and the strongest
version of the story is the individual-to-team transition (section 0a): "I got
something working; now I want to share it, adapt it for our environment, keep
it, and come back to it." The rungs below are the agent-first path from that
first working result toward sharing it, and they drag in the production concerns
a team brings, permissions, monitoring, resources, and CRDs, as the reason to
keep the result in ConfigHub. From inside Claude Code they reach everything
ConfigHub can do, one win per rung. Mapped to the Workshop columns (option 5):

| Agent rung | The developer's Claude does | Workshop column | What we need |
|---|---|---|---|
| **1. Public API** | fetches a predictable URL | Catalog | **per-listing JSON at predictable URLs**; today there is none, only the monolithic record set |
| **2. The skill** | loads `SKILL.md` and does multi-step tasks right | Catalog, Tools | the skill as the progressive-disclosure controller: it routes rungs and carries the wins as prompts |
| **3. Install** | one line, no account | Tools | the skill's one-line install and escalation |
| **4. Doorway** | `cub server`, then upload | Doorway, Castle | the skill teaches the doorway and the ConfigHub verbs |
| **5. Make** | composes, certifies, publishes | Tools, Catalog | the composer; the publish-back loop |

Principles that came up in shaping this view, for the maintainer to keep or
change: the question determines the rung and the skill routes; every rung
delivers a win before the ask; when the catalog has no entry, "render it
locally" is the on-ramp to the tools (the machine contract already says so);
private input stays local until the user chooses to upload, and then only into
their own org; the doorway is a reward rather than a toll; instrument every rung.

The shipped skill (v0.1.1) covers the four tasks, resolving through the records,
materialize and compare and check, the reviewed result, and CI. It does not yet
route zero-install first, offer the one-line install of `cub` and the plugin as
the escalation, teach the doorway or the ConfigHub verbs, or carry a rung
structure.

## 7. The engine: the code behind it (the Castle)

The co-founder's standing objection: config is not enough, there has to be code
behind it. As a critique of "config as data," it lands. Data alone is inert.

The resolution is the database. Nobody won on "your data, stored." They won on
the engine, and the engine was only possible because the data had a schema.
Config as data is the schema. ConfigHub is the database and the engine. None of
these verbs can be written over code; every one needs the data form first.

| Engine | What it does over config-as-data | Status |
|---|---|---|
| **Flatten** | per-format materializers: source into exact objects | exists (the catalog) |
| **Certify** | the composition verdict: do these objects hold together? | exists (the plugin) |
| **Query and place** | which of my clusters fits, over the live graph | primitives exist (ConfigHub Where, labels, fleet); the agent-callable fit-query surface is a gap (see the API plan) |
| **Vary, promote, diff** | derived variants, promotion, semantic compare | exists (ConfigHub) |
| **Govern** | release, rollback, drift, gates | exists (ConfigHub) |
| **Compose** | a goal into a certified config, app, addon, or stack | **the new code** |

Five of six exist. The composer, with the publish-back loop, is the new engine,
the one that makes the hub generative, and the one nobody else has, because
nobody else has the data form to certify against or the lineage model to
publish into.

## 8. The flywheel: pull, make, keep, publish back

Hugging Face's loop is pull, fine-tune, `push_to_hub`. Ours, on ConfigHub
primitives, is pull, make, walk through the door, publish back. Everything AI
makes is an existing primitive; no new objects.

| Someone, with AI, makes a... | It is, in ConfigHub | Born via | Hugging Face analogue |
|---|---|---|---|
| **config** | a base or derived variant | `cub variant create`, `cub config check` | fine-tune |
| **app** | a workload with its needs declared, placed on a stack | `cub app check` | |
| **addon** | a component composed into a stack | manifest edit, `cub stack certify` | adapter |
| **stack** | a stack manifest, a platform once governed | `cub stack certify`, `cub stack upload` | a new model |
| **...published back** | a listing: a base variant or released OCI | `cub variant upload`, `cub release publish`, `cub stack publish` | `push_to_hub` |

- **The hub becomes generative.** The catalog grows because users' AIs make
  derivatives and publish them back, certified by the engine.
- **Creation is a growth lever.** Pulling curated stacks is bounded. Making a
  variant or addon for my case is unbounded. Creation is where AI is
  transformative and where trust breaks; the Workshop sits at that intersection.
- **Lineage is the trust feature of AI-made config.** Upstream links, digests,
  and receipts answer where it came from, what changed, and whether it is safe.
- **Config as data is what makes AI creation checkable.** The AI writes data,
  which the engine can read and refuse rather than having to run to understand.
  That is the bounded claim, not a universal guarantee: an advisory local check,
  a composition-certify verdict proved on specific examples, and a
  revision-bound ConfigHub apply gate are three distinct things (the API plan,
  section 7, states each with its scope). "Nothing runs until certified" is the
  design intent of that apply gate, not a property flattening confers on its own.
- **Where AI makes things is the whole point.** Made as loose files, AI output
  is untrusted code with no lineage. Made in ConfigHub, it is data, certified,
  traceable, governable, publishable.

## 9. The agent interface and the API

For the segment building AI systems, the agent interface is the product and the
human UI is the brochure. The interface is the Workshop's own shape:

- **Catalog:** static read at predictable URLs, crawl-free, no auth. Per-listing
  machine cards (what it needs, provides, its verdict, receipt, placement
  constraints), the canonical digest address, and the machine contract: resolve
  the exact version, read coverage before citing a verdict, cite the evidence.
  Largely shipped (`llms.txt`, `catalog.json`, `base-variant-records.json`, the
  schemas, the skill). Missing: per-listing JSON.
- **Tools:** the local `cub` CLI. Coding agents have a shell. Fetching the corpus
  plus `cub stack certify` plus `cub variant create` is the whole loop today.
- **Doorway:** the org and auth handoff, the protocol boundary.

**The one-line pull,** the `from_pretrained` moment for systems, as a candidate
hero:

```bash
# I want an inference platform with H100s, in my org
cub stack pull confighub/inference-platform@sha256:... --into my-org --where 'gpu=h100 and region=eu'
```

**On MCP,** the positions we have looked at are listed in section 13. The
considerations: it is how configuration comes to "just come from" us inside the
agent toolchain, one-click into Claude, Cursor, and Codex, so for a
be-the-default mission the channel matters; the moat is what the tools expose,
not the protocol; hyperscaler MCPs will own "operate my cluster," a layer the
Workshop does not compete on; for a Claude Code user the skill already
distributes the same capability.

## 10. Proof: the cohort at each band

The first real cohort of three, as the research mapped them onto the
entry/spine/keystone framing (option 2) and the Workshop columns (option 5).

| Role | Band | Column | The win |
|---|---|---|---|
| **The product lead** | entry | Catalog, Tools | owns the free-to-account-to-paid funnel; "Check my config" as the primary call to action; `cub server` as the twenty-second on-ramp |
| **A founding maintainer of a platform generator** | mid, rising to keystone | Tools, Doorway | external validation from the generator's author; the co-marketing post on a small internal platform built with the generator and ConfigHub; the catalog as the generator's external upstream |
| **An operator of a large GPU inference fleet** | keystone | Castle | seven "cluster in a box" requirements scored honestly as now, path, or not yet; the H100 inference run as the single buyable proof; trust earned at the entry (blocked versus failed, honest rollback limits) and spent at the keystone |

The audit line that ties them together: the site jumped from check to promote
and skipped the middle; upload and release had no first-class page, the stack
rung was a report rather than a step, and there was no inference-shaped spine.

## 11. A proposed sequence, for decision

The review asks for a **narrower first delivery and a measured user trial**:
choose one of the three experiences (section 0a), demonstrate it with real users
from first request through a useful, retained result, and measure whether they
reach a useful decision and whether keeping it in ConfigHub solves their next
problem. The steps below serve that, with the ones that do not depend on the
open decisions first.

1. **Ship per-listing JSON at predictable URLs,** so an agent can construct the
   address without crawling. Needed by every option that starts from the
   catalog.
2. **Make the doorway frictionless and measure it.** `cub server`, one-command
   upload, land in your org. Measure the time from a certified result to the
   first Space. Needed by options 3, 5, and 6.
3. **Choose one experience to prove, and its system size** (section 13), then
   make that first experience real and update the skill to route it. Run it as a
   measured trial with real users, not a broad build.
4. **Instrument the rungs.** API hits, skill installs, plugin installs, first
   certify, first `cub server`, first upload, first release, first publish back.
5. **Prove the chosen first rung on the cohort and on the developer's ladder** with fetch and
   `cub`, no new server.
6. **Distribute into the toolchain** in whatever form section 13 decides.
7. **Automate the supply side,** if the marketplace option leads.
8. **Lead the Castle's API with placement as a query.** `cub place <stack>
   --where 'gpu=h100'` returns the clusters that fit, the plan, and the gaps.
9. **Build the composer.** A goal into a certified config, app, addon, or stack,
   born in ConfigHub.

## 12. What is already proven (for the pitch)

- **The catalog:** 139 retained package versions across 112 components, each an
  OCI image of exact objects with a receipt; upstream-republish cases caught and
  recorded.
- **Config as data, with its honest boundary:** every base carries a flattening
  verdict; the four lanes and their counts are published.
- **Certify:** real stacks certified and refused with reasons. `eks-inference`
  certified at 130 objects across eight bundles; `metrics-double` refused for
  nine objects claimed twice. A full inference platform sandboxed for free.
- **The Castle:** variants with upstream links, promotion, release by digest,
  rollback across two clusters, placement over the fleet graph.
- **The doorway:** `cub server` running ConfigHub locally in about twenty
  seconds; `cub stack upload` landing a certified stack as Spaces and links.
- **The cohort:** three real roles at the three bands, each with a recorded win.
- **The machine surface:** `llms.txt`, the JSON records and schemas, a published
  agent skill.

## 13. Open decisions, with their options

**Which ladder framing leads, and which combine.** The ten options in section 4.

**The first experience to prove, and the system size** (the co-founder's
usefulness-before-friction test; see section 0a). The review frames this as
three testable experiences, all kept in the vision, one chosen to demonstrate
with real users end to end and measure:
- (i) **adapt something for our environment** — make a working configuration or
  system fit here;
- (ii) **create and share a working environment** — stand something up and let a
  teammate see and reuse it (the concrete win: show an already-running tool
  rather than ask someone to install one);
- (iii) **assemble and manage a heterogeneous stack** — compose several parts
  and operate them together.

The system size is a paired decision: one chart, an existing application, a
stack, or a whole platform. "This" spans that whole range; Helm is an
evidence-rich first case, not the ceiling.

Earlier candidate framings of the first problem, still on the table and each
mappable into one of the three experiences: the most-asked configuration
question, "what will this install, and what must already exist?", answered in
one fetch with nothing installed; the product lead's dev-environment visibility
for shared debugging (option 10, an instance of experience ii); "is my
configuration right?" and "why did Helm ignore my values?", the browser check
with the user's own chart and values; and certify and render a whole platform
for free with `cub stack sandbox` (an instance of experience iii).

**What kind of marketplace.** Options:
- (a) the catalog we certify ourselves, as today;
- (b) a public hub of certified systems from many vendors, with curation,
  liability, and trust to design;
- (c) a hybrid: vendor-published, ConfigHub-certified.
The leadership vision leans to (b) or (c); what exists is (a). This is the "more
meat" the pitch has been asked for.

**MCP.** Options:
- (a) lead with an MCP server as the agent interface;
- (b) treat it as distribution only, built later to expose catalog, tools, and
  doorway, local for the free path and org-scoped for the SaaS path;
- (c) skip it; the skill plus `cub` plus the static catalog is the interface.

**The composer's free and paid line.** Options: an open composer over the public
catalog; a composer that learns from an org's derivation graph as the Castle's
edge; both, split by data source.

**The two doors, held deliberately.** The AI-led story as the Moat's growth
motion; control, change management, and compliance as the Castle's sale to
regulated buyers, one of whose agreements now constrains generative AI in
delivery. Whether and how to say this publicly.

**Timing.** Autonomous agents composing whole systems is early. The hedge on the
table: the same surface serves human-driven agents today and autonomous ones
later, built once.

**"There has to be code behind it."** The answer on the table: the engine over
config-as-data, five of six parts built; the composer and the publish-back loop
are the new code.

## 14. The line

Config as data, open. The Workshop is the moat: a catalog to pull from, tools to
make with, and a frictionless doorway into the ConfigHub castle, where what you
made with your AI is kept, placed, and governed. Configuration comes from
ConfigHub because it is made in the Workshop and walks through the door.
