# helm-expt Persona UX Strategy

_The persona-UX layer of the [helm-expt test map](README.md) — group **E. UX / journey**._

**UNOFFICIAL/EXPERIMENTAL.** This is a **product-comprehension** test, not a browser-polish
checklist. The proof lanes (groups A–D, F, G) tell us whether the *model* works; a persona UX
audit tells us whether a real visitor can **understand, trust, and use** helm-expt without
reading the whole repo. It complements — never replaces — generated proof and live evidence.

## When to run (the rule)

Run a persona UX audit **after any major public-site or user-doc change**, and before a release
or live demo. Not after every edit. A "major change" means new or restructured site pages, a new
user journey, a reworked landing / FAQ / catalog, or a batch of `docs/user/*` rewrites.

## What it tests

A real visitor arrives with a task or a fear and a handful of obvious, slightly dumb questions.
The audit asks: can they get an answer, on the current site, before they bounce? Each persona is
run as a task, walking the site **without changing it** — the audit log is the only output.

The task-run shape:

```text
landing page
 -> first likely click
 -> task-specific page
 -> can they find the command?
 -> can they tell what the output should look like?
 -> do they know whether a cluster / account is needed?
 -> do they know the next step?
```

## How to run

1. **Pick 6–10 personas** from the reusable set below (use all eight for a full audit).
2. **Give each persona one practical task or fear** — a single thing they came to do.
3. **Walk the current site and docs without changing them.** Inspect the generated `site/*.html`
   and the `docs/user/*.md` a visitor would actually reach.
4. **Record** the path, where the answer was found, where the user would bounce, and the wording
   or page that would fix it — in the artifact format below.
5. **Tag each improvement candidate with a voice owner** (Alexis or Brian — see below).
6. **Rank the findings into a site plan**, grouped by surface, with a build order.
7. **Re-run after large website/doc changes** and diff against the prior audit.

A fast quantitative pre-scan helps: a **page-metrics table** counting, per page, command blocks,
expected-output language, and `npm run` mentions — it surfaces pages that explain but never show.

## The reusable persona set

At least these eight; together they represent the Helm community. Give each the one task/fear
listed, then run it.

| # | Persona | Profile in one line | Task or fear | Mostly served by |
| --- | --- | --- | --- | --- |
| 1 | **Novice Kubernetes user** | knows kubectl a little, used Helm once or twice, no account | "Show me the Redis demo without signing up." | Alexis |
| 2 | **Low-skill Helm operator** | runs Helm from runbooks, wants copy/paste + clear pass/fail | "Show me standard Helm and cub installer getting the same Redis result." | Brian |
| 3 | **Helm expert / chart customizer** | comfortable with values and chart internals, will fork/emulate | "Pick Redis existing-secret mode, then how do I make my own variant?" | Brian |
| 4 | **GitOps operator (Argo/Flux)** | runs a controller today, wants no new in-cluster agent | "Can I load my existing Argo/Flux apps and publish OCI?" | Brian |
| 5 | **SRE / on-call** | owns incidents, distinguishes 'applied' from 'working' | "Show me operating a live app: scan, patch, promote, observe, roll back." | Brian |
| 6 | **Chart maintainer** | publishes a chart, cares about hook/CRD/lifecycle fidelity | "What does ConfigHub do to *my* chart's hooks and CRDs?" | Brian |
| 7 | **AI-curious product lead** | not deep technically, wants the AI story, concrete and safe | "What can AI change here, and what keeps it safe?" | Alexis |
| 8 | **Skeptical technical reviewer** | knows Helm / GitOps / supply-chain, hunts overclaims | "Convince me this isn't a proof toy — show hard cases and boundaries." | Brian |

Optional extras when the change calls for it: an **existing-app bringer** (platform-stack owner)
and a dedicated **security / supply-chain reviewer** (split from #8).

## Seed questions (the obvious and slightly dumb ones)

These are the questions a real visitor asks *before* they understand the model. Every audit should
confirm each is answerable within a click or two of where it would be asked:

- What is ConfigHub?
- Do I need an account?
- Do I need a cluster?
- Can I use my existing Argo or Flux setup?
- Can I load my existing app or platform?
- How do I know cub installer preserved Helm behavior?
- Where did my Helm hook go?
- What output should I expect after each step?
- What is safe for AI to change?
- What do I do when a chart breaks?

## The voice split

Every improvement candidate is owned by one voice. Keep them distinct:

- **Alexis voice** — intros, landing pages, motivation, marketing-type copy. Plain, warm, direct,
  a little ambitious; says *why the work matters to people*.
- **Brian voice** — technical contracts, scope, prerequisites, evidence. Precise; defines the
  model, names limits, links proof; *no product overclaim*.

A page can use both, but a given fix has one owner: motivation copy → Alexis; a scope / prerequisite
/ evidence statement → Brian.

## Output artifact format

One audit is one dated log. Per persona run, record exactly these fields (copy this block per
persona):

```text
## Persona N: <name>
- Profile:               <one or two lines>
- Task / fear:           <the single thing they came to do>
- Path tested:           landing -> first click -> ... -> outcome
- Where it succeeded:    <what the site already answers well>
- Where it failed:       <the bounce point — the first place they give up or get confused>
- Improvement candidate: <the specific wording or page that would fix it>
- Voice owner:           Alexis | Brian
```

Then convert the per-persona failures into a **ranked site plan**: group the improvement
candidates by surface (homepage · get-started · catalog · chart pages · variants/apps ·
hooks/hard-questions · site quality), tag each with its voice owner, and give a build order.

The worked first run — eight personas, the page-metrics pre-scan, and the ranked plan — is
[docs/planning/persona-ux-baseline-2026-06-21.md](../docs/planning/persona-ux-baseline-2026-06-21.md).

## Scope

The **default** persona audit covers the **free, public, try-it surface** only. **Commercial /
managed-edition flows are out of scope** unless explicitly requested — don't let a persona's task
drift into paid-tier features in a default run.

## Where this sits in the test map

Group **E. UX / journey**, beside the journey-pathways test
([docs/planning/user-journey-test-pathways-plan.md](../docs/planning/user-journey-test-pathways-plan.md))
and the adversarial-persona probe ([adversarial-strategy.md](adversarial-strategy.md)). The product
framing is in the persona PRD and plan
([docs/planning/helm-community-persona-prd.md](../docs/planning/helm-community-persona-prd.md),
[docs/planning/helm-community-persona-plan.md](../docs/planning/helm-community-persona-plan.md)).
The proof lanes that establish whether the model *works* are groups A–D / F / G in the
[test map](README.md); persona UX testing establishes whether a user can *understand* it.
