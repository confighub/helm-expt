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

The maintainer settled three more points the same day.

6. **Human docs adopt STE's writing rules only**, not its controlled
   dictionary.
7. **Every plugin is shown openly.** Drafts and work in progress appear in the
   list with their state, and no filter hides them.
8. **The ConfigHub Server button stays separate, at the top right.** It
   balances the ConfigHub Workshop button at the top left.
9. **App rows link to the default branch, and record the commit last checked.**
   A person sees the current example. An agent also sees which commit was
   checked, and a check flags any row whose branch has moved on since.
10. **The headline is "An agentic data hub for Kubernetes and AI
    configurations".** It keeps the hub of option A, the agent of option B, and
    "as data", and it names AI configuration beside Kubernetes.

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

## The five journeys come first

The five demo journeys are the front door of the site, and the unit the site
improves by. Each one connects a problem people recognise with an explanation,
the commands, and a result. Each follows the same path.

> Arrive with a problem → understand why it happens → start with AI or `cub` →
> follow the Guide → get a checked result → use it on your own configuration.

The journeys live in `monadic/workshop-demo`. Each has a `run.sh` for a person
at the command line, a `PROMPT.md` for an agent, and an `expected/` folder
from a real run. The #1956 acceptance tracker measures them as J1 to J5.

| Journey | What the user should understand | Demo | Guide it becomes | The why, in Docs | Where it continues |
| --- | --- | --- | --- | --- | --- |
| My values did nothing | Valid input can still fail to express my intent. | `1-catch-the-ai` | Find the values Helm ignored, from the values Guide, "Why did Helm ignore my values?" and the Helm questions | How configuration works | Configs, and a CI line with `cub config values --exit-code` |
| Preserve my fixes | Configuration as data lets us inspect changes and keep deliberate adaptations. | `2-my-fixes-survive` | Keep your fixes through a rewrite, from the field-restore Guide and "Change a config safely" | Variants | ConfigHub, which carries the fixes through the next rewrite |
| What my app needs | An application's requirements must match what its platform provides. | `3-what-my-app-needs` | Put an app on a platform, from Apps on a platform, the match Guide and the compose Guide | How configuration works, the stack part | Stacks and Apps |
| Before GitOps takes over | Delivery behaviour matters, and repeatable configuration is the foundation. | `4-before-argo-takes-over` | Hand a config to Argo CD or Flux, from "Run it with Flux, Argo CD, or kubectl", the GitOps adopter Guide and the Argo CD hardening Guide | What charts hide | Configs, with a reviewed base variant |
| It installs but never starts | A successful render cannot show that runtime dependencies exist. | `5-it-installs-and-never-starts` | Move off a chart that stopped pulling, from "Did a chart stop pulling?" | Trust, on what a check cannot see | Configs, with the image state in each row |

Four rules follow for the journeys.

- **The home page offers them first**, as "start from your problem", one line
  each, within the landing page limit.
- **They are the first group in Guides**, above every other group.
- **Each journey Guide keeps both tracks.** A person runs the demo's `run.sh`,
  and an agent follows its `PROMPT.md`. The Guide then shows the same steps on
  the reader's own configuration.
- **A change to the site is judged by the journeys.** A step counts as done
  when the journeys it touches still reach a checked result with a fresh agent,
  as the #1956 acceptance measures.

## The rules every step follows

Phase 2's rules still apply. Every page is generated. A topic is explained on
one page. Text moves rather than being rewritten, and nothing is deleted. A
moved page leaves a redirect behind. Counts come from `data/`, never from
prose. One pull request covers one step, and the maintainer merges it.

Phase 3's rules still apply too. Every top page passes the trust test and the
action test, and its code blocks follow the code-block doctrine.

Phase 4 adds three rules.

- **A list is data before it is a page.** Each section's rows live in one
  machine-readable file, and the page is generated from that file. Any source
  kept by hand lives outside `site/`, which is generated in full. An agent
  reads the file and a person reads the page. The two can never disagree.
- **Each row says what an agent does next.** Every row carries a stable ID, a
  one-line description, its state, and the exact command or address an agent
  uses.
- **Pages that explain are written for one reader.** A Guide is written for an
  agent and the person beside it. An agent doc is written for an agent. A human
  doc is written for a person, in STE.
- **Pages are taken apart by what each section does.** A section that shows how
  to do something becomes part of a Guide. A section that explains becomes part
  of a Doc. What a newcomer needs first stays on a landing page, in a few short
  sentences. Every section gets exactly one new home, so no material is lost.
  A page that is fully taken apart leaves a redirect to where most of it went.
- **Landing pages stay simple.** The home page, the six section pages and the
  ConfigHub Server page are the top-level landing pages. Apart from its list,
  each holds at most about 300 words of plain web content: what the reader can
  do here, and where to go next.

## The navigation

The top bar reads **Configs · Stacks · Apps · Plugins · Guides · Docs**. The
**ConfigHub Workshop** button sits at the top left and leads home, as today.
The **ConfigHub Server** button sits at the top right, in symmetry with it, as
today. The first five items are the Catalog's sections. There is no separate item for agents, because every section already
serves them.

The home page keeps four things only. It states the mission, it offers the five
journeys as "start from your problem", it gives the two agent prompts and the
skill, and it shows one line per Catalog section with its count and link.

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
- **monadic/workshop-demo** holds the shop app that the five journeys follow.

A row shows the app's name, what it shows, the delivery it uses (plain, Argo
CD, Flux or a generator), and a link to it on its repository's default branch.
The source is a new `site/apps.json`. It also records the commit at which each
app was last checked. A verifier compares that commit with the branch, and
flags any row whose example has changed since, so an agent can say "checked at
this commit, changed since". Updating the recorded commit is part of the
regular refresh, as it is for chart versions.

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
released (with its latest tag), draft, or in progress. Every plugin is shown
openly, and no filter hides drafts or work in progress. The registry is kept by
hand in `data/workshop-plugins/plugins.yaml`, outside the generated site, and a
verifier checks each row against its repository's latest release. The
generator emits `site/plugins.json` from it.

### Guides

The Guides list holds every known path that an agent walks with a person
beside it. Guides are grouped by where the reader starts.

| Group | Guides today |
| --- | --- |
| The five journeys | My values did nothing, Preserve my fixes, What my app needs, Before GitOps takes over, It installs but never starts, as the section above sets out |
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
English standard. They adopt the rules only, not its controlled dictionary.

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

## How each current page is refactored

Each page is split by section. The table names each page's sections by their
headings today, and says where each one goes. "Landing" means the short
content that stays on a top-level landing page. Guide and Doc names are
working titles, which the build settles.

| Page today | Stays as landing content | Becomes Guides | Becomes Docs | The URL |
| --- | --- | --- | --- | --- |
| `index.html`, home | The mission, the prompts and skill, one line per section | None | None | Stays |
| `charts/index.html`, the Catalog | "Search the catalog", and the list | "Verify an entry yourself" and "Take an entry into a stack or into ConfigHub" go to Check a claim yourself and Take a config further | "Check why you can trust an entry", "What each catalog entry contains", "Read each result correctly" and "Why the catalog offers several configurations" go to Trust and to How configuration works | Becomes Configs |
| `proof.html`, Why trust it | None | "Check one claim yourself" goes to Check a claim yourself | The counts, the test coverage, the harder charts, security review, the adversarial tests and "what this project does not claim" go to Trust | Redirects to Docs, Trust |
| `known-gaps.html` | None | None | Both sections go to Trust, Known gaps | Redirects to Docs |
| `matrix.html`, the Evidence index | None | None | The whole matrix becomes an agent doc under Trust, and its data stays on GitHub | Redirects to Docs |
| `did-this-chart-version-change.html` | None | The example, the record and the next step go to Did a version change? | None | Redirects to the Guide |
| `did-your-bitnami-chart-stop-pulling.html` | None | Every section goes to Move off a chart that stopped pulling | "Know when ConfigHub helps" goes to the ConfigHub human doc | Redirects to the Guide |
| `why-did-helm-ignore-my-values.html` | None | Every section goes to Find the values Helm ignored | "Know when ConfigHub helps" goes to the ConfigHub human doc | Redirects to the Guide |
| `config.html`, How configuration works | One sentence on configuration as data, on the home page | "Choose a tool and start" goes to the Guides list | "Follow one configuration from source to running", "See what each format becomes" and "See whether a configuration can be flattened" become How configuration works, a human doc with agent docs under it | Redirects to Docs |
| `ai.html`, Use with your AI | The skill and the two prompts, on the home page | The install, "Ask for one result", "Keep the answer tied to records", the non-Helm source and "Keep your fixes" go to Work with your AI | "How agents help maintain the Catalog" becomes an agent doc | Redirects to the Guide |
| `variants.html` | None | "Decide where the change belongs", "Follow a safe flow", "Run the commands" and "Open worked examples" go to Change a config safely | "See the model", "Tell what set a field", "Understand a chart preset", "See what is inside ConfigHub" and "Read the details" become Variants, a human doc with agent docs under it | Redirects to Docs |
| `oci.html`, OCI shapes | None | "Check one [signature] yourself" goes to Check a claim yourself | The shapes and their consumers, bundles and stacks as one artifact, what a signature proves, and other tools' shapes become OCI shapes | Redirects to Docs |
| `quirks.html`, What charts hide | None | "Do the six steps", the worked examples through hooks and CRDs, "Decide who owns each CRD" and "Stage target prerequisites" go to Handle hooks and CRDs | The phases and dispositions, the short answer, how a bundle carries routes, each tracked requirement, and what remains before deployment become What charts hide | Redirects to Docs |
| `ask.html`, Is my configuration right? | None | "Start with a chart and values", both "Run … on your machine" sections, the completed review, the browser check and "Keep or share" go to Check my own config; "Four common Helm questions" and "Questions people are asking" go to the Helm questions Guide | "What happens to a public question" becomes an agent doc | Redirects to the Guide |
| `deploy-with-flux-or-argo.html` | None | Sections 1 to 6 and 8 go to Hand a config to Argo CD or Flux | "Read the current limits" goes to Trust, Known gaps | Redirects to the Guide |
| `try.html`, Redis in ten minutes | None | Every section goes to Start here: see what a chart installs | None | Redirects to the Guide |
| `redis-walkthrough.html` | None | Every section goes to Start here, as its longer path: pull, upgrade, the base, OCI for Argo CD or Flux | "What we checked" goes to Trust | Redirects to the Guide |
| `testing.html`, Worked examples | None | "What do you need?" goes to the Guides list | The example rows go to Apps | Redirects to Apps |
| `demo.html`, the ten-minute demo | None | Every section goes to The ten-minute tour, which walks config, app, stack and fleet | None | Redirects to the Guide |
| `stack.html`, Stacks and fleets | "What a stack is", in two sentences, and the list | "Get a stack", "Checking your stack", "Run and govern it" and "Run it" go to Compose and check a stack | "Receipts and boundaries" goes to Trust | Becomes Stacks |
| `kubara.html`, Build a platform | None | "Choose services", the adoption journey and "What we show in ConfigHub" go to Bring Kubara's managed add-ons into ConfigHub, which links the `cub kubara` guide | "Benefits with explicit acceptance evidence", "What stays Kubara, and what ConfigHub adds" and "The honest boundaries" become a Kubara agent doc | Redirects to Plugins, the kubara row |
| `try-aicr.html`, Inference platforms | None | Both paths and the ORAS steps go to Compare GPU nodes and pull an AICR config | "Where the selected configuration came from" and "What the example proves" become an AICR agent doc | Redirects to the Guide |
| `apps.html`, Apps on a platform | "What an app is", in two sentences, and the list | "Try it now", the demo steps, "Take it into ConfigHub" and "Bring an app that already runs" go to Put an app on a platform | None | Becomes Apps |
| `how-it-works.html`, Operate | None | Release, Promote, Gate and approve, and Roll back go to Release, promote and roll back | The model behind the four verbs becomes the ConfigHub human doc | Redirects to Docs |
| `confighub.html`, ConfigHub Server | "What ConfigHub adds" and "See one exact handoff", made short | "Continue from the retained answer" goes to Take a config further; the tutorial link stays | None | Stays, as marketing |
| `promote.html`, Promote my config | None | Every section goes to Review a promotion | None | Redirects to the Guide |
| `operations.html` | None | "Check the starting point", "Choose an operation", "Keep a fleet record" and the App demonstrations go to Operate a fleet; "Build a ConfigHub App" goes to its own Guide | "Govern with the commercial product" goes to the ConfigHub Server page | Redirects to Docs |
| `does-cluster-match-approved-config.html` | None | Every section goes to Does the cluster match? | None | Redirects to the Guide |
| `why-do-dev-and-prod-differ.html` | None | Every section goes to Why do dev and prod differ? | None | Redirects to the Guide |
| `docs.html`, Docs | The Docs tree | The four task groups go to the Guides list | "Every doc, by area" stays as Docs, Reference | Stays, as the Docs tree |
| What ConfigHub Workshop is | A short version on the home page | None | Stays as marketing, About, rewritten to the mission summary | Stays |
| `offering.html`, Offering | "What is free, and what needs the commercial product", on the ConfigHub Server page | "Send a missing or broken public chart" goes to its own Guide | "Check what exists today" and the supporting detail go to About | Redirects to the ConfigHub Server page |

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
   the same pull request. The home page leads with the five journeys.
3. **Configs.** Rename the Catalog page, cut it to its landing content and the
   list, and show base variants in each row. Its explanation moves to Docs and
   its steps to Guides, as the refactor table says.
4. **Stacks.** Build the list from `stacks.json`. Move the refusal stacks to
   Guides, and fold the inference page into the eks-inference row and a Guide.
5. **Apps.** Build the list from `apps.json`, and fold Worked examples and Apps
   on a platform into it.
6. **Plugins.** Build the list from `plugins.json`, and replace the Kubara page
   with the kubara row and a Kubara Guide.
7. **Guides.** Assemble each Guide from the sections the refactor table names,
   in the Guide format, and build the grouped list from `guides.json`. The five journey Guides come first, and each is rerun with a fresh agent before the step is done.
8. **Docs and the STE pass.** Assemble each Doc from the sections the refactor
   table names. Write each human doc in STE, with the agent docs under it, and
   move the contract's sentence limits for those pages.
9. **The marketing pages.** Put the headline and the approved sentences under
   it on the home page, then give the four marketing pages one prose pass.

The gates for every step are the ones AGENTS.md names for the website: site
generation with the pinned timestamp, `site:ux:verify`, `site:verify`,
`docs:verify`, `config-model:verify`, `verify:no-personal-names` and
`verify:no-temp-paths`. Step 1 also adds a verifier that checks each section
file against its schema and its page.

## The text under the headline

The maintainer approved this text on 27 September 2026, for now. The first
paragraph names the problem, says what the reader can do, and brings in
ConfigHub with the graph. The second says what ConfigHub adds.
Each sentence is within the 32-word cap.

> Your agent writes configuration faster than anyone can check it, and a chart
> rarely shows what it will really do. Pull tested configs, stacks, example
> apps and plugins from here, from a web platform to GPU inference, with guides
> your agent can follow, and check each one before it runs. When your team
> needs to keep it, ConfigHub stores it with the graph of how it all connects.
>
> ConfigHub is where people and agents change the same configuration safely.
> Every change is versioned, approved and released by digest, and the Argo CD
> or Flux you already run delivers it.

## Open questions for the maintainer

None. Every decision this plan needs is recorded above.
