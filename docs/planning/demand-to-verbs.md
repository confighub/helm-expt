# The demand map, from users to verbs

This is a planning record, not a decision. It grounds the site's journey and the
proposed `cub` verbs in written demand, so the order in which we build rests on who
our users are and what they ask, not on taste. Every layer below is already written
down somewhere in this repository. This document joins those layers into one chain
and pressure-tests each link against the evidence.

The chain is one line: **a user asks a question, an app or stack answers it, a `cub`
verb runs it, and the assistant makes it one step.** The rest of this document fills
that line in and marks where it holds and where it bends.

## Who the users are

Six personas are defined and stable across the product record. The canonical set
lives in [helm-community-persona-prd.md](./helm-community-persona-prd.md) with a
success signal for each, and again as a route matrix in
[helm-community-persona-reference.md](../reference/helm-community-persona-reference.md).

- A Helm user trying a popular chart, who wants Redis, NGINX, or Prometheus to work
  without learning a platform first.
- An application team or service owner, who needs dev, staging, and production
  variants from one reviewed base.
- A platform SRE or fleet operator, who manages many clusters and needs blast-radius
  preview before a change ships.
- A security, compliance, or audit reviewer, who needs proof that the object set
  reviewed is the object set that shipped.
- A GitOps operator, who already runs Argo CD or Flux and does not want ConfigHub to
  replace the controller.
- A chart or managed-service catalog maintainer, who wants maintained Helm usage to
  become a supported catalog rather than a pile of values files.

A seventh user is the assistant itself. The growth-strategy record and the doctrine
both treat the visitor's AI as a first-class user, not a feature.

**Where it holds.** The six are consistent across three documents and drive the
public offering page. **Where it bends.** The public offering page collapses the six
into five by folding the GitOps operator into the application team, and the
assistant-as-user appears only in the strategy and doctrine, not on the persona
pages. The persona canon and the public copy disagree by one seam.

## What they ask

The questions are written in three sets, at three grains.

The three entry questions organise the home page. They are "I need a configuration",
"I have a configuration, is it right?", and "I have an accepted configuration, can I
promote it?".

The four assessment questions sit under those and are restated in the doctrine. They
are what do I have, what will it produce, can this destination accept it, and did it
work.

The ten practical questions are the research-derived set in
[configuration-questions.mjs](../../scripts/lib/configuration-questions.mjs), each
with a frequency count. The counts come from a review of forty public Helm
discussions as of 2026-08-14. This is a small pre-outreach research sample, not site
usage data, and the file says so.

| Count | Question | Code |
| --- | --- | --- |
| 8 | What will this install, and what must already exist? | install-shape |
| 6 | How is this candidate different from production? | config-diff |
| 5 | I set a value. Why did the rendered object not change? | ignored-values |
| 5 | The chart does not expose the field I need. Must I fork it? | custom-field |
| 4 | Can I upgrade this chart without breaking production? | upgrade-risk |
| 4 | How should Argo CD or Flux handle this chart's hooks and CRDs? | lifecycle-work |
| 3 | Where does this vulnerable image run, and how can I update it safely? | fleet-image |
| 2 | Can I roll back to exactly what ran before? | rollback-history |
| 2 | Do these version and digest records identify the same bytes? | supply-drift |
| 1 | AI wrote these values. What did they actually change? | ai-values |

**Where it holds.** The questions are real, verbatim, and counted. **Where it bends.**
Forty discussions is a small sample, and it counts public Helm chatter from before
AI-written configuration was common, which is why `ai-values` sits last. The counts
rank today's volume, not where demand is going.

## What answers them

The doctrine states the job as "inspect, test, compare, change, promote, deploy,
operate, or build an application or platform"
([config-catalog-doctrine.md](../reference/config-catalog-doctrine.md), the browse
table). Application and platform are the two build targets, which is the same split
as `cub app` and `cub stack` in the
[custom stacks and apps proposal](https://github.com/confighub/helm-expt/pull/1653).

Five ConfigHub Apps are the named answers. Each carries a worked example and a
receipt, and each is currently marked working as an example but partial as a broader
product.

- The Upgrade App calculates fleet impact, tests a candidate, promotes it in waves,
  and checks the rollout. Its proof is a Redis 25 to 27 upgrade with rollback across
  two Argo CD clusters.
- The Hooks and CRDs App checks prerequisites, runs the required setup in order, and
  records what happened. Its proof is the Kube Prometheus Stack CRD and webhook
  sequence under Argo CD and Flux.
- The RBAC Review App finds risky access and proposes an exact correction. Its proof
  removes unnecessary Secret access under an approval gate.
- The Fleet Platform App assigns platform configurations to cluster groups and manages
  rollout waves. Its proof is a Kubara platform expanded across a Sveltos fleet with
  drift recovery.
- The AI Change Review App turns an agent's suggested edits into diffs, checks,
  approvals, and an unwindable revision. Its proof catches an unpinned image and an
  inline API key.

Three stack families are the compositions users build. The platform-services family
is the Kubara platform, which is cert-manager, Traefik, External Secrets, monitoring,
and Argo CD across a fleet. The inference family is the eks-inference stack, which is
ACK, an EKS cluster, Karpenter, a GPU runtime, and a sample vLLM workload across
three planes. The AI-workload family is the AICR set, which resolves Kubeflow
training and NIM or KServe inference platforms from a component registry.

**Where it holds.** Every app and stack above exists as a proof in the repository,
not as a slogan. **Where it bends.** All five apps are guarded as partial, so they
answer their question in a worked example but are not yet a finished self-serve
interface. The gap between the proof and the product is the honest state.

## The chain from a question to a verb

Joining the three layers gives the demand chain. The route matrix in the persona
reference already links each persona to a first question, so the rows below extend
that link out to the app or stack, the verb, and the assistant.

| Who | Asks | Answered by | Verb | The assistant |
| --- | --- | --- | --- | --- |
| Helm newcomer | What will this install? | a Catalog component, rendered | `cub check`, `cub stack` sandbox | reads the render and says what matters |
| App team | How does this differ from production? | the exact object diff | `cub check` compare | shows the few changes that matter |
| Helm newcomer | Why did my value not change? | the effective value path | `cub check` | finds the wrong path, or proves the field is unexposed |
| App team | Must I fork it for a missing field? | a derived configuration | `cub app` | writes the smallest post-render edit and flags upgrade overlap |
| App team, SRE | Can I upgrade without breaking production? | the Upgrade App | `cub app` promote | tests the candidate and promotes in waves |
| GitOps operator | How do Argo or Flux handle hooks and CRDs? | the Hooks and CRDs App | `cub app`, `cub stack` to their reconciler | sequences the routes |
| Platform SRE | Where does this image run, and how do I fix it? | the Fleet Platform App | `cub stack`, platform operations | inventories the estate and plans the wave |
| SRE, reviewer | Can I roll back to exactly what ran? | a retained digest | governance | restores the exact object set |
| Security reviewer | Do the records identify the same bytes? | receipts and digests | governance | compares records against retained evidence |
| App team or reviewer, for their AI's change | AI wrote these values, what changed? | the AI Change Review App | `cub check`, `cub app` review | the AI authored it, the human asks, the engine reviews and gates it |

## The funnel, measured

Grouping the ten questions by the band that answers them gives a shape. Nineteen of
the forty questions are answered at the entry, fourteen on the spine, and seven at
the keystone. The demand is a funnel, and the measured counts draw it rather than a
diagram asserting it.

## The build order

The order follows the counts. `cub check` and `cub app` answer the entry and the
spine, which is thirty-three of the forty questions and the most personas, so they
come first. `cub stack` is the altitude jump that unlocks the keystone's fleet and
AI-workload questions, so it follows. The certify step under `cub stack` is the moat,
and it has its own brief in the
[composition certification record](https://github.com/confighub/helm-expt/pull/1654).

`ai-values` sits last in the sample, but it is the assistant's own question and the
growth bet. The honest position is to serve today's volume with `cub check` and
`cub app` while treating the AI axis as the forward wager, stated as a wager rather
than inflated by the count.

## How AI makes it easy

The assistant does three jobs, and all three are already written down. It is a
first-class user, named in the strategy and voiced on the ask page as a persona that
brings AI-written values for review. It is a composer, which proposes variants and
stacks that the parity check and the composition verdict validate, so its
suggestions are inputs the engine certifies rather than results taken on faith. It
is the interface, which drives cub and ConfigHub so the person does not type the
commands.

The AI Change Review App is the proof, and reading it closely separates two claims
that are easy to blur. The proof starts from an agent-authored change to an AICR
training runtime that does three unsafe things at once. It asks for more nodes than
the target allows, swaps a digest-pinned image for a mutable tag, and leaves the API
key as an unfilled placeholder. Three actors appear. The AI authored the change, a
human asks what it did, and the engine, not another AI, reviews and gates it with
deterministic checks and an approval boundary. So the first thing the proof
demonstrates is that AI-authored change is made safe, because the gate says yes
rather than the assistant.

**Where it holds.** AI-safe is proven with a receipt today. A careless agent change
is caught before it ships, which is the custody wedge in one example, the assistant
computes from today's bytes and ConfigHub keeps the record. **Where it bends.**
AI-easy is a different claim and less proven. The assistant explaining a finding in
plain language and driving the whole surface in one step rides on top of AI-safe, and
the proof is a deterministic scenario stated plainly as not a transcript from a named
model. The composer role that assembles a stack from a goal still rests on the
composition verdict that is designed but not yet built. The honest order is that
safety is proven and ease is the build still ahead.

## What the pressure-test found

Three of the five app lanes were verified and pass, the Upgrade App, the AI Change
Review App, and the RBAC Review App. All five were then scanned for whether an
assistant actually drives them. The same seam runs through every one, so what follows
separates what is proven from what is claimed.

What is proven is the custody spine. The Upgrade App is a live test on two Argo CD
clusters. It carries a post-render replica change through a Redis 25 to 27 upgrade,
shows which environment variants are waiting, promotes through development and staging
behind a dry-run, reconciles the same OCI digest on both clusters, then restores the
exact pre-upgrade revisions and reconciles the rollback, with an exact-object and
workload check at every step. This is safety, and it is real. The Upgrade App also
answers more of the demand than its one row. The surviving replica edit is the
custom-field question, the promotion dry-run is the config-diff question, and the
rollback is the rollback-history question, so one app covers four of the ten. That
strengthens the case for building the spine early.

What is not yet proven is the assistant on top. The Upgrade App proof contains no AI
at all, because a person drives cub and ConfigHub. The RBAC Review App proposes its
correction with deterministic review logic, not an AI, and the Fleet Platform App is
cub, ConfigHub, and Sveltos with no assistant in the path. Across all five apps an AI
appears in exactly one, the AI Change Review App, and there only as the author of the
reviewed change. An assistant drives none of them yet. So the proven layer is the
deterministic custody mechanism, and the AI-makes-it-easy layer, the assistant that
proposes, explains, and drives in one step, sits above it and is the build still
ahead. The honest order is safety first, proven, then ease, next.

## Honest limits

The frequency counts are a forty-discussion research sample, not usage data. The
`cub app`, `cub stack`, and platform verbs are proposed, not shipped, so this
document describes a demand map and a build order, not a released surface. The five
apps are proofs, not finished products. Naming the verbs is still open and should be
settled with the author of `cub server`.

## Where this sits

The visual form of this chain is the Keystone and Spine map, which carries the same
personas, questions, verbs, and the ground-floor demand matrix. This document is its
committed, cited counterpart. It pairs with the
[custom stacks and apps proposal](https://github.com/confighub/helm-expt/pull/1653),
which names the verbs, and the
[composition certification record](https://github.com/confighub/helm-expt/pull/1654),
which builds the moat under `cub stack`. Every claim here rests on committed
evidence, which is rule 10 of [the doctrine](../../tests/doctrine.md).
