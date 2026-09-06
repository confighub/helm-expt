# Site information architecture, phase 2

**UNOFFICIAL/EXPERIMENTAL**

This is the execution plan for the second pass over the public website's
structure. It follows the phase 1 plan (`site-information-architecture.md`,
#1709 to #1727) and the three decisions the maintainer made on 6 September
2026. A new session can execute it from this document alone; every step names
the page, the sources, and the gates.

## The three decisions

1. **The website is what a user reads and runs.** Proofs, receipts and other
   records stay in the repository and the Catalog backend. Landed as #1755:
   the generator renders only `docs/` and `examples/`, and every other link
   points at the file on GitHub. Nothing is deleted. Good material is moved,
   never hidden.
2. **Five buttons: Catalog · Config · Stacks · Operate · Docs**, plus the
   ConfigHub Server button. "Why trust it" folds into the Catalog page, which
   frees a button for Config. Config is the model and what you can do with a
   configuration; Catalog is the store and why you can trust it.
3. **What Config must explain**, in the maintainer's words: "how we are
   standardising config into one lifecycle model, flattening & rendering,
   recipes & values → base, routing etc.; and around OCI+friends; and how new
   or varying stuff comes in (eg via cub installer). That's central to the
   Catalog, and adjacent to 'how we deal with each config format'. We need the
   subsequent role of CH, stacks, platforms, apps, etc to be very clear too;
   and we need a clear hooks/CRDs story."

## How this plan was made

Nine readers mapped where each of those topics is explained today, across
325 docs and every site page; a synthesis proposed one home per topic; a
critic checked every cited path and range (all 69 exist and say what was
claimed) and found 22 placement defects, which this plan resolves. The raw
maps sit outside the repository; the decisions are here.

## The rules every step follows

- Every page is generated. A step edits `scripts/generate-public-site.mjs`,
  then `scripts/verify-site-ux-contract.mjs` (it pins h1s, headings, opening
  phrases, term lists and h2 caps), then `docs/README.md` when a doc moves or
  is added. Gates, in order: `HELM_EXPT_SITE_GENERATED_AT="$(cat
  site/generated-at.txt)" npm run site:generate`, `npm run site:ux:verify`,
  `npm run site:verify`, `npm run docs:verify`, `npm run config-model:verify`
  (it reads named pages for doctrine phrases; when the model moves from
  `docs.html` to `config.html`, its page list moves with it), `npm run
  verify:no-personal-names`.
- A topic is explained on one page. Every other page that explains it today
  keeps one sentence and a link. The satellites are named per step so none is
  forgotten.
- Text moves rather than being rewritten, and a moved passage gets a
  house-style pass on arrival: plain sentences with verbs, no verbless colon
  headlines, no em-dash asides, cross-references re-pointed. The maintainer's
  verbatim passages (the home page's "What ConfigHub Workshop is", in a
  `data-verbatim` container) are not touched.
- Facts from receipts are stated on the page; the receipt is linked on
  GitHub. Counts are read from `data/` summaries by the generator, never typed
  into prose. Project checks (`npm run …`) go to `docs/user/verification.md`,
  not to a site page.
- Headings say what the reader can do or learn. No "ladder", no "rung".
- Registering a page takes four edits in the generator: the page list, the
  builder object, `PAGE_DESCRIPTIONS`, and an explicit `write()`. Retiring a
  URL takes a `PAGE_REDIRECT_TARGETS` entry and a `movedPageHtml` stub.
- One pull request per step. The maintainer reviews each and merges.
  Squash-merge, so never stack a branch on a branch.

## The target map

| Button | Hub | Pages in the group |
| --- | --- | --- |
| Catalog | `charts/index.html` | `proof.html` (the trust sub-page), `known-gaps.html`, `matrix.html`, `did-this-chart-version-change.html`, `did-your-bitnami-chart-stop-pulling.html`, `why-did-helm-ignore-my-values.html` |
| Config | `config.html` (new) | `variants.html`, `oci.html` (new), `quirks.html` (rebuilt), `ask.html`, `ai.html`, `deploy-with-flux-or-argo.html`, `try.html`, `redis-walkthrough.html`, `testing.html` |
| Stacks | `stack.html` | `demo.html`, `kubara.html`, `try-aicr.html`, `apps.html` |
| Operate | `how-it-works.html` | `confighub.html`, `promote.html`, `operations.html`, `does-cluster-match-approved-config.html`, `why-do-dev-and-prod-differ.html` |
| Docs | `docs.html` | `d/docs/user/what-config-workshop-is.html`, `offering.html` |

Every current page keeps its URL. `security.html` and `verification.html`
already redirect to `proof.html` and keep working. The footer mirrors the
groups. The "ConfigHub Server" button stays as the sixth element of the top
bar.

## Who defines what

One canonical definition each, quoted in one sentence everywhere else:

| Term | Defined on | Everywhere else |
| --- | --- | --- |
| The lifecycle, the four questions, materialize, flatten | `config.html` | one sentence and a link |
| Recipe, values, declared inputs, base, derived variant, where a change belongs | `variants.html` | one sentence and a link |
| The OCI shapes, digests, what is signed | `oci.html` | one sentence and a link |
| Hooks, CRDs, required setup, dispositions | `quirks.html` | per-chart route tables stay on chart pages and link here |
| ConfigHub (the server), config = component = base variant = Space, the handoff order | `config.html` | `confighub.html` explains what it adds; the home page quotes the sentence |
| Stack, platform, place, fleet | `stack.html` | `config.html` and `kubara.html` quote the sentence |
| App, app on a stack, app on a platform | `apps.html` | `stack.html` quotes the sentence |
| Verified, certified, signed; check one claim yourself | `charts/index.html` | `index.html` keeps the three words as links; `oci.html` shows signing as a column and links here |
| Argo CD 3.x and 2.x specifics, the Flux and Argo manifests | `deploy-with-flux-or-argo.html` | `how-it-works.html` and `oci.html` link here |

## The steps

### Step 1. The nav fold and the Config page

New top bar and groups as in the target map; `expectedNavLabels`, the section
sidebar (`siteSections()`), the footer (`siteFooterNav`) and the contract's
shared-nav term list change together. `config.html` is registered and carries
four sections:

1. **Follow one configuration from source to running.** One telling of the
   lifecycle: `docs/user/confighub-data-model.md` "From source to a reviewed
   base" (both sequences and the definition bullets) and "How the pieces fit",
   with the four questions from `docs/user/model-and-vocabulary.md` "Start with
   the question" stated once. The other sequences (`skills/config-workshop/references/processing-model.md`,
   `docs/reference/config-catalog-doctrine.md`) are cited, not moved; moving
   four numberings settles nothing. New: a short verb strip mapping `cub config
   check --out`, `cub stack certify`, `cub variant upload`, `cub variant
   create` and `cub release publish` onto the stages, and one paragraph saying
   the render-late lane rejoins at the base step. Also new: ConfigHub in one
   paragraph, the "config = component = base variant = Space" row, and the
   handoff order to stacks and apps, quoting `stack.html` and `apps.html`.
2. **See what each format becomes.** The "How each source uses the model" table
   and "The ways configuration enters" from `config-catalog-doctrine.md`, and
   "The same objects in familiar terms" from `model-and-vocabulary.md`. New: a
   "what is checked" column and a link to an example entry per format, and one
   line each for Kubara and Sveltos as source types. The flattening column
   links the legend in section 3.
3. **See whether a configuration can be flattened, and what that decides.**
   `docs/reference/flattening-alignment.md` opening and "The four verdicts";
   `docs/reference/certified-bundle-spec.md` "The question this answers", "The
   pipeline" and "Boundaries"; `docs/reference/deciding-a-flattening-lane.md`
   "The four lanes" and "What a decided lane does not mean". New: the lane
   legend with live counts from `data/` (today 104 of 246 audited bases refuse
   a flattened bundle), two plain examples of what a flattened render loses,
   and the chart-level verdict against the stack-level flattened release.
4. **Choose a tool and start.** One table: `cub workshop`, `cub installer`,
   `cub helm`, the browser check, your own AI, with a "when" column, from
   `docs/user/choosing-commands.md` "Command Roles". The same table carries the
   door for a chart the catalog does not have: the "When your chart is not in
   the catalog" block from the Catalog page, with its `cub installer` door
   corrected (a chart without a package cannot be pulled), plus "Short
   Version" and "Graduation Path" from `choosing-commands.md` and "The three
   public jobs" from `docs/user/configuration-question-workflow.md`. Only the
   `cub server install` row comes from `docs/planning/cub-noun-vocabulary.md`;
   `deploy` is marked planned wherever it appears.

Satellites folded to one sentence and a link: the Catalog page's "The model in
five words", "What you can do with any entry", doors 1 to 3 and "When your
chart is not in the catalog"; `how-it-works.html` section 1 (the four answers)
and section 2 (materialization); `ai.html` section 2 (the four answers) and
sections 4 and 5; `docs.html` "The processing model" block (the F1 to F4
labels stay in `model-and-vocabulary.md`, and the docs word table gains
Materialize and Flatten); `testing.html` "Bring your own Helm chart and
values"; `ask.html` "What happens to a public question"; `offering.html`
section 5. The Catalog page's h2 cap and the config-model gate's page list
move with the content. Fix in passing: the empty h3 above the Catalog search
card, `cub promote` on the home page (not a shipped verb), and "from the
public Catalog" where the article is missing.

### Step 2. The Catalog page as store plus trust

Sections, in order: the hero (pick a tested configuration and check it
yourself) with one sentence and a link to Config for the model; **Search the
catalog** (the Helm table plus rows for the AICR, Timoni, plain-YAML and
literal-OCI entries); **What each catalog entry contains** (kept: package,
bases, bundle where the lane permits, routes, receipt, each item linking the
Config section that explains it); **Read each result correctly** (the lane
legend links Config section 3; quirk tags link `quirks.html`); **See why the
catalog offers several configurations** (the values policy stays; the base
definition links `variants.html`); **Check why you can trust an entry** (the
essentials from `proof.html`: the counts, what each test covers, the three
words verified, certified and signed defined here and only here, the one
`cosign` command from `docs/reference/installer-package-signing.md` "Verify A
Package", check one claim yourself, and "What stays available" with the two
byte-drift cases); **See what this catalog does not claim**; **Take an entry
into a stack or into ConfigHub**.

`proof.html` stays, demoted from the nav to the Catalog sub-page, with all
seven of its sections: the harder charts, security before release, tests
designed to expose failure, and the rest. Its "Project checks" paragraph moves
to `docs/user/verification.md`. `known-gaps.html` and `matrix.html` join the
Catalog group. `index.html` keeps the three words as links to the Catalog
section.

### Step 3. `variants.html` becomes the one page for bases and changes

Title: **Turn a recipe and values into a base, and decide where a change
belongs.** It keeps its commands, flow and examples and gains the definitions:
"Three variant layers" from `model-and-vocabulary.md`; "The whole chain, with
the variants labeled" and "How To Tell What Set A Field" from
`docs/user/variants-after-upload.md`; "The Claim", "What A Chart Preset
Records" and "Where Each Setting Lives" from `docs/user/helm-presets-and-values.md`
(the four-place table lives here once); "The Short Model" from
`docs/user/helm-render-intents.md`; "What The Package Contains" from
`docs/user/installer-oci-packages.md`; "Inside ConfigHub" from
`confighub-data-model.md` for Unit, Space, base and derived; the three-line
rule from "What Happens When You Bring Values?" and "Three Decisions", "Quick
Routing Table" and "The OCI Boundary" from `docs/user/change-routing-before-oci.md`;
the field lists from `docs/user/custom-overlays.md`; the replica and
StorageClass nuance from `docs/reference/customization-algorithm.md`;
`docs/user/transform-oci-package.md` as the bundle-level route. New: the four
referents of "base" in one table, "recipe" and "declared inputs" defined for a
newcomer, "a base Space has no target", and firm answers for image tag,
namespace, replicas and StorageClass.

The rule is taught about twelve times today. Satellites folded to one
sentence and a link: `how-it-works.html` section 3 in full; three `ask.html`
FAQ rows ("What is a base variant?" among them); the `operations.html` "Where
changes belong" link; one-liners on `apps.html`, `stack.html` and
`testing.html`; the passages in `helm-presets-and-values.md` and
`docs/user/customization-decision-tree.md` (the docs keep their other jobs).

### Step 4. `oci.html`, the OCI shapes in one place

Title: **Package and deliver it as OCI, and see what is signed.** New: the
nine-row shapes table (media type, layout, producer, consumer, registry,
signed by whom), which consumer accepts which layout, the signing coverage
matrix, a routing rule for the four verify commands, and a digest glossary.
Moved: the transport paragraph and "The OCI packages are not all the same"
from `config-catalog-doctrine.md`; "The artifact" and "The three forms and
the digest rule" from `docs/planning/oci-design-center.md`; "Three OCI Roles"
and "Public Pull Access" from `installer-oci-packages.md`; "Where OCI fits"
and "Digest roles" from `model-and-vocabulary.md`; "The two OCI artifacts are
different" from `docs/user/cub-deployment-path.md`; "What A Valid Signature
Shows" from `installer-package-signing.md`; "The published form" and "Prior
art and relatives" from `docs/planning/stack-manifest-spec.md` for Timoni,
AICR and Kubara in one paragraph each. The five OCI-role tables that disagree
(three roles, four roles, two artifacts) are reduced to links; the page
records the open point that `oci-design-center.md` puts the receipt in a
referrer and `certified-bundle-spec.md` puts it beside the bundle.

`deploy-with-flux-or-argo.html` owns the Argo CD 3.x and 2.x specifics and
the Flux and Argo manifests; `how-it-works.html` section 4 and `oci.html`
link there. `stack.html` keeps its two stack OCI forms (the index from `cub
stack publish`, the flattened image from `cub stack sandbox --out oci://`)
and links the shapes table. Satellites: `how-it-works.html` section 1 OCI
cards, three-job table and identity paragraph; the Catalog page's OCI
sentences; `docs.html` three-digests line; `deploy-with-flux-or-argo.html`
section 6 roles paragraph; `operations.html` package-versus-delivery
paragraph.

### Step 5. `quirks.html` rebuilt as the hooks and CRDs page

Title: **See what happens to your chart's hooks, CRDs, and setup work.**
`hooks.html` already redirects here. New first: the contract paragraph
(phases, the five disposition words, execution mode, the `automatic: false`
rule, observe then execute then emit) and "who runs it today". Moved:
`docs/user/chart-hooks-what-happens.md` whole (short answer, practical
choices, what a route tells you, what you do, honest boundary); the worked
examples keep their facts and link their receipts on GitHub. Cited, not
moved: `docs/reference/what-hook-support-means.md` and
`docs/reference/hook-lifecycle-strategy.md`, whose vocabularies differ from
each other. Also moved: "The install order", "What happens to Helm hooks" and
"What is still manual" from `docs/demo/hooks-crds/kube-prometheus-stack.md`;
"What the catalog package does" from `docs/demo/hooks-crds/argo-workflows.md`;
the opening and "How To Use This As A User" from
`docs/user/target-prerequisites.md`; "Routes travel inside the bundle" from
`certified-bundle-spec.md`; "Hooks under GitOps" from
`docs/user/gitops-adopter-guide.md`; the ServiceMonitor-guard sentence from
`docs/demo/kubara/app-rollout.md`. New: CRDs as one menu (subchart and
umbrella cases, CRD-guarded objects), the hard-chart criteria, the
required-setup terms, and which Argo and Flux mapping is generated versus
advice.

Satellites: the Catalog page's "How the catalog handles required setup";
`how-it-works.html` sections 2 and 3 hook and CRD lines; four `ask.html` FAQ
rows; `testing.html` hook lines; `proof.html` hook lines. The `ask.html`
section and the `promote.html` h3 that share this page's title are renamed
"What this chart still needs" with a link. Per-chart route tables stay on
chart pages; `stack.html` keeps its CRD-before-CR certify rows.

### Step 6. The roles, one sentence each

`stack.html` "What a stack is" owns stack, platform (the outcome of upload,
place, govern) and fleet, drawing on `docs/planning/stacks-platforms-apps-taxonomy.md`
"The nouns", "Platform: the outcome" and "The one model, in order", and keeps
"Becoming a platform: upload, place, govern". `apps.html` owns app, app on a
stack and app on a platform, and the standalone-app line from
`docs/planning/custom-stacks-and-apps.md`. `config.html` section 1 owns
ConfigHub (from `what-config-workshop-is.md` part 3 for the verbs and
`confighub-data-model.md` "After ConfigHub"). `confighub.html` explains what
ConfigHub adds and quotes the definition. The home page's "five words"
paragraph, `kubara.html`'s ten-second box, `demo.html`'s Kubara headings and
`try-aicr.html` quote the sentences; `demo.html` says "certify a whole stack"
not "platform"; `try-aicr.html` says what "AICR platform" means;
`operations.html` says "Build a ConfigHub App". The Kubara-tree-is-not-yet-a-platform
line lands on `kubara.html`.

### Step 7. The Operate hub around its four verbs

`how-it-works.html` gets four h2s in hero order: Release, Promote, Gate and
approve, Roll back, each with its command rows, what changes, and its doc
link. Its plugin table moves to `stack.html`; installer, local and OCI
material to `deploy-with-flux-or-argo.html` and `try.html`; its account
verbs stay in one table (the plugin verbs live on Config's tool table). The
Operate docs are then placed across `confighub.html`, `variants.html`,
`operations.html` and `apps.html`. Fleet operations (status, gates,
rollouts) have no home yet; decide here whether they sit on `stack.html` or
`operations.html`.

### Step 8. The docs index by area, and the contributor group

Encode the doc-to-area map in `docs/README.md` (or a data file) and teach
`scripts/verify-doc-map.mjs` the pattern first. Then regroup "Every doc, by
area" on `docs.html` by the five buttons; a collapsed "For contributors" group
holds the internal docs and the planning notes. Historical docs are labelled
in `docs/README.md`, not moved: moving them would change their rendered URLs.
Two descriptions in `docs/README.md` are wrong today and are corrected here.
Add the missing How-do-I entries (`choosing-commands`, `serverless-mode`,
`helm-to-cub-migration`, `ci-render-check`).

### Step 9. The Stacks pages earn their titles

`apps.html` gets its promote half with real commands. `kubara.html` gets an
explicit certify step between generate and package, with steps 1 to 6
contiguous. Sibling links in body prose (stack, kubara, apps, try-aicr). The
stack count and its table come from `data/certified-bundles/` (the data side
is #1759).

### Step 10. Offering, names, and the one prose pass

`offering.html` gets one Free-local / Free-account / Commercial table, what
triggers payment, and "free to start" said once; `try-now` folds into
`try.html`; `what-you-get`, `why-this-exists` and `offering` become one intro
under Config's tool table. Then one name per page: nav, sidebar, footer,
title and h1 agree (`confighub.html` has four names today). Last, one
house-style pass over whatever the moves left behind, so nothing is polished
twice.

## What has to be written new, ranked

Needed for step 1 to ship: the verb strip and the render-late rejoin
paragraph; ConfigHub in one paragraph and the handoff order; the per-format
"what is checked" column; the lane legend with live counts and two examples;
the merged tool table with its "when" column and the corrected `cub installer`
door. Needed by steps 3 to 5: the four referents of "base"; the firm answers
for image tag, namespace, replicas and StorageClass; the nine-row OCI shapes
table and the signing matrix; the hooks contract paragraph and the CRD menu.
Everything else on the synthesis's list waits for the step that needs it.

## Open questions for the maintainer

1. The home page's verbatim text says every image is "verified, certified,
   and signed". The catalog bundles are not all signed today. Qualify the
   sentence, or sign the bundles first? The text is the maintainer's and is
   not changed without a decision.
2. The public word: "base variant" everywhere, with "preset" named once as an
   alias? The two doc H1s that say "preset" would change too.
3. `deploy` is used as a free verb on two pages and is not a shipped command.
   Mark it planned, or remove it until it ships?
