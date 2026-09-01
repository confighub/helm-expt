# Website ladder review brief, 2026-09-01

This brief gathers one working arc for review. It covers the stack manifest becoming a runnable surface, the prototype scripts becoming one cub plugin, the full fleet example, and the homepage change that puts the ladder on display. The reviewer should judge three things: what a user arriving at the website can do, what the OCI catalog is worth to them, and whether the examples answer "what can I do here" well enough to carry blog posts.

## What happened, in order

1. The keystone platform became a stack manifest and the manifest became a command: `cub stack sandbox eks-inference` certifies and renders the whole platform for free (#1687). The certify step caught a real duplication the deeper verdict had deduplicated silently, so the two layers check each other.
2. The manifest format was specified, bindings moved into it, and the composition verdict was armed as a regression gate (#1688). A second producer proved the format producer-neutral: the same verbs certify a platform composed from the catalog's certified renders (#1689).
3. The fleet layer was written down as data: composition times placement times history, with a generated slice whose four attention tiles match the product's own queries (#1690).
4. The CI-rendered catalog journey landed as a documented user journey: teams whose CI already renders charts hold the result as governed data with one command, canonically equal, reconciler untouched (#1691).
5. The prototype scripts graduated to one real cub plugin named workshop, carrying the whole noun family: `cub config`, `cub app`, `cub stack`, `cub fleet`. One install gives every noun, every free verb, and the content they run against: nine verified catalog renders, thirteen authored apps, eleven stacks, and a ten-cluster fleet manifest.
6. The full meridian fleet ran through the plugin: ten regional clusters, twenty components, 125 placements, built entirely through the governed verbs on a disposable self-hosted server. The build found a real capacity boundary, stopped with a named remediation, and resumes exactly where it stopped. The demo-aging step replays operations rather than faking state, so the attention tiles show real residue.
7. The homepage changed to match: the hero terminal now shows the ladder instead of one packaging command, the four starting questions became six, and the vocabulary got one line with a home for each noun.

## Review focus one: a user coming to the website

The homepage now answers "what can I do here" at three sizes. The reviewer should walk each row and confirm the page delivers what the row claims.

| Band | What the visitor can do | Where |
| --- | --- | --- |
| Entry | See what a chart installs before installing, in the browser, no login | Check my config |
| Entry | Find a tested component and pull its verified render | Catalog, 112 components |
| Entry | Compare versions and preview a promotion | Promote my config |
| Entry | Render a reviewed chart to controller-native OCI and let their existing Flux or Argo CD reconcile it | starting question 5 |
| Entry | Certify and render a whole platform for free | the ladder terminal, `cub stack sandbox` |
| Mid | Land CI-rendered YAML as governed data, canonically equal | the CI-rendered catalog journey |
| Mid | Release by digest and watch either reconciler apply exactly that digest | the delivery receipts |
| Mid | Promote through an approval gate that refuses first | the operator ladder |
| Keystone | Build a platform and run apps through it | Kubara, recorded live |
| Keystone | Speak a platform as one certified stack, any producer | the stack manifest spec and receipts |
| Keystone | Generate and read a governed fleet from manifests | starting question 6 |

Known honest edges the reviewer should keep honest: the plugin verbs are labeled proposed and prototype on the page, the plugin installs from the public repository with `cub plugin install confighub/cub-workshop --source-repo`, and the real-GPU rung remains the named unproven step.

## Review focus two: the value of the OCI catalog

The catalog is the substrate every rung stands on, and the review should check the site says so where it matters.

- Every free verb works anonymously because the catalog publishes verified renders and digest-pinned bundles to public OCI. The plugin pulls bundles by digest and hash-verifies them against receipts before a single object parses.
- Delivery claims are exact because releases and bundles share the digest discipline: the receipts show Argo CD and Flux each applying exactly the published digest, including through a governed change.
- The certified-bundle receipts are what let a platform be rebuilt from evidence alone, which the replica track proved end to end.
- The commercial line is drawn plainly: public catalog and public journeys are free, while private catalogs, team access, and production responsibility are the paid tier.

## Review focus three: blogs and examples

Every capability row above is also a post. The journeys already documented on the site each carry their receipts, so a writer cites rather than asserts: the CI-rendered catalog journey, the operator ladder with the gate that refused first, the Flux repeat, the stack sandbox for the keystone and for the catalog-composed platform, the fleet slice, the no-GPU proof, and the Kubara build. The reviewer should confirm each journey page stands alone: states what it proves, links its receipt, and names its limits.

## What to check by hand

1. Open the homepage and read the hero terminal as a newcomer. Does the ladder read as one story, and is the prototype labeling clear without deflating it?
2. Click all six starting questions. Each should land on a page that delivers its promise within one screen.
3. Follow the vocabulary line. Config, app, stack, and fleet should each resolve to a page that defines the noun and shows it running.
4. Read the CI-rendered catalog journey as the strongest enterprise entry and check the honest twist is stated: text stays frozen, data moves with its reason.
5. Run the install line from the page on a clean machine and confirm the four noun commands answer: `cub plugin install confighub/cub-workshop --source-repo`, then `cub config check redis`.
