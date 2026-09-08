# The API for AI use cases

**Status:** companion to the Workshop plan. Anonymised for the public repo.
Where there is a real fork, the options are listed; the choice is the
maintainer's.

## 1. The premise: the user is AI-first

The people building AI systems increasingly work through agents, or drive them
all day. A developer in Claude Code does not open our website; their agent
fetches, runs, and reports. The doctrine already says it: the visitor's AI is a
seventh user, a first-class user rather than a feature. For this segment **the
agent interface is the product and the human page is the brochure.**

The agent is both the **maker** and the **buyer.** It searches for the right
configuration, forks a template, composes a stack from a goal, checks it,
certifies it, and keeps it. Every one of those is an API call or a command. So
"the site needs an API for AI use cases" is not a feature request; for this
user it is the whole product surface.

The guiding principle, from the working record of August: **an agent is correct
in proportion to how much of the system can describe itself to the agent, and
refuse the agent when it is wrong.** The catalog is the encoded expertise. The
records are the self-description. The composition verdict and the approval gate
are the refusal. Everything below is in service of those three.

The persona for this document is Dan: a developer at work who uses Claude Code
all day, starts from zero with nothing of ours installed, and has a real
question. Section 8 walks his ladder.

## 2. What the agent needs to do

Nine steps, from a goal to a governed system. The last column is where the
capability lives, and it is the architecture of the API.

| The agent needs to... | What answers it | Where it lives |
|---|---|---|
| **Discover** what fits (GPU, cloud, format, what it needs and provides) | search over machine-readable listings | the static hub |
| **Resolve** to exact versions and digests | canonical addressing: component, version, base, digest | the static hub |
| **Compose** a system from a goal | goal into a stack manifest (the composer) | local `cub` |
| **Validate** before anything runs | `cub stack certify`: CERTIFIED or REJECTED with reasons | local `cub` (the gate) |
| **Fork** for this environment | a derived variant with an upstream link | ConfigHub |
| **Place**: which of my clusters fits this? | placement as a query over the live fleet graph | ConfigHub SaaS |
| **Land** it (the button, many clusters) | `cub fleet up` | ConfigHub SaaS |
| **Operate** | release, promote, gate, roll back, watch drift | ConfigHub SaaS |
| **Prove** it to its operator | receipts, digests, evidence URLs | the static hub and SaaS |

Rows one and two are the hub: static, free, crawl-free. Rows three and four are
the gate: local, free. Rows five to nine are ConfigHub. **Rows four and six are
the ones no one else offers to an agent:** certification of a composition
before it runs, and placement across clouds as a query.

## 3. The surface that exists today

Shipped, not planned. All static files are served with CORS `*` and strong
ETags, which is what makes browser-side and agent-side consumption with zero
server egress possible.

| Surface | What it gives an agent | Status |
|---|---|---|
| `site/llms.txt` | the curated index of every machine and human surface, plus a **machine contract**: resolve the exact chart and version through `changes.json` and its `schema_version`; read coverage before citing a verdict, because missing coverage means not checked; use the canonical chart URL and cite the evidence URLs, because page copy is a guide and receipts hold the evidence; a breaking change uses a new major version; when an entry is absent, render locally and ask before filing a public issue | shipped |
| `site/catalog.json` | the machine-readable catalog: components, retained versions, packaged configurations, counts, `rendered_yaml_paths` and `rendered_yaml_sha256s` per base, the repo data paths they come from; `schema_version: "1"` | shipped |
| `site/changes.json` and `changes.schema.json` | the compact change feed: exact chart versions, aliases, package digests, declared coverage, canonical pages, evidence URLs; the versioned JSON Schema | shipped |
| `site/base-variant-records.json` | source-neutral records joining each maintained base to its exact source, objects, OCI package, prerequisites, lifecycle routes, policy, and evidence status | shipped |
| six record schemas | `review`, `workshop-result`, `workshop-ci-report`, `promotion-review`, `configuration-decision`, `changes`: the versioned shapes for a reviewed result, a CI report, a promotion comparison, and an accepted decision | shipped |
| `site/.well-known/agent-skills/config-workshop/SKILL.md` (v0.1.1) with `references/processing-model.md` and `references/task-playbook.md`, and `index.json` | an installable agent skill: four tasks (find a known answer, check my config, promote my config, keep the result); working rules (pin versions and digests, records over page copy, missing coverage is not checked, never print Secret values, preview before mutation); how to resolve, materialize, compare, and produce a reviewed result; the CI report | shipped |
| `site/ai.html` | the human and agent entry page | shipped |
| `docs/agent/` (README, tasks, recovery, verification, catalog, human-agent doctrine, terms) | in-repo agent instructions, linked from the site's Docs | shipped |
| the `cub` CLI and the workshop plugin | the action surface: check, compose, vary, render, publish, verify, certify, sandbox, upload, release, promote, fleet | shipped |

**What this already is:** a complete, read-only, static API plus a local
action surface plus a skill that teaches the agent to use both. For a coding
agent with a shell, fetching the corpus and running `cub` is the whole
search-fork-build-certify loop today, with no new server.

## 4. The gaps

Concrete, verified against the shipped files.

| Gap | Why it matters | What it blocks |
|---|---|---|
| **No per-listing JSON at predictable URLs.** Zero today; only the monolithic `catalog.json`, `changes.json`, and `base-variant-records.json`. | an agent must download the whole record set to answer one chart question, and cannot construct an address without crawling | rung 1 of Dan's ladder; every motion that starts from the catalog |
| **The skill is a task skill, not a ladder.** It does the four tasks well but does not route zero-install first, does not offer the one-line install of `cub` and the plugin as the escalation, does not teach the doorway (`cub server`, upload) or the ConfigHub verbs, and carries no rung structure or wins-as-prompts. | the agent cannot guide a zero-install user up the ladder; it assumes tools are present | rungs 2 to 4 of Dan's ladder; progressive disclosure |
| **No one-line pull.** There is no `cub stack pull <listing>@<digest> --into <org>` that pulls a certified system into an org in one command. | the `from_pretrained` moment for systems does not exist; pulling is several steps | the marketplace's "press a button" |
| **Placement as a query is not a product surface.** ConfigHub Where, labels, and triggers exist, but there is no agent-callable "which of my clusters fits this stack" call returning the fit, the plan, and the gaps. | the mission's stated differentiator is not exposed to the agent | the Place step; the paid edge |
| **No composer.** Nothing turns a goal into a candidate config, app, addon, or stack manifest, born as ConfigHub data. | the make half of the flywheel is manual | Compose; the generative hub |
| **No machine card per listing.** The fields exist in `base-variant-records.json` (needs, provides, verdict, receipt, constraints) but not as a first-class per-listing document. | agents decide fit from a card; today they parse a record set | Discover |
| **The read-only documentation MCP is deferred.** The plan says: do not add a public MCP command until a real endpoint exists and is maintained. | agents without a shell have no action surface | reach beyond coding agents |
| **The marketplace's discover and publish edges.** Three of five parts exist (variant is the listing, manifest is the template, `cub fleet up` is the button); discovery and vendor publishing do not. | the supply side is manual | the second ladder |

## 5. Static or SaaS: the split

Not a choice between them; a split along the boundary the doctrine already
enforces.

| Layer | What it holds | Why there | Examples |
|---|---|---|---|
| **Static, predictable URLs** (the Moat's read side) | the public, anonymous, read catalog: listings, machine cards, evidence, receipts, the skill | crawl-free, cacheable, CORS `*`, no auth, zero egress; the encoded expertise the hyperscaler cluster tools do not have; commodity-resistant because the value is the evidence, not the tool-calling | `llms.txt`, `catalog.json`, `changes.json`, per-listing JSON, `SKILL.md` |
| **Local `cub`** (the Moat's tools) | compose, check, certify, render, publish OCI | free, no account, private input stays local; the gate runs where the user is | `cub config check`, `cub stack certify`, `cub stack sandbox` |
| **ConfigHub SaaS** (the Castle) | per-org state: where a fork lands, placement over the live graph, release, promote, gate, roll back, fleet | placement is a query over *your* live fleet graph, which only ConfigHub holds; custody and governance are per-org and authenticated | `cub variant create`, `cub variant upload`, `cub release publish`, `cub fleet up`, Where and labels |

**The agent interface straddles the three:** read tools hit the static corpus;
build and certify run local `cub`; fork, place, and govern call ConfigHub. The
read/action line, the free/paid line, the static/SaaS line, and the
compose/certify line are the same line, and that line is the doorway.

**This also answers the standing objection that config is not enough and there
has to be code behind it.** Static is the acquisition layer; ConfigHub is the
monetisation layer; and the code behind it is the engine over config-as-data,
which has to be SaaS because it queries private, live, per-org state.

## 6. ConfigHub as the foundation: every motion maps to a primitive

The AI-led marketplace is a thin agent-facing façade over primitives that
already exist. Almost every motion has a ConfigHub home.

| Marketplace or AI-led motion | ConfigHub foundation | `cub` verb |
|---|---|---|
| **Search or find** the right config, addon, or stack | the public catalog for read; your components and Units for org state | browse the catalog; query Units |
| **Fork** a template or listing | a **derived variant** on a base, in a Space, upstream-linked | `cub variant create` |
| **Build or compose** a system from a goal | a **stack** (manifest) of components, then certify | `cub stack certify`, then `cub stack upload` |
| **A listing** (the marketplace item) | a **base variant**, or a released OCI | `cub variant upload`, `cub release publish` |
| **Publish** (a maintainer participates) | upload a base variant and release it as OCI | `cub config check --out oci://...`, `cub release publish` |
| **The button** (land in my org, many clusters) | Spaces, targets, fleet placement | `cub fleet up` |
| **Placement query** ("this cluster has the right GPU") | ConfigHub Where, labels, triggers over the live graph | where-clauses, `cub fleet status` |
| **Govern** | ConfigHub governance | release, promote, gate, roll back |

Two consequences. **The API layer builds almost no new backend:** it translates
a goal into these operations and lets the composition verdict refuse a bad one.
Fork is not a new object; it is a derived variant. Build is not a new object;
it is a stack plus certify. **And the delta is nameable:** the composer (goal
into a candidate), the marketplace's discover and publish edges, and richer
agent-facing read (per-listing JSON, machine cards).

## 7. The AI-first flywheel: what AI makes, and where

People, with their AI, will make more configs, apps, addons, and stacks. The
question is where. Made as loose files in a repo, AI output is untrusted code
with no lineage. Made in ConfigHub, it is data, certified, traceable,
governable, publishable.

| Someone, with AI, makes a... | It is, in ConfigHub | Born via | Hugging Face analogue |
|---|---|---|---|
| **config** | a base or derived variant | `cub variant create`, `cub config check` | fine-tune |
| **app** | a workload with its needs declared, placed on a stack | `cub app check` | |
| **addon** | a component composed into a stack | manifest edit, `cub stack certify` | adapter |
| **stack** | a stack manifest, a platform once governed | `cub stack certify`, `cub stack upload` | a new model |
| **...published back** | a listing: a base variant or released OCI | `cub variant upload`, `cub release publish`, `cub stack publish` | `push_to_hub` |

**Lineage is the trust feature of AI-made config.** Upstream links, digests,
and receipts answer where it came from, what changed, and whether it is safe.
**Config as data is what makes AI creation safe.** The AI writes data; the
engine certifies data; nothing runs until certified. If the AI wrote templates,
nothing could judge them without executing them.

## 8. Dan's ladder: progressive disclosure from inside the agent

The rule: the question determines the rung, the skill routes, and nothing is
gated behind an install or a sign-up when a lower rung can answer it. Every rung
delivers a win before the ask.

| Rung | Dan's Claude does | The win | What pulls him up | What we need |
|---|---|---|---|---|
| **0. Discovery** | asks a config question; Claude knows to look at us | a tested answer exists | a real question | be in the model's knowledge and the registries; `llms.txt` |
| **1. Public API, zero install** | fetches a predictable URL | a cited, exact answer about a tested chart (objects, hooks, CRDs, receipt), nothing installed, nothing signed up for | a chart we lack, or his own values | **per-listing JSON at predictable URLs** |
| **2. The skill** | loads `SKILL.md` | multi-step tasks done right (resolve, read coverage, cite); knows when to escalate | his question needs local computation | the skill as the ladder's controller; wins as prompts |
| **3. Install `cub` + the workshop** | one line, no account | exact answers about *his* config; CERTIFIED or REJECTED; a verified OCI his Flux or Argo can pull | he wants to keep, share, or place it | the skill's one-line install and escalation; "entry absent, render locally" as the on-ramp |
| **4. The doorway** | `cub server` in twenty seconds, then upload to his org | kept as data with lineage; vary, promote, place | the team, then the fleet | the skill teaches the doorway and the ConfigHub verbs |
| **5. Make more, publish back** | composes a variant, addon, or stack; certifies; publishes | his derivative is a listing others' agents pull | | the composer; the publish-back loop |

**Principles the ladder forces:** the skill is the protagonist for a Claude
Code user (it is the first thing to get, it knows the API, and it is the
progressive-disclosure controller); failure is the on-ramp (the machine
contract already says: when an entry is absent, render locally, which is rung
3); private input stays local through rung 3 and only rung 4 moves data, into
Dan's own org; the doorway is a reward, not a toll; instrument every rung (API
hits, skill installs, plugin installs, first certify, first `cub server`, first
upload, first release, first publish back).

## 9. Machine cards: the per-listing format

A proposal for the missing per-listing document, building on
`base-variant-records.json`. Every listing (a base variant, a stack) gets one
card at a predictable URL.

| Field | What it says | Source today |
|---|---|---|
| identity | component, version, base, digest, canonical URL | `changes.json`, records |
| what it needs | CRDs, Secrets, controllers, hardware (GPU class), cloud, namespaces that must exist | records: prerequisites, lifecycle requirements, target facts |
| what it provides | the objects, the services, the CRDs it installs | records: object inventory |
| verdict | flattening lane; certify result where it is a stack | records: flattening verdict; composition verdict |
| receipt | what was checked, what did not run, evidence URLs | receipts |
| placement constraints | plane, order, route intents, where it can and cannot land | records: routes; the manifest |
| lineage | upstream base, derived variants known, publisher | ConfigHub links; OCI provenance |

Agents read the card to decide fit; humans see it rendered as the listing page.

## 10. Delivery options

Listed as options. The considerations under each are the ones raised in the
record and in discussion.

**Option 1. Skill-first, no new server.** Make `SKILL.md` the ladder's
controller, ship per-listing JSON, and treat `cub` as the action surface.
Optimises for: the coding-agent user (Claude Code, Codex, Cursor), who already
has a shell and web fetch; zero hosting; plays to the moat (the corpus and the
gate) rather than the protocol. Leaves out: agents without a shell.

**Option 2. The static-plus-SaaS split with an org-scoped SaaS API.** Keep the
public catalog static; expose fork-into-org, placement-as-query, and govern as
ConfigHub's own authenticated API for agents. Optimises for: the paid edge; the
differentiator (placement by query) as a product surface; custody stays in
ConfigHub. Leaves out: nothing on the read side; it is the Castle's API.

**Option 3. MCP.** Three positions have been argued:
- (a) lead with an MCP server as the agent interface;
- (b) treat it as distribution, built later, exposing catalog, tools, and
  doorway, local for the free path and hosted and org-scoped for the SaaS path,
  listed in the registries for one-click install into Claude, Cursor, and Codex;
- (c) skip it: the skill plus `cub` plus the static catalog is the interface.
Considerations: for a be-the-default mission the channel into the agent
toolchain matters, the way `pip install transformers` did for Hugging Face; the
moat is what the tools expose, not the protocol; hyperscaler MCPs (EKS, GKE,
AKS, OpenShift) will own "operate my cluster," a layer the Workshop should not
compete on; the earlier plan says do not add a public MCP until a real endpoint
exists and is maintained; MCP is the only route to agents without a shell; a
protocol boundary can make the refusal structural (the agent cannot mutate
without passing the gate).

**Option 4. The one-line pull as the hero.** `cub stack pull
<listing>@<digest> --into <org> --where '<placement>'`: the `from_pretrained`
moment for systems, with certify in the path. Optimises for: the mission's
"press a button"; a single memorable surface. Leaves out: it presumes the
doorway and the org.

**Option 5. The refusal gate as the trust product.** Position certify not as a
check but as agent-safe infrastructure: let your agent build the system, and
the engine refuses the ones that will not hold together. Optimises for: a
CISO and platform-team sentence no one else can say; the AI-era argument for
the Castle. Leaves out: it is positioning, not a surface.

| Option | What it optimises for | Cost | Risk |
|---|---|---|---|
| 1 Skill-first | coding agents; zero hosting; the moat | low | no reach to non-shell agents |
| 2 Static + SaaS API | the paid edge; placement by query | medium (SaaS API design, auth for agents) | none on read; scope creep on write |
| 3a MCP first | toolchain distribution | high (build, host, version, secure) | competing on a commoditising protocol before the corpus is complete |
| 3b MCP later | distribution when the corpus is ready | medium | timing |
| 3c No MCP | simplicity | none | missing the registries and non-shell agents |
| 4 One-line pull | the mission's button | medium (a new verb) | presumes the doorway |
| 5 Refusal gate | positioning | none | claims must stay honest about limits |

Options 1, 2, 4, and 5 combine. Option 3 is the fork.

## 11. A proposed sequence, for decision

Steps that do not depend on the open decisions first.

1. **Per-listing JSON at predictable URLs.** Needed by every option.
2. **Machine cards** as the per-listing format (section 9).
3. **The skill as the ladder's controller** (zero-install first; one-line
   install as escalation; the doorway and the ConfigHub verbs; wins as prompts).
4. **Make the doorway frictionless and measure it** (`cub server`, one-command
   upload; time from a certified result to the first Space).
5. **Instrument the rungs.**
6. **Prove the loop on the cohort and on Dan** with fetch and `cub`, no new
   server.
7. **Decide option 3 (MCP) and option 4 (the one-line pull)**, then build what
   is chosen.
8. **Placement as a query** as an agent-callable surface (option 2).
9. **The composer**, born in ConfigHub, gated by certify. A basic composer over
   the public catalog; a composer that learns from an org's derivation graph as
   the Castle's edge.

## 12. Open decisions, with their options

- **MCP:** 3a, 3b, or 3c.
- **The hero surface:** the one-line pull, the skill, or the machine card.
- **Per-listing granularity:** one card per base variant, per version, or per
  component with versions inside.
- **How an agent authenticates at the doorway:** the user's `cub` login; a
  scoped agent token; the SaaS API's own auth.
- **The composer's free and paid line:** open over the public catalog; learning
  from an org's derivation graph; both.
- **Which ladder framing leads** (the umbrella plan, section 4), because it
  decides what the skill routes first.
