# Persona UX Testing Strategy

**UNOFFICIAL/EXPERIMENTAL.** Persona UX testing checks whether a human can
understand and use the public site. It complements proof lanes. It does not
replace render, live, or ConfigHub evidence.

Issue: https://github.com/confighub/helm-expt/issues/1018

## Scope

By default, this audit covers the free public website and its main journeys:
Home, Guides, Check my config, Catalog, Try Redis, Examples, Deployment, Docs,
ConfigHub, FAQ, and the generated evidence linked from those pages. It covers
Helm, AICR, OCI, Kubernetes YAML, and mixed-source journeys. Commercial and
managed-edition flows are out of scope unless a run explicitly asks for them.

## When To Run

Run this after major public-site, user-doc, homepage, catalog, FAQ, or Get
Started changes.

## Depth Requirement

Do not stop at the homepage or top navigation. Each persona run must include a
depth pass through the pages the persona would naturally reach within one or
two clicks of home:

| Entry point | One-click pages | Two-click pages to sample |
| --- | --- | --- |
| Home | Guides, Check my config, Catalog, Deployment, Docs, ConfigHub | Redis chart page, Examples, Known Gaps, GitOps guide, upgrade and rollback guide |
| Check my config | Catalog lookup, private boundary, ConfigHub handoff | Helm investigation reference, existing-release guide, evidence feed |
| Catalog | search results and a component page | packaged configuration, setup work, source record, receipt |
| Examples | Helm, AICR, OCI, and YAML starts | promotion, GitOps delivery, fleet, policy, and App demonstrations |
| Deployment | local files, OCI, and ConfigHub choices | hooks and CRDs, Argo CD and Flux, managed operations |
| Docs and FAQ | task question or skeptical question | the command, guide, gap, or evidence page linked from the answer |

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
| Application developer using AI-written configuration | Check values or YAML, get exact objects, and take one useful next step. |
| GitOps operator | Keep Argo CD or Flux and understand OCI, hooks, CRDs, pruning, and delivery limits. |
| Platform engineer | Create variants, promote changes, and operate environments or fleets. |
| Security-minded release reviewer | Find provenance, checks, approvals, gaps, and exact rollback evidence. |

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
voice owner: marketing voice or technical voice
```

## Reproducible Bulk Run

Run the deterministic synthetic study after a substantial navigation or copy
change:

```bash
npm run site:persona:simulate
```

To compare a local candidate with a saved baseline, pass the local site URL,
an output directory, the current navigation label, and the baseline CSV:

```bash
npm run site:persona:simulate -- \
  --base-url http://127.0.0.1:8767/site/ \
  --out-dir data/site-persona-simulations-2026-08-13-after \
  --current-label "Check my config" \
  --compare-with data/site-persona-simulations-2026-08-13/journeys.csv
```

The runner executes 200 simulations for each of the four personas: 180 live
journeys from nine public entry pages and 20 synthetic label trials. A live
journey follows only visible internal links, stops after five clicks, and
succeeds only when it finds all required facts plus a relevant action.

Treat these as routing diagnostics, not user research. Report first-click
improvement separately from eventual success; a site that answers a question
after five clicks can still have a poor front door. Keep language trials
explicitly labeled as synthetic. Confirm consequential failures in a browser
before changing the site.

## Voice Split

Use **marketing voice** for intros, landing pages, user motivation, and marketing
content. It should be plain, direct, optimistic, and human.

Use **technical voice** for technical content. It should define scope, prerequisites,
current status, evidence, limits, and next actions precisely.

## Output

The output is a ranked website plan, not a new proof surface. Keep the proof
links underneath the user journey.

Recorded runs:

- [800-run public-site simulation, 2026-08-13](../data/site-persona-simulations-2026-08-13/summary.md)
- [Candidate rerun and baseline comparison, 2026-08-13](../data/site-persona-simulations-2026-08-13-after/summary.md)
- [Persona UX rerun, 2026-06-22](../docs/planning/persona-ux-rerun-2026-06-22.md)
- [Persona UX audit, 2026-06-22](../docs/planning/persona-ux-audit-2026-06-22.md)
