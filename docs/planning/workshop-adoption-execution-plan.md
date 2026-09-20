# Workshop adoption doctrine and execution plan

Status: agreed direction; execution checklist starts open, 2026-09-20.

## Outcome and doctrine

Turn the five demos into an adoption loop: encounter a familiar problem, get a
useful result, use Workshop on your own configuration, and keep using it.
More Catalog coverage alone does not establish that loop. Each demo is also a
hook for ConfigHub: it must reveal why the model matters and offer a useful next
action, not merely demonstrate a diagnostic command.

Help people turn configuration intent into working, maintainable systems,
starting with the chart, app or configuration they already have. A whole stack
is an optional starting point and a natural extension, not an entrance requirement.

Configuration as data means making actual configuration explicit: flattening
source templates and generators into concrete objects we can inspect, compare,
adapt and retain. Where behavior cannot safely be flattened, preserve its source,
lifecycle requirements and authority explicitly. Flattening alone establishes
neither successful deployment nor safe upgrades or rollback.

Users should understand that simple foundation. They should not have to master
OCI shapes, lifecycle routes or proof-lane vocabulary before getting help.
Explain why, what and how upfront. Defer operational depth to readable Guides
and reference docs; machine contracts support the Guide rather than replace it.

| Part | Responsibility |
| --- | --- |
| AI | Understand intent, investigate, propose, check, repair and explain meaningful choices. Preserve requirements; stop when authority or evidence is missing. |
| Catalog | Supply investigated configurations, exact identities, provenance, behavior and scoped evidence. Unknown and refused results remain explicit. |
| Workshop and cub | Execute repeatable operations, return structured results and refusals, and expose the same capabilities manually and to agents. |
| ConfigHub | Preserve shared configuration, derivations, ownership, changes and governance. |
| Delivery systems and runtime observations | Reconcile desired state and establish what happened on an identified target. |

The agent proposes; independent checks determine what passed. Neither confident
language nor a static result proves application health. The manual path remains
first-class, including CI and recovery without AI.

The governing question is: what responsibility can a user confidently hand over
today, and what additional evidence lets them hand over more tomorrow?

## Scope and relationship to existing plans

This is the current adoption delivery sequence, supplementing the
[unified backend ledger](./workshop-execution-plan.md) and
[agent configuration work](./agent-configuration-work-plan.md). Their unfinished
integrity, source, runtime and infrastructure obligations remain open; this plan
does not reset their statuses. Use existing issues and evidence before making new
ones. Seven implemented technical blocks do not establish an adoption outcome.

Preserve the current website IA. Do not add navigation sections, redesign all
pages or launch another general prose pass. Improve complete journeys within the
existing pages and Guides, starting with measured obstacles. No homepage framing
or commercial positioning choice is silently settled by a pilot experiment.

The five [demo journeys](https://github.com/monadic/workshop-demo) reviewed at
commit `b82bcb4` are core
acceptance journeys, not the entire market. Flux and Argo onboarding, Kubara
platform composition and GPU/fleet keystones remain parallel entry points. They
do not require users to progress through a Helm tutorial first.

## Five hooks and their ConfigHub reveal

| ID | Hook | Useful result | ConfigHub reveal and continuation |
| --- | --- | --- | --- |
| J1 | My values did nothing | Identify ineffective settings, repair the intended request and show the object change. | Explicit configuration makes intent inspectable; retain the reviewed result and a repeatable check for the user's chart. Do not depend on AI making a mistake. |
| J2 | My fixes disappeared | Preserve deliberate customizations while accepting the requested change. | Show retained edits surviving a subsequent upstream change in ConfigHub, separately from the local diff. Continue with the user's own adaptation. |
| J3 | What does my app need? | Discover candidate components, assemble explicit choices, refuse mismatches and check the repair. | Queryable configuration connects app needs with platform capabilities; save the composition and change it again. An operator is not a running database. |
| J4 | Before GitOps takes over | Detect unstable rendering and prerequisites, then check a deliberate alternative. | Retain and govern explicit desired configuration while keeping existing delivery controllers. Continue to the appropriate Argo or Flux onboarding Guide. |
| J5 | It installs but never starts | Check external image availability and explain a viable alternative and its costs. | Decisions use retained evidence and reviewed alternatives. Continue from an operator to a database resource and Secret requirements; do not imply migration/data safety. |

Each follows: recognizable pain -> discovery -> useful resolution -> demonstrated
ConfigHub value or explicitly labelled continuation -> one next action.
A local Workshop check must never be presented as having exercised Server.

## Guide and public-page contract

A demo shows value; a Guide helps a person and agent do the work on their own
inputs. Each journey must map an existing entry page to an existing Guide, demo,
commands, evidence and own-input continuation. Repair existing Guides before
creating duplicates. Missing mappings become tasks, not invented URLs.

The initial view explains the problem, simple model, expected outcome and one
primary next action. Within the Guide provide:

- Prerequisites, tested versions and approximate time, separating setup from work.
- AI mission and deterministic manual path with equivalent acceptance outcomes.
- Meaningful choices and their consequences; do not hide a lost requirement to pass a check.
- Expected artifacts, success, specific refusals and recovery instructions.
- What was checked, what remains unknown, and what needs authorization or a target.
- Save/resume and one action on the user's own input.
- Optional ConfigHub continuation with its actual value and dependencies.

Keep essential model explanations visible. Put detailed syntax and evidence
behind relevant links. Professional presentation means consistent hierarchy,
terminology and spacing, fewer competing actions and less repeated prose—not
simply shorter text. Inspect desktop and narrow layouts. Use human feedback for
visual quality; agent success alone cannot establish it.

## Existing Guide starting points

These are audit starting points, not assertions of complete journey coverage.
A0 must resolve the full demo commit SHA and verify the entry links and evidence
at the pinned revisions; record any changes since the reviewed baseline.

| Journey | Existing authored Guide or reference |
| --- | --- |
| J1 | [Values Guide](../user/workshop-values-guide.md) |
| J2 | [Field restore](../user/workshop-field-restore-guide.md), [Adapt](../user/workshop-adapt-guide.md) |
| J3 | [Compose](../user/workshop-compose-guide.md), [Stack contract](../reference/stack-manifest-contract.md) |
| J4 and Flux/Argo onboarding | [GitOps adopter](../user/gitops-adopter-guide.md), [delivery path](../user/cub-deployment-path.md) |
| J5 | [Remote images and supported bases](../user/remote-images-and-supported-bases.md) |
| Argo tree | [Application tree pattern](../../knowledge/wiki/delivery-app-of-apps.md) |
| Kubara | [Kubara Guide](../user/workshop-kubara-guide.md) |
| GPU/fleet | [Match Guide](../user/workshop-match-guide.md), [fleet requirements](./nvidia-fleet-catalog-requirements.md) |

## Executable work queue

One lead owns synthesis, acceptance and integration. Bounded audits and routine
fixes go to lower-cost agents. Every row produces a reviewable artifact and can
be resumed from its ID. Checkboxes are completion records, not forecasts.

| Done | ID / order | Owner and concrete work | Exit evidence / dependency |
| --- | --- | --- | --- |
| [ ] | A0: baseline, first | Cheap audit agent maps all five journeys plus the parallel entries to exact current pages, Guides, commands and source revisions. Record broken transitions, repetitions and misleading claims without editing. | One compact journey matrix and ranked obstacles. Pin website, Catalog, demo, plugin and cub versions; record installation instructions that actually work. |
| [ ] | A1: rehearsal, with A0 | Cheap execution agent rehearses five manual tracks in an isolated environment. Pin tested dependencies; compare assertions to retained expected results. | Per-step outcomes, setup failures and artifact hashes. No server/cluster writes during default trials. Optional live demonstrations are separate authorized serial tasks. |
| [ ] | A2: reliability, after A1 | Cheap implementation agents fix specific demo/plugin faults in separate worktrees: specific refusal assertions, deterministic inputs, safe reset, installation and network error handling. | Broken dependency is not accepted as intended refusal; all five default tracks complete on tested setup. Claims distinguish static checks, registry observations and runtime. |
| [ ] | A3: mission tracks, after A0 | Cheap drafting agent adds a problem-and-constraints prompt for each demo, keeping the teaching scripts. Lead reviews preservation of intent and limits. | Prompts omit command-by-command instructions and expected answers. Fixtures and acceptance rubric remain hidden from trial agents. Both manual and AI paths retain useful results. |
| [ ] | A4: one journey pilot | Lead chooses a pilot based on A0/A1 obstacles; J4 and J2 are candidates, not predetermined homepage winners. Capture current screenshots and task outcomes. Improve only that entry page and linked Guide using the agreed page contract. | Before/after artifacts, same-task evaluation with separate fresh sessions, and human review of clarity/presentation. Existing IA unchanged; no new unsupported claims. |
| [ ] | A5: propagate only proven improvements | Cheap agents apply the accepted Guide/page pattern to remaining journeys; one integrator regenerates shared site outputs. | All five journeys have why/what/how, hook, accurate ConfigHub reveal, manual/AI route and own-input continuation. Re-test affected journeys only. A failed pilot triggers diagnosis, not bulk editing. |
| [ ] | A6: complete configuration paths | Catalog/plugin agents extend J3 with released discovery and explicit composition; implement the missing useful J5 successor configuration and focused cert-manager/database acceptance cases. | Real identities and receipts; prerequisites named; preserved requirements; operator versus instance distinction tested. No invented publication/digest or green status. Depends on existing source constraints. |
| [ ] | A6b: ConfigHub reveal and recovery | Lead binds J2 to the existing Adapt/Redis preservation evidence and, on an authorized server, tests a new upstream change with retained downstream edits. Cheap agent prepares exact fixtures. J5 records the exact replacement image and registry response. | J2 retains before/upstream/derived hashes and the intended-only diff. J5 distinguishes registry resolution from target pull/readiness; only a separate target receipt permits a runtime recovery claim. No available server/target means explicitly pending, not silently omitted. |
| [ ] | A7: parallel entry acceptance | Lead scopes Flux, Argo tree, Kubara and GPU/fleet tasks below. Cheap agents inspect existing Guides and test static portions while live access is pending. | Separate acceptance row per entry; do not substitute J4 for onboarding or static fleet checks for operational confidence. Can proceed alongside A2–A6. |
| [ ] | A8: user trial packet | Cheap agent prepares recruitment options, task cards and consent-aware score sheet; lead reviews. Maintainer approves recipients/messages before any outreach. | Trial-ready packet and proposed ten-person initial cohort across entry levels. Ten is a learning target, not proof of demand. Preparation does not wait for all live gaps. |
| [ ] | A9: actual-user trials | Lead observes people bringing their own configuration, with minimal intervention. Cheap agents summarize anonymized observations. | Record completion, help, correctness, understanding, own-input transfer and return use. Track channels and cohorts separately; do not count agent trials as human adoption. |
| [ ] | A10: distribution and retention decision | Lead compares evidence by hook and entry level; prepare audience-specific demo links and factual copy. Maintainer approves public outreach. Fix repeated obstacles before widening distribution. | A named next experiment based on useful results and repeat use, not pageviews alone. Retain unsuccessful trials; do not extrapolate market size from a small sample. |

## Rapid delivery cadence

First work session: A0 and A1 in parallel, then a short ranked blocker list and
small reliability PR. Next session: A3 and the A4 pilot, while A7 inventories
parallel Guides and A8 prepares recruitment. Propagate with A5 only after pilot
acceptance. A6 fills evidenced product gaps concurrently in isolated branches.
Sessions describe sequencing, not guaranteed wall-clock delivery or daily quotas.

Each PR should be reviewable in about ten minutes. Record what changed, the
receipt or test proving it, gates and person dependencies. Run narrow checks,
then the repository's required full gate on the final source; use exact-head CI
before an authorized merge. Never bypass checks for speed or add new failures
to the known-red register. Reuse successful checks only for unchanged inputs.

## Parallel entry points: required acceptance

| Entry | First useful result and ConfigHub reveal | Evidence boundary |
| --- | --- | --- |
| Flux onboarding | Identify sources, rendered configuration and reconciliation ownership; show a reviewed change retained in ConfigHub and the explicit handoff back to Flux. | Separate source inspection/static handoff from a canary controller reconciliation. Preserve the reconciler; record the authority handover, absence of competing writers and bounded reversal on an authorized target. |
| Argo application tree | Account for root and child Applications and Argo-generated objects; show before/after source -> ConfigHub -> delivery/authority. | Do not import generated objects as independent authored truth. An authorized canary must distinguish bootstrap/child authority, observe child health, remove conflicting authority and demonstrate bounded reversal; tree inspection alone cannot pass it. |
| Kubara platform with apps | Use generator output as the platform source, add explicit app choices, check prerequisites, preserve per-cluster/service derivations and show a day-2 change. | Preserve generator/controller ownership. Verify which handoff is implemented; richer desired workflows are not current proof. |
| GPU/fleet keystone | Constrained build/install configuration, provenance, class/owner authority and desired/live identity; show the next meaningful fleet decision. | Record four separate confidences: safe deployment, nondisruption, data-safe rollback, successful reversal. Hardware, credentials and scale claims need separate receipts. |

Use the [fleet requirements](./nvidia-fleet-catalog-requirements.md) and existing
[UX readiness work](./workshop-ux-readiness.md); do not duplicate their contracts.
No representative fleet CRD, target access or H100 evidence is invented to finish
this plan. Record the dependency, owner role and independently runnable next task.

## Measurements and acceptance decisions

For every trial retain: journey, date, pinned revisions/tool versions, manual or
agent mode/model, setup time, time to first useful result, help/retries, checks
run, retained artifacts, outcome, unsupported claims, comprehension and next action.
Private configurations and credentials stay private; public reports use consented,
anonymized observations and synthetic or approved artifacts.

Use a simple 0/1/2 rubric: failed, completed with intervention, independently
completed. Score outcome correctness, intent preservation, model comprehension,
evidence limits and save/resume separately. Record elapsed time, not just a score.
Ask the person to explain what configuration-as-data means, what changed, what
was proved and why ConfigHub helps. Do not prompt them with the desired answer.

Operating thresholds for this first experiment (not market claims): obtain three
fresh agent trials and two human trials of the pilot, with at least two of three
agent trials and both human trials independently reaching a correct useful result.
Both humans must explain the basic model and identify the next action without
coaching. Retest with fresh sessions after material fixes. If human participants
are unavailable, mark human acceptance pending and limit propagation to objective
correctness fixes. Widen outreach beyond the initial cohort only after at least
six of ten people reach useful results on their own inputs and at least three
demonstrate a second use or retained workflow within the agreed observation
window; otherwise investigate the failing stage. These small-sample thresholds
are practical stop/go rules, not estimates of population adoption.

Pilot acceptance also requires correct results, no critical authority/secret/evidence
violation, no lost requirement, and no regression in locating the next action.
Expand only when observed friction decreases and human review supports clearer
presentation. A small trial is directional evidence, not statistical superiority.

Adoption funnel: relevant arrival -> useful result -> own-input success -> repeat
use or retained CI/agent check -> team sharing/governance. Record denominators
and observation windows. Check return use after seven days where participants
consent; distinguish no response from confirmed non-use. Treat GitOps/platform
and enterprise fleet cycles separately from quick individual trials.

The release gate and adoption gate differ: passing scripts/CI permits shipping;
it does not prove usefulness, demand or retention. We have not met the adoption
goal until actual users supply that evidence.

## Cost discipline and handoff

Default bounded execution to a lower-cost agent. Give it only the necessary
paths, one concrete outcome, forbidden mutations and a stopping condition.
Use at most two cheap workers plus the lead initially; increase only for clearly
independent work. Reuse compact evidence maps instead of repeatedly sending the
whole chat. Stop a worker after one report/PR; escalate ambiguous semantics to
the lead instead of repeated blind attempts.

Reserve stronger reasoning for doctrine, prioritization, UX synthesis, technical
ambiguity and final review. Separate implementation agents from fresh trial
agents. Run live lanes serially on an awake machine; never parallelize shared
regeneration or cluster work. Record agent/model, elapsed time and available usage
information; do not invent monetary savings. Avoid redundant full-suite runs.

Each completed work item records status, PR, exact evidence, unresolved limits and
next ID in the tracking issue. A resumed session reads this plan and that issue,
selects the first ready item and updates the user with findings—not activity counts.
