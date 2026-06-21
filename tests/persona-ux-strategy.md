# Persona UX Testing Strategy

**UNOFFICIAL/EXPERIMENTAL.** Persona UX testing checks whether a human can
understand and use the public site. It complements proof lanes. It does not
replace render, live, or ConfigHub evidence.

Issue: https://github.com/confighub/helm-expt/issues/1018

## When To Run

Run this after major public-site, user-doc, homepage, catalog, FAQ, or Get
Started changes.

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

