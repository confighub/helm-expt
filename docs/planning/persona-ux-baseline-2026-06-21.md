# Persona UX Audit — Baseline (2026-06-21)

_First recorded run of the [persona UX strategy](../../tests/persona-ux-strategy.md): the worked
example and the baseline future audits diff against._

**UNOFFICIAL/EXPERIMENTAL.** A manual product-comprehension audit of the generated public site and
user docs, run **without changing them**. Inspected the generated `site/*.html` (home, try, charts
index, the Redis chart page, variants, journey, operations, docs, hard-questions, matrix) and the
`docs/user/*` a visitor would reach. This document is the output. Commercial / managed-edition
flows were out of scope, per the strategy.

## Quick page metrics (pre-scan)

Per page: command blocks · expected-output language · `npm run` mentions. Surfaces pages that
*explain* but never *show*.

| Page | Command blocks | Expected-output | npm mentions | Note |
| --- | ---: | ---: | ---: | --- |
| Home | 5 | 0 | 7 | Strong story, no concrete output checkpoints. |
| Get Started | 6 | 4 | 8 | Best first-run page, but opens with repo checks. |
| Helm Catalog | 0 | 0 | 0 | Good 100-chart entry, but no search/filter; hooks come before chart choice. |
| Redis chart page | 1 | 0 | 0 | Options + a command, but few "you should see" checks per option. |
| Variants | 1 | 1 | 0 | Good concept page, thin on run output. |
| Apps | 0 | 0 | 0 | Good existing-app answer, too abstract for a task user. |
| Ops | 1 | 0 | 0 | Needs a concrete first ops walkthrough. |
| Docs | 0 | 2 | 0 | Useful index, but many link labels are raw file paths. |
| FAQ | 0 | 0 | 0 | Strong skeptical route, but answers jump into deep docs/data. |
| Matrix | 0 | 0 | 157 | Useful as a database, too dense as primary UX. |

## Persona runs

### Persona 1: Novice Kubernetes user
- Profile: knows kubectl a little; used Helm once or twice; wants to try Redis without signing up.
- Task / fear: "I heard this helps me run Helm more safely. Show me the Redis demo."
- Path tested: Home → Get Started → Try → Redis happy path → Expected Results guide.
- Where it succeeded: the four-box homepage journey gives a sane first path; Get Started is obvious; Redis is the right teaching chart; the expected-results guide answers the cluster question.
- Where it failed: Get Started **opens with `git clone` + `npm run *:verify`**, so a novice thinks the product *is* repo verification; the actual thing to inspect after `cub installer setup` isn't shown inline.
- Improvement candidate: lead Get Started with the render + what-you-see, and label npm commands "verify the proof corpus," not the happy path.
- Voice owner: Alexis (framing) with Brian on the verify-vs-happy-path label.

### Persona 2: Low-skill Helm operator
- Profile: runs Helm from runbooks; wants copy/paste and simple pass/fail; nervous when docs branch into proofs/receipts/matrix.
- Task / fear: "Show me standard Helm and cub installer getting the same Redis result."
- Path tested: Home → Get Started → Expected Results And Clusters → Standard Helm baseline.
- Where it succeeded: the expected-results guide names what parity needs (chart, version, values) and warns a naked `helm install` is a smoke test, not a parity check.
- Where it failed: the Helm baseline lives behind a Markdown link, not on the page; `npm run kind-parity:run` is scary as a *first* parity command; no side-by-side "copy this Helm baseline" card next to the cub card; no visible expected-Helm-output box.
- Improvement candidate: a side-by-side Redis card (Helm vs cub installer: command, object count, live result, verification) with expected-output blocks.
- Voice owner: Brian.

### Persona 3: Helm expert / chart customizer
- Profile: comfortable with values files and chart internals; wants to customize Redis/Prometheus/nginx without losing the golden path; likely to fork a recipe.
- Task / fear: "Pick Redis existing-secret mode, then how would I make my own custom variant?"
- Path tested: Home → Helm Catalog → Redis chart page → Variants.
- Where it succeeded: the catalog labels catalog-supported vs proof-grade; the Redis page has matrix-derived option cards; the Variants page gives the right doctrine (base variant for render choice, derived variant for post-render refinement).
- Where it failed: no catalog search/filter (a 100-row table gets unwieldy); lots of raw artifact links before the user knows which option to pick; option cards lack a compact "copy this command / expected result / when to use it" layout; the fork/emulate path must be inferred from `variant.yaml` / package base / receipt; the `F1/F2/F4` matrix-layer terms aren't a plain customizer flow.
- Improvement candidate: a "Create a similar base" flow plus compact per-option cards; catalog search/filter.
- Voice owner: Brian.

### Persona 4: GitOps operator (Argo / Flux)
- Profile: runs Argo CD or Flux today; does not want a new in-cluster agent; wants to know if ConfigHub adopts existing apps and publishes OCI.
- Task / fear: "Can I load from my existing Argo apps, platform, stack, or live cluster?"
- Path tested: Home → Apps → "Can I start from an existing app?" → Adopting Existing Apps.
- Where it succeeded: the Apps page says existing apps/platforms/stacks/GitOps objects/live resources enter through discovery/import first; the adoption doc gives the low-risk first result (read-only discovery, no cluster change); the deployment-path doc explains OCI + Argo/Flux/cub-direct.
- Where it failed: the homepage still frames the first four boxes around *public catalog* use, so existing-app adoption isn't visible until Apps; the guide shows no actual `cub gitops discover/import` or `cub unit import` commands; no "bring your own cluster vs cub-lk" diagram; no controller-specific expected output (`Argo Application: Synced/Healthy`, `Flux OCIRepository/Kustomization: Ready=True`).
- Improvement candidate: a concrete GitOps-adoption guide with commands + controller output blocks; surface existing-app adoption on the homepage.
- Voice owner: Brian.

### Persona 5: SRE / on-call
- Profile: owns production incidents; distinguishes "applied" from "working"; wants to know if this prevents upgrade crashes and false-green sync.
- Task / fear: "Show me operating a live app: scan, patch, promote, observe, or roll back."
- Path tested: Home → Ops → FAQ → Why-Synced-Is-Not-Working / Upgrade-Crash example.
- Where it succeeded: the Ops page has the right categories (diff, scan, promote, OCI/GitOps delivery); the FAQ has strong synced-is-not-working / upgrade / hard-chart answers; the expected-results guide says controller sync alone isn't enough.
- Where it failed: Ops is mostly explanatory with one promotion command and no end-to-end walkthrough; no "you should see" examples for scan findings / gate / dry-run preview / changeset / controller status / observation receipt / rollback candidate; the upgrade-crash story is Markdown, not a web guide; the SRE bounces between Ops, FAQ, Matrix, and docs for one task.
- Improvement candidate: a single worked Ops journey with visible outputs at each step.
- Voice owner: Brian.

### Persona 6: Chart maintainer
- Profile: publishes a Helm chart; cares whether the catalog preserves *their* chart's hooks, CRDs, and lifecycle behavior; will check how their chart is represented.
- Task / fear: "What does ConfigHub do to *my* chart's hooks and CRDs?"
- Path tested: Home → Helm Catalog → a hook/CRD-bearing chart page → Hard Questions / hooks.
- Where it succeeded: the lifecycle-route disposition model exists; per-chart hook cards show observed/routed/blocked/refused with `automatic: false`; serious charts (cert-manager, kube-prometheus-stack) are present.
- Where it failed: hooks are framed for *consumers*, not *maintainers*; there's no "how your chart is treated / validate your chart" entry; the cub-direct CRD-ordering caveat isn't on the chart page where a maintainer would look.
- Improvement candidate: a maintainer-facing "how your chart is treated" card per chart (hooks routed, CRDs, prerequisites, what stays watch) — the per-chart adoption-caveats data feeds this directly.
- Voice owner: Brian.

### Persona 7: AI-curious product lead
- Profile: not deeply technical; wants the AI story; needs it concrete and safe before recommending it.
- Task / fear: "What can AI change here, and what keeps it safe?"
- Path tested: Home → "Why AI matters" → FAQ → hard-questions.
- Where it succeeded: the site says AI should propose variants, explain diffs, suggest patches, and operate fleets under ConfigHub gates.
- Where it failed: "what is safe for AI to change" stays abstract; no visible worked example of a gate / diff / rollback on an AI-proposed change; the value ("AI proposes, ConfigHub makes it visible, diffable, gated, reversible") isn't a single concrete panel.
- Improvement candidate: one concrete "AI proposes → ConfigHub makes it visible / diffable / gated / reversible" panel with a real diff + gate.
- Voice owner: Alexis (the motivation) with Brian on the gate contract.

### Persona 8: Skeptical technical reviewer
- Profile: knows Helm, GitOps, platform engineering, supply-chain claims; wants to know what is proven, what isn't, and whether AI changes stay controlled; will inspect matrix, FAQ, claims register, hard charts.
- Task / fear: "Convince me this isn't a proof toy. Show me hard cases, boundaries, and controlled AI change."
- Path tested: Home → FAQ → Matrix → kube-prometheus-stack chart page → Docs.
- Where it succeeded: the FAQ is genuinely skeptical; the matrix exposes non-green states instead of hiding them; kube-prometheus-stack is present as a serious chart; the claims register ties claims to evidence.
- Where it failed: the matrix is too dense to be a primary UX; the watch findings (fixed credentials, cub-direct prune, cub-direct CRD ordering, cub-scout env drift) aren't gathered into one honest "known gaps we surface" guide; some FAQ answers jump straight into deep docs/data.
- Improvement candidate: a "Known gaps we surface" guide, framed positively but honestly ("the awkward parts become visible before a user trusts the path"); link every FAQ answer to evidence.
- Voice owner: Brian.

## Ranked site plan (output)

Improvement candidates grouped by surface, each tagged with its voice owner. (Distilled — the
first-pass list ran to ~50 points.)

### A. Homepage & first impression
- **[Alexis]** shorter human problem story (values sprawl · hidden lifecycle · unsafe upgrades).
- **[Alexis]** a "What is ConfigHub?" box before the proof language; **[Brian]** define Unit / Space / Variant / Target / OCI bundle / Observation inside it.
- **[Brian]** a "What this does not claim" line (parity ≠ target fit / production readiness / every hook).
- **[Alexis]** make "Try Redis first" dominant; add "Pick your own chart from the catalog"; surface existing-app adoption here too.

### B. Get Started & parity demos
- **[Brian]** three visible modes (no cluster · local kind · ConfigHub-connected) with exact requirements each.
- **[Brian]** make npm proof commands optional ("verify the proof corpus"), not the happy path.
- **[Brian]** expected-output blocks after every command; a side-by-side Helm vs cub installer Redis card.

### C. Catalog & chart pages
- **[Alexis]** search/filter on the catalog (name, repo, proof level, hooks, CRDs, start-here).
- **[Brian]** per chart: "How do I run this?" summary, compact per-option cards, "which option to start with," row-specific watch reasons, source links; Redis as the gold standard.

### D. Variants, apps, existing systems
- **[Brian]** base vs derived variant routing rules; a worked Redis/Prometheus promotion with real commands.
- **[Alexis/Brian]** a "Can I load my existing app?" guide (read-only discovery first) with real `cub gitops discover/import` commands + controller output.

### E. Hooks, quirks, hard questions
- **[Brian]** a per-chart hook/action card (observed/routed/blocked/refused, who runs it) and the maintainer-facing "how your chart is treated" view.
- **[Brian]** one "Known gaps we surface" guide (fixed credentials, cub-direct prune, cub-direct CRD ordering, cub-scout env drift); **[Alexis]** frame it positively but honestly.
- **[Alexis/Brian]** a concrete "what AI can change, safely" panel (proposes → visible/diffable/gated/reversible).

### F. Site quality
- **[Brian]** a site-lint rule: every command block on Get Started + chart teaching pages has an expected-output block nearby.
- **[Brian]** a site-lint rule for voice + scope: intro pages may use product language; technical pages must include scope, prerequisites, and current-status links.

### Build order
1. Homepage "What is ConfigHub?" + shorter problem/value copy.
2. Redis gold-standard tutorial page.
3. Cluster/account badges + expected-output blocks on Get Started.
4. Catalog search/filter.
5. Chart pages: "How do I run this?" + row-specific watch reasons.
6. Existing-app and broken-chart triage guides.
7. The "what AI can change, safely" panel.
8. Site lint for expected outputs and voice/scope.
