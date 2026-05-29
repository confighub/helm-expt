# Today Roadmap - 2026-05-29

This is the focused handoff plan for another AI or teammate to lead today.
It turns the current thread into executable work without requiring the full
conversation history.

## Mission For Today

Help the ConfigHub team get to a better product by making careful,
evidence-backed suggestions from `helm-expt`.

The product story stays:

```text
Use Helm charts.
Create durable cub installer recipes.
Ship safe ConfigHub variants.
Prove the exact configs before and after deployment.
```

The tactical goal today is to make variant creation and promotion clear enough
for Brian, Jesper, and a skeptical Helm user:

```text
cub helm install = quick one-shot render into ConfigHub Units.
cub installer recipe = maintained, verified, variant-aware catalog artifact.
cub variant create = post-render ConfigHub variant creation from a reviewed base.
ConfigHub Promotion = review and advance changes across those variants.
```

## Current State

Issue:

```text
#76 Define Helm import path from cub helm install to cub installer recipes
```

PR:

```text
#77 Document ConfigHub promotion mapping doctrine
```

Verification before this handoff:

```text
git diff --check: pass
npm run verify: pass
```

Important correction made today:

```text
Do not generate a batch of standalone per-chart promotion-map YAML files unless
they are consumed by product code, a verifier, an agent workflow, or ConfigHub
UI/CLI. Product contract first; artifacts only when useful.
```

## Operating Rules

1. Work inside `confighub/helm-expt` unless Alexis explicitly approves work
   elsewhere.
2. Do not file issues outside `confighub/helm-expt` without asking first.
3. Do not create one-off artifacts just because they are easy to generate.
4. Prefer existing ConfigHub/cub primitives before proposing new primitives.
5. Every product suggestion should be backed by repo evidence, a concrete test
   case, and an acceptance check.
6. Keep user-facing language simple. Internal nouns belong in docs and
   machine-readable artifacts, not the happy path.

Suggested product-suggestion template:

```text
Observed pain:
Evidence in helm-expt:
Existing ConfigHub/cub primitive:
Smallest product gap:
Suggested UX:
Acceptance check:
What not to build yet:
```

## Workstream 1 - Variant Creation Doctrine

Goal:

```text
Make it clear how users create variants from a reviewed base without learning
all the internal machinery.
```

Doctrine:

```text
Recipe/package base = choices that affect Helm rendering.
ConfigHub variant = post-render refinement of an already-rendered base.
If a change requires rerendering Helm, route back to the recipe/base path.
If a change mutates already-rendered Units, use ConfigHub variant creation.
```

Three variant creation modes to keep aligned:

| Mode | User shape | Product surface |
| --- | --- | --- |
| Base variant | `redis/default`, `redis/reuse-existing-secret` | `cub installer setup --base ...` |
| Guided variant | `Create prod-us-east from redis/default` | Variant Creator / `cub variant create` porcelain |
| Fleet variant | `create 100 variants from a matrix` | Same blueprint as a function over rows |

One artifact with three surfaces:

```text
UX: guided human wizard
AX: structured agent task with checks and receipts
FX: parameterized fleet function over one row or many rows
```

Today's concrete output:

- Keep [variant-creation-artifact.md](variant-creation-artifact.md) focused on
  this doctrine.
- Keep [variant-creator-verification.md](variant-creator-verification.md)
  focused on invariants, goldens, and proof across UX/AX/FX.
- Do not add a new artifact unless the plan says who consumes it.

Acceptance:

- A reader can answer: "When do I create a new base versus clone a ConfigHub
  variant?"
- A reader can answer: "Why would a variant need target facts?"
- A reader can answer: "What does the user see, what does an agent see, and
  what does a fleet function execute?"

## Workstream 2 - Test Case A: Promotions

Goal:

```text
Show how a reviewed Helm-derived base becomes downstream ConfigHub variants
that can be reviewed and promoted.
```

Primary example:

```text
Redis default base -> prod-us-east variant
```

Current live ConfigHub example in the Kubara org:

```text
base Space: helm-redis-mapping-default
variant Space: helm-redis-mapping-prod-us-east
component: Redis
base units: 15
variant units: 15
clone edge: statefulset-redis-redis-master default -> prod-us-east
```

Important observation:

```text
Space labels carry the downstream Variant value.
Cloned Unit labels may still carry the source base Variant unless the clone
operation also patches Unit labels. That is a product/UX point to inspect
carefully before making a broad suggestion.
```

Today's concrete output:

- Keep [confighub-promotion-mapping.md](confighub-promotion-mapping.md) as the
  doctrine document.
- Make no more promotion-map artifact batches today.
- If adding an artifact, first decide whether the product home is:
  - existing `artifact-index.yaml` fields
  - a formal Variant Blueprint / VariantCreationPlan
  - ConfigHub metadata stored with the component/base Space

Acceptance:

- The promotion story can be explained in one minute:

```text
cub installer uploads a reviewed Redis base.
cub variant create clones it into prod-us-east.
ConfigHub Promotion shows the relationship and the diff.
Future base changes can be reviewed and promoted into prod-us-east.
```

- The doc states the code changes needed, but frames them as careful product
  suggestions, not demands.
- No external GitHub issues are filed.

## Workstream 3 - Test Case B: Kubara Customized Platform Apps

Goal:

```text
Use Kubara-style managed Helm apps to test whether the model handles wrapper
charts and customer overlay values, not just public upstream charts.
```

Doctrine:

```text
The import unit is often not one public chart.
The real import unit is:

managed wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + render context
```

Why this matters:

```text
Public charts prove breadth.
Kubara wrapper charts prove whether the model survives real platform choices:
provider settings, cluster issuer settings, storage buckets, external secrets,
ingress classes, CRDs, and dependency assumptions.
```

Recommended first candidates:

| Candidate | Why |
| --- | --- |
| `external-dns` | Provider values, webhook image, DNS credentials, ExternalSecret/target facts. |
| `cert-manager` | ClusterIssuer values, CRDs, webhook readiness, capability profile. |
| `metrics-server` | Smaller wrapper baseline; overlaps existing top-20 proof. |

Recommended first golden:

```text
external-dns
```

Reason:

```text
It shows the difference between quick render and maintained recipe most clearly:
provider-specific overlay values and secret/credential target facts are not
accidental details. They are part of the managed release recipe.
```

Today's concrete output:

- Add or update a Kubara mapping note only if it records real inspected inputs.
- Classify each required value into one of:
  - source lock
  - dependency lock
  - managed default
  - customer overlay value
  - base variant selection
  - target fact
  - generated fact
  - post-render ConfigHub variant field
  - lifecycle policy / hook / CRD disposition
- Do not claim a full Kubara golden until render, comparison, and verification
  evidence exists.

Acceptance:

- One Kubara app has a clear "what would import need to capture?" analysis.
- The analysis explains how customer choices become safe variant inputs.
- The analysis identifies which choices require Helm rerendering and which can
  be post-render ConfigHub refinements.

## Workstream 4 - Helm Import Issue And Roadmap

Canonical issue:

```text
https://github.com/confighub/helm-expt/issues/76
```

Use this issue for:

- `cub helm install` versus `cub installer` recipe positioning.
- The import bridge from quick render to maintained catalog artifact.
- Redis as the first golden class.
- Kubara wrapper chart + overlay values as the second golden class.
- Promotion mapping from recipe/base to ConfigHub variants.

Do not use this issue to:

- Track implementation in another repo.
- Claim `cub installer import helm` exists.
- Demand a new backend engine.
- Hide hooks, target facts, generated secrets, or customer overlay values.

Today's issue work:

- Add comments only when they contain new evidence, a decision, or an
  acceptance check.
- If a new issue is needed, file it only in `confighub/helm-expt`.
- Prefer improving #76 over creating duplicates.

## Workstream 5 - Product Suggestions To ConfigHub Team

Careful suggestions that are currently justified:

| Suggestion | Why it is justified | Existing primitive |
| --- | --- | --- |
| Variant Creator UX | Users need an easy way to create prod/region/customer variants from a base. | `cub variant create`, bulk clone, labels, targets, gates |
| Blueprint/Creator contract | Human, agent, and fleet workflows need the same plan. | Units, placeholders, TransformPaths, functions, gates |
| Promotion clarity | Helm-derived bases should appear as components with variant nodes. | `Component`/`Variant` labels, `Unit.UpstreamUnitID`, Promotion UI |
| Import bridge | One-shot Helm render should graduate into maintained recipe/package artifacts. | `cub helm install`, `cub installer` package path |
| Target facts in variants | Post-render variants still need target-specific values and checks. | target facts, triggers/functions, checks |

Suggestions that are not justified yet:

- A new standalone per-chart promotion-map YAML batch.
- A new backend variant system.
- A claim that all Kubara apps are fully imported.
- A claim that `cub installer import helm` exists.
- External project issues without explicit approval.

## Sequence For Today

1. **Land the doctrine cleanup.**
   - PR #77 should remain small and readable.
   - It should contain doctrine, not a large new artifact family.
   - Validate with `git diff --check` and `npm run verify`.

2. **Make the promotion example crisp.**
   - Summarize the Redis default -> prod-us-east Kubara org example.
   - Record the Unit-label nuance as a product question, not a conclusion.
   - Do not add product asks until the example is written clearly.

3. **Write the Kubara app analysis.**
   - Pick `external-dns` unless a better small case is found.
   - Identify wrapper chart, platform values, customer overlay values,
     dependency closure, and target facts.
   - Classify which choices are recipe/base inputs versus post-render variants.

4. **Update #76 only with concrete evidence.**
   - Add a comment if the Kubara analysis lands.
   - Add a comment if the promotion example exposes a precise product gap.
   - Do not file elsewhere.

5. **Choose the next implementation step.**
   - If the product home is existing catalog metadata, extend
     `artifact-index.yaml` carefully.
   - If the product home is Variant Blueprint, refine
     `variant-creation-artifact.md`.
   - If the product home is ConfigHub metadata, write the smallest product ask
     as a helm-expt issue first.

## Verification

Required before handoff:

```sh
git diff --check
npm run verify
```

Optional but useful:

```sh
npm run top20:verify-local-e2e
npm run catalog:review:verify
npm run external-scan:verify
```

No today's-work PR should merge if:

- it adds a new artifact family with no consumer;
- it makes the user-facing path harder than Helm;
- it files or relies on issues outside `confighub/helm-expt`;
- it weakens the top-20 proof claims;
- it makes a future command sound available today.
