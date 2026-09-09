# Workshop execution plan: from intent to a checked, runnable result

Status: proposed implementation sequence, 2026-09-09. This plan records the
requested direction; it does not change catalog verdicts or select a commercial
model. Deliver small PRs, with one complete user task as the unit of progress.

## Outcome

A person or their assistant brings configuration, an app, or platform requirements
and leaves with a useful, retained result. The direct command-line route must be
clear enough to use without AI. Claude Code and Codex use the same operations,
checks, and evidence, with fewer decisions for the user. Each website page explains
one task completely and leads to a working next step.

Deliver three journeys, in this order:

1. **Compose:** a bounded Kubara platform plus one app, checked against explicit
   requirements and a named target, then delivered when prerequisites are available.
2. **Adapt:** change an existing configuration, inspect the semantic difference,
   preserve local intent across an upstream change, and hand the result to a teammate.
3. **Match:** choose a workload configuration for specified NVIDIA hardware and
   constraints, separating static compatibility from observed GPU execution.

The first journey includes one small adaptation, so the first demo shows both
composition and a meaningful change. Configs, charts, apps, and stacks remain
first-class inputs; the first fixture does not define the product's format ceiling.

## First slice: a Kubara platform and one app

User task: “Give me a small platform with GitOps and a web app; tell me what I need
to supply, show me what will run, and help me change it.” Start with the existing
Kubara platform manifest and the plugin’s existing shop-app scenarios. Keep the
plain YAML app fixture as an alternative for the Adapt journey. Record the precise source
revisions and effective component inventory before selecting supported options.
Do not promise arbitrary platform synthesis from this bounded example.

The result must contain the selected components, exact materialized object identity,
source provenance, explicit app requirements, target assumptions, findings, omitted
checks, and a next action. Platform and app remain separately identifiable. A
configuration result is useful before deployment; a claim that the app runs requires
a fresh controller observation and an application response on the named target.

The initial variation changes one app field. Include one deliberately incompatible
requirement and show the same actionable refusal in the CLI and both assistants.
A missing capability must name what is missing and a supported repair, rather than
returning a generic failure or guessing a different platform.

## Reuse before building

| Existing source | Reuse | Boundary to preserve |
| --- | --- | --- |
| [Stack manifest specification](./stack-manifest-spec.md) | Components, planes, bindings, source forms and composition identity. | Prototype commands and the committed full verdict have different scopes; neither proves target readiness. |
| [Command contract](../../data/config-workshop-command-contract/summary.md) | WorkshopResult and exact-object continuity between entry points. | Extend existing records only where required; avoid a second competing result model. |
| [Plain YAML app](../../examples/plain-yaml/acme-web/README.md) | A retained app fixture and upload evidence. | Upload is not live application availability. |
| [App walkthrough](../user/app-to-live-walkthrough.md) | Current variant, release and delivery sequence. | Recheck installed command versions; historical receipts do not validate a new composition. |
| [Certified inference stack](../../data/certified-bundles/eks-inference-stack.md) | Source retention, component identities and scoped inference evidence. | CPU or sandbox results do not establish NIM or H100 readiness. |
| [Demo program](./config-catalog-demo-program.md) | OCI boundaries, promotion evidence and existing proof ownership. | This plan joins user journeys; it does not reset completed work. |

Before publishing runnable instructions, capture the installed CLI and plugin
versions and verify every command through help and execution. Stack and app
prototype implementation work may belong in cub-workshop or the CLI repository;
record the owner and linked change rather than introducing a shadow CLI here.

## Reviewable delivery blocks

| Order | Deliverable and owner | Acceptance evidence |
| --- | --- | --- |
| 1 | Backend: inventory the bounded Kubara-plus-app scenario, command versions, inputs, expected results and missing prerequisites. | A retained scenario with linked existing receipts; every claimed operation classified as available, missing or blocked. No live status changes. |
| 2 | Backend: deterministic composition and app-fit checks for that scenario, reusing the existing manifest and result contract. | Positive fixture plus conflicts, missing capability and unknown target facts; unknown remains unknown. Findings name component, requirement and remedy. |
| 3 | CLI/plugin owner with backend fixtures: complete the shortest direct workflow from selection through retained result and one change. | Clean-environment transcript, actionable errors, reproducible identities, restart after interruption, no unrecorded shell setup. Missing commands get their own implementation PR. |
| 4 | Backend and agent integration owner: task instructions for Claude Code and Codex using the verified workflow. | Both assistants complete the same task and refusal case; results agree on source identity and findings. No invented commands or mutation without the required approval. |
| 5 | Website owner: complete the Kubara page and its app continuation around the verified task. | First action, prerequisites, expected result, failure recovery, evidence and next step all work; direct and AI routes are easy to find. Browser walk plus site gates. |
| 6 | Backend: one serial live run of the exact reviewed result, then one app change and rollback of desired configuration. | Source-to-release-to-controller identities, readiness and application response recorded separately; cleanup recorded. Rollback makes no database recovery claim. |
| 7 | Backend and website: two show-and-tell scripts and a teammate handoff trial. | Direct CLI and AI demonstrations start from declared prerequisites and end with a usable result; a second person can explain and continue it without the author. |
| 8 | Backend and website: repeat the complete loop for Adapt, then Match. | Adapt preserves a real local change across an upstream update; Match separates hardware assumptions, static checks and GPU observations. Each gets its own complete page and both demo routes. |

Blocks 3 and 4 can start with the current command surface while missing checks are
implemented. Website copy follows verified behavior, and can ship a useful local
result before the live block. Each block may split into small independently based
PRs; do not stack branches on unmerged work or wait for all journeys to be finished.

## Easy and sharp: observable requirements

- Ask only for facts needed for the next meaningful action. Discover available
  capabilities and versions before asking the user to diagnose the environment.
- Show what will be produced, where it is saved, and what runs remotely before
  requesting credentials or deployment approval.
- Give concise human output and structured results from the same operation.
  Keep identifiers and previous selections across steps and interruptions.
- Report checked, failed, unknown and not-run distinctly. Static certification,
  target qualification, controller sync and application health are separate facts.
- Let the user inspect and retain a local result without a ConfigHub account when
  the selected source permits it. Private registries and governed operations state
  their own authentication requirements at the point of use.
- A teammate handoff preserves object identity and declares access requirements.
  Sharing configuration is not the same as sharing a running application.

The assistants may propose a selection or edit. Deterministic tools produce the
verdict; neither a fluent explanation nor a successful render overrides a refusal.

## Website work alongside delivery

Improve one task page at a time: Kubara and its app continuation first, then the
adaptation entry, then the NVIDIA entry. Keep navigation changes out of this slice.
Every page must answer: what can I do here, what do I need, what is my first action,
what result should I see, what if it fails, and what can I do next?

Offer a copyable direct path and a compact assistant task with the same bounded
outcome. Keep evidence on GitHub and summarize its scope on the page. Test links,
copyable commands and the complete journey, including empty or missing input.
Generated pages change through their source generator; backend PRs regenerate data
surfaces, while authored website changes remain with the website owner.

## NVIDIA continuation and dependencies

Reuse the AICR ingestion stream's output rather than duplicating its work. The
customer configuration journey selects retained workload and platform components
against explicit chipset, capacity and environment requirements. The fleet-operator
journey additionally needs disruption analysis, staged rollout and held-back targets;
those are separate acceptance criteria, not consequences of a successful render.

| Dependency | Action and effect |
| --- | --- |
| Kubara context, target clusters and fresh-organization prerequisites | Maintainer supplies the target and authorization before live qualification. Static composition and demo preparation continue. |
| Registry access for #1699 and #1639 | Maintainer supplies credentials; preserve blocked status without workarounds. |
| Real H100 and NIM prerequisites in #1581 | Maintainer supplies target, registry/model access, budget and cleanup constraints; GPU claims wait for a real response receipt. |
| GPU disruption classification in #1660 | Check current issue and implementation before promising drain or driver-impact predictions. |
| d2 stack layouts for #1758 | Maintainer supplies the layouts before that survey starts; it does not block this bounded Kubara scenario. |
| CLI/plugin changes outside this repository | Identify the owning repository and open a linked implementation change; record the tested version here. |

## Demonstration and trial gate

Each show-and-tell has a clean-start checklist, source versions, exact task, expected
intermediate artifacts, one failure-and-repair example, one change, retained result,
and cleanup. The CLI demo must succeed without an assistant. Both assistant demos
must succeed without hidden maintainer intervention. Record setup time separately
from task time and do not call a prepared transcript a user trial.

Proposed first trial: three pairs complete the same real task using their current
workflow and the new route. Record time to first useful result, setup interruptions,
requests for help, correct interpretation of missing evidence, and teammate handoff.
Follow up on reuse after a week. A provisional advance criterion is two of three
pairs completing without maintainer rescue; any mistaken safety or live-readiness
claim requires investigation before expansion. These are proposed criteria, not
measured outcomes or evidence of market demand.

## Validation and decisions

Every implementation PR names the changed receipt or verifier, runs the narrowest
relevant checks and then the full repository gate, and reports person-dependent
blocks. Documentation additions update the doc map, freshness snapshot and generated
site at the pinned timestamp. No new breakage is added to the known-red register.

Commercial packaging, marketplace design, hosted execution, MCP deployment and a
new one-line product command remain decisions, not prerequisites for this trial.
The [umbrella](./workshop-frictionless-entry-plan.md),
[stories](./workshop-stories-entry-mid-keystone.md) and
[AI API options](./workshop-ai-api-plan.md) retain that strategic discussion.

Local discovery found CLI v0.4.4 and prototype stack/app plugins. The plugin lists
`kubara-shop-first-try` and `kubara-shop-platform`, described as a refusal and a
repaired composition. Those listings are discovery evidence, not execution proof.
Audit their checks and retained sources before adding overlapping fixtures.

Next implementation PR: block 1, a versioned Kubara-plus-app scenario inventory and
command audit. Credit already implemented behavior; its explicit gaps determine
block 2 and the CLI/plugin work.
