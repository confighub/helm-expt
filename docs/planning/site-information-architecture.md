# The site's information architecture, aligned with the three things

The site has 45 top-level pages, a seven-item nav, and 1,124 rendered documents,
grown over eight months. The definition now says Config Workshop is three
things: a verified catalog, platforms and stacks on demand, and a ConfigHub
plugin to operate apps, platforms, and stacks correctly
([what-config-workshop-is.md](../user/what-config-workshop-is.md)). This plan
maps every page to that structure, names what each page must let a reader
understand and do, retires what does not serve it, and removes the leftovers in
this repository that the plugin superseded. Nothing on the site is outside this
map when it is done.

## The shape

Five nav items replace seven: **Catalog · Platforms and stacks · Operate · Why
trust it · Docs**, plus the ConfigHub sign-up as a button. The homepage keeps
its four doors (I use Helm, I run Flux or Argo CD, I want a platform, I need a
stack) and its six starting questions; each question lands in one of the three
sections. The footer mirrors the sections.

Each section has one hub page with a "Run it" block: the plugin commands, and
links to the manifest, proof, or walkthrough in the cub-workshop repository at
stable paths. The site never copies plugin files; it links them. Everything a
user runs lives in cub-workshop; everything a user reads, and every receipt,
lives here.

## Section 1: the verified catalog

What a reader understands: tested configuration, one form, an image per variant,
with a receipt. What they do: check a chart, pull an image, verify it.

| Page today | Disposition | Reader understands and does |
| --- | --- | --- |
| charts/index | keep, section hub | find a component and version, pull its image, see its receipt; the Run it block: `cub config check`, `cub config verify` |
| ask | keep | check a chart or rendered YAML in the browser; the Helm door |
| did-this-chart-version-change | keep | a version now points at different bytes upstream |
| did-your-bitnami-chart-stop-pulling | keep | a chart stopped pulling anonymously; a tested successor |
| why-did-helm-ignore-my-values | keep | a value changed nothing; the path was wrong |
| hooks, quirks | done: quirks is *What charts hide*, hooks forwards to it | hooks, CRDs, webhooks, setup Jobs, and how the image carries them as routes |
| hard-questions | merge into ask | the ten questions are already ask's spine |
| serverless, deploy-with-flux-or-argo | done: deploy-with-flux-or-argo is *Run it with Flux, Argo CD, or kubectl*, serverless forwards to it | consume an image by digest with the reconciler you have, no account; the OCI design center for consumers |
| try, redis-walkthrough | done as two pages: try is *Try it: Redis in ten minutes* and stays at three command blocks by contract; the walkthrough remains its continuation | one chart end to end, free |
| entry-path-reference, deployment-reference, docs-reference | retire, redirect to the catalog hub and Docs | reference tables fold into the map |

## Section 2: platforms and stacks on demand

What a reader understands: describe what you want, get tested parts, checked
before anything runs; your assistant can pick. What they do: sandbox a stack,
generate a platform, let an assistant compose.

| Page today | Disposition | Reader understands and does |
| --- | --- | --- |
| stack | keep, section hub | stacks and fleets; the Run it block: `cub stack sandbox`, `cub stack certify`, `cub stack publish`; the shipped examples with their manifests |
| kubara | keep | I want a platform: choose, generate, govern, run apps |
| try-aicr | keep, rename *Inference platforms* | eks-inference and the AICR entries: parts, receipts, the GPU boundary |
| ai | keep, rename *Your assistant* | the recorded composition, the skill, author-not-authority |
| custom-apps, existing-apps | done: both forward to *Apps on a platform* (apps.html); the CI-rendered journey is linked from the Operate hub | an app needs a platform; check it, put it in a stack; the CI-rendered journey moves to Operate |
| journey, guides | merge journeys into the three hubs; guides becomes Docs' learn-by-doing list | |
| challenge, future, demo-org | retire, redirect | roadmap lives in planning docs; the demo org is the sandbox server |

## Section 3: operate with ConfigHub

What a reader understands: the ladder, upload, release, promote, roll back, and
gates that refuse. What they do: upload an image, release by digest, promote,
compare with live.

| Page today | Disposition | Reader understands and does |
| --- | --- | --- |
| how-it-works | keep, rename *Operate*, section hub | the ladder table; the Run it block: `cub stack upload --run`, `cub variant upload`, `cub release publish`, `cub variant promote` |
| confighub | keep | what the account adds: the chaining story, the ConfigHub-ready record |
| promote | keep | compare, then promote |
| variants | keep | environments as variants, protection, fork versus overlay |
| operations, day1-operations | merge into one page, *Operations* | drift, rollback, day two |
| does-cluster-match-approved-config | keep | compare approved with live |
| why-do-dev-and-prod-differ | keep | the variants check |
| the CI-rendered catalog journey (from existing-apps) | lands here | your CI already renders; hold it as data |
| offering, tiers, private/index | done: offering is *Offering*, tiers and private/index forward to it | free, account, paid, plainly |

## Why trust it, and Docs

| Page today | Disposition | Reader understands and does |
| --- | --- | --- |
| proof, verification, security | done: proof is *Why trust it*, verification and security forward to it | verified, certified, signed; the chain reruns; the signing that CI checks |
| known-gaps | keep, under Why trust it | the honest register |
| matrix, testing | matrix stays as the evidence index; testing's "find a configuration" moves to the catalog hub and its worked stories to the section hubs | |
| docs | keep, the map | |
| compare, whats-new | keep, under Docs | |

## Leftovers to remove from this repository

The plugin superseded the prototypes, so these go, with their npm scripts and
every page or doc that points at them repointed to cub-workshop:
`examples/cub-stack`, `examples/cub-app`, `scripts/cub-config.mjs`,
`scripts/cub-app.mjs`, `scripts/cub-stack.mjs`, `scripts/run-fleet-generate.mjs`,
and the `cub:config`, `cub:app`, `cub:stack` scripts. The fleet-slice and
stack-sandbox receipts stay; they are evidence.

## How it lands

1. Nav, footer, and the three hubs with their Run it blocks; the definition page
   linked from every hub.
2. The merges, one page at a time, each with the UX contract updated.
3. The retirements as redirect stubs, so no inbound link breaks.
4. The prototype cleanup in this repository.
5. The persona pass again: the walkers and three fresh-eyes reads, then fixes.

Done means: every page on the site appears in this map with its disposition
carried out; every "what you can do" line in the definition has one page that
delivers it; the nav has five items; nothing a user runs is described only in a
planning document.
