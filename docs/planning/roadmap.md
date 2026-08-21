# Roadmap

**UNOFFICIAL/EXPERIMENTAL.** This is the canonical roadmap index for
`helm-expt`. It does not replace generated status surfaces or GitHub issues.
It explains the current product direction, the active workstreams, and which
planning files are authoritative for each kind of question.

Updated: 2026-08-21.

## How To Read The Roadmap

Use generated data for moving status and use GitHub issues for execution.
Use this file for priority, ownership, and product shape.

| Question | Source |
| --- | --- |
| How much of the agreed Top 50 is complete? | [Top 50 Completion Plan](../../data/top50-completion/summary.md). |
| What should we work on next? | This roadmap, [Next Execution Plan](./next-execution-plan.md), and GitHub issues. |
| What is the state of one chart, version, and variant? | [Master Catalog Matrix](../../data/master-catalog-matrix/matrix.html). |
| Which claims are backed, partial, planned, or refused? | [Claims Register](../../data/claims-register/summary.md). |
| Which outcome is promised and how is it tested? | [Outcome Evidence Contract](../../data/outcome-evidence-contract/summary.md). |
| Which public pages must stay truthful? | `chart-claim-integrity:verify` and `site:ux:verify`. |
| Which historical notes explain how we got here? | Planning files marked as handovers, dated audits, or archive material. |

Do not copy live counts into roadmap prose. Counts belong in generated data.

## Current Product Goal

`helm-expt` should help a person turn configuration they already use into a
reviewed, deployable OCI package. That result must remain useful without ConfigHub.
When a team needs durable history and operations, the project should show how the
same accepted configuration continues into ConfigHub:

```text
Start with Helm first, then support AICR, cub installer packages, existing OCI, and Kubernetes YAML.
Let people inspect, test, and produce public OCI without a ConfigHub account.
Record source inputs, exact objects, prerequisites, hooks, CRDs, checks, and receipts.
Offer an optional ConfigHub handoff when a team needs shared history, variants, approvals, promotions, or fleet rollout.
Publish exact reviewed objects as OCI for Argo CD, Flux, or direct apply.
Keep unsupported cases and missing evidence visible.
```

Helm remains the first and deepest path. The wider boundary is:

```text
source -> inspect and test -> OCI
OCI -> inspect or change -> OCI
OCI -> ConfigHub -> reviewed variants and operations -> OCI -> delivery
```

The proof machinery supports that story. It should not be the first thing a new
visitor has to understand.

The model keeps four records separate: source and intent, exact configuration,
lifecycle work, and runtime result. Helm hooks, CRDs, cloud provisioning, runtime
images, models, and configuration OCI have different lifecycle rules. OCI is the
common transport between tools and systems; it is not a universal execution model.

The homepage should keep a small number of starting jobs. A well-designed Catalog
absorbs the breadth: users can browse by source format, task, lifecycle need,
evidence stage, and version. More examples should make the Catalog more useful without
turning every format or advanced workflow into another top-level entry point.

## Active Workstreams

| Workstream | Current objective | Primary surfaces | Main trackers |
| --- | --- | --- | --- |
| Question-first acquisition | Turn real public Helm questions into visits, answered checks, and retained results: the cohort test, the intake counter, and the Check and Promote pages. | `site/ask.html`, `site/promote.html`, [growth strategy](./config-workshop-ai-drift-growth-strategy.md), [promotion test program](./promotion-workshop-test-program.md). | [#1537](https://github.com/confighub/helm-expt/issues/1537), [#1538](https://github.com/confighub/helm-expt/issues/1538), [#1539](https://github.com/confighub/helm-expt/issues/1539), [#1540](https://github.com/confighub/helm-expt/issues/1540), [#1553](https://github.com/confighub/helm-expt/issues/1553). |
| Public website and guides | Keep the site clear for a new Helm user, with short guide pages and deeper docs one click away. | `site/*.html`, [Dedicated Website Plan](./dedicated-website-plan.md), [persona UX audits](./persona-ux-audit-2026-06-22.md). | [#1406](https://github.com/confighub/helm-expt/issues/1406), [#679](https://github.com/confighub/helm-expt/issues/679). |
| Chart catalog and matrix | Keep the top-100 chart catalog useful, honest, and navigable by chart/version/base/variant. | [Master Catalog Matrix](../../data/master-catalog-matrix/matrix.html), [Chart Use Guide](../../data/chart-use-guide/summary.md), [Top-100 Readiness](../user/top100-readiness.md). | [#106](https://github.com/confighub/helm-expt/issues/106), [#113](https://github.com/confighub/helm-expt/issues/113), [#114](https://github.com/confighub/helm-expt/issues/114). |
| Live evidence and hard charts | Keep hard chart behavior receipted: CRDs, webhooks, hooks, target facts, generated facts, storage, runtime health, and GitOps sync. | [Current Proof Status](../user/current-proof-status.md), [Live Parity Rerun Plan](../../data/live-parity-rerun-plan/summary.md), [Lifecycle Boundary](../../data/lifecycle-boundary/summary.md). | [#842](https://github.com/confighub/helm-expt/issues/842), [#861](https://github.com/confighub/helm-expt/issues/861), [#878](https://github.com/confighub/helm-expt/issues/878). |
| Variants and promotion | Show base variants, derived ConfigHub variants, promotion, and app workflows as ordinary ConfigHub value, now including the public promotion review page. | [Creating Variants](../user/creating-variants.md), [Variant Promotion Model](../reference/variant-promotion-model.md), [Variant Promotion](../../data/variant-promotion/summary.md). | [#152](https://github.com/confighub/helm-expt/issues/152), [#151](https://github.com/confighub/helm-expt/issues/151). |
| Render-input capture and renderer integration | Ensure one-shot Helm adoption records the inputs needed for repeatable render, upgrade, and rollback, and align with Argo CD / Flux renderer sources where those are already the source of truth. | [Choosing Commands](../user/choosing-commands.md), [Why This Exists](../user/why-this-exists.md), [ConfigHub Data Model](../user/confighub-data-model.md). | Upstream ConfigHub [#3393](https://github.com/confighubai/confighub/issues/3393), [#4369](https://github.com/confighubai/confighub/issues/4369), helm-expt [#76](https://github.com/confighub/helm-expt/issues/76). |
| ConfigHub/cub product blockers | Keep product gaps exposed by the corpus linked to upstream implementation work without overstating what helm-expt itself owns. | [Issue Backlog](./issue-backlog.md), [Variant Promotion Closeout](../reference/variant-promotion-closeout.md). | [#682](https://github.com/confighub/helm-expt/issues/682), upstream ConfigHub issue [#4609](https://github.com/confighubai/confighub/issues/4609). |
| Errors, omissions, and UX guards | Prevent false chart-page claims and placeholder leaks from returning. | [Chart Claim Integrity Audit](./chart-claim-integrity-audit-2026-06-22.md), [Test Map](../../tests/README.md). | PR [#1024](https://github.com/confighub/helm-expt/pull/1024), [#1025](https://github.com/confighub/helm-expt/issues/1025), [#1026](https://github.com/confighub/helm-expt/issues/1026), [#1027](https://github.com/confighub/helm-expt/issues/1027), PR [#1028](https://github.com/confighub/helm-expt/pull/1028). |
| AI-assisted apps and operations | Turn the ConfigHub data model into a substrate for AI-assisted app changes, RBAC/task-specific tools, and safer operations. | [AI-Assisted Helm Changes](../user/ai-assisted-helm-changes.md), [Broken Chart Triage](../user/broken-chart-triage.md), future app examples. | [#949](https://github.com/confighub/helm-expt/issues/949) and future app/example issues. |
| AI infrastructure and tested platform stacks | Let a user start an inference service or compose a platform from tested components, keep custom runtime images explicit, and move the reviewed configuration through OCI, ConfigHub, GitOps, and Kubernetes. | [AICR Catalog Brief](./aicr-catalog-brief.md), [Kubara journey](../../site/kubara.html), [Worked Examples](../../site/testing.html), and the AI runtime plan below. | Existing AICR and Kubara issues, followed by dedicated c3agent and platform-builder issues. |

## AI Infrastructure And Platform Track

This track is informed by an August 2026 discussion with an AI infrastructure
partner. The roadmap records the product requirements, not private meeting notes,
contact details, or commercial commitments.

The partner feedback makes the job concrete:

- offer tested, versioned ways to run common AI and platform workloads;
- keep a complete open-source reference path, while allowing users to replace
  components and supply their own images;
- help teams that have Kubernetes and GPUs but do not yet have mature cloud
  operations;
- let agents request infrastructure without letting a non-deterministic agent
  rebuild the platform differently on every run; and
- put testing, promotion, rollout, rollback, and measured optimization around the
  selected configuration.

### Two Public Starting Journeys

| User question | First useful result | What follows |
| --- | --- | --- |
| How do I get an inference service running correctly? | One tested configuration with exact component versions, runtime image digests, required Secrets and controllers, generated Kubernetes objects, checks, and a local or OCI output. | Save the accepted base in ConfigHub, make environment variants, test a candidate, promote it, publish release OCI, and check the live result. |
| How do I build a platform from known-good parts? | Pick tested Catalog components and versions, add custom applications or runtime images, and generate one Kubara platform plus its source-and-intent record and immutable package index. | Keep Git as the portable source, use ConfigHub for the retained platform variants and operations, and let Argo CD, Flux, or Sveltos reconcile the approved output. |

The first journey begins with an inspection and configuration exercise that needs no
GPU. A page may say that inference is running only after a real model request succeeds
on a recorded target. GPU-specific claims require a real GPU target and measured
workload evidence. The second journey should be presented as **Build a platform**, not
as a Kubara expert reference page. The existing Kubara evidence remains behind that
simpler front door.

### Named Inference Starting Stacks

"Get inference running" is a family of concrete examples, not one generic AI demo.
The public site should first let a person inspect the configuration without specialist
hardware, then identify the stack whose model workload they can actually run.

| Starting stack | What it helps a user do | Evidence and boundary today |
| --- | --- | --- |
| [AICR plus Helm components](../demo/aicr/index.md) | Choose a tested AI platform recipe, inspect the Helm-backed components and their order, and keep the exact generated Argo CD configuration. The CPU starter is the accessible first run; the retained EKS, H100, Kubeflow, and NIM entries show the larger shapes. | The repository retains exact AICR versions, generated Applications, digest indexes, ConfigHub changes, promotions, and bounded kind delivery. These are configuration proofs; no catalog receipt claims that it ran a GPU workload. |
| [NIM inference](../demo/aicr/eks-h100-inference-nim.md) | Choose between an [AICR-native NIM platform](../demo/aicr/eks-h100-inference-nim.md) and [NIM model shapes on KServe](../demo/aicr/kserve-nim-inference.md), then inspect the runtime references, model-to-GPU choices, prerequisites, and generated objects before using them. | The AICR platform shape and the retained NVIDIA KServe files are pinned and checked. The KServe path has ConfigHub import, promotion, and config-plane delivery evidence. NGC images, models, and keys remain user-supplied; no NIM model workload is claimed as run. |
| [EKS inference](https://github.com/confighub/eks-inference) | Install shared component bases, create a configuration sandbox, or build the real ACK, EKS, Karpenter, GPU-runtime, and vLLM stack through the public `cub eksinf` plugin. | Config Workshop has certified all eight published component bundles, proved the ConfigHub sandbox, promoted and delivered one change through Argo CD, and run one real request using the CPU starter. AWS provisioning, NVIDIA GPU readiness, and the production model path remain open. |

These entries must remain visibly different. AICR describes and composes a platform,
Helm supplies many of its components, NIM supplies licensed model-serving runtimes,
and `eks-inference` is an opinionated end-to-end stack. The Workshop gives them the
same review path without pretending they are the same format.

### Public Site And Customer Path

This track should extend the current site rather than introduce another navigation
model. Each named stack follows the same short sequence:

1. Find the stack in the Catalog or Examples page and read what it contains, what it
   needs, and what has actually been tested.
2. Run the accessible example locally or use the site's no-account checks. Keep the
   reviewed result as files or configuration OCI.
3. Compare the result with another catalog version, an AI-produced candidate, or the
   configuration the user already runs.
4. Stop with the reviewed files or OCI, or use **Keep this reviewed result in
   ConfigHub** when the result needs shared history, variants, approvals, promotion,
   release OCI, GitOps delivery, or live comparison.

The source identity and object-set digest must stay visible across step 4. The account
is the way to retain and operate an accepted answer, not a prerequisite for learning
what a stack will do. The website needs small additions to the existing Catalog,
Examples, Check, Promote, and ConfigHub pages; it does not need a separate AI-inference
site or another top-level product story.

### OCI Is The Common Handoff

The common delivery shape is:

```text
Git -> build -> OCI -> ConfigHub -> OCI -> Argo CD or Flux -> Kubernetes
```

OCI is the transport and immutable handoff for deployable configuration. It is not
the only record in the system, and the site must not use the word OCI as if every
artifact had the same job.

| OCI role | What it contains | Example |
| --- | --- | --- |
| Source or package OCI | Reproducible source material, selections, and files needed to produce configuration. | A `cub installer` package or an AICR recipe bundle. |
| Runtime image OCI | The application, model server, agent runtime, or sandbox image Kubernetes will run. | A digest-pinned inference server or c3agent image. |
| Configuration or release OCI | The exact Kubernetes objects reviewed by the user and consumed by a reconciler. | A local rendered OCI or a ConfigHub Space release. |

Every maintained path also needs a source-and-intent record. It explains the source,
selections, exact output, custom images, remaining inputs, prerequisites, lifecycle
work, checks, and receipts. Secrets travel as references or target requirements, not
as credential material embedded in a portable OCI.

The public no-account boundary remains useful at every starting point:

```text
work -> OCI
OCI -> work
OCI -> work -> OCI
```

Here, work means inspect, explain, render, compare, test, scan, or edit. A useful
anonymous path can end with files or OCI. A user signs in when they choose to retain
the result as shared ConfigHub data, promote or approve it, publish a ConfigHub
release, or compare it with live systems.

### Deterministic Tools Behind Agents

The agent path should be:

```text
request in words
-> agent chooses a deterministic tool and inputs
-> exact candidate objects
-> checks and workload measurements
-> human or policy decision
-> ConfigHub promotion and release OCI
-> GitOps and Kubernetes
```

An agent may explain the result, select a tested pattern, propose inputs, or choose
the next experiment. Deterministic tools render, transform, compare, test, publish,
and promote it. The agent does not directly improvise a different cluster or platform
on every run.

This creates two related examples:

| Example | Purpose | Current boundary |
| --- | --- | --- |
| c3agent fleet | Turn model, runtime image, concurrency, budget, storage, and credential references into exact Kubernetes resources with field provenance and policy checks. | The Workshop now proves deterministic objects, companion OCI records, ConfigHub variants and promotion, release OCI, Argo CD, and Kubernetes reconciliation with the workload disabled. Running the private runtime and an agent task remain open. |
| Configuration optimization sandbox | Try candidate settings against a defined workload, retain the input, output, target facts, and metrics, and promote the best accepted configuration. | A bounded NGINX example now tests three exact candidates, rejects one on a destination requirement, selects the smallest passing configuration, promotes that object set, and proves its release through Argo CD. Broader or repeated optimization remains future work. |

The first c3agent Workshop example should show one digest-pinned custom runtime image,
one Secret reference, and one model or budget change moving from development to
staging and production. It should produce a configuration OCI locally, retain the
same object set as a ConfigHub base, publish a release OCI, and deliver it through
Argo CD or Flux. The live proof must say whether it checked only Kubernetes readiness
or exercised the agent workload itself.

### Acceptance Ladder

The track graduates one claim at a time.

1. A new user can run the starting example locally without a ConfigHub account.
2. The result names the source package, exact versions, runtime image digests, and
   every generated Kubernetes object.
3. Required Secrets, controllers, CRDs, hooks, setup work, and target facts are
   visible before deployment.
4. The user can keep the reviewed objects as files or a configuration OCI.
5. Pulling that OCI back produces the same object-set hash.
6. Uploading the result to ConfigHub retains the same object set and source digest.
7. Development, staging, and production changes appear as exact variant diffs, with
   overlapping source and post-render changes identified before promotion.
8. Apply gates check schema, placeholders, Secret handling, approved models or
   runtimes, image pinning, lifecycle routes, and production approval as applicable.
9. A ConfigHub release OCI reaches Argo CD or Flux at the recorded digest, and the
   target result is observed separately.
10. An optimization example records each candidate, test workload, metric, decision,
    and promoted winner. A failed or partial target never becomes an overall pass.

### Current Boundaries

| Capability | Status |
| --- | --- |
| Pull, inspect, render, compare, and create OCI locally without a ConfigHub account | Available for the current public starting paths. |
| Hosted browser inspection of rendered YAML without signing in | Available as a bounded path: exact object inventory, comparison, static findings, optional Catalog lifecycle context, AI handoff, and one downloadable result. No arbitrary chart rendering, OCI pull, cluster access, or live tests. |
| Hosted anonymous arbitrary source or OCI work | Planned, not shipped. |
| Helm package, rendered OCI, ConfigHub release OCI, and Argo CD or Flux delivery | Demonstrated in the existing evidence corpus. |
| AICR recipe, digest-bound package set, exact-field variant gate, ConfigHub variant, and promotion | Demonstrated for the retained CPU-starter and platform examples. Broader inference, Flux delivery for the promoted platform, and GPU workload proof remain open. |
| Public `confighub/eks-inference` plugin and eight OCI component bundles | The eight bundles are incorporated as certified external artifacts with file and digest witnesses. The configuration sandbox, one retained promotion, ConfigHub release OCI, Argo CD delivery, and one CPU vLLM request are independently proven. AWS and NVIDIA GPU execution remain open. |
| Kubara composition, retained versions, ConfigHub operations, and fleet evidence | Demonstrated for the retained platform, with a simple Catalog-to-platform chooser and a companion generator in `kubara-confighub`. |
| c3agent source mapping and connected ConfigHub path | Demonstrated from compact source through exact objects, local OCI, ConfigHub variants and promotion, release OCI, Argo CD, and Kubernetes object reconciliation. The Deployments remain deliberately disabled. |
| Standalone live c3agent workload and generic AI sandbox execution | Not yet demonstrated. |
| Measured configuration selection and promotion | Demonstrated for three NGINX candidates, one fixed local HTTP test, one destination requirement, ConfigHub promotion, release OCI, Argo CD, and Kubernetes. This is not a performance benchmark or a general optimizer. |

### Next Build Order

1. **Completed:** publish the four-record lifecycle model and the Catalog browse model in the
   canonical guides, then keep the public site summary short.
2. **Completed:** expose the eight existing `eks-inference` certified-bundle records as one readable
   stack journey, including the component order, routes, and exact source commit.
3. **Completed:** independently run and receipt the `eks-inference` ConfigHub configuration sandbox.
   Do not add a cloud or model-runtime claim to that receipt.
4. **Completed:** retain one candidate as a ConfigHub variant, promote it, publish release OCI, and
   prove Argo CD or Flux consumed the recorded digest.
5. **Completed:** run one real vLLM model request on a recorded target. Keep cluster readiness,
   workload readiness, and successful inference as separate results.
6. **Completed:** present the CPU starter, AICR plus Helm, NIM, and `eks-inference` as one ordered
   Catalog family: begin without specialist hardware, then offer the GPU and cloud
   paths with costs, credentials, prerequisites, and proof boundaries stated first.
7. **Completed:** build a Config Workshop c3agent example from local source through
   configuration OCI, ConfigHub variants, promotion, release OCI, Argo CD, and a
   bounded Kubernetes check.
8. **Completed:** add a simple **Build a platform** journey: choose tested Catalog
   components, versions, and custom images; generate Kubara configuration and its
   package index; then continue locally or in ConfigHub.
9. **Completed:** join the test harness to promotion: generate candidates, run a fixed workload,
   record metrics and target facts, select an accepted result, and promote that exact
   configuration.
10. **Completed:** complete the bounded hosted-anonymous path and its contract without
    implying that the static site renders arbitrary charts, pulls arbitrary OCI, or contacts clusters.
11. **Completed:** gate one AI-proposed AICR platform change by exact object identities,
    declared Application reach, and exact changed fields; refuse the overbroad request.
12. **Then:** only after the bounded examples pass, generalize the pattern to more AI runtimes,
   sandboxes, hardware classes, fleet tools, and reference stacks.

## Component Ownership

Which part of the wider system owns each kind of work. This is the split issue
#949 asked the roadmap to state; it names owners, not delivery dates.

| Component | Owns | Does not own |
| --- | --- | --- |
| helm-expt / Config Workshop | The public evidence catalog, the site, the verify chain, receipts, and honest refusals. | Executing changes against user clusters, or any governed store. |
| ConfigHub Server | Variants, approvals, promotion, releases, revision history, and live comparison records. | Rendering charts; that stays with the tools that produced the objects. |
| cub installer | Pulling a package, rendering exact objects locally, and publishing a rendered OCI. | Deciding what is safe to promote; it reports, the review decides. |
| cub variant | Creating and promoting governed variants against ConfigHub. | Inventing merge semantics; conflicts surface for review. |
| cub-scout | Observing live state and comparing it with desired configuration. | Writing desired state; observation stays read-only. |
| Argo CD / Flux | Reconciling the published release OCI into clusters. They stay user-owned. | Being replaced; the catalog emits routes for them, not substitutes. |
| Pilot | Parity-gated variant generation, prototype only. | Authority; it is author-not-authority by design. |
| Remediation and lifecycle intelligence | helm-expt records routes and action packets, every one automatic: false. | Execution, which stays with the user or the product, never the catalog. |

## Release Guardrails

The broad verifier should prevent regressions in the claims that users see.

| Guard | Purpose |
| --- | --- |
| `docs:verify` | Every authored doc has a declared role and valid local links. |
| `site:verify` | Generated site pages match the site generator. |
| `site:ux:verify` | Chart pages do not leak unresolved action placeholders or raw work-dir placeholders. |
| `chart-claim-integrity:verify` | Chart pages do not make claims contradicted by their cited receipts. |
| `npm-scripts:catalog:verify` | The npm script catalog matches `package.json`. |

Run scoped checks while editing. Use `npm run verify` as the broad release gate
after focused checks pass. A passing verifier means committed evidence is
self-consistent; it does not replace a fresh live run.

## Planning File Roles

The active planning corpus has three tiers.

| Tier | Files | Role |
| --- | --- | --- |
| Canonical | This file, [Top 50 Completion Plan](../../data/top50-completion/summary.md), [Issue Backlog](./issue-backlog.md), [Next Execution Plan](./next-execution-plan.md). | Current roadmap, evidence-linked completion status, issue groups, and launch workstreams. The Top 50 source is `config-catalog/top50.yaml`. |
| Lane-specific | [Dedicated Website Plan](./dedicated-website-plan.md), [Robust Sceptic Plan](./robust-sceptic-plan.md), [Fuzz Corpus Tests Roadmap](./fuzz-corpus-tests-roadmap.md), [Hook Route Execution Plan](./hook-route-execution-plan.md), [Maintenance Strategy](./maintenance-strategy.md), [Verified Install Commercial Model](./verified-install-commercial-model.md). | Active product or test lanes. These should link back here when priorities change. |
| Snapshot or review input | Handover docs, dated persona audits, dated claim audits, independent review briefs, older execution plans. | Evidence, review history, or context. These are not authoritative for current counts. |

When adding a new planning file, add its role to [Documentation Map](../README.md)
and decide whether it is canonical, lane-specific, or a snapshot.

## Roadmap Cleanup Rules

1. Do not create another broad roadmap without updating this file.
2. Dated files are logs or audits unless they explicitly say otherwise.
3. Generated data remains the authority for counts.
4. GitHub remains the authority for execution state.
5. User-facing claims must be backed by receipts, generated data, or an explicit planned/refused status.
6. If a planning note is no longer current, either archive it or add a short status note at the top.

## Near-Term Cleanup Still Worth Doing

| Item | Why |
| --- | --- |
| Continue archiving old handoff snapshots. | The repo has many useful historical notes that should not look like current instructions. |
| Keep website copy smaller than the docs behind it. | The site should explain the product path; detailed proof belongs in guides and generated data. |
| Keep chart-page warnings visible but less scary. | Warnings are product honesty, not failure, when they tell users what remains to stage or decide. |
