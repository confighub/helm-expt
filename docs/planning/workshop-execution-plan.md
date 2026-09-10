# Unified Catalog and Workshop execution plan

Status: active, reconciled 2026-09-10. This is the single execution plan for the
Catalog backend and the Compose, Adapt and Match user journeys. It combines the
42 tasks from the [original backend checklist](./backend-seven-day-plan.md) with
the eight Workshop acceptance blocks. The original checklist is a historical
record; update this plan for current work. This plan does not change data verdicts.

## Execution order and ownership

The goal is a trustworthy configuration catalog that a person or assistant can
use easily: select, inspect, change, retain, deliver and observe exact configurations.
Backend integrity and useful successor configurations are prerequisites for that
experience, not a separate backlog to forget when a demo is being built.

Work packages below join related tasks without discarding their acceptance
criteria. B01–B42 retain their original identities. W1–W8 refer to the Workshop
blocks in the acceptance table below. A package is complete only when every
applicable backend task and journey criterion is accepted. Open PRs are implemented,
not landed; unavailable target facts remain unknown. Do not derive progress from
PR count or elapsed calendar days.

| Priority | Package | Original tasks | Next deliverable and exit condition |
| --- | --- | --- | --- |
| 1 | U1. Verification and trustworthy receipts | B01–B06, B25–B30, B37–B40 | Preserve the passing baseline and receipt identity; fix demonstrated diagnostic or substitution gaps, with focused rejection cases and the full gate. Keep registered Kubara failures distinct from new failures. |
| 2 | U2. Source availability and catalog refresh | B07–B12 | Use exact source observations in the seven-row queue and its consumers. Each row has an evidenced disposition; transport, authentication and digest failures are not interchangeable. Resolve retirement decisions explicitly. |
| 3 | U3. Useful successor configurations | B13–B18, B22–B23 | Finish the reviewed Redis/RabbitMQ useful-base scopes and operator successor static packages. Render, scan, install prerequisites, installer package, Helm equivalence and artifact-specific terms have exact receipts. Run runtime/upgrade scopes only when their targets are available. |
| 4 | U4. Complete local Compose workflow | W1–W5 | Integrate the reviewed plugin changes, run one exact Kubara/GitOps/app selection through save, edit, resume and refusal, and repeat with both assistants. Publish matching CLI and AI routes on the website. A controller manifest is not a bound GitOps loop. |
| 5 | U5. Complete Adapt workflow | W8 Adapt, B27–B30 | Join the merged local diff task and existing protected-upgrade evidence into a complete task and handoff. Preserve the distinction between historical ConfigHub preservation, a fresh managed upgrade, and Kubernetes delivery. |
| 6 | U6. Match and cross-format coverage | B31–B36, W8 Match | Finish the bounded KServe-to-Node comparison journey while retaining NIM/Timoni and delivery-pattern work. Configuration coverage is not hardware/runtime compatibility. Add broader model selection only with explicit supported input shapes and evidence. |
| 7 | U7. Serial live acceptance | B19–B24, W6, W8 runtime | On a named authorized target, bind the reviewed result to release/controller identity, readiness and application response; then change, roll back desired configuration and record cleanup. Complete stack receipts and remove known-red entries only when their gates pass. |
| 8 | U8. Handoff and completion record | B41–B42, W7 | Run the direct and AI demonstrations and an independent human continuation trial. Publish accepted task IDs, exact evidence, gates and outstanding dependencies. A scripted copy/move test is not a human trial. |

Priority is the default selection order, not a dependency forcing idle time.
When one task needs access or review, pick the next ready task in U1–U6. Work
on independent branches from main. Website implementation is authorized for these
journeys; generated files still change only through their generators.

## Current execution batch

1. Reconcile all B-task statuses against data, receipts and landed changes. Preserve
   historical evidence and identify partial tasks rather than redoing their completed
   portions. The ledger below replaces the stale seven-day completion count.
2. B38's bounded diagnostics landed in #1857 and #1859. Their failure conditions
   and the known-red register are unchanged; fresh live Kubara receipts remain
   separately blocked by target access.
3. Take the first remaining independently runnable source/successor task identified
   by the audit. The existing draft PR owns its scope; update it where practical.
4. Cub-workshop #10–#17 are merged and the direct Compose/Match check is retained.
   Preserve the historical assistant trials at their tested source revisions;
   repeating the expanded selection with both assistants remains separate.
5. Continue the exact local Compose and Match tasks, then their website pages and
   acceptance trials. Live access and a human participant do not block U1–U3.

The lead owns planning, prioritization, source/claim review and integration. Use
lower-cost agents for bounded evidence inventories, command/test execution and
small well-specified fixes. Each writer has a separate worktree; no agent runs a
live lane or edits shared generated output concurrently. The lead checks every
agent's evidence and diff before publishing. Run the appropriate narrow gates,
then the full repository gate once per reviewed change; avoid duplicate full
runs for unchanged source. Each PR records actual results and person dependencies.

## Backend task ledger, 2026-09-10

Accepted means the original bounded deliverable has landed with supporting
records; it does not imply production support or current live health. Partial
means some acceptance remains. Active means work is currently assigned; blocked
names an external prerequisite. The twelve historically accepted tasks remain accepted; B38 now also has its
bounded diagnostic deliverable recorded. Broader journey acceptance remains separate. The
current work packages above determine what runs next, not the old day grouping.

| Task | State | Evidence and remaining acceptance |
| --- | --- | --- |
| B01 | accepted | AICR legacy provenance repair landed in [#1770](https://github.com/confighub/helm-expt/pull/1770); retained upstream bytes and checksum pins preserved. |
| B02 | accepted | Redis CI refresh [#1771](https://github.com/confighub/helm-expt/pull/1771) and the exact-tree #1803 baseline are recorded in the original execution record. |
| B03 | accepted | [#1783](https://github.com/confighub/helm-expt/pull/1783) binds lifecycle identity and selection-dependent target facts, with rejection cases. |
| B04 | accepted | [#1785](https://github.com/confighub/helm-expt/pull/1785) binds observed baseline policy and consistent receipt selection. |
| B05 | accepted | Ready backlog #1765 and #1775 landed; this accepts that bounded backlog, not every future PR. |
| B06 | accepted | Original exact-tree #1803 baseline passed CI with the declared exceptions; current-head acceptance remains B40. |
| B07 | accepted | [#1786](https://github.com/confighub/helm-expt/pull/1786) retains direct-URL/OCI observations in [source-fetch receipt](../../runs/bitnami-source-fetch/receipt.json). |
| B08 | accepted | [#1793](https://github.com/confighub/helm-expt/pull/1793) checks all seven candidate archives against retained digests in [refresh source-fetch receipt](../../runs/latest-top20-refresh/source-fetch/receipt.json). |
| B09 | partial | Pinned retrieval and failure cases exist; a 403 does not establish an authentication requirement. Complete the explicit observation/classification audit without guessing a cause. |
| B10 | review | The source-consumer audit below finds no demonstrated 403-to-auth or unavailable scheduling defect in the named consumers. Its bounded result is ready for review in this plan change. |
| B11 | accepted | [#1793](https://github.com/confighub/helm-expt/pull/1793) records eleven offline negative cases for missing candidates and identity/digest substitution. |
| B12 | partial | Closed #1381 does not authorize blanket retirement: OCI bytes remain available. Reconcile all six original pins with the retained replacement decisions and exact remaining prerequisites. |
| B13 | partial | Redis [secret-switch map](../../data/successor-track/redis-secret-switch-map/summary.md) landed in #1772; useful existing-secret base remains draft [#1809](https://github.com/confighub/helm-expt/pull/1809). |
| B14 | partial | RabbitMQ [secret-switch map](../../data/successor-track/rabbitmq-secret-switch-map/summary.md) landed in #1773; useful-base scope remains draft [#1807](https://github.com/confighub/helm-expt/pull/1807). |
| B15 | partial | CloudNativePG 0.29.0 static preflight exists; [#1799](https://github.com/confighub/helm-expt/pull/1799) remains draft. Operator installation and database provisioning remain separate scopes. |
| B16 | partial | Percona 1.22 terms metadata landed in #1777. 1.23 admission remains draft [#1813](https://github.com/confighub/helm-expt/pull/1813); companion database and publication evidence remain explicit. |
| B17 | blocked | MySQL operator [#1779](https://github.com/confighub/helm-expt/pull/1779) needs registry reauthentication before publication and derived evidence. |
| B18 | partial | [Candidate work orders](../../data/latest-top20-refresh/promotion-work-orders.md) do not substitute for successor render/scan/install/package/equivalence receipts. Close each selected successor scope explicitly. |
| B19 | blocked | Maintainer must select Kubara context, target clusters and authorized organization/access; confirm one serial runner before mutation. |
| B20 | blocked | Three #1759 lanes remain in [known-red register](../../tests/verify-chain-known-red.yaml); no fresh accepted live run replaces them. |
| B21 | partial | Complete each stack receipt gap against [certified bundles](../../data/certified-bundles/summary.md) and the matrix, preserving both reader contracts. Static Workshop evidence is not live stack acceptance. |
| B22 | blocked | Successor controller/database readiness needs the selected target and prerequisites, independently of operator render success. |
| B23 | blocked | Bounded successor upgrade/rollback needs those target prerequisites and exact before/after identities. |
| B24 | blocked | Regenerate dependent evidence and remove register entries only after their verifiers pass. Offline preparation can continue. |
| B25 | partial | Focused deployed-policy binding repairs landed (#1785); complete the scoped producer audit rather than inferring observations from desired state. |
| B26 | partial | Focused receipt selection fixes landed; finish the consumer audit for historical hardcoding and newer-evidence selection. |
| B27 | partial | Chart archive and Timoni client bindings improved ([9276a3371](https://github.com/confighub/helm-expt/commit/9276a3371) and [8ff59b067](https://github.com/confighub/helm-expt/commit/8ff59b067)); complete the source/selection/namespace/configuration/target binding matrix. |
| B28 | partial | Focused substitution tests landed (#1783, #1785, #1793); add tests only for further demonstrated gaps identified by B25–B27. |
| B29 | partial | Retained historical scopes are documented; complete the immutability/current-policy coverage audit without rewriting old success. |
| B30 | partial | Affected gates pass for landed fixes; finish the cross-family catalog-claim reconciliation with exact receipts. |
| B31 | accepted | [#1781](https://github.com/confighub/helm-expt/pull/1781) landed the [AICR trust/mirror/skill comparison](../reference/aicr-evidence-and-our-receipts.md). |
| B32 | blocked | NIM configuration profiles do not establish governing terms. Nine artifact-specific NGC terms pages in #1387 still require a human read; retain unread status. |
| B33 | partial | Merged [#1863](https://github.com/confighub/helm-expt/pull/1863) admits [Flux AIO Timoni](../../examples/timoni/flux-aio-2-9-4-0/README.md) and the retained [BaseVariantRecord](../../data/base-variant-records/records/timoni-flux-aio-2-9-4-0-default.yaml), with 21 objects/15 CRDs. Destination, post-deployment and target-resolution evidence remain not-run/awaiting target. |
| B34 | partial | [Timoni Redis proof](../../data/timoni-redis-catalog-proof/summary.md) has a dev selection without a Kubernetes field change. Meaningful multi-environment selection is still static work; target delivery remains blocked on destination selection. |
| B35 | accepted | [AICR v0.20.0 chain](../../data/aicr-v0-20-0-chain/summary.md) and release OCI receipt complete the configuration-plane reconciliation. #1608 runtime and #1581 remain separate. |
| B36 | partial | [#1778](https://github.com/confighub/helm-expt/pull/1778) landed seven [non-d2 delivery patterns](../../knowledge/wiki/delivery-patterns.md). #1758 is closed, but d2 still needs the maintainer layout list. |
| B37 | accepted | [Verification-cost receipt](../../runs/verification-cost/2026-09-07/site-parse-profile.json) measured repeated parsing; #1812 landed the scoped cache optimization. Single-run timings are not general benchmarks. |
| B38 | accepted | Merged [#1857](https://github.com/confighub/helm-expt/pull/1857) improves stale Kubara fingerprint diagnostics and [#1859](https://github.com/confighub/helm-expt/pull/1859) exposes catalog promotion digest failure context, with focused rejection coverage. These diagnostics do not qualify a live Kubara target or change known-red status. |
| B39 | partial | Per-change regeneration checks exist. Complete deterministic regeneration and dependency coverage for the unified delivery scope. |
| B40 | open | Backend integration PRs #1857, #1859, #1863 and #1864 each passed all nine current-head CI checks. That is per-PR evidence; a full-chain result for the integrated main baseline remains to be recorded. Site deployment is a different gate. |
| B41 | active | This dated reconciliation covers the original backlog and journey work; keep task/issue/PR state synchronized as the remaining work lands. |
| B42 | open | Publish the final accepted task/evidence/gate record only after outstanding acceptance is resolved. This checkpoint is not completion of the plan. |

## Source-consumer audit: B10 execution result

On 2026-09-10, traced both committed source-fetch receipts through the refresh
queue and live rerun generator. No demonstrated scheduling defect was found in
this scope. Historical HTTP failure and successful anonymous OCI byte retrieval
remain separate observations; neither proves future availability or whether
credentials would repair a failed URL.

| Surface | What was checked | Finding |
| --- | --- | --- |
| [Four-pin audit](../../scripts/audit-bitnami-source-fetch.mjs) and [receipt](../../runs/bitnami-source-fetch/receipt.json) | Exit status, execution error, archive hash, protocol declarations and direct-TGZ observation. | OCI availability requires successful pinned-byte retrieval. Direct HTTP 403 is not classified as an authentication requirement. This receipt is not itself a scheduler input. |
| [Refresh source audit](../../scripts/audit-refresh-candidate-sources.mjs) and [action queue generator](../../scripts/generate-latest-refresh-action-queue.mjs) | Source transport and identity, candidate version/digest and failed/missing receipt handling. | Queue verification requires a valid source receipt. Actions retain replacement decisions instead of translating historical HTTP failures into auth-remediation work. |
| [Live rerun generator](../../scripts/generate-live-parity-rerun-plan.mjs) | Source overrides used in generated Bitnami rerun commands. | The generator selects the Bitnami OCI repository, independently of historical direct-TGZ status. This transport choice is not a new availability observation for every version. |
| [Historical successor survey](../../data/bitnami-successors/successors.csv) | Whether the old direct-URL wording feeds the inspected schedulers. | It does not. Its historical 403 wording must not be treated as a current runtime-source verdict. No scheduler repair is justified by that wording alone. |

Focused offline checks passed: source-fetch verification for four pins, refresh
source verification for seven candidates (including fifteen negative cases),
action-queue verification for seven update rows, and rerun-plan verification for
108 rows. Commands: `node scripts/audit-bitnami-source-fetch.mjs --verify`,
`node scripts/audit-refresh-candidate-sources.mjs --verify`,
`node scripts/generate-latest-refresh-action-queue.mjs --verify`, and
`node scripts/generate-live-parity-rerun-plan.mjs --verify`. These inspect retained
observations; no new fetch or live lane ran. This result completes the bounded
consumer audit for review, not B09's remaining classification work or B12's
six-pin retirement/disposition reconciliation.

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

## Workshop acceptance blocks (W1–W8)

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

Current integration batch: cub-workshop #10–#17 are merged after fresh CI. The [direct integration observation](../../runs/workshop-integration/2026-09-10/receipt.json) records source `4fd3f01a7a67238013cd3d613c1efe04c3339819` with cub v0.4.4: isolated installation, the 184-object GitOps selection, move/resume with a minimal runtime, replica-only edit, incompatible API refusal, and Match candidate/mismatch/unknown results. It is an agent-operated direct CLI check, not a new independent assistant or human trial.

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
| d2 stack layouts, originally tracked by #1758 | The seven non-d2 patterns landed, but the closed issue does not supply the d2 layouts. Maintainer supplies the list before that portion starts. |
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

## Workshop evidence checkpoint, 2026-09-10

Completion is measured against each block's acceptance evidence, not PR count.
The local editing loop is implemented; the complete three-journey plan is not yet
accepted. Open implementation PRs are not installed capabilities.

| Block | Current evidence | Remaining acceptance |
| --- | --- | --- |
| 1. Scenario inventory | [Backend scenario](https://github.com/confighub/helm-expt/blob/main/examples/workshop-kubara-app/README.md) and [merged audit PR](https://github.com/confighub/helm-expt/pull/1846). | Complete for the original bounded inventory; a new selection needs its own current receipt. |
| 2. Composition and fit | [Served API fix](https://github.com/confighub/cub-workshop/pull/7) merged. [Prerequisite inventory](https://github.com/confighub/cub-workshop/pull/10) and [Kubara plus Argo CD selection](https://github.com/confighub/cub-workshop/pull/11) merged. | Bind the selected GitOps source and destination; preserve explicit user requirements and verify target facts. |
| 3. Retained local workflow | [Structured results](https://github.com/confighub/cub-workshop/pull/8) and [portable workspaces](https://github.com/confighub/cub-workshop/pull/9) merged. PR #9 records clean cub installation, move/resume, one-field edit and baseline preservation. The [integrated direct receipt](../../runs/workshop-integration/2026-09-10/receipt.json) repeats that local check for the 184-object GitOps selection, including refusal. | Local direct acceptance is recorded; GitOps source/destination binding and live delivery remain separate. |
| 4. Assistant routes | [Matching local trials](https://github.com/confighub/cub-workshop/pull/12) merged; both assistants produced identical accepted and refused candidate hashes, checked independently. | Repeat both assistants for the expanded 184-object selection; historical trials remain pinned to their original 135-object input. |
| 5. Website task page | Maintainer authorized website implementation. [#1855](https://github.com/confighub/helm-expt/pull/1855) landed the repaired Kubara command transitions and tested local Adapt route; all nine PR checks passed. | Publish the complete composition task after integration, then browser walk and site gates. |
| 6. Live run, change, rollback | [HTTP listener fix and local container receipt](https://github.com/confighub/cub-workshop/pull/14) merged. No new Kubernetes target or controller observation. | Maintainer supplies context, target, source/destination and access. Run serially; retain readiness, response, rollback and cleanup separately. |
| 7. Demos and handoff | [Shared CLI/assistant exercise](https://github.com/confighub/cub-workshop/pull/12) accompanies the retained trials. | Full reviewed selection, live demonstration and an independent person's handoff trial. A test copying a directory is not that person trial. |
| 8. Adapt and Match | [Prometheus preservation proof](https://github.com/confighub/helm-expt/blob/main/data/prometheus-upgrade-preservation-proof/summary.md) already records a real 29.8.0 to 29.9.0 upgrade preserving protected replicas through staging promotion. [Local input checks](https://github.com/confighub/cub-workshop/pull/13) merged, including bounded parsing and exact validated-byte retention. | Reuse that configuration-plane proof in the complete Adapt task and handoff; it did not deliver to Kubernetes. [Local structured diff](https://github.com/confighub/cub-workshop/pull/18) and [actual Adapt assistant trials](https://github.com/confighub/cub-workshop/pull/19) are merged. [Bounded KServe-to-Node Match](https://github.com/confighub/cub-workshop/pull/16) merged; [actual Match assistant trials](https://github.com/confighub/cub-workshop/pull/17) merged at their historical source pin. The direct integration receipt records all three Match outcomes with the merged bounded parser. Finish integrated pages and human handoff. H100 execution remains blocked by #1581. |

Do not count an Argo CD controller manifest as a working GitOps loop. Do not count
NVIDIA model-profile coverage as image pull, model load or a GPU response. The
credential boundaries of #1699 and #1639 remain in force. Website source ownership is authorized. Live target selection, access and the
human-trial participant remain requested. Static work continues independently.


## Independent handoff trial: ready-to-run protocol

This protocol is prepared, not an executed trial. Choose a participant who did
not author the implementation. Give them the task page, the pinned plugin source
revision and a fresh copy of the result directory. Do not give them the expected
answers below until their attempt is recorded. A second assistant is not a human
participant.

1. Record the journey, source revision, CLI/plugin versions, setup start and setup
   finish. Count setup interruptions separately from task time. Keep organization
   access out of a local exercise.
2. Ask the participant to explain the intended change, identify its exact inputs,
   rerun the local command into a new output file, and identify what remains
   unchecked. Record help requests verbatim after removing private information.
3. Ask them to move the directory, repeat the check, and make one additional
   requested edit. Compare hashes and findings before and after the move. Preserve
   the original input and the first result.
4. Present the deliberate refusal or unintended extra edit. Ask them to explain
   the finding and next action without the author repairing it for them.
5. Record task finish, observed result, assistance needed, and whether the
   participant could continue unaided. Never fill missing observations with an
   expected result. A mistaken live-readiness claim requires investigation.

For Adapt, use the pinned task and fixtures in cub-workshop at revision
`569d74f968b0b60cc3d55bffe91aef22de10fa29`. The requested edit is Deployment
`monitoring/prometheus-server` replicas 1 to 2; the extra-edit candidate also changes
`revisionHistoryLimit` from 10 to 5. The expected local result reports both changes
for that candidate. The participant should distinguish comparison success from
approval, upstream preservation and workload health.

The handoff record must name the input and output hashes, the exact task supplied,
setup and task durations, assistance events, refusal interpretation, omitted live
checks, and the observed continuation outcome. Keep real participant identities out
of public records. For Compose and Match, bind this protocol to the final integrated
source revision before the trial; the currently separate PRs are not that revision.

## Fleet confidence and entry-path acceptance refinement

The [NVIDIA fleet catalog requirements](./nvidia-fleet-catalog-requirements.md)
refine the existing blocks without marking any of them complete. Start with
fleet-level declarative desired/live reconciliation and keep the four
deployment/rollback confidence outcomes separate ([#1582](https://github.com/confighub/helm-expt/issues/1582)).
The AICR v0.21.0 comparison reuses existing exact receipts and preserves the
v0.20.0 chain ([#1860](https://github.com/confighub/helm-expt/issues/1860)).

Completion requires actual cub, command-line plugin and live-chat API paths
for the supported Catalog/Workshop jobs, with the same digests, constrained
inputs, evidence, approvals and refusals ([#1861](https://github.com/confighub/helm-expt/issues/1861)).
A CLI-only demo or API design document does not complete live-chat access.
Missing target, publication or runtime evidence stays explicitly unproved.

## Workshop Guides: story coverage and evidence admission

The Workshop Guides proposal adds a learner-facing layer to this plan. Keep
Compose → Adapt → Match in order and preserve the existing site navigation.
A Guide teaches one bounded job; a Path links Guides into a larger story;
Examples supply executable inputs; Stories explain relevance; Evidence supports
specific claims. The [portfolio map](../../data/workshop-guides/summary.md) is
planning coverage, not a count of published Guides or proven capabilities.

Cover the full progression, not only signup:

- **Entry:** inspect or find configuration, understand what it installs and needs,
  diagnose ignored values, and make a bounded change without an unnecessary fork.
- **Midpoint:** keep, share and resume a result; map source to ConfigHub; compare
  candidates; preserve intent across upgrades; handle lifecycle work; review,
  release and promote; distinguish configuration rollback from recovering data.
- **Keystone:** describe a platform and its apps and receive a checked bounded
  composition; match GPU workloads and operate declared fleet configuration with
  provenance, constrained inputs and distinct deploy/continuity/rollback evidence.

Experts may enter at a midpoint or keystone with explicit prerequisites. Each
major story needs a Guide/Path mapping, accountable role, source/evidence links,
implementation status and next step. The first published set stays small; the
whole story map must remain visible. Current receipts outrank historical story
claims. The GPU-fleet Path inherits #1582's four confidence requirements and
#1581's runtime prerequisites; a story never lifts those gates.

Every taught journey explains authored source → materialization → ConfigHub
representation → delivery/observation → authority and the next edit location.
For anonymous completion, a ConfigHub mapping can be explicitly previewed rather
than created. A retained local result or actionable refusal is a valid completion;
SaaS activation is a separate outcome with actual product state and evidence.

[#1869](https://github.com/confighub/helm-expt/issues/1869) owns the Guide metadata,
portfolio, template and admission work. Reuse WorkshopResult and existing
source/result identities; do not create a competing execution model. Keep
editorial maturity separate from source, materialization, destination and live
status. Official publication requires accountable ownership, supported versions,
maintained pins, reproducibility and evidence for the promised outcome. Mapping a
story does not satisfy those conditions. Runnable tasks stay in cub-workshop;
Guide pages/evidence stay here; Hub owns product tours, auth continuation and
user/organization-scoped resume. Actual direct cub/plugin and live-chat API
acceptance remains [#1861](https://github.com/confighub/helm-expt/issues/1861).

[#1870](https://github.com/confighub/helm-expt/issues/1870) specifies the Argo
Application Tree Path now, with supported handover deferred until proved.
Preserve bootstrap, managed child definitions, generated desired objects and
observed state as distinct nodes. Displaying a generated object does not make
ConfigHub authoritative for it. Prove one canary change and bounded rollback,
including removal of conflicting previous authority, before expanding adoption.
