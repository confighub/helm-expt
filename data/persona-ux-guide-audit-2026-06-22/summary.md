# Persona UX audit — menu guides (2026-06-22)

**UNOFFICIAL/EXPERIMENTAL.** Structured re-run of the [persona UX strategy](../../tests/persona-ux-strategy.md), scoped to the **8 guide pages reachable from the top menu** (Upgrade→`/private/` excluded as commercial, per the strategy's scope rule). **480 graded tests** = 8 pages × 10 personas × 6 checks, each scored P=1 / p=0.5 / F=0 by a per-page audit that read the page's actual content. Colored matrix: [matrix.html](./matrix.html) · raw data: [tests.csv](./tests.csv).

## Headline: **52%** overall — the guides *orient* but don't *deliver*

The clearest signal is per-check. The guides are strong at getting you oriented and weak at letting you act:

| Check | Score |
| --- | --- |
| C1 CoreQ — answers this persona's core need | 76% |
| C2 Action — runnable command/action on the page | 33% |
| C3 Output — expected output/result shown | 16% |
| C4 Prereq — prerequisites clear (account/cluster/tools) | 31% |
| C5 Next — next step clear | 71% |
| C6 Scan — findable fast (not buried/jargon-walled) | 87% |

**Orient (scan 87%, core-question 76%, next-step 71%) ≫ deliver (command 33%, prerequisites 31%, expected-output 16%).** A visitor can find the right guide and knows where to go next, but the guide rarely shows a runnable command, its prerequisites, or what they'll see — they have to leave for a doc to actually do anything. Expected-output (**16%**) is the single weakest dimension of the whole site.

## By guide page (best → worst)

| Guide | Score | /5 |
| --- | --- | --- |
| Get Started | 68% | 3.4/5 |
| FAQ | 65% | 3.3/5 |
| Docs | 60% | 3.0/5 |
| Ops | 50% | 2.5/5 |
| Home | 48% | 2.4/5 |
| Helm Catalog | 43% | 2.2/5 |
| Variants | 43% | 2.1/5 |
| Apps | 42% | 2.1/5 |

**Get Started** is the model page (real commands + "you should see" blocks). **Apps, Variants, Helm Catalog** are orientation pages with almost no runnable action. **Docs/FAQ** route well but answer in prose+links.

## By persona (best → worst served)

| Persona | Score |
| --- | --- |
| Skeptic | 70% |
| LowHelm | 61% |
| HelmExpert | 61% |
| Novice | 57% |
| Maintainer | 57% |
| GitOps | 54% |
| ExistingApp | 50% |
| SRE | 43% |
| Security | 38% |
| AILead | 31% |

The site is **built for the Skeptic** (70% — gaps, refusals, and proof are first-class) and **underserves the doers**: the **AI-curious lead (31%)** is nearly invisible across the guides (no AI content on Get Started, Apps, or Ops), and **Security (38%)** and **SRE (43%)** have no menu guide that lets them act on their core task.

## Worst-scoring cells

| Guide × persona | Score | Gap |
| --- | --- | --- |
| Get Started × AILead | 0.5/6 | page never mentions AI/agent at all |
| Helm Catalog × Security | 0.5/6 | no secrets/OCI provenance content at all |
| Home × ExistingApp | 1/6 | no read-only adopt-running-stack path |
| Home × Security | 1/6 | secrets/OCI provenance barely mentioned |
| Variants × Security | 1/6 | no secrets, no OCI provenance |
| Apps × AILead | 1/6 | no AI-change or safety story at all |
| Ops × AILead | 1/6 | no AI-change or safety surface at all |
| Home × AILead | 1.5/6 | 'AI with guardrails' prose only, dead-end card |

## Ranked fixes (the output)

1. **[Brian] Add an expected-output block to every command on every guide** — the weakest dimension site-wide (C3 16%). "You should see …" under each `cub`/`npm`/`kubectl` line.
2. **[Brian] Put a runnable command on the orientation guides** (Apps, Variants, Catalog) — at least one copy-paste action + result, instead of prose that routes to a doc (C2 33%).
3. **[Brian] State prerequisites inline per guide** — account / cluster / `cub` install / inputs, near the first command (C4 31%; only Get Started + FAQ do this).
4. **[Alexis] Give the AI lead, Security, and Existing-app personas a home** — AI content on Home/Get Started (not just a dead-end card), a security/provenance section, and a read-only "adopt my stack" command on Apps.
5. **[Alexis] Complete the Ops guide** — it names rollback/observe/patch but ships none; add those cards so SRE can act.

Re-run after Codex lands changes and diff the matrix.
