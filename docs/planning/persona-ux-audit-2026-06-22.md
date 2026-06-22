# Persona UX Audit 2026-06-22

UNOFFICIAL/EXPERIMENTAL

This audit records ten simulated website visits after the adoption-lens updates
and the first persona UX pass. The purpose is to keep a dated record of what a
new visitor could understand from the public website without reading the whole
repository.

Average score: about 3.0 out of 5.

## Runs

| Run | Persona | Score | Result |
| --- | --- | ---: | --- |
| 1 | Novice Kubernetes user | 2.0 | Bounced at the setup step. The site promised a low-commitment try-out, but the user still had to understand clone, CLI, and local setup. |
| 2 | Low-skill Helm operator | 2.5 | The Redis path was useful, but the site did not show the plain Helm versus cub installer comparison clearly enough. |
| 3 | Helm expert customizer | 3.0 | Existing-secret customization was clear. Authoring a new base or recipe was still too hard to find. |
| 4 | GitOps operator | 3.0 | The Argo and Flux story existed in Markdown, but the runnable commands were not on the site page. |
| 5 | SRE or on-call engineer | 3.0 | The Ops page promised observation and rollback, but did not yet show concrete cards for those workflows. |
| 6 | Chart maintainer | 2.5 | Most chart pages said no action was recorded, which sounded like a hook-free claim even when the data model was only missing a route. |
| 7 | AI-curious lead | 3.0 | The AI guide was real, but the homepage AI card had no link. |
| 8 | Skeptical reviewer | 4.0 | The proof corpus looked credible, but inconsistent version and lane wording reduced trust. |
| 9 | Existing-app user | 3.5 | The read-only-first adoption principle was good. The site needed direct discovery and import examples. |
| 10 | Security reviewer | 3.0 | Secrets and caveats were discussed, but the security path was not visible early enough. |

## Verified Findings

The audit checked the largest recurring complaints against generated files:

| Finding | Verified state |
| --- | --- |
| Entry banner | The experimental banner appeared on the homepage and offering page, not every top-level page. |
| Command cliff | `cub gitops discover`, `cub gitops import`, and `cub unit import` appeared in user docs but not on any generated site page. |
| Chart action fallback | Most chart pages used wording that could be read as "this chart has no hooks" rather than "no route is attached to this page yet." |
| AI entry point | The homepage AI card had no guide link. |
| Redis version consistency | The homepage mixed Redis 25.5.3 and 27.0.0 while the try page used 25.5.3. |

## Ranked Fix Plan

1. Put runnable commands and short expected-output text on the HTML pages for GitOps adoption, existing-app discovery, observation, and rollback.
2. Make chart pages avoid blank hook denials. If a route is missing, say that the route is not attached yet rather than claiming the chart has no hook behavior.
3. Keep Redis examples on one visible version unless a page explicitly explains an upgrade comparison.
4. Add Observe and Rollback cards to the Ops guide so the page matches its own introduction.
5. Link the AI guide from the homepage and keep AI claims tied to diffs, gates, variants, and receipts.
6. Re-run the persona audit after the site changes and compare the same ten personas against this baseline.

## Style Notes

Use direct product language for public pages. A visitor should know:

| Question | Website answer |
| --- | --- |
| What should I type? | Show the command on the page where the task is described. |
| What should I see? | Show one short expected-result sentence next to the command. |
| Is this proven? | Use pass, watch, blocked, in progress, or not applicable consistently. |
| Do I need a cluster? | Say whether the step is serverless, local kind, cub-lk, or bring-your-own cluster. |
| Is npm required? | Keep npm verifiers as optional proof checks for the default user journey unless the task is explicitly a repo proof task. |
