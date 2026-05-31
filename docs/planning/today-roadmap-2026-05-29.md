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
for a skeptical Helm user:

```text
cub helm install = quick one-shot render into ConfigHub Units.
cub installer recipe = maintained, verified, variant-aware catalog artifact.
cub variant create = current clone/link primitive for post-render ConfigHub variants.
Creator contract = blueprint, preview, checks, and receipts over that primitive.
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
git diff --check: pass at the time of the handoff
npm run verify: rerun from current main before using this dated handoff
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
| UX-created variant | `Creator / From: redis/default / Blueprint: Environment clone / Target variant: prod-us-east` | Foundational user-led expression of the Variant Creator contract |
| AX-created variant | structured `create_variant` task | Agent-based expression of the same artifact |
| FX-created variants | `create 100 variants from a matrix` | Function-based expression of the same artifact over rows |

Today's concrete output:

- Keep [variant-creation-artifact.md](../reference/variant-creation-artifact.md) focused on
  the Variant Creator contract over current ConfigHub primitives.
- Treat the old `VariantCreationPlan` name as a working-name ancestor, not as a
  new backend entity.
- Keep [variant-creator-verification.md](../reference/variant-creator-verification.md)
  focused on verifying the artifact fields, previews, checks, and receipts.
- Do not add a new artifact unless the plan says who consumes it.

Acceptance:

- A reader can answer: "When do I create a new base versus clone a ConfigHub
  variant?"
- A reader can answer: "Why would a variant need target facts?"
- A reader can answer: "How does the same variant get made through UX, AX, and
  FX?"

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

Recorded ConfigHub example from the Kubara org:

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

- Keep [confighub-promotion-mapping.md](../reference/confighub-promotion-mapping.md) as the
  doctrine document.
- Keep [variant-promotion-worked-example.md](../reference/variant-promotion-worked-example.md)
  as the two-example explainer: Redis default -> prod-us-east, and
  external-dns managed base -> customer overlay variant.
- Make no more promotion-map artifact batches today.
- If adding an artifact, first decide whether the product home is:
  - existing `artifact-index.yaml` fields
  - the Variant Creator contract
  - ConfigHub metadata stored with the component/base Space

Acceptance:

- The promotion story can be explained in one minute:

```text
cub installer uploads a reviewed Redis base.
cub variant create clones the base, and the Creator contract describes preview/checks/fill values for prod-us-east.
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

Product tier:

```text
Kubara-style wrapper chart + platform values + customer overlay values is
Tier 3 managed overlay import, not merely the public catalog proof.
It needs ConfigHub Server, target facts, approvals, gates, variant creation,
and receipts. It may become a managed/commercial lane.
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
- Current note: [kubara-customized-overlays.md](../corpus/kubara-customized-overlays.md)
  records inspected `external-dns/external-dns@1.21.1` inputs and classifies
  what a managed wrapper/customer overlay import would need to capture.
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
| Variant Creator contract | Users need a clear way to describe prod/region/customer variants from a base. | `cub variant create`, space/unit clone substrate, upstream links, labels, targets, gates, placeholders, TransformPaths, functions |
| Shared artifact shape | UX, AX, and FX paths need the same fields. | Units, placeholders, TransformPaths, functions, gates |
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

1. **Land the creation explanation.**
   - PR #77 should remain small and readable.
   - It should explain how variants get created before leaning on examples.
   - It should define the Creator contract role without treating the old
     `VariantCreationPlan` name as user-facing product language.
   - Validate with `git diff --check` and `npm run verify`.

2. **Then make the promotion examples crisp.**
   - Summarize the Redis default -> prod-us-east Kubara org example.
   - Record the Unit-label nuance as a product question, not a conclusion.
   - Do not add product asks until the example is written clearly.

3. **Write the Kubara app analysis.**
   - Pick `external-dns` unless a better small case is found.
   - Identify wrapper chart, platform values, customer overlay values,
     dependency closure, and target facts.
- Classify which choices are recipe/base inputs versus post-render variants.
- State which product tier the example belongs to and why it is beyond a
  simple public/free catalog proof.

4. **Update #76 only with concrete evidence.**
   - Add a comment if the Kubara analysis lands.
   - Add a comment if the promotion example exposes a precise product gap.
   - Do not file elsewhere.

5. **Choose the next implementation step.**
   - If the product home is existing catalog metadata, extend
     `artifact-index.yaml` carefully.
   - If the product home is Variant Creator contract, refine
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
