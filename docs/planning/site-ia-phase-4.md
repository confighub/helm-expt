# Site IA, phase 4: a flat Catalog for agents and humans

Phase 2 settled one page per concept and the five sections Catalog, Config,
Stacks, Operate and Docs. Phase 3 set the rules for the words and wayfinding on
the pages a reader lands on. Phase 4 changes the structure again, on the
maintainer's decisions of 27 September 2026. The site becomes a flat list of
what the Catalog holds, section by section, and the explanation moves into
Guides and Docs.

This document is the plan. Nothing in it is built until the maintainer
approves it.

## The decisions

The maintainer made these decisions on 27 September 2026.

1. **The structure is much flatter.** The site is a list of the things in the
   Catalog, section by section. It includes every ConfigHub plugin, and more
   will be added, and the example apps. The more complex material goes into
   Guides or Docs, many of which are two or three layers deep.
2. **Everything serves agents and humans, and agents come first.** Every tool
   and every part of the site is agentic first and agent led. Humans get two
   things of their own: a small area of marketing pages, and short human docs
   written in Simplified Technical English (STE).
3. **The Catalog sections are the top navigation.** The bar reads Configs,
   Stacks, Apps, Plugins, Guides and Docs, with the ConfigHub Server button.
4. **The Plugins list shows every public plugin, marked by its state.**
   ConfigHub Enterprise is left out.
5. **This plan comes first.** The build starts once it is approved.

The product these sections describe is summarised in "ConfigHub Workshop:
mission, purpose and value" (27 September 2026). In short, the Workshop lets
an AI get Kubernetes configuration right on a person's behalf. The Catalog
holds checked Configs for standard and custom patterns, worked Example Apps,
config Stacks, Plugins for easy setup in ConfigHub, and how-to Guides.

## Why the site exists

Every section in this plan answers to this purpose. The maintainer's words are
quoted with their dates.

**It started with Helm pain.** "In May we wanted also to make helm pain go
away" (18 September). We did not make it go away. We made it visible and
checkable, and we removed some of it by rendering once and shipping the exact
objects, so no template reaches the cluster.

**It grew beyond Helm.** "In last few weeks we expanded potential patterns to
think about flux, argo, kubara, stacks" (18 September). The question grew from
"what does this chart do?" to "what happens to it when you deliver it your
way?" One common core makes that possible: "the OCI+flattening standard core
matters so that AICR, Helm, Timoni can get a mostly uniform operational
treatment" (18 September).

**The user starts small, with an agent.** "Almost all users will start with one
app, one chart, one bit of AI vibe coding. They will be 'in claude code' or
have it nearby" (17 September). Each step must be "compelling at each step and
each scale. No 'tiers'." And: "We can't always force connect to CH server, and
should not try."

**The AI does the work.** "The ai has to own the pain on behalf of the user"
(18 September). Humans read the site for "high level principles and rules, not
all the machinery and details."

**The Catalog gives agents what other catalogs do not.** "Other catalogs provide
ready to use charts, and we do this too, but our main focus is to provide your
agents with the correct data and values so that a wide range of charts and
stacks can be created and verified automatically" (18 September).

**The outcome is a platform on request.** "Being able to say I want a heroku
style app platform with redis, prometh, loki, ... and it just appears as a
kubara stack for the ai" (18 September). "I definitely want users to ask the AI
for a platform, and for cub to be able to provide this in various ways"
(19 September). "We do not want to be 'in kubara's lane'" (19 September).

**Plain configuration is rarely enough.** An Argo CD hardening article showed
that "vanilla config is not enough", and that several base variants are needed
for different assumptions (25 September). That led to the super-mission, "the
hugging face of config": configs, OCI, stacks, example apps and how-to guides,
plus an "Agentic Catalog", with "as data", ConfigHub and graph or context in
the mission (27 September).

The backend stream's mission statement of 23 September fits these points.
"Help someone get consequential configuration work done… Start with their
configuration and their problem. AI investigates and proposes; `cub` performs
repeatable operations; checks establish what is supported; the person makes
meaningful decisions." Its progression runs from "help me with this" to a
checked result, then keep and change it, then manage it with ConfigHub, then
larger apps, platforms and fleets.

## The rules for agents

The story began as "catch the AI", with a person checking the assistant. It
became "the AI owns the pain". Four rules follow, and every section and Guide
keeps them.

1. **The agent proposes, and a check decides.** A check, not the agent, decides
   whether a result is right. "Refuse with options" is a normal outcome, and
   `cub` offers the options. If the user wants the AI to choose, the AI does
   that on top.
2. **People and agents run the same `cub`.** "humans can use cub or AIs can use
   cub or both can." The two prompts and the skill exist so that any agent can
   find the Workshop.
3. **ConfigHub holds shared state.** Once many agents or people act on a
   configuration, ConfigHub keeps it. Swarm write concurrency "isn't solved by
   this, but by confighub server" (19 September).
4. **Nothing adds friction for its own sake.** Using the Workshop from an agent
   must be "easy, frictionless, normal" (13 September). No page forces an
   account, and no gate exists to slow the agent down.

## The journey, section by section

The sections are not a funnel, but the journey passes through them in order.

| Stage | What happens | Where the site serves it |
| --- | --- | --- |
| The initial user | A developer in Claude Code has a chart that does not do what they want, an app the assistant wrote, or a worrying upgrade. | The home page, the two prompts and the skill |
| The entry | The agent answers from the Catalog, then runs `cub` on the user's own files and shows a checked result. No account is needed. | **Configs**, **Guides** (Start here, Helm questions, Formats, GitOps) |
| Into ConfigHub | The second change: fixes that must survive the assistant, a teammate who wants the working setup, several agents on one configuration. | **Guides** (ConfigHub), **Plugins**, the ConfigHub Server page |
| The keystone | The person asks their AI for a platform, or for GPU inference. `cub` presents the ways to build it, and ConfigHub runs it across clusters. | **Stacks**, **Plugins** (generators such as Kubara and Sveltos), **Apps** |

## The user problems, and where each is answered

Each problem has one place that answers it, and a Guide that walks it. The
evidence column is honest about which problems were observed and which were
inferred. For most of the project the problems were inferred, and the first
real test cut both ways. An assistant that has Helm does read the chart and
gets the values right. The generated password and the image that no longer
pulls were real.

| The user's problem | Evidence | Answered in |
| --- | --- | --- |
| "I set a value and nothing happened." | The most common problem, and the least painful | Guides, Helm questions ("Why did Helm ignore my values?"), with `cub config values` |
| "The chart decided things I never wrote," such as a password that changes on every render | Observed: Argo CD and Flux rewrote it on every sync | Configs (the flattening verdict in the row), Docs (What charts hide), Guides (GitOps) |
| "It installed fine and the pods never started." | Observed: the image tag had gone from the registry | Configs (the row's image state), Guides ("Did a chart stop pulling?") |
| "The assistant rewrote my file and my fixes vanished." | The "my tweaks survive the AI" demonstration | Guides (ConfigHub: field restore, promote), the ConfigHub Server page |
| "What will this actually install?" | Every entry keeps its exact objects | Configs (each entry's page) |
| "Customising beyond the values means a fork, and upgrades cause problems." | A colleague's three Helm scenarios, 14 September | Configs (reviewed base variants), Guides (adapt, upgrade) |
| "I asked for a platform. Do these parts fit together?" | Composition checks that refuse with options | Stacks, Guides (compose, the refusal examples) |
| "Plain configuration is not enough for my case." | The Argo CD hardening Guide | Configs (several base variants per entry) |
| "I got something working. Now I want to share it, adapt it, keep it, and come back to it." | A leadership discussion, 9 September | Guides (ConfigHub), Plugins |
| "Will this model fit the GPUs I have?" | The match Guide; eks-inference is proven up to the GPU | Guides (match), Stacks (eks-inference), Configs (AICR) |

## The rules every step follows

Phase 2's rules still apply. Every page is generated. A topic is explained on
one page. Text moves rather than being rewritten, and nothing is deleted. A
moved page leaves a redirect behind. Counts come from `data/`, never from
prose. One pull request covers one step, and the maintainer merges it.

Phase 3's rules still apply too. Every top page passes the trust test and the
action test, and its code blocks follow the code-block doctrine.

Phase 4 adds three rules.

- **A list is data before it is a page.** Each section's rows live in one
  machine-readable file, and the page is generated from that file. An agent
  reads the file and a person reads the page. The two can never disagree.
- **Each row says what an agent does next.** Every row carries a stable ID, a
  one-line description, its state, and the exact command or address an agent
  uses.
- **Pages that explain are written for one reader.** A Guide is written for an
  agent and the person beside it. An agent doc is written for an agent. A human
  doc is written for a person, in STE.

## The navigation

The top bar reads **Configs · Stacks · Apps · Plugins · Guides · Docs**, with
the **ConfigHub Server** button at the end. The first five are the Catalog's
sections. There is no separate item for agents, because every section already
serves them.

The home page keeps three things only. It states the mission, it gives the two
agent prompts and the skill, and it shows one line per Catalog section with its
count and link.

## The Catalog sections

Each section page holds one list. A short paragraph may sit above it, but no
other explanation. Each row links to the entry's own page, repository or
Guide.

### Configs

The Configs list holds every Catalog entry. Today that is 262 listings, which
break down as 251 Helm, 4 AICR, 2 Timoni, 1 Kubara, 1 Sveltos, 1 plain YAML,
1 configuration OCI and 1 cub installer package. The generator reads these
counts from `site/listings/index.json`.

A row shows the entry's name, format, version, object count and flattening
verdict. It also shows its reviewed base variants. Several variants matter when
one configuration serves different use cases, as Argo CD does. The row links
to the entry's page, which already exists.

The list is today's filterable Catalog table under a new name. Its source is
`site/listings/index.json`, which already exists.

### Stacks

The Stacks list holds the shipped stacks in cub-workshop's `stacks/`
directory. Today these are app-platform, data-services, eks-inference,
gitops-secrets, the Kubara stacks, observability-base, redis-platform,
shop-platform and web-platform. The stacks that exist to show a refusal, such
as conflict-demo and metrics-double, move into Guides.

A row shows the stack's name, what it builds, its parts and their count,
whether it was checked, and the command to try it, such as
`cub stack sandbox eks-inference`.

The source is a new `site/stacks.json`, generated from the cub-workshop
manifests at a pinned commit.

### Apps

The Apps list holds worked example applications, from three places.

- **cub-workshop `apps/`** holds the shop services, such as storefront, cart,
  checkout and fraud-scoring, and 13 others.
- **confighub/examples** holds the Argo CD examples (app-of-apps,
  ApplicationSet, git-as-database), the Flux examples (beginner and fleet),
  Spring with cub-gen, and Score.
- **monadic/workshop-demo** holds the demonstration stories.

A row shows the app's name, what it shows, the delivery it uses (plain, Argo
CD, Flux or a generator), and its repository at a pinned commit. The source is
a new `site/apps.json`.

### Plugins

The Plugins list holds every public cub plugin, each marked by its state.

| Plugin | Command | What it does | Repository |
| --- | --- | --- | --- |
| workshop | `cub config`, `app`, `stack`, `fleet` | Checks, composes and publishes configuration from the Catalog | confighub/cub-workshop |
| kubara | `cub kubara` | Runs a Kubara platform through ConfigHub, with Catalog evidence for each chart | confighub/kubara-confighub |
| sveltos | `cub sveltos` | Brings a Sveltos fleet into ConfigHub, one variant per cluster | confighub/sveltos-confighub |
| eks-inference | `cub eksinf` | Runs the eks-inference stack on EKS | confighub/eks-inference |
| installer | `cub installer` | Renders and installs configuration-as-data packages | confighub/installer |
| helm | `cub helm` | Installs Helm charts as ConfigHub components | confighub/cub-helm |
| scout | `cub scout` | Explores and maps GitOps in your clusters | confighub/cub-scout |
| scan | `cub scan`, `cub check` | Checks Kubernetes and GitOps configuration for known risks | confighub/homebrew-tap |
| server | `cub server` | Installs a self-hosted ConfigHub server | confighub/cub-server |
| demo | `cub demo` | Seeds a ConfigHub organisation with a demo dataset | confighub/cub-demo |
| argo | `cub argo` | Reads an Argo CD estate and plans it into ConfigHub | In progress, not yet published |
| flux | `cub flux` | Reads a Flux fleet repository and plans it into ConfigHub | In progress, not yet published |

A row also carries the one-line install command and the state, which is
released (with its latest tag), draft, or in progress. The source is a new
`site/plugins.json`, kept by hand in a committed data file and checked against
each repository's latest release.

### Guides

The Guides list holds every known path that an agent walks with a person
beside it. Guides are grouped by where the reader starts.

| Group | Guides today |
| --- | --- |
| Start here | The Redis introduction, Try it: Redis in ten minutes, the ten-minute demo, Use with your AI |
| Helm questions | The Helm questions guide, values, "Why did Helm ignore my values?", "Did a version change?", "Did a chart stop pulling?", upgrade, adapt, bring your own charts |
| Formats | AICR, Timoni, plain YAML, Kubara |
| GitOps | The GitOps adopter guide, "Run it with Flux, Argo CD, or kubectl", the Argo CD hardening guide, the Argo and Flux app review tasks |
| Stacks and platforms | Compose, lifecycle, match, the refusal examples |
| ConfigHub | Promote my config, field restore, "Does the cluster match?", "Why do dev and prod differ?" |

Each Guide keeps one format. For every step it says what the agent does, what
the person sees, and where the person decides, and it gives the same `cub`
commands for a person working without an agent. The source is a new
`site/guides.json`, generated from the Guides' front matter.

## Docs

Docs hold explanation, in two kinds.

- **Agent docs** go as deep as the subject needs, two or three layers, and stay
  complete. They hold the machinery, such as lifecycle routes, flattening
  verdicts, the listing schema, evidence and receipts. Most already exist under
  `docs/`, and they stay where they are.
- **Human docs** are short. They are written in STE, as the next section sets
  out. Each explains one idea a person needs in order to trust or use the
  Workshop, and links to the agent doc for depth.

The Docs page is organised as a tree.

| Area | Pages | Depth |
| --- | --- | --- |
| Concepts | How configuration works, then Variants, OCI shapes and What charts hide | Human doc on top, agent docs under it |
| ConfigHub | Operate, Operations, ConfigHub Server | Human doc on top, agent docs under it |
| Trust | Why trust it, then Known gaps and the Evidence index | Human doc on top, evidence on GitHub |
| About | What ConfigHub Workshop is, Offering | Marketing |
| Reference | The full docs index by area, as today | Agent docs |

## Human docs in Simplified Technical English

Human docs follow the writing rules of ASD-STE100, the Simplified Technical
English standard.

- A procedure sentence has at most 20 words, and a descriptive sentence has at
  most 25.
- A procedure gives one instruction per sentence, in the imperative.
- Sentences use the active voice.
- A paragraph has at most six sentences.
- A noun cluster has at most three words.
- One word means one thing, and the same thing always has the same word.

The UX contract enforces the sentence limits on human-doc pages, in place of
today's 32-word cap. The house style still applies on top of STE.

## Marketing pages for people

Four pages carry the mission and the value story for people. They are the home
page, What ConfigHub Workshop is, Offering and the ConfigHub Server page.
Phase 3's worked home page specification still applies to the home page. The
other pages do not try to sell.

## Where every current page goes

Every current page keeps a home. A page that moves keeps its URL as a redirect.

| Page today | Section today | Goes to |
| --- | --- | --- |
| `charts/index.html` Find a configuration | Catalog | **Configs** (the list itself) |
| `proof.html` Why trust it | Catalog | Docs, Trust |
| `known-gaps.html` Known gaps | Catalog | Docs, Trust |
| `matrix.html` Evidence index | Catalog | Docs, Trust |
| `did-this-chart-version-change.html` | Catalog | Guides, Helm questions |
| `did-your-bitnami-chart-stop-pulling.html` | Catalog | Guides, Helm questions |
| `why-did-helm-ignore-my-values.html` | Catalog | Guides, Helm questions |
| `config.html` How configuration works | Config | Docs, Concepts |
| `ai.html` Use with your AI | Config | Home, and Guides, Start here |
| `variants.html` Variants | Config | Docs, Concepts |
| `oci.html` OCI shapes | Config | Docs, Concepts |
| `quirks.html` What charts hide | Config | Docs, Concepts |
| `ask.html` Is my configuration right? | Config | Guides, Helm questions |
| `deploy-with-flux-or-argo.html` | Config | Guides, GitOps |
| `try.html` Try it: Redis in ten minutes | Config | Guides, Start here |
| `redis-walkthrough.html` | Config | Guides, Start here |
| `testing.html` Worked examples | Config | Apps |
| `demo.html` The ten-minute demo | Stacks | Guides, Start here |
| `stack.html` Stacks and fleets | Stacks | **Stacks** (the list itself) |
| `kubara.html` Build a platform | Stacks | Plugins (the kubara row), and a Kubara Guide |
| `try-aicr.html` Inference platforms | Stacks | Stacks (eks-inference), and Guides, Formats |
| `apps.html` Apps on a platform | Stacks | **Apps** (the list itself) |
| `how-it-works.html` Operate | Operate | Docs, ConfigHub |
| `confighub.html` ConfigHub Server | Operate | Marketing, the ConfigHub Server button |
| `promote.html` Promote my config | Operate | Guides, ConfigHub |
| `operations.html` Operations | Operate | Docs, ConfigHub |
| `does-cluster-match-approved-config.html` | Operate | Guides, ConfigHub |
| `why-do-dev-and-prod-differ.html` | Operate | Guides, ConfigHub |
| `docs.html` Docs | Docs | **Docs** (the tree) |
| `d/docs/user/what-config-workshop-is.html` | Docs | Marketing, About |
| `offering.html` Offering | Docs | Marketing, About |

The Kubara page's title, "Build a platform", goes. Platform generators build
platforms, and the Workshop checks and composes what they produce.

## What agents read

- `llms.txt` lists the five section files first, then the listings.
- `site/configs.json`, `site/stacks.json`, `site/apps.json`, `site/plugins.json`
  and `site/guides.json` each hold one section's rows. `configs.json` is a
  view of `site/listings/index.json`, which stays the canonical per-entry
  index.
- The agent skill and the two prompts name the five files.
- The listing schema gains a published schema for each section file.

## The steps

Each step is one pull request, and the maintainer merges it.

1. **The section files.** Generate the five section files and their schemas,
   and list them in `llms.txt`. No page changes yet, so agents gain the flat
   lists first.
2. **The navigation and the home page.** Change the top bar to Configs, Stacks,
   Apps, Plugins, Guides and Docs. Reduce the home page to the mission, the
   prompts and one line per section. The contract's navigation labels change in
   the same pull request.
3. **Configs.** Rename the Catalog page, show base variants in each row, and
   move the trust pages and the three Helm question pages to their new homes.
4. **Stacks.** Build the list from `stacks.json`. Move the refusal stacks to
   Guides, and fold the inference page into the eks-inference row and a Guide.
5. **Apps.** Build the list from `apps.json`, and fold Worked examples and Apps
   on a platform into it.
6. **Plugins.** Build the list from `plugins.json`, and replace the Kubara page
   with the kubara row and a Kubara Guide.
7. **Guides.** Build the grouped list from `guides.json`, and bring every
   how-to page under it.
8. **Docs and the STE pass.** Build the Docs tree, write the human docs in STE,
   and move the contract's sentence limits for those pages.
9. **The marketing pages.** Settle the mission line, then give the four
   marketing pages one prose pass.

The gates for every step are the ones AGENTS.md names for the website: site
generation with the pinned timestamp, `site:ux:verify`, `site:verify`,
`docs:verify`, `config-model:verify`, `verify:no-personal-names` and
`verify:no-temp-paths`. Step 1 also adds a verifier that checks each section
file against its schema and its page.

## Open questions for the maintainer

1. **The mission line.** The maintainer leans toward option A, "a public hub
   for Kubernetes configuration, as data", over option B, "the agentic catalog
   of configuration, as data" (27 September). Step 9 needs the final wording.
   Steps 1 to 8 do not.
2. **STE vocabulary.** Should human docs adopt only STE's writing rules, or also
   its controlled dictionary with a short list of approved technical words?
3. **Apps from other repositories.** Should rows for apps in confighub/examples
   and monadic/workshop-demo point at a pinned commit, as the plan says, or at
   the default branch?
4. **Plugin state.** Should the Plugins list show only released plugins by
   default, with drafts and work in progress behind a filter?
5. **The ConfigHub Server button.** Should it stay separate from the bar, as
   today, or become a seventh item?
