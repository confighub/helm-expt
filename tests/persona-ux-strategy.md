# Persona UX Testing Strategy

**UNOFFICIAL/EXPERIMENTAL.** Persona UX testing checks whether a human can
understand and use the public site. It complements proof lanes. It does not
replace render, live, or ConfigHub evidence.

Issue: https://github.com/confighub/helm-expt/issues/1018

## Scope

By default, this audit covers the free/public website and documentation surface:
home, Get Started, Helm Catalog, chart pages, Variants, Apps, Ops, Docs, FAQ,
and generated public data linked from those pages. Commercial and managed-edition
flows are out of scope unless a run explicitly asks for them.

## When To Run

Run this after major public-site, user-doc, homepage, catalog, FAQ, or Get
Started changes.

## Depth Requirement

Do not stop at the homepage or top navigation. Each persona run must include a
depth pass through the pages the persona would naturally reach within one or
two clicks of home:

| Entry point | One-click pages | Two-click pages to sample |
| --- | --- | --- |
| Home | Get Started, Helm Catalog, Variants, Apps, Ops, Docs, FAQ | Redis chart page, kube-prometheus-stack chart page, How It Works, Known Gaps, AI-assisted changes, GitOps adopter guide, upgrade/rollback guide |
| Helm Catalog | chart index, chart page, matrix link | chart recipe/catalog link, per-chart caveats, lifecycle/action route, source chart URL |
| Apps | existing-app section, app examples | adopting existing apps, ConfigHub data model, custom app or stack guide |
| Ops | observe, rollback, delivery, scan/gate cards | verify-it-yourself, day-2 upgrade/rollback, why-synced-is-not-working, cub-scout diff design |
| FAQ | skeptical questions | the guide or data page linked from each answer |

For every deeper page sampled, record whether the user can still answer:

```text
What am I trying to do?
What should I type?
What should I expect to see?
Do I need a cluster, ConfigHub account, GitOps controller, or only local files?
Is this a proved path, a watch path, a blocked path, or planned work?
Where do I go next?
```

If a page answers only by linking to raw data, treat that as a possible bounce
unless the persona is the skeptical reviewer.

## Personas

| Persona | What they want |
| --- | --- |
| Novice Kubernetes user | Learn what this is without knowing ConfigHub. |
| Low-skill Helm user | Copy commands and see expected output. |
| Helm expert | Understand where values, hooks, CRDs, and upgrades go. |
| GitOps platform engineer | Keep Argo or Flux and know what changes. |
| SRE or on-call engineer | Triage what broke and what evidence exists. |
| Chart maintainer | See whether their chart can be represented honestly. |
| AI-curious product lead | Understand what AI can safely help with. |
| Skeptical reviewer | Find limits, watch rows, refusals, and proof scope. |

## Seed Questions

```text
What is ConfigHub?
Do I need an account?
Do I need a cluster?
Can I use my existing Argo or Flux setup?
Can I load my existing app or platform?
How do I know cub installer preserved Helm behavior?
Where did my Helm hook go?
What output should I expect after each step?
What is safe for AI to change?
What do I do when a chart breaks?
```

## Run Format

For each persona, record:

```text
persona
task or fear
path tested
deeper pages tested
where the site answered well
where the persona would bounce
improvement candidate
voice owner: Alexis voice or Brian voice
```

## Voice Split

Use **Alexis voice** for intros, landing pages, user motivation, and marketing
content. It should be plain, direct, optimistic, and human.

Use **Brian voice** for technical content. It should define scope, prerequisites,
current status, evidence, limits, and next actions precisely.

## Output

The output is a ranked website plan, not a new proof surface. Keep the proof
links underneath the user journey.

Recorded runs:

- [Persona UX rerun, 2026-06-22](../docs/planning/persona-ux-rerun-2026-06-22.md)
- [Persona UX audit, 2026-06-22](../docs/planning/persona-ux-audit-2026-06-22.md)
