# Next Execution Plan

This is the current execution plan for Config Workshop and its path into
ConfigHub. It turns the project doctrine, user simulations, command audit,
misconfiguration work, AI use, promotion work, and SaaS onboarding review into
one sequence.

For current evidence counts, use the [Top 50 Completion Plan](../../data/top50-completion/summary.md)
and generated status pages. For the business purpose and processing model, use
the [Config Catalog Doctrine](../reference/config-catalog-doctrine.md).

The previous Helm-proof execution plan is retained as a
[historical snapshot](./next-execution-plan-2026-06-helm-proof.md).

## Current Status

The August 2026 audit covered the doctrine, roadmap, Top 50 tracker, user
simulations, command guidance, open issues, installed `cub` plugins,
`cub-scan`, and the shared patterns repository.

The current Top 50 state is:

```text
available: 29
partial:   19
planned:    2
```

[PR #1593](https://github.com/confighub/helm-expt/pull/1593) captures the latest
simulation findings and misconfiguration doctrine. [Issue #1592](https://github.com/confighub/helm-expt/issues/1592)
tracks the work needed to join Catalog findings, local checks, and ConfigHub
validation into one visible journey.

The first complete case and the Catalog-wide local evidence are now in place:

- one NGINX change runs from an unsafe local result through a correction,
  retained ConfigHub revision, blocking validation, and promotion;
- every maintained Helm base has a separate released `cub check` result bound
  to the exact YAML bytes and canonical scanner object set;
- generated chart pages show the human summary and link the complete shared
  result, exact YAML, and separate chart-specific Catalog review;
- the mapping from Catalog rules to stable shared controls is complete and
  deliberately marks partial overlap and rules that require source, lifecycle,
  target, or live evidence.

A source-neutral configuration-decision schema and one complete NGINX case now
record every accepted fix, one narrow approved exception, the separate local
and managed checks, the exact retained ConfigHub revision, promotion, and Argo
CD delivery. The decision is also stored as an approved, non-deployable Unit in
the live demo organization. A general ConfigHub product view that creates and
shows these decisions for arbitrary configurations remains open in issue #1592.

## User Promise

People should be able to bring configuration made by themselves or by AI and
answer six practical questions:

1. What will this create or change?
2. How does it differ from a known configuration or what I run now?
3. What is wrong, risky, missing, or still unknown?
4. What exact result did I accept?
5. Can I promote that result to this destination?
6. Did the released configuration reach the intended live state?

The product journey is:

```text
check it -> keep it -> change it -> promote it -> release it -> observe it
```

Promotion is central. A checked configuration becomes more valuable when the
same accepted result can be changed for staging, compared with production,
tested against the destination, approved, promoted, released, and observed.

## Complete Journey

```text
Helm, AICR, OCI, YAML, or a maintained package
  -> materialize the exact Kubernetes objects
  -> compare and run relevant checks
  -> correct the configuration and rerun the checks
  -> retain one accepted object set and digest
  -> create a candidate variant
  -> compare it with the destination
  -> check lifecycle work, target requirements, and available staging results
  -> approve and promote the exact revision
  -> publish release OCI
  -> deliver through Argo CD, Flux, or another selected route
  -> compare desired configuration with live state
```

The first part must remain useful without a ConfigHub account. ConfigHub is the
next step when the user wants to retain the result, share it, change it again,
enforce checks, promote it, release it, or compare it with live systems.

## Product Surfaces

Each surface has one job.

| Surface | Job |
| --- | --- |
| Catalog | Publish answers already investigated for exact sources and versions: useful configurations, known problems, lifecycle requirements, and evidence. |
| Check my config | Investigate the user's own chart, values, YAML, OCI, or current deployment. Materialize exact objects, compare them, run bounded checks, and produce a result the user can keep. |
| Local `cub` tools | Perform source processing, comparison, checks, file output, and OCI output without requiring ConfigHub Server. |
| ConfigHub browser tour | Show a short sample journey in the browser: create one component, inspect it, change one field, create a dev variant, and see the diff. |
| ConfigHub managed product | Retain the user's accepted result, manage variants, rerun controls, record approvals, promote exact revisions, publish release OCI, and preserve live comparisons. |

The public call to action must depend on context:

- **See ConfigHub in five minutes** opens the short sample tour.
- **Keep this checked result in ConfigHub** retains the user's real objects and
  digest. It must not replace them with the tutorial sample.

## Website And CLI Are One Workflow

The website and `cub` must expose the same substantive jobs. A user may start in
the browser and continue in a terminal, or start with an AI using the CLI and
open the corresponding human explanation. The source identity, exact objects,
digest, findings, limits, and next step must remain the same.

| User question | Website path | CLI path | Shared result |
| --- | --- | --- | --- |
| I need a configuration. | Describe the need or choose a maintained starting configuration. | Discover or receive the same source reference, then process it through the applicable source plugin or package engine. | Source, version, selected configuration, requirements, and evidence links. |
| I have a configuration. Is it right? | Upload or paste rendered YAML, compare it, run bounded checks, and download the result. | Use the applicable source command, then run the released `cub check` plugin over the materialized objects. | Exact objects, object-set digest, comparison, findings, checks not run, and files or OCI. |
| I have an accepted configuration. Can I promote it? | Compare the candidate with its destination, inspect checks, and continue into ConfigHub when a managed promotion is selected. | Use `cub variant create` and `cub variant promote`, followed by release and observation commands. | Candidate revision, destination, exact diff, validations, approvals, promotion result, and release identity. |

The cross-surface rules are:

1. Every substantive website action provides a copyable command, API action, or
   downloadable record that continues the same job.
2. Every public CLI workflow links to a short website page that explains why it
   exists, what it changes, what it returns, and what it does not prove.
3. Browser and CLI results use the same schemas, pattern and control IDs, object
   digest rules, and checked-versus-not-checked language.
4. A user can move a browser result to the CLI and a CLI result to ConfigHub
   without repeating source selection or losing the accepted digest.
5. Generated website commands are verified against released CLI help. Proposed
   commands remain labelled as proposed until released.
6. AI agents use the CLI and machine output; people may use either surface. They
   are working with the same configuration record.

## Key Scenario: Build An Internal Developer Platform

One complete user request is:

> "I want to use the Catalog, Kubara, and AI to create an internal developer
> platform for building and running the tools and applications my team creates
> with AI."

This scenario uses all three main journeys rather than adding another front
door.

### I need a configuration

The user describes the platform they need: cluster type, environments, GitOps
tool, ingress, certificates, Secrets, observability, databases, policy, AI
runtime, custom images, and expected application types.

The Catalog supplies maintained components, exact versions, known
configurations, requirements, and evidence. AI can help narrow the choices and
write the native Kubara selection and wiring. Kubara remains the platform
composer and generates its normal platform tree.

The result includes:

- native Kubara `config.yaml` and reviewed overlays;
- exact component and image versions;
- source-and-intent records;
- generated platform and application-delivery objects;
- component dependencies and provided services;
- lifecycle requirements such as CRDs, hooks, certificates, and setup Jobs;
- a portable Git handoff and target-neutral OCI packages plus platform index.

### I have a configuration. Is it right?

The user reviews the exact generated platform before selecting a ConfigHub
organization or target. Local tools check source locks, generated paths,
object inventories, lifecycle work, placeholders, image identities, and the
provides-and-needs wiring. AI can explain findings and propose a smaller change,
but the rerun output and digest show what was accepted.

The website must offer the same platform selection as a downloadable native
Kubara input and a copyable CLI path. The CLI must return the same component
versions, source record, object inventory, findings, and platform digest that
the website displays.

### I have an accepted configuration. Can I promote it?

ConfigHub retains the component definitions, effective configurations,
relationships, target instances, and immutable release identities. Platform
changes move through development, staging, and production as exact revisions.
Checks, approvals, lifecycle requirements, rollout results, and rollback limits
remain attached to those revisions.

Platform components, developer tools, and applications remain related but
separately versioned. Each has its own source and configuration, consumes or
provides named services, and follows the same check, retain, variant,
promotion, release, and observation path. A shared platform change, a developer
tool change, and an application change can therefore be reviewed and promoted
independently while their compatibility is checked at the destination.

The operating split is:

```text
Catalog supplies maintained components and evidence.
AI helps choose, explain, and propose changes.
Kubara composes and generates the platform.
ConfigHub retains, compares, validates, and promotes exact revisions.
Argo CD or Flux reconciles selected release OCI.
Kubernetes runs the platform and applications.
```

The current public starter and importer live in
[`confighub/kubara-confighub`](https://github.com/confighub/kubara-confighub).
They currently expose native Kubara and `npm`-driven preparation and import
paths. A simple `cub` entry for this journey is a product gap, not a shipped
command. The likely direction is a source-specific Kubara plugin that produces
the common review record and hands retained work to `cub variant` and
`cub release`. Its exact command names require agreement with the Kubara and
`cub` maintainers.

## AI Throughout The Journey

AI is part of each job, not a separate final feature.

| Job | AI can help with | The deciding record |
| --- | --- | --- |
| Check | Run tools, explain objects, compare with known configurations, identify likely mistakes, and propose a correction. | Exact objects, source identity, checks run, findings, and work not checked. |
| Keep | Prepare the accepted files and source information for retention. | The retained ConfigHub revision and digest. |
| Change | Propose a values change or object patch and explain why it is needed. | The exact diff and rerun checks. |
| Promote | Explain candidate-versus-destination differences and identify prerequisites or risks. | Destination checks, staging results, policy gates, and required approval. |
| Release | Prepare release notes and invoke the selected command. | The exact retained revision published as OCI. There is no last-minute regeneration. |
| Observe | Explain desired-versus-live differences and suggest a correction. | Recorded observations and an explicitly accepted change. |

The primary AI question is:

> "Here is the chart and values my AI produced. Compare them with the chart
> defaults, the Catalog, and what I run now. Tell me what matters, then give me
> a reviewed result I can keep."

AI may propose and explain. Exact objects, diffs, controls, approvals, release
digests, and observations decide what progresses. The tools must support
non-interactive use, stable machine output, meaningful exit status, and links
to evidence. Raw prompts and secrets must not be required as configuration
provenance.

## Misconfiguration From Finding To Prevention

The user question is:

> "What is wrong with this configuration, what does it affect, and what should
> I fix before I ship it?"

The maintained path is:

```text
known problem
  -> exact objects
  -> advisory checks
  -> correction and new digest
  -> retained ConfigHub revision
  -> authoritative validation and approval
  -> promotion checks for the exact destination
  -> delivery and live observation
```

The current evidence systems must remain correctly named:

- Existing helm-expt scan receipts were produced by the helm-expt rendered-object
  scanner. They must not be relabelled as `cub-scan` results.
- `cub check` is the primary local command. `cub scan` is an alias, and
  `cub-scan` remains the standalone binary for local and CI use. All three
  produce advisory results from the same engine and pinned pattern bundle.
- ConfigHub `scan-unit` and `scan-space` provide detailed advisory findings over
  retained data.
- ConfigHub `validate-unit` and `validate-space` provide revision-bound results
  that can participate in managed gates.

The Catalog-wide mapping and digest-bound shared results now live in
`config-catalog/shared-control-mappings.yaml` and
`data/catalog-shared-checks/`. Each shared receipt preserves the complete
released scanner result and adds the exact committed YAML-file digest. Chart
pages show both the shared result and the separate Catalog review.

The NGINX example now carries one approved exception into ConfigHub as a
separate, non-deployable decision Unit. Its public record shows the local and
managed results together without merging their authority. The remaining work is
to make this a general product path for arbitrary configurations and to rerun
the relevant controls against every retained revision. A local result does not
become authoritative merely because it was uploaded.

Static checks do not prove hook execution, CRD readiness, admission behavior,
workload health, rollback of external effects, or convergence. Promotion and
live checks cover those separate questions where evidence exists.

## `cub` Command Direction

`cub` is the common command-line shell. Do not add another umbrella such as
`cub workshop` or present `cub installer` as a replacement for Helm.

The user-facing command structure should describe jobs:

| Job | Current or proposed path |
| --- | --- |
| Check configuration made by the user or AI | Released `cub check` plugin command |
| Process an arbitrary Helm chart | `cub helm` |
| Process AICR or another source format | The relevant source plugin, such as `cub aicr` |
| Process a maintained Config Workshop package | `cub installer` as the package engine; the first public command may later be wrapped by the check flow |
| Run shared configuration controls | `cub check`; `cub scan` alias; standalone `cub-scan` retained |
| Retain literal objects | `cub variant upload` or the applicable source upload command |
| Create and promote variants | `cub variant create` and `cub variant promote` |
| Publish a release | `cub release publish` |
| Read desired and live state | `cub k8s` and `cub scout` |

`cub check` describes the user's problem rather than the Catalog that helps
answer it. Its local scanner result is released. The browser now accepts the
result only for the exact matching object set, keeps its version, pattern-bundle
identity, and stable finding IDs in `WorkshopResult`, and carries it into the
ConfigHub handoff as non-deployable advisory evidence. Every report
must separate:

```text
checked
findings
not checked
requires a destination or live test
```

`cub installer` remains useful for package authors, CI, reproducible examples,
anonymous rendering, and OCI output. It pulls and verifies a maintained package,
selects a configuration, materializes objects, and preserves companion records.
It does not own deployment or replace the user's normal Helm path.

All source adapters should produce the same portable review information:

- source and version;
- recorded input and intent;
- exact objects and object-set digest;
- comparison baseline and changed fields;
- lifecycle requirements;
- controls run, findings, and limits;
- files or OCI output;
- the next applicable command.

## SaaS Tour And Handoff

[ConfigHub PR #5127](https://github.com/confighubai/confighub/pull/5127) is the
proposed browser tour. It must not be advertised as the common public destination
until its first path is short, accurate, and covered by a passing chained test.

Before public use:

1. Make the first tour the externally advertised path.
2. Show it on first login and in an empty organization.
3. End the short path after component creation, inspection, one change, a dev
   variant, and a visible diff.
4. Rename "Deploy to dev" to "Create a dev variant" until it actually deploys.
5. Remove or postpone steps that describe behavior that is not working.
6. Fix required empty fields that prevent a fresh user from continuing.
7. Add one passing end-to-end test for the advertised path.
8. Preserve the referring source in the URL. Analytics remain parked and do not
   block the product path.

The later tours remain optional education about ownership, production, releases,
and other advanced work.

## Execution Order

### Phase 0: Land The Current Doctrine

1. Merge [PR #1593](https://github.com/confighub/helm-expt/pull/1593) after all
   required checks pass.
2. Keep the Top 50 tracker, roadmap, simulation findings, and this file as the
   maintained status sources. Do not recreate the plan in handover notes.
3. Remove analytics from the T50 completion condition. T50 is completed by
   outside-user evidence, not a selected analytics vendor.
4. Update stale umbrella issues such as #1251 and #989 to use the current journey.

### Phase 1: Prove Check To ConfigHub

1. Continue [issue #1592](https://github.com/confighub/helm-expt/issues/1592).
2. **Complete:** map every current Catalog rule to partial shared controls or a
   clear reason why static object checking cannot replace it.
3. **Complete:** generate separate `cub check` receipts for every exact
   maintained Helm base without changing historical receipt identity.
4. **Complete:** add a plain finding summary, exact input, date, scanner and
   bundle identity, local action, and full result link to chart pages.
5. **Complete for one NGINX case:** a source-neutral decision record binds every
   finding to an accepted fix or narrow approved exception, the exact object
   digest, evidence, scope, and review date. The browser does not yet create
   this record for arbitrary results.
6. **Complete for one NGINX case:** retain the same objects in ConfigHub and
   rerun authoritative controls against that revision.
7. **Complete in the public NGINX example; remaining in the general product:**
   show local evidence and ConfigHub validation together but separately,
   including approved exceptions.
8. **Complete for one NGINX case:** demonstrate:

```text
unsafe candidate
  -> local finding
  -> reviewed correction
  -> retained ConfigHub revision
  -> enforced validation
  -> promotion result
```

9. **Next:** add the decision record to the ordinary ConfigHub review flow so a
   user can decide findings, set a scope and review date, approve the exact
   decision revision, and reopen it automatically when the configuration,
   destination, or review date changes.

### Phase 2: Make Promotion The Main Managed Payoff

1. Start with an accepted base and a named destination.
2. Create one staging candidate with an exact object diff.
3. Classify source-controlled fields, ConfigHub changes, protected fields, and
   destination facts.
4. Resolve lifecycle work after the final candidate exists. Hooks, CRDs, setup
   Jobs, certificates, and prerequisites may change when a derived variant is
   created.
5. Run available static, destination, and staging checks separately.
6. Require the applicable validation and approval.
7. Promote the exact accepted revision rather than recreating it.
8. Publish release OCI and deliver it through Argo CD or Flux.
9. Record desired-versus-live results and rollback limits.
10. Repeat the proof on a second chart with meaningful lifecycle or upgrade work.

### Phase 3: Join The Public And SaaS Experiences

1. Tighten the short ConfigHub browser tour and its end-to-end test.
2. Add **See ConfigHub in five minutes** where a sample is useful.
3. Add **Keep this checked result in ConfigHub** only where the user's exact
   result can continue.
4. Preserve the source and reviewed digest across the handoff.
5. Keep the completed `cub check` to WorkshopResult composition covered by the
   browser self-test and public schemas.
6. Keep local advisory findings visibly separate from ConfigHub's revision-bound
   validation and approval results.
7. Keep `cub installer` visible in technical package documentation, but describe
   the customer action rather than leading with the engine name.
8. Remove references to the retired top-level install alias and delete local
   plugin residue that still exposes it.
9. Add one generated website-to-CLI map for the three main journeys and verify
   every published command against the released command surface.
10. Add links from CLI results to the corresponding human explanation and from
    website results to the exact continuation command.
11. Agree and implement the smallest `cub` entry for the existing
    `kubara-confighub` platform starter and importer without replacing Kubara's
    native configuration model.

### Phase 4: Test With Users And Agents

1. Run the first outreach wave from the private cohort list in issue #1553.
   Recheck every public thread before contact and record only aggregate outcomes
   in Git.
2. Run these six end-to-end tests:
   - AI-written Helm values to a reviewed OCI;
   - reviewed OCI retained as a ConfigHub base;
   - a staging change compared with production;
   - hooks, CRDs, and destination requirements checked before promotion;
   - an exact release delivered through Argo CD or Flux and compared with live
     state;
   - a useful public investigation retained as a Catalog answer.
3. Run the internal developer platform test: use AI and Catalog records to
   produce native Kubara input, generate and check the exact platform, retain it
   in ConfigHub, promote one platform change, then add and promote one small
   application that consumes a declared platform service.
4. Test both a human driving AI and an AI agent driving `cub` commands.
5. Measure whether users reach an answer, understand what was not checked, retain
   the result, and complete a promotion without losing the object identity.
6. Turn repeated failures into product or content changes, not additional prose
   on the same page.

### Phase 5: Strengthen The Common Foundation

1. Complete package signatures and digest-pinned pulls in issue #1402.
2. Finish source-and-intent and lifecycle-route coverage for more maintained
   configurations.
3. Complete readable production promotion, rollback, and live-observation paths.
4. Promote the remaining 80 Helm entries from proof-grade rows to useful
   configurations.
5. Give AICR, Timoni, Kubara, Sveltos, literal OCI, and YAML stable browse and
   review paths using the same processing model.
6. Publish stable JSON schemas, exit behavior, and agent instructions for the
   common review result.
7. Add CI and pull-request reporting without implying that static findings prove
   runtime behavior.

### Phase 6: Extend The Proven Paths

1. Complete representative AICR and GPU delivery evidence.
2. Record the H100/NIM and NVIDIA GPU Operator demonstrations.
3. Add lifecycle-heavy Timoni entries and live proof.
4. Deepen Kubara and Sveltos fleet rollout and rollback evidence.
5. Complete the Upgrade, Hooks and CRDs, RBAC Review, Fleet Platform, and AI
   Change Review Apps as product experiences.
6. Add hosted processing for arbitrary private sources or OCI only after the
   security, credentials, cost, and abuse-control design is proven.

## Acceptance Tests

The next release is successful when a new user can:

1. Start from a maintained configuration or their own AI-produced input.
2. Materialize and inspect exact objects without an account.
3. Understand findings and the limits of the checks.
4. Correct the input and retain one accepted digest.
5. Keep that exact result in ConfigHub without repeating the investigation.
6. Create a staging variant and compare it with production.
7. See lifecycle and destination requirements before promotion.
8. Promote and release the exact accepted revision.
9. See what reached the destination and what remains unknown.
10. Complete the same job through the website or CLI and move between them
    without changing the source, selected configuration, or accepted digest.
11. Build one small internal developer platform from Catalog components and
    native Kubara input, then promote one platform-component revision, one
    developer-tool revision, and one application revision independently through
    ConfigHub.

The short browser tour is successful when a new user can create, inspect, change,
and compare one sample component without a CLI or cluster and without being sent
through the full education sequence.

## Work Deliberately Parked

- Analytics vendor selection and issue #1060.
- A new `cub workshop` or `cub config` umbrella.
- Relabelling historical scanner receipts.
- Letting an AI approve its own production change.
- Treating static scanning as proof of lifecycle execution or runtime health.
- Expanding the public site with equal-weight entry points before the main check,
  keep, and promote journey works end to end.
