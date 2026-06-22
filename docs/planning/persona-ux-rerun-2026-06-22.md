# Persona UX Rerun, 2026-06-22

**UNOFFICIAL/EXPERIMENTAL.** Rerun of
[persona-ux-strategy.md](../../tests/persona-ux-strategy.md) after the adoption-lens
site updates: per-chart adoption caveats, known gaps, managed cub-direct wording,
Component/Variant language, AI-assisted changes, broken-chart triage, and chart-page
persona content.

Scope: free/public website and linked public docs only. Commercial and managed-edition
flows are out of scope for this rerun.

## Page Metrics

Command blocks, expected-output language, and `npm run` mentions were counted from the
generated site files.

| Page | Command blocks | Expected-output blocks | `npm run` mentions | Current reading |
| --- | ---: | ---: | ---: | --- |
| Home | 5 | 0 | 7 | Clearer story and vocabulary, but still no concrete output checkpoint. |
| Get Started | 5 | 5 | 10 | Best first-run page; still needs clearer separation between happy path and proof-corpus checks. |
| Helm Catalog | 0 | 0 | 0 | Better 100-chart entry; still needs search/filter and stronger chart-choice flow. |
| Redis chart page | 4 | 4 | 0 | Much stronger. It now has run commands, expected output, and adoption caveats. |
| Variants | 3 | 1 | 0 | Better Component/Variant model; still needs a more concrete create/promote walkthrough. |
| Apps | 0 | 0 | 0 | Good concept page, but no task-level app walkthrough yet. |
| Ops | 1 | 0 | 0 | Right categories, but still lacks a complete worked operations journey. |
| Docs | 0 | 0 | 0 | Good guide index; still mostly a route map rather than a guided task. |
| FAQ | 0 | 0 | 0 | Strong skeptical answers; still jumps quickly into docs/data. |
| Known gaps | 0 | 0 | 0 | New and useful. Works as the honest watch-finding front door. |

## Persona Rerun

### 1. Novice Kubernetes User

Task: try Redis without first understanding the proof machinery.

Current result: improved. Get Started and the Redis chart page now show expected results.
The user can see what to inspect after `cub installer setup`.

Still weak: the homepage and Get Started still mention repo/npm verification early enough
that a novice may think the product is the verifier suite.

Next improvement: make "try the Redis path" visually dominant and label npm commands as
optional proof-corpus verification.

### 2. Low-Skill Helm User

Task: compare regular Helm with cub installer and copy the right commands.

Current result: improved. Redis now has concrete run and expected-output blocks. The
expected-results guide explains cluster options.

Still weak: the side-by-side Helm baseline is not yet a single compact web card with
object counts and live status.

Next improvement: add a Redis parity card: regular Helm command, cub installer command,
expected object count, and the check that proves equivalence.

### 3. Helm Expert Or Chart Customizer

Task: choose existing-secret mode, then create a similar custom path.

Current result: improved. The Variants page now explains Component and Variant, and chart
pages expose per-chart adoption caveats.

Still weak: the fork or emulate path is still mostly a documentation route. The chart page
does not yet say "create a similar base" as a task.

Next improvement: add a chart-page action for "create a similar base" with links to
`variant.yaml`, package base, and the migration guide.

### 4. GitOps Platform Engineer

Task: keep Argo or Flux and understand what changes.

Current result: improved. The delivery path now states that Argo/Flux are the cleaner path
for CRDs and upgrades, and How It Works has one adoption-caveat block.

Still weak: existing-app adoption is not visible early enough, and controller-specific
expected output is missing.

Next improvement: add an existing-app adoption web guide with expected Argo and Flux
status examples.

### 5. SRE Or On-Call Engineer

Task: know whether this prevents upgrade crashes and false-green sync.

Current result: improved. Known gaps are now explicit. The no-prune, CRD ordering, SSA
conflict, and drift-coverage findings are visible instead of buried.

Still weak: Ops is still mostly explanatory. It needs a worked journey from scan to patch
to approval to delivery to observation to rollback candidate.

Next improvement: add a single Ops walkthrough with "you should see" blocks.

### 6. Chart Maintainer

Task: understand how ConfigHub treats the chart's hooks, CRDs, and adoption caveats.

Current result: improved. Every chart page now links to adoption caveats, and the catalog
has hook/action language.

Still weak: the maintainer view is still implicit. A maintainer has to infer how their
chart is represented from consumer-facing pages.

Next improvement: add a maintainer-facing card on chart pages: hooks/actions, CRDs,
target facts, adoption caveats, and how to send a problem chart.

### 7. AI-Curious Product Lead

Task: understand what AI can safely change.

Current result: improved. The AI-assisted changes guide exists, and the Component/Variant
model makes "AI changes a variant" easier to explain.

Still weak: there is no concrete AI example on the website with a real diff, gate, and
rollback story.

Next improvement: add a small AI panel: propose variant change, review diff, pass gates,
deliver, observe, roll back if needed.

### 8. Skeptical Reviewer

Task: find hard cases, limits, and whether awkward gaps are hidden.

Current result: improved. Known gaps are now collected, chart pages surface caveats, and
How It Works states managed cub-direct caveats directly.

Still weak: the matrix remains too dense as a first skeptical UX. The reader still needs a
short path from "what can fail?" to "show me the evidence."

Next improvement: make FAQ answers route through Known Gaps, serious charts, and the chart
page before sending the reader to raw data.

## Ranked Follow-Up Plan

1. Add a compact Redis parity card with Helm command, cub command, expected object count,
   and equivalence check.
2. Separate happy-path commands from optional npm proof-corpus verification on Get Started.
3. Add catalog search/filter by chart, proof level, hooks, CRDs, and caveats.
4. Add "create a similar base" to chart pages for Helm experts.
5. Add an existing-app adoption web guide with Argo and Flux expected output.
6. Add one complete Ops walkthrough with scan, patch, approval, delivery, observation, and
   rollback candidate.
7. Add a maintainer-facing chart card for hooks, CRDs, target facts, caveats, and problem
   chart intake.
8. Add a concrete AI-assisted change panel with diff, gate, delivery, observation, and
   rollback story.
9. Reduce FAQ jumps into raw data by routing first through guides.
10. Keep Known Gaps and per-chart adoption caveats visible on every path where cub could
    otherwise feel worse or more confusing than plain Helm.

## Acceptance Check

The adoption-lens items requested after #1016 through #1021 are present:

- per-chart adoption caveats are linked from chart pages;
- known gaps are gathered in one guide;
- managed cub-direct applier wording is in How It Works, delivery docs, and doctrine;
- default persona scope is free/public unless explicitly widened.

The remaining work is product UX depth, not proof-surface plumbing.
