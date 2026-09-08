# Stories at each band: entry, spine, keystone

**Status:** companion to the Workshop plan. Anonymised for the public repo:
people appear as roles, prospects appear generically, product names stay.

**What this is.** The stories behind the ladder options, written down. Three
kinds of material sit under each band: the doctrine's worked stories (the
AI-driven examples the site generates), the six personas' success signals, and
the real wins of the first cohort of three, found in the working record and
anonymised. This is evidence for the maintainer's ladder decision, not a
decision.

**The AI-first thread runs through all of it.** In every doctrine story the
shape is the same: the assistant does the easy part and the gate does the safe
part. The growth strategy and the doctrine both treat the visitor's AI as a
seventh user, a first-class user rather than a feature. The assistant has three
jobs: it is a user that brings AI-written values for review; it is a composer
that proposes variants and stacks the checks validate; and it is the interface
that drives `cub` and ConfigHub so the person does not type the commands. The
honest split in the record: AI-safe is proven with receipts today; AI-easy is a
different claim and less proven, and the composer that assembles a stack from a
goal rests on a composition verdict that is designed but not fully built.

## The band model, as the research found it

The topology is called Keystone and Spine: narrow entry points where a person,
or their AI, arrives with a real problem; a spine where AI and delivery both run
end to end; and the Kubara keystone the whole site drives toward. Enter narrow,
travel the spine, arrive at the keystone.

The entry is organised by three questions: I need a configuration; I have a
configuration, is it right; I have an accepted configuration, can I promote it.
Under them sit the four assessment questions: what do I have, what will it
produce, can this destination accept it, did it work.

The funnel is measured. Of forty sampled demand questions, nineteen are answered
at the entry, fourteen on the spine, seven at the keystone. The build order
followed the counts: `cub check` and `cub app` first (thirty-three of forty
questions and the most personas), then `cub stack` as the altitude jump that
unlocks the keystone's fleet and AI-workload questions, with certify as the
moat.

The audit line that maps the three real people onto the three gaps: the site
jumped from check to promote and skipped the middle. Upload and release had no
first-class page (the product lead's rung), the composition and stack rung was a
report rather than a step (the platform architect's rung), and there was no
inference-shaped spine (the fleet operator's rung).

## Entry

### The doctrine stories

**What will this install, and what must already exist?** A Helm newcomer asks
the most common question in the demand sample. The assistant answers it from the
committed render: the objects, what the chart hides, what the cluster must
already have. The gate does the safe part, refusing any object or prerequisite
the render does not support, and refusing to omit one. Nothing is guessed;
everything cited comes from a record.

**I set a value. Why did the rendered object not change?** A Helm user asks the
question that produces most of the confusion in the community. The answer
compares the render with and without each supplied values key and names the
misspelled or misplaced path.

**The chart exposes no value for the field I need. Must I fork it?** An
application team needs a field the chart does not expose. The assistant answers
no, and proposes the smallest post-render edit: keep Helm, then record a
reviewed object-level change after rendering. The gate checks that the edit is
real. This story sits on the seam between the entry and the spine: a reviewed
change is the first thing worth keeping.

### The persona signal

The Helm user trying a popular chart: "I can try the chart as quickly as Helm,
but I can see and prove more."

### The real win: the product lead

The product lead owns the free-to-account-to-paid funnel and the site's front
door. Their calls shaped the entry. "Check my config" became the primary call to
action rather than "Find a configuration." The `cub check` scan-plugin dance was
cut. The naming settled on `cub server`, "like GitHub and the `gh` CLI," with a
lightweight local server as "a twenty-second exercise to get ConfigHub running
locally, a stepping stone." The audit persona modelled on them cares about
product accuracy, no overclaiming, and the funnel. Their larger proposal, the
marketplace, reaches to the top of the climb (the keystone section, and the
plan), but the rung they own operationally is the entry.

### What this band names as missing

Upload and release had no first-class page: the entry led straight to promote
and skipped the step where a checked configuration is kept.

### Ladder options this band exemplifies (informational)

The verb ladder's free rungs (`check`, `deploy`); the product lead's funnel
(the front door, the stepping stone); the website ladder's entry rows (see what
a chart installs in the browser with no login; certify a whole platform for
free).

## Spine (mid)

### The doctrine stories

**How is this candidate different from production?** An application team asks
the second most common question in the demand sample. The answer compares
object identity and normalised fields, not line order, and attributes each
change to its place: the source input, a post-render variant, destination or
lifecycle setup, or live-only drift.

**Can I upgrade this chart without breaking production?** An application team
runs one version in production and holds a candidate. The assistant names the
upgrade's hazards from the records; the gate refuses to invent a hazard or miss
one. The proof behind it: the live Upgrade App reconciled the same upgrade on
two clusters without recreating anything.

**If my chart has hooks, what happens?** A GitOps operator asks a spine
question about lifecycle work. The assistant names the CRDs, hooks, setup jobs,
and prerequisites as recorded route intents; the gate does the safe part,
checking them against what the render and receipts actually contain.

**Can I roll back to exactly what ran before?** An operator asks. The assistant
answers yes and points at the retained revisions; the gate checks that against
the committed receipt of the live rollback, so "exactly" means the same bytes.

**Did the bytes behind this version change?** A reviewer compares the digest
the recipe locked against the digest the publisher later served. The catalog
keeps the reviewed bytes and records both digests, so a version string alone is
never taken as identity.

**From review to promotion.** The anonymous review is the front door; the
governed promotion is the spine. They carry the same reviewed bytes from one to
the other, checked against a real promotion.

### The persona signals

The application team or service owner: "I can create prod from a reviewed base
and see the few changes that matter." The security, compliance, or audit
reviewer: "I can prove which objects were checked and what was observed later."
The GitOps operator: "I can keep Argo or Flux, but the input becomes reviewed
and provable."

### The app proof

The Upgrade App: a Redis upgrade from one major to the next, with rollback,
across two Argo CD clusters. It covers four of the ten demand questions on its
own.

### The real win: a founding maintainer of Kubara

External validation from the author of the platform generator the site drives
toward. In mid-August the maintainer reported that the Kubara founder "likes
the blog": the co-marketing post on building a small internal developer
platform with Kubara and ConfigHub. The founder's own published piece on Kubara
catalogs sparked a follow-up idea: the Workshop's catalog used as a Kubara
upstream, an external catalog. They are a confirmed real user of both. The audit
persona modelled on them is a GitOps-first platform architect who composes
tested components into governed platforms and hates hand-waving.

They live on the composition rung. Custom stacks are the middle rung (`cub
stack`), rising to the platform, which is the full governed keystone. Their
story is the spine's: compose tested parts, certify the composition, then walk
it up.

### What this band names as missing

The composition and stack rung was a report rather than a step. The middle of
the value ladder, upload and release and the composition rung, had no
first-class surface.

### Ladder options this band exemplifies (informational)

The verb ladder's account rungs (`upload`, `release`, `promote`) and its
composition rung (`stack certify`, `sandbox`); the adoption bands' spine; the
Workshop's tools and doorway columns; the flywheel's make-and-keep half.

## Keystone

### The doctrine stories

**Where does this vulnerable image run, and how do I update it safely?** A
platform SRE asks a keystone question. The assistant does the easy part,
placing the image across the fleet; the gate does the safe part, refusing to
misplace it or miss an environment, by checking every claim against the
committed fleet blast-radius matrix.

**An agent-authored change, caught.** An agent proposes a change to an AICR
training runtime. It asks for more nodes than the target allows, swaps a
digest-pinned image for a mutable tag, and leaves the API key as an unfilled
placeholder. The engine catches all three. The gate says yes rather than the
assistant. This is the AI Change Review story, and it is the keystone's
argument in one example: the more the assistant can do, the more the gate
matters.

**The keystone speaks the vocabulary.** `cub stack sandbox eks-inference`
certifies and renders a whole inference platform, cloud network to workload,
for free, from digest-pinned certified bundles. The eks-inference replica
merges the two keystones, because the platform builder manufactures the AI
platform, and it converts the stack from a crafted artifact into a reproducible
product of the catalog.

### The persona signals

The platform SRE or fleet operator: "I can change a hundred variants without
guessing which clusters or objects are in scope." The chart or managed-service
catalog maintainer: "I can turn maintained Helm usage into a supported catalog,
not a pile of values files."

### The app proof

The Fleet Platform App assigns platform configurations to cluster groups and
manages rollout waves. Its proof is a Kubara platform expanded across a Sveltos
fleet with drift recovery. This is the Kubara keystone win.

### The real win: an operator of a large GPU inference fleet

A meeting with a GPU-platform operator at a GPU vendor in late August drove the
inference track. Their fleet team's email described a hundred-plus GPU
clusters, templated configuration, an app-of-apps layout, and qualified
bundles; the maintainer mapped it onto the five Sveltos journeys and built a
deck, then rebuilt the deck to fold in the meeting: the eks-inference facts, the
sandbox, and a slide scoring the operator's seven "cluster in a box" asks
honestly as now, path, or not yet. A coverage map at the end of August checked
every requirement against the Workshop and ConfigHub. The headline in the
record: the whole of what the operator and their colleague asked for is
addressed end to end at the configuration plane today; the certified
configuration hub thesis is demoable now through the vendor's own six-step AICR
test; the H100 inference run is the single buyable proof.

Trust is earned at the entry and spent at the keystone. The record is specific
about what moves this person from skeptic to trusting: the distinction between
blocked and failed, honest rollback limits, and the comparison page. The audit
persona modelled on them is a skeptical, time-poor GPU-platform operator.

### What this band names as missing

There was no inference-shaped spine: the path from one GPU chart to a governed
GPU fleet was not drawn as a climb.

### Ladder options this band exemplifies (informational)

The adoption bands' keystone; the marketplace ladder's destination (press a
button, it lands in your own org, sets up your clusters, everything queryable);
the scale ladder's fleet rung; the verb ladder's paid rung (`govern`).

## The cohort as the first trial

The record names these three as the natural first three humans for a trial: a
twenty-minute script, three links sent. Each embodies one band, and each names
one of the three gaps the site had.

## Reference table

| Band | Doctrine story (the assistant does the easy part, the gate the safe part) | Persona signal | App proof | Real win (anonymised) | Gap the story names | Ladder options exemplified |
|---|---|---|---|---|---|---|
| **Entry** | what will this install, and what must already exist; why did my value not change; must I fork for one field | "as quickly as Helm, but I can see and prove more" | the browser check; `cub stack sandbox` for free | the product lead: "Check my config" as the front door, `cub server` as the twenty-second stepping stone | upload and release had no first-class page | verb ladder free rungs; the product lead's funnel; website ladder entry rows |
| **Spine (mid)** | how is this candidate different from production; can I upgrade safely; what do my hooks do; can I roll back exactly; did the bytes change; review to promotion | "prod from a reviewed base"; "prove which objects were checked"; "keep Argo or Flux, but reviewed and provable" | the Upgrade App: a major upgrade with rollback across two clusters | a founding maintainer of Kubara: the co-marketing post, the catalog as a Kubara external upstream, the composition rung | the stack rung was a report, not a step | verb ladder account and composition rungs; adoption bands' spine; Workshop tools and doorway; the flywheel's make half |
| **Keystone** | where does this image run and how do I fix it safely; the agent-authored change caught by the gate; the keystone speaks the vocabulary | "change a hundred variants without guessing"; "a supported catalog, not values files" | the Fleet Platform App: a Kubara platform across a Sveltos fleet with drift recovery | an operator of a large GPU fleet: seven asks scored now, path, not yet; the H100 run as the buyable proof | no inference-shaped spine | adoption bands' keystone; the marketplace destination; the scale ladder's fleet; verb ladder paid rung |

## Sources

Repo: `docs/planning/demand-to-verbs.md`, `docs/planning/website-ladder-review-2026-09-01.md`,
`docs/planning/ladder-on-spine.md`, `docs/planning/cub-noun-vocabulary.md`,
`docs/planning/custom-stacks-and-apps.md`, `docs/planning/eks-inf-replica-plan.md`,
`docs/planning/helm-community-persona-prd.md`, `docs/planning/composition-certification.md`,
and the AI-driven example generators under `scripts/generate-ai-*.mjs`
(install-shape, ignored-values, custom-field, config-diff, upgrade-risk,
lifecycle-work, rollback-history, supply-drift, promotion-handoff, fleet-image,
change-review). The real wins are from the working record of August 2026,
anonymised here.
