# Config catalog doctrine

The simplest architecture for this project is **OCI in, managed configuration, OCI
out**.

The [official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/)
owns the product onboarding journey. This catalog owns source-specific preparation,
public package testing, and evidence. See
[Onboarding And Entry Paths](../planning/onboarding-and-entry-paths.md).

## Business purpose and user journey

This section is the canonical statement of the project's business purpose and user
journey. Other documents and website pages may explain the part relevant to their
reader, but they should link here instead of maintaining a competing full summary.

The overall business purpose is to make ConfigHub the trusted place between
configuration being created and software being delivered. The public site is a
working front door, not only a product description. It gives people useful answers
before they sign up or change their delivery system.

### Problems we solve

Configuration users often cannot answer basic questions confidently:

- What will this chart or package actually install?
- Which values affected the result?
- What changed between two versions or environments?
- What prerequisites, hooks, CRDs, Secrets, and setup Jobs are involved?
- Is this upgrade or promotion safe?
- Can I keep a necessary customization without maintaining a permanent fork?
- Can I reproduce or roll back the exact result?

AI makes these problems more urgent. It can produce charts, values, YAML, and
application changes faster than people can inspect them. The output may look
convincing while containing an ignored value, unsafe default, missing prerequisite,
excessive permission, or large unintended rendered change.

### Our promise

> Bring the configuration that you or your AI created. We will show what it actually
> does, compare it with what you trust, and give you a reviewed result that you can
> keep and deliver.

### The user journey

| Step | Job |
| --- | --- |
| Catalog | Find a configuration we have already investigated, with known options, quirks, and evidence. |
| Check my config | Compare a chart, values, YAML, or OCI with defaults, Catalog examples, or what the user runs today. |
| Promote my config | Test a proposed change, including the destination and any staging work, before production. |
| ConfigHub | Keep the accepted result, create environment variants, approve changes, publish OCI releases, and compare desired configuration with live systems. |

This supports the delivery path:

`Git or AI -> build -> OCI -> ConfigHub -> OCI -> Argo CD or Flux -> Kubernetes`

People can keep Helm, AICR, GitOps, and their existing build systems. ConfigHub
becomes valuable because it records and manages what happens between OCI input and
OCI output.

### Business model

The anonymous tools solve an immediate problem without requiring trust, migration,
or an account. A useful anonymous result is complete in its own right. The natural
reason to adopt ConfigHub appears when the user wants to:

- keep the reviewed result;
- share it with a team;
- compare the next change;
- manage development, staging, and production;
- require tests or approval;
- promote an exact release;
- roll it out across a fleet; or
- connect it with live state.

The public result must not stop at a warning or a score. It should produce exact
objects, comparisons, checks, stated limits, and a result the user can retain as
files or OCI. The contextual ConfigHub handoff is **Keep this reviewed result in
ConfigHub**, not a generic request to create an account.

AI may propose and explain a change. The exact rendered objects, source record, diff,
checks, approval, release, and observation remain the records used to decide what
ships. The site should also support people who already have Claude, Codex, or another
assistant running by giving that assistant the exact local files, context, questions,
and commands it needs.

Every new question can also improve the Catalog. A public question starts as an
investigation. When maintainers reproduce the result, lock the source, classify its
prerequisites and lifecycle work, and publish the evidence, it can become a maintained
Catalog answer. Each accepted answer makes the next user's investigation shorter.
This creates a compounding public resource of known configurations, common variants,
upgrade knowledge, lifecycle handling, checks, and evidence.

The commercial strategy is: help people understand one configuration for free, then
become the system they use to manage that configuration as it changes, becomes an
application, and reaches production.

The Catalog should become the **global OCI headquarters for configuration patterns
and tools**: the place where a user can find versioned source, known configurations,
portable packages, lifecycle handling, checks, receipts, and tools for comparing or
changing them. This is an ambition, not a claim that the current catalog is complete.
Helm is the first and deepest source today; AICR, OCI, YAML, platform generators, and
other configuration sources use the same evidence and retention rules.

### Practical question contract

The following questions came from a review of 40 current public Helm discussions.
They are a standing product and user-test set, not copy that can disappear during a
website rewrite:

1. What will this install, and what must already exist?
2. How is this candidate different from production?
3. I set a value. Why did the rendered object not change?
4. The chart does not expose the field I need. Must I fork it?
5. Can I upgrade this chart without breaking production?
6. How should Argo CD or Flux handle this chart's hooks and CRDs?
7. Where does this vulnerable image run, and how can I update it safely?
8. Can I roll back to exactly what ran before?
9. Do these version and digest records identify the same bytes?
10. AI wrote these values. What did they actually change?

The 40 discussions are research input, not evidence of demand or successful use. The
project must test these questions with real users. A useful test starts from the
user's exact source and version, lets them use the Workshop tools and their own AI,
and checks whether they can reach a decision and retain the result locally, as OCI,
or in ConfigHub. Promotion tests must continue through candidate comparison,
destination and staging checks, a ConfigHub promotion when selected, and the recorded
delivery result. Aggregate outcomes belong in the public challenge-intake record;
personal details remain outside Git.

The [simulation findings](../planning/config-workshop-simulation-findings.md) record
the automated navigation checks, their limits, and the human tests still required.

The website, catalog, and public tools handle useful configuration work around OCI.
They can prepare source before the first OCI is built, inspect an existing OCI, or
produce a new OCI after checking or changing its contents. They help people work with
Helm charts, AICR recipes, installer packages, Kubara output, Sveltos objects, and
existing YAML as literal configuration with recorded inputs, known prerequisites,
lifecycle work, and evidence.

Starting examples at the public front door must remain useful without a
ConfigHub account:

- `work -> OCI`: inspect and test source material, then build a deployable OCI;
- `OCI -> work`: pull a public OCI to explain, inspect, scan, or compare it;
- `OCI -> work -> OCI`: check or change the exact objects and serve the result.

In this project, **serverless** means the work does not depend on ConfigHub Server.
**Anonymous** means it uses no ConfigHub account. A local command or CI job can be
both. The work can sit before OCI, after OCI, or between an input OCI and an output
OCI.

Here, `work` means rendering, inspecting, explaining, testing, scanning, comparing, or
editing configuration. These are not only first-run paths. They are small steps that
can be inserted into a delivery flow wherever they are useful:

| Shape | Example use |
| --- | --- |
| `work -> OCI` | A repository or CI job checks source files and publishes a deployable OCI package. |
| `OCI -> work` | A person or CI job pulls a package to inspect, test, or extract its exact objects. |
| `OCI -> work -> OCI` | A person or service pulls a package, checks or changes it, and serves a new package for Argo CD, Flux, or another consumer. |

These are composable options, not three separate products or a required sequence. A
team can use any one by itself or combine them in a longer delivery flow. ConfigHub
enters when the team wants to save, share, transform, approve, promote, or fan out
the configuration; none of the three public operations requires that step.

The three public options belong to starting examples. Once a configuration is
claimed or uploaded, the variants, promotions, releases, Apps, apply gates, and
fleet examples use ConfigHub Server. They do not need a second local or anonymous
version.

The work may run as a local command, a CI job, or the bounded public browser page.
The browser page can inspect and compare rendered Kubernetes YAML, run static
manifest checks, add a supplied Catalog source and intent record, and download one
complete result without signing in. It does not render arbitrary sources, pull OCI,
contact a cluster, or publish a hosted package. Anonymous use must not quietly create
private history, saved edits, variants, or approvals.

The optional handoff is **Claim this configuration in ConfigHub**. A user can work
anonymously with public packages before or after any OCI boundary. Claiming saves the
objects and their history so a team can transform, approve, promote, and roll them
out. It is not a required first step or a fixed position in every delivery flow.

A successful anonymous journey may end with reviewed files or a verified OCI. That is
a useful result, not an incomplete ConfigHub trial. If the user later needs a shared
record, comparisons over time, approval, promotion, release, or live-state history,
the ConfigHub handoff should retain the same source identity, object-set digest, and
review result. The user should not have to repeat the investigation merely because
the work moved from a local tool into ConfigHub.

The [public OCI to Flux proof](../../data/serverless-oci-gitops-proof/summary.md)
checks that boundary. It starts from a public NGINX installer OCI, runs
`cub installer setup --output-oci` with no ConfigHub token, writes the six rendered
objects as a second OCI, reads that output back to check the object set, and records
the exact digest Flux reconciled. The output registry is temporary; the receipt does
not claim a hosted public workbench.

The [anonymous OCI CI proof](../../data/anonymous-oci-ci-proof/summary.md) runs the
same public entry path in GitHub Actions. With no ConfigHub credentials, it pulls the
NGINX package, renders and checks six objects, creates an OCI image layout, and pulls
that layout back to compare the object set. The layout is retained as a workflow
artifact, not published as a public registry package.

Anonymous work can also happen after ConfigHub. The
[RBAC correction proof](../../data/rbac-review-live-proof/summary.md) stores and
approves a correction in ConfigHub, publishes the private ConfigHub release, then
packages the same approved objects as a temporary portable OCI. Argo CD in a
different organization reads that portable package without borrowing the first
organization's OCI credential. That is `ConfigHub -> work -> OCI -> Argo CD`. The
temporary registry proves the shape, not a permanent hosted service.

ConfigHub is the middle. It stores the exact objects, creates base and derived
variants, shows diffs, runs checks, records approvals, promotes changes, and keeps
release and observation history. `cub release publish` then creates an immutable
Space release OCI for Argo CD, Flux, or another recorded delivery path. Delivery does
not render the source package again.

ConfigHub can join an existing `Git -> CI -> OCI -> Argo CD or Flux -> Kubernetes`
flow without replacing the tools around it. The first change can be
`OCI -> ConfigHub -> OCI`. The measured pass-through keeps every spec, label, and
user-supplied annotation unchanged, while the ConfigHub release adds
`confighub.com/origin` for provenance. The input and output have different OCI
digests because they are different artifacts. Later, ConfigHub can produce named
variants for environments, customers, regions, or cluster classes. It can also
publish specific outputs to several consumers from one recorded base. Each input and
output needs its own digest and receipt so a congruent pass-through, a transformation,
and a fan-out are not confused.

Current local delivery examples create their kind cluster and Argo CD setup with
`cub cluster up` and remove it with `cub cluster down`. The string
`cub-lk-kind-vanilla` survives in older receipts as a historical target-class value;
it is not the current command or product path.

The immediate goal is to make Helm easier to inspect and operate. The longer-term goal
is a large, useful catalog of configuration in the formats teams already use. Each
entry should help a person understand what the configuration does, try it, check the
evidence, and use it as the start of their own application or fleet.

## One Catalog, Several Ways To Find An Answer

The homepage should offer a small number of clear jobs. The Catalog carries the
range. Adding a source format or an advanced example should add another catalog path,
not another equal homepage button.

The same catalog records must be browsable by:

| View | Examples |
| --- | --- |
| Starting source | Helm, Timoni, AICR, Kubara, existing OCI, or Kubernetes YAML |
| Job | Inspect, test, compare, change, promote, deploy, operate, or build an application or platform |
| Lifecycle need | CRDs, hooks, setup Jobs, Secrets, cloud provisioning, models, or runtime images |
| Evidence stage | Source checked, objects reproduced, package verified, ConfigHub retained, promoted, delivered, or observed live |
| Version | Current recommendation, earlier versions, upgrade candidates, and recorded changes between them |

Each entry should use one stable order: why it exists, the exact source and version,
ready-to-use configurations, the produced objects, lifecycle and target requirements,
the checks that passed, the checks that did not run, how to try it, and the available
next steps. Examples and web pages must be generated from the same source, intent,
object, route, and receipt records wherever possible. That lets the corpus grow
without maintaining a second explanation by hand.

## Known answers and new investigations

The Catalog and the Check my config workflow have different jobs.

- The Catalog answers questions that this project has already investigated for an
  exact source and version.
- Check my config investigates a new chart, version, values set, OCI, YAML object set,
  or existing deployment.
- ConfigHub retains an accepted answer when a team needs to compare it again, change
  it, promote it, or deliver it.

Both public paths produce the same kind of answer: exact objects, a comparison when
one is available, prerequisites and lifecycle work, checks that ran, checks that did
not run, one recommended action, and a clear limit. The optional
`ConfigurationReview` record links those parts to the inspected object hashes.

A public investigation does not become a Catalog entry merely because it rendered.
Maintainers must reproduce it, lock the source, classify its prerequisites and
lifecycle work, run the applicable checks, and publish the decision and evidence for
that exact version. The intake process is documented in
[How public configuration questions are handled](question-intake-operation.md).

## Configuration taxonomy

Use one model for every input format. It has two connected tracks:

```text
configuration lineage
  source and intent -> exact base -> derived variant -> promoted release

lifecycle handling
  requirements -> route intent -> destination resolution -> execution -> receipt
```

The full operating sequence is:

```text
source + processing intent
  -> select and lock inputs
  -> materialize exact Kubernetes objects
  -> capture an exact configuration revision
  -> identify lifecycle requirements
  -> decide the flattening lane for the intended path
  -> retain a reviewed base
  -> derive or update a variant
  -> recheck affected requirements, ownership, and flattening assumptions
  -> resolve lifecycle routes for the variant, destination, and delivery runtime
  -> compare, test, approve, and promote
  -> publish an immutable release
  -> reconcile the objects and perform the lifecycle work
  -> observe the result and record receipts
```

This sequence has loops. A source upgrade returns to materialization. A variant can
add or remove a prerequisite. A new destination or delivery runtime can require a
different route even when the object digest is unchanged.

Every identity must name its role. An OCI manifest digest identifies an OCI manifest; it is
not the digest of the Kubernetes object set inside it. A base-revision digest,
exact-object digest, ConfigHub Unit data hash, and release OCI digest also identify
different records. A receipt may bind them through an exact-object comparison; it must
not call unlike hashes the same digest. For Helm, the base-revision digest covers the
complete variant revision, including its inputs and object-set identity.

A step may be a recorded no-op. Plain Kubernetes YAML is already materialized. A
literal configuration OCI is already flat. Those inputs still need provenance,
checks, lifecycle decisions, promotion history, delivery, and runtime evidence.

The following rules apply at every source boundary:

1. Record the source identity and choices before claiming that an object set is
   reproducible.
2. Give the exact object set its own digest. Do not substitute a source-package,
   OCI-manifest, or ConfigHub Unit hash for it.
3. Decide flattening for one exact processing boundary. A flat wrapper does not make
   its nested sources flat.
4. Treat a missing lifecycle record as a gap. It is not evidence that no route is
   required.
5. Recheck requirements and field ownership after a derived variant changes.
6. Resolve routes only when the exact variant, destination, and delivery runtime are
   known. Promotion reviews that resolution; delivery performs it.
7. Call lifecycle work executed only when the required receipt exists.
8. Name the role of every OCI artifact and digest. OCI transports records; it does
   not perform hooks, provision infrastructure, or prove runtime health.

These terms describe different decisions. Do not use them interchangeably.

| Term | Meaning |
| --- | --- |
| Source package or source configuration | The chart, source-native recipe, package, generator input, OCI, or YAML that the user starts with. Recipe is not a general name for every configuration. |
| Processing intent | The source identity and the choices needed to produce or select exact objects. It includes build or render inputs, target assumptions, and known lifecycle decisions. |
| Materialize | Produce or read the exact Kubernetes objects that will be reviewed. Helm renders; Timoni builds; AICR and Kubara generate or compose; a source OCI invokes its declared processor; literal YAML and literal configuration OCI need no source transformation. Materializing does not apply objects or prove runtime health. |
| Exact configuration revision | The accepted Kubernetes objects, object inventory, and digest for one revision. This is the source-neutral equivalent of a captured output. |
| Render | Helm's materialization step: run the chart with recorded values, release context, API capabilities, and permitted target facts. Do not use `render` as the generic name for every source format. |
| Helm render intent | The Helm-specific source-and-intent record: chart, version, values, release context, source lock, prerequisites, and lifecycle choices. It does not contain the rendered objects. |
| Helm render variant | The captured, pinned Kubernetes output for one Helm base and revision, linked to its Helm render intent and identified by an object inventory and digest. Do not invent a render variant for literal YAML or another source that did not render. |
| Preset configuration or base variant | A maintained starting shape such as `default`, `no-crds`, `reuse-existing-secret`, or `ha`. It fixes the choices needed to produce and operate that reviewed base. |
| Derived variant | A ConfigHub version for an environment, region, customer, or target. It changes accepted objects after the base render; Helm is not rendered again. |
| Flatten | Keep the exact materialized objects as the configuration that later systems review and deliver instead of rerunning the source processor during delivery. For literal YAML or literal configuration OCI this is a recorded no-op. |
| `born-flattened` | Literal YAML or configuration OCI already contains exact objects. Materialization and flattening are recorded no-ops, while provenance, requirements, ownership, checks, and delivery still need records. |
| `safe-to-flatten` | The exact source, configuration, and intended path has no required processor behavior outside the retained objects. Source, object digest, checks, and evidence still travel with it. |
| `flatten-with-routes` | Retain the literal objects, but also carry named lifecycle requirements and route intents for CRDs, hooks, certificates, Secrets, setup Jobs, ordering, or other work around apply. |
| `unsafe-to-flatten` | Keep the source and inputs authoritative because live lookup, generated state, destructive lifecycle behavior, or another unresolved dependency has no adequate route for this use case. The operating response is process late (`render late` for Helm). |
| Lifecycle requirement | Something that must exist or happen around ordinary object apply, such as a CRD, hook, setup Job, certificate, controller, model, cloud resource, or prerequisite Secret. It can originate in the source, exact objects, variant, or destination. |
| Route intent | A portable proposal for handling one or more lifecycle requirements. It may name supported runtimes and constraints, but it is not yet bound to a particular variant and destination. |
| Resolved lifecycle route | The selected actor, order, mechanism, checks, retry rule, and failure rule for an exact configuration digest, variant, destination, and delivery runtime. |
| Receipt | The recorded result of generation, a check, lifecycle work, promotion, delivery, or a runtime test. A route without its required receipt remains planned work. |
| No route required | An explicit reviewed result that this exact configuration needs no separate lifecycle work. A missing route record does not mean the same thing. |
| Protected local field | A field intentionally owned by a downstream variant and preserved during promotion or source refresh. It is not the same as a Secret or a Kubernetes resource protected from pruning. |
| Secret or protected input | Credential material stays outside portable configuration. The configuration records a Secret reference or target requirement, not the secret value. |
| Prune-protected resource | A resource that a delivery path must not delete. This is delivery behavior and is separate from field ownership and Secret handling. |
| Configuration OCI | Immutable transport for exact objects and companion records. Moving the OCI does not execute routes, create infrastructure, or prove runtime success. |

### How each source uses the model

| Source | Materialize | Source-and-intent record | Flattening result | Later route resolution |
| --- | --- | --- | --- | --- |
| Helm chart | Run Helm with recorded values and render context. | `HelmRenderIntent`; the captured output is its Helm render variant. | `safe-to-flatten`, `flatten-with-routes`, or `unsafe-to-flatten`. | Recheck hooks, CRDs, generated state, target facts, and controller handling for the selected variant and destination. |
| Timoni module or bundle | Build the pinned OCI source with its typed values. | Module or bundle version and digest, typed schema, selected values, build receipt, and declared lifecycle workflow. | Flatten the built objects, keep lifecycle routes beside them, or run the source workflow later when target-dependent behavior remains. | Bind ordered apply sets, waits, tests, health checks, prune behavior, runtime lookups, and target requirements to the selected variant and destination. |
| AICR | Run its declared composition step, including nested Helm work it declares. | Native AICR recipe, selected options, build receipts, required controllers, and output digest. | Flatten the generated layer, flatten it with routes, or process part of the composition late. | Bind component order, required controllers, GPU or cloud facts, and nested source work to the target. |
| Kubara or another generator | Run its declared generation step, including nested source processing it declares. | Source revision, selected options, build receipts, required controllers, and output digest. Do not call it a recipe unless the source tool does. | Flatten the generated layer, keep routes beside it, or process the source late. | Bind platform prerequisites, component ownership, and controller work to the chosen platform target. |
| Installer or source OCI | Pull by digest, inspect its declared role, then invoke the processor it contains or references. | Input OCI reference and digest, package role, processor, selections, and receipts. | Decide from the produced objects and remaining lifecycle work. A source OCI is not automatically deployable. | Resolve the resulting requirements; OCI transport does not perform them. |
| Literal configuration OCI | Pull by digest and read the contained Kubernetes objects. Materialization is a no-op apart from parsing and canonicalization. | Input OCI reference and digest, object inventory, provenance, checks, and any prior transformation. | `born-flattened`; record whether route intents or protected inputs travel beside it. | Resolve prerequisites, ordering, ownership, and setup for the destination. |
| Plain Kubernetes YAML | Read, parse, and canonicalize the files. Materialization is a no-op. | Source path or revision, file checksums, object inventory, and checks. | `born-flattened`; record lifecycle requirements, ownership, and later packaging. | Resolve any required work for the destination and runtime. |
| ConfigHub Units or release OCI | Read the retained exact objects and revision history. Materialization is a no-op. | Space, Unit revisions, source link, approvals, release digest, and receipts. | Already retained as data. | Resolve the selected revision against its assigned target and delivery runtime. |

Flattening is evaluated at each processing boundary. An AICR Application set can be
flattened while the Helm charts referenced by those Applications remain render-late.
An OCI artifact can contain source material, literal configuration, or a ConfigHub
release. Its role and consumer must be recorded rather than inferred from the word
OCI.

Do not call the combined record a "full rendering." The complete managed record is
the source and intent, exact configuration revision, flattening verdict, lifecycle
requirements, route resolutions, field ownership, release, and scoped receipts. Each
part answers a different question and may change on a different schedule.

The flattening verdict belongs to an exact source version, preset, and intended target
path. A safe verdict for one case does not cover every values combination or future
version. Read [When to flatten configuration](flattening-alignment.md) for the decision
rules and [The ConfigHub data model](../user/confighub-data-model.md) for how the
records connect before, inside, and after ConfigHub.

### What each stage must leave behind

| Stage | Required result | Recheck when |
| --- | --- | --- |
| Select and lock | Source identity, version, digest or checksum, and chosen inputs | The source or any source-owned choice changes |
| Materialize | Exact Kubernetes objects, inventory, object digest, and processor receipt or recorded no-op | The source, processor, render context, or relevant target fact changes |
| Decide flattening | One scoped verdict for this processing boundary | The source, lifecycle-sensitive variant, destination, or runtime changes |
| Retain a base | Exact objects linked to source, requirements, route intents, ownership, and evidence | The accepted base changes |
| Derive a variant | Exact variant revision plus inherited, added, changed, and removed requirements | Any variant field changes |
| Resolve lifecycle work | Actor, order, mechanism, checks, retry, and failure rule for the exact variant and destination | The variant, destination, or delivery runtime changes |
| Review and promote | Object diff, lifecycle diff, ownership result, checks, decision, and destination plan | The candidate or destination changes |
| Publish and deliver | Immutable release digest, selected consumer, and execution receipts | A new release is published or delivery is retried |
| Observe | Target identity, observed object or workload result, time, and freshness | The release or live target changes, or the observation expires |

## The ways configuration enters

The Catalog currently has records for seven concrete entry forms:

1. **Helm:** keep the chart and values, record the render context, and capture one
   exact render variant.
2. **AICR:** keep the native recipe and selected options, then record each generated
   processing boundary and its controller requirements.
3. **cub installer source OCI:** pull a public multi-preset package by digest, select
   one preset, and record the exact objects it produces.
4. **Kubara or another generator:** keep its native source and generation inputs,
   then record the generated platform configuration and nested sources.
5. **Sveltos:** retain the literal fleet configuration while keeping the referenced
   Helm source as a later processing boundary.
6. **Literal configuration OCI:** pull exact Kubernetes objects by digest and import
   them without rerendering.
7. **Plain Kubernetes YAML:** read and retain the supplied objects without a render
   step.

A ConfigHub revision or release OCI can also re-enter the model as an exact retained
revision. The current Catalog demonstrates that later boundary in delivery evidence,
but it does not yet have a separate ConfigHub-re-entry base record. A generic source
OCI that uses a processor other than cub installer is also defined by the model but
does not yet have its own Catalog example.

These paths do not require a replacement chart language. Teams keep their Helm
charts, AICR recipes, generators, OCI packages, and existing files.

The generated base records use these precise source types. The live apply-policy
selector uses a smaller operational label set: plain YAML, literal configuration OCI,
and ConfigHub revisions are grouped as `rendered-config`; a processor-specific source
OCI uses the processor's label. That grouping chooses checks. It does not replace the
source-and-intent record or its more precise provenance.

## What a base variant records

A ConfigHub base variant needs more than a directory of YAML.

- The literal Kubernetes objects that ConfigHub can query, diff, revise, approve, and
  deliver.
- The source and intent record that explains where the configuration came from, which
  choices produced these objects, and what remains to be supplied or performed.
- The choices fixed at build time and the small set still allowed at install time.
- The flattening verdict for this exact source and base, or an explicit
  `not-assessed` state.
- Lifecycle requirements and portable route intents for CRDs, hooks, webhook
  certificates, setup jobs, Secrets, storage, namespaces, target capabilities, and
  other work known before a destination is selected.
- The ownership assessment for source-controlled fields, variant-controlled fields,
  protected inputs, and prune behavior, or an explicit gap.
- Provenance, checksums, tests, policy results, approvals, and delivery receipts.
- The operational class: user workload, system service, or system configuration, plus
  the owner and expected change cadence.

Controller requirements count as prerequisites too. For example, AICR's Flux OCI
output uses `ArtifactGenerator` and `ExternalArtifact`. Its base record must therefore
name the required Flux version, `source-watcher` controller, feature gate, and matching
`OCIRepository`; otherwise the YAML is complete as data but cannot reconcile.

### The source and intent record

Every maintained base must have a **source and intent record**. This is a document
role, not one universal schema. It gives a person or tool the context needed to
understand and reproduce the exact objects:

- the source type, identity, version, and digest or checksum;
- the values, selections, or other choices used to produce the objects;
- the inputs that remain for the user or target;
- the output object inventory and its digest;
- required Secrets, CRDs, hooks, setup work, controller features, and target facts;
- the checks and receipts that exist, plus any evidence that is still missing.

The source format determines the concrete record:

| Source | Source and intent record |
| --- | --- |
| Helm | `HelmRenderIntent`, including the chart, version, values profile, release context, source lock, output, prerequisites, and lifecycle routes |
| AICR | The AICR recipe plus its generation and bundle receipts, including fixed choices, remaining inputs, controller requirements, and OCI digests |
| cub installer or another source OCI | An OCI source record containing the input reference and digest, package role, processor, selected preset or options, output inventory, and receipts |
| Kubara or another generator | The source revision, generation inputs, nested source boundaries, output inventory, controller requirements, and receipts |
| Sveltos | The exact ClusterProfile or related fleet objects, selectors, referenced sources, management-cluster requirements, and receipts |
| Literal configuration OCI | The input reference and digest, object inventory, checks, prerequisites, and any recorded transformation |
| Plain Kubernetes YAML | A source record containing the source revision or path, file checksums, object inventory, checks, and later OCI or ConfigHub revision |
| ConfigHub revision or release OCI | Space and Unit revisions, upstream links, approvals, release digest, and prior delivery receipts |

The role may be represented by a source Unit, Space metadata plus a committed
receipt, or a generated base-variant record. ConfigHub does not yet have one
first-class source-and-intent entity for every format.

Other formats should use the same role with fields that make sense for that source.
They must not be mislabeled as Helm. A new source type is not complete until a reader
can answer where the objects came from, why they have their current shape, what must
happen before delivery, and which claims have evidence.

This rule applies to maintained catalog examples. An arbitrary upload does not gain
correct source history or chart-specific lifecycle facts automatically. Generic checks
can be attached after upload. The source adapter or a reviewed catalog addition must
provide the source-and-intent record and any required hook, CRD, Secret, setup, or
target records. Missing facts remain an explicit gap.

The source and intent record and the literal objects stay connected. A rendered YAML
file on its own is useful, but it cannot explain why a hook was replaced, who owns a
CRD, or which target facts were required.

### Route resolution after the base

A base records lifecycle requirements and portable route intents. It cannot normally
claim one final route because no derived variant, destination, or delivery runtime has
been selected yet.

| Point | Required record |
| --- | --- |
| Base creation | Requirements discovered from the source and exact objects, possible route handling, and any known target facts. |
| Variant creation or change | Requirements inherited, added, changed, or removed by the variant, plus fields that the variant owns. |
| Destination assignment | Target facts and the selected delivery runtime. |
| Promotion review | One route resolution bound to the exact candidate digest, destination, runtime, actor, order, checks, retry rule, and failure rule. |
| Delivery | Receipts for the release digest, controller reconciliation, executed lifecycle work, and runtime result. |

The route resolution must be recalculated when a relevant input changes. This
includes a new source version, a variant that changes generated or lifecycle-sensitive
fields, a different destination, or a switch between Argo CD, Flux, and direct apply.
An unchanged object digest does not make two destination routes equivalent.

## Configuration, Lifecycle, Transport, And Runtime

The model keeps these record roles separate:

1. The **source and intent record** explains the source and the choices that produced
   the configuration.
2. The **exact configuration** records the accepted Kubernetes objects and their
   digest.
3. The **flattening verdict** states whether that exact object set can travel alone,
   needs route companions, or must leave source processing until later.
4. The **lifecycle requirements and route intents** record work known before a
   destination is selected.
5. The **field-ownership record** separates source-owned, variant-owned,
   target-supplied, and delivery-owned choices.
6. The **variant revision** records the exact accepted changes after the base.
7. The **route resolution** binds the exact variant to a destination, delivery
   runtime, actor, order, checks, retry rule, and failure rule.
8. The **release, delivery, lifecycle, and runtime receipts** record what was
   published, reconciled, performed, and observed.

These records have different clocks and different proof. Helm hooks and setup Jobs
may run once or on every upgrade. CRDs need ownership, apply ordering, and an
establishment check. Cloud provisioning is asynchronous and needs a controller,
credentials, status, and cleanup rules. Runtime images are executable artifacts that
must be pinned and then observed as workloads. Models have their own identity,
storage, access, compatibility, and inference checks. Configuration OCI carries
configuration and companion records between systems; it does not perform any of
that work.

OCI is therefore the common transport, not a universal execution model. A package can
carry exact objects plus routes and source records. The consumer still determines
what runs: `cub installer` renders, ConfigHub stores and changes records, Argo CD or
Flux reconciles Kubernetes objects, cloud controllers provision infrastructure, and
model servers answer inference requests.

The current `BundleRoute` schema covers portable chart-specific route intents needed
by certified bundles. The `LifecycleRouteResolution` schema binds requirements and
route intents to an exact variant, destination, and delivery runtime. The first three
resolution records cover the same kube-prometheus-stack base through direct apply,
Argo CD, and Flux. Cloud and model workflows may keep source-specific lifecycle
records until several working examples justify a shared extension. In every format,
the final route resolution must answer the same questions: what runs, who runs it, in
what order, on which destination, through which runtime, how interruption and retry
are handled, and which receipt proves the result.

The [flattening decision guide](./flattening-alignment.md) states when those objects
can stand alone, when lifecycle work must travel beside them, and when the source must
still render late.

Every real base must also state whether its surrounding records are complete:

- a flattening verdict is decided or explicitly `not-assessed`;
- lifecycle requirements are attached, explicitly unnecessary, or an actionable gap;
- route intent is attached, explicitly unnecessary, or an actionable gap;
- destination resolution is marked as waiting until a variant and target are selected,
  or points to an exact resolution record;
- field ownership is declared, partly declared, or not assessed;
- target prerequisites are either declared, explicitly unnecessary, or an actionable
  gap;
- a route copied from another chart version remains a gap until the exact version has
  its own receipt;
- an Argo CD or Flux mapping explains the intended handling, but it is not execution
  proof;
- prerequisite checks expire at the next render or apply unless a stricter recorded
  rule says otherwise.

These states belong in the generated source record, base-variant record, master
matrix, and Catalog page. Missing information must not be presented as "nothing
required."

## The OCI packages are not all the same

The word OCI covers four related artifacts in this work.

| OCI artifact | What it contains | What consumes it |
| --- | --- | --- |
| Source or installer package | A chart or source bundle, preset configurations, and the files needed to produce a selected result | `cub installer` or another source tool |
| Literal configuration bundle | Kubernetes YAML that is ready to become ConfigHub Units | `cub variant upload oci://...` |
| Portable deployment bundle | Reviewed Kubernetes objects in a standard OCI content layer | An anonymous pull, Argo CD, Flux, or another external consumer |
| ConfigHub release bundle | Approved desired configuration published for delivery | Argo CD, Flux, or another ConfigHub delivery path |

An entry must name which kind of OCI artifact it links to. A multi-preset installer
package is not automatically a literal configuration bundle.

The literal upload bundle and portable deployment bundle may contain the same
Kubernetes objects while using different OCI layer layouts. The consumer determines
the required layout. The front door must check the package it produces with the
consumer that will use it.

This distinction also divides the work cleanly. The front door helps users make,
inspect, and serve public packages. ConfigHub manages what happens after the literal
configuration is claimed and publishes its own release artifact for delivery.

The AICR Argo CD example makes the distinction concrete. AICR generates a Helm chart
as its Argo CD source package. Helm renders that chart into 17 Argo CD `Application`
objects. The source chart is useful to Argo CD, while the second OCI artifact containing
those 17 objects is the one ConfigHub can upload and manage as configuration.

That AICR base controls cluster-wide system configuration, so it uses the
approval-required policy. The live
[AICR policy receipt](../../examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml)
records a rejected dry-run of the exact 17-Application Unit. The required-approval gate
stopped it before a target was attached, and the Unit revision and data hash remained
unchanged.

The [AICR OCI round-trip receipt](../../data/aicr-oci-roundtrip-proof/summary.md)
checks the other side of the boundary. ConfigHub imports the literal configuration
OCI, publishes a ConfigHub release OCI, and the proof pulls it back. All 17
Applications keep the same Kubernetes fields; ConfigHub adds only its origin
annotation. The run does not claim that Argo CD reconciled those Applications or that
an EKS or GPU workload became healthy.

## Changes after the base

Test, development, staging, production, region, customer, and cluster differences are
derived ConfigHub variants. A derived variant changes the recorded objects without
re-rendering the source package. Promotion moves a reviewed change between variants
and shows the exact mutations before they are accepted.

When a change alters what Helm must render, it belongs in a new Helm base variant.
When it changes the operating context or an object field after render, it belongs in a
derived variant.

Derived does not mean lifecycle-free. A variant can add a target-owned Secret,
remove bundled CRDs, change a storage class, select a cloud identity, or introduce an
object that needs ordered handling. Promotion must therefore compare the objects,
preserve protected destination fields, and resolve lifecycle requirements for the
destination. The base route intent is inherited input to that decision, not the final
answer.

## Fleet delivery

Kubara fits as a producer of platform configuration. Its Terraform output remains an
infrastructure plan. Its generated Helm charts, cluster values, Argo CD assignments,
and the Kubernetes objects rendered from them are configuration records. ConfigHub can
keep that configuration as a base variant, make cluster-class variants, and manage
rollout waves. Kubara does not need to become a Helm chart row.

The [Kubara v0.12.0 local-platform example](../demo/kubara/local-platform.md) records a
real generation run. It contains the generated source, 77 rendered Argo CD bootstrap
objects, and a literal OCI layout. Its route record names three CRDs, four Helm-hook
resources, two rendered Secrets, and the External Secrets prerequisite. ConfigHub
pulled the local OCI and stored the 75 non-Secret objects under the catalog's
approval-required policy because this is cluster-wide system configuration.

The [Kubara OCI delivery receipt](../../data/kubara-oci-delivery-proof/summary.md)
continues from that base. It records the approval, installs the CRDs first, supplies
the target-owned Secrets, runs the Redis initializer, and packages 69 prepared
objects as a portable OCI. Bootstrap Argo CD reconciles the exact digest. Kubara Argo
CD becomes ready and creates one healthy Metrics Server Application. The portable
pull is anonymous and the route work does not use ConfigHub Server; the approval and
private release record do.

That receipt does not turn one test into a fleet claim. It used one kind cluster, one
selected service, and a temporary OCI registry. External Secrets and the gRPC Ingress
were deferred because the target did not provide their prerequisites. The full
seven-service profile and a multi-cluster promotion wave remain separate work.

Sveltos is one fleet placement and reconciliation path. ConfigHub stores the reviewed
`ClusterProfile`, its history, and its policy results. Sveltos selects matching
clusters and reconciles the declared add-ons. The
[Kyverno fleet example](../demo/sveltos/kyverno-fleet.md) proves that split in two
steps. The first approved profile selected only the pilot cluster. The second
revision removed one selector label and added another staging cluster. Each revision
had a different OCI digest, and Argo CD reconciled both on the management cluster.
Sveltos installed Kyverno on the pilot first, then on both clusters, and restored a
changed replica count on each target. Pulling the portable OCI needed no ConfigHub
account. The proof used a temporary registry and two local kind clusters, so
permanent publication, a large fleet, and a failed-target pause remain separate work.

Argo CD and Flux remain important delivery paths for ConfigHub release OCI. The
catalog must report their evidence separately because one controller succeeding does
not prove the other one.

Do not copy one cluster's target-scoped OCI credential into another cluster to make a
fleet demo pass. Either publish through each intended target or give all intended
controllers legitimate access to one portable release artifact.

The project also separates proof of the delivery mechanism from proof for a catalog
entry. The routed-hook fixture proves that one ConfigHub release OCI can be consumed
through Argo CD and Flux. A separate direct local test proves that the same artifact is
portable; it is not a third ConfigHub managed-delivery mode. A Helm base, AICR bundle,
Kubara platform, or other catalog entry earns a delivery claim only when that exact
configuration has its own controller and workload receipt.

The live Nginx fleet demonstrates the ConfigHub side of this model with a
Helm-derived base and four environment variants. One digest-preserving image change
was promoted to dev, staging, and one production region; the other production region
still reports the pending change. Dev and staging retain their own replica counts.
The [live receipt](../../data/fleet-promotion/live-nginx-registry-migration.yaml)
checks those records and policy assignments. It does not claim Kubernetes delivery
or workload health.

The [OCI import, promotion, and two-cluster proof](../../data/oci-deploy-stage-rollout-proof/summary.md)
demonstrates the immediate end-to-end slice: import one exact OCI as a base, create
development and staging variants, promote one reviewed field change in sequence,
package staging once, and reconcile that same OCI digest on two clusters. Its receipt
includes controller status, ready workload replicas, and fingerprinted `cub-scout`
receipts showing that the five live objects match the reviewed files and are current
on both clusters. Those observations were recorded locally rather than submitted to
ConfigHub observation storage. The proof does not stand in for production scale or
every catalog row.

## Apply policy

The standard policy profile applies the same basic checks to Helm, Timoni, AICR,
`cub installer`, Kubara, Sveltos, and existing YAML after they become ConfigHub data.
The source determines how the configuration is produced; it does not change the
minimum checks applied to the resulting Kubernetes data.

- Schema and placeholder checks block apply everywhere.
- Lifecycle route records must name their chart, version, preset, executor, disposition, and evidence. A route cannot claim automatic execution without an observed receipt.
- Deployments, StatefulSets, DaemonSets, and ReplicaSets receive checks for
  digest-pinned images and health probes. Jobs receive the image check but not
  the long-running workload probe check.
- AICR `ClusterTrainingRuntime` objects receive checks that read their nested
  training image and `AI_API_KEY` fields. A mutable image is reported. An API
  key stored directly in the object is blocked; it must refer to a named Secret
  and key.
- Production releases add one required human approval.
- System configuration also requires approval in development and staging because a
  change to networking, GPU support, admission policy, or another cluster-wide
  setting can affect every workload on that cluster.

The baseline filter must select an explicit set of triggers and must exclude the
approval trigger. The approval-required filter must include the baseline checks as
well as approval. A verifier checks both rules so a broad filter cannot quietly put
approval on every Space or remove the common checks when approval is needed.

The policy uses three operational resource classes:

| Resource class | Examples | Normal policy |
| --- | --- | --- |
| `user-workload` | An application owned and released by an application team | Common checks; add approval in production |
| `system-service` | Shared DNS, monitoring, ingress, or another service used by many workloads | Common checks; add approval in production |
| `system-configuration` | Cluster-wide networking, GPU, admission, or platform configuration | Common checks plus approval in every environment |

The class describes what the configuration controls. It does not matter whether the
source was Helm, Timoni, AICR, `cub installer`, Kubara, Sveltos, or ordinary YAML. Individual
checks still need to understand the object they inspect. A Deployment check must not
guess where a custom resource stores its containers.

The catalog keeps one checked example for each class:

- A Bitnami NGINX configuration is a `user-workload`, owned by an application
  team and promoted from development to staging before it reaches production
  targets.
- Kube Prometheus Stack is a `system-service`, owned by the platform service
  team. Its fresh-install route runs first on one non-production cluster;
  production adds approval.
- A Kubara platform configuration is `system-configuration`, owned by the
  platform team. It requires approval in every environment and starts on one
  test cluster before any fleet expansion.

The [operational class examples](../../data/operational-class-examples/summary.md)
record the target, checks, rollout order, current result, and receipt for each
case. The generator attaches the same information to the three base-variant
records. Other records remain `not-yet-classified` until those decisions have
been made; the catalog does not infer ownership or risk from a chart name.

The lifecycle-route check applies only when a `LifecycleRoute` is stored. It checks
whether that record is complete and honest. It does not infer that a chart needs no
route when none has been written. Chart-specific preset work and evidence still
determine which CRD, hook, certificate, setup, and observation routes are required.

The maintained profile is
[config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).
The live `helm-catalog` filters and Space assignments were checked on 30 July 2026.
The result is recorded in
[data/apply-policy-profiles/live-helm-catalog.yaml](../../data/apply-policy-profiles/live-helm-catalog.yaml):
33 Spaces use the seven common checks and nine Spaces use those checks plus approval:
four production Spaces and five system-configuration Spaces. Run
`npm run helm-org:policy:verify` while logged into the org to
compare the current live state with that receipt.

Each covered Space also records how its configuration entered ConfigHub. The same
receipt currently includes three Helm Spaces, three AICR Spaces, thirty `cub
installer` Spaces, one Kubara Space, one Sveltos Space, and four rendered-config
Spaces. The verifier fails if a covered Space has no source type or if any maintained
source type has no live example.

The topology receipt says which checks are connected. The
[functional policy proof](../../data/apply-policy-functional-proof/summary.md)
shows what they did with temporary records. ConfigHub blocked an unresolved
placeholder, invalid Kubernetes data, and unapproved system configuration. It
reported an unpinned image and missing health probes as warnings and still allowed
the dry-run apply. The system-configuration fixture was then approved at its exact
head revision, the approval gate cleared, and the same dry run was allowed. No
fixture configuration was applied to Kubernetes.

## ConfigHub Apps

The catalog should lead into useful Apps rather than ending at installation.

- Upgrade App: calculate fleet impact, test a candidate, promote it in waves, and check
  the rollout.
- Hooks and CRDs App: check prerequisites, run the required chart-specific setup in the
  right order, and record what happened.
- RBAC Review App: find risky access across imported workloads and propose an exact
  correction.
- Fleet Platform App: assign platform configurations to cluster groups and manage
  rollout waves.
- AI Change Review App: turn an agent's suggested values or object edits into exact
  diffs, checks, approvals, and an unwindable revision.

Each App must have a complete example and receipt before the project describes it as
available. The generated demonstration programme states what is available, partial,
example-only, or planned.

The [Redis Upgrade App proof](../../data/redis-upgrade-app-proof/summary.md) is the
first continuous execution of the upgrade path. It starts from the public
`bitnami/redis:25.5.3` installer package, records a two-replica change, reconciles
`27.0.0` without losing that change, promotes through development and staging, and
checks the same OCI digest on two Argo CD clusters. The mechanics pass. The App remains
partial because the portable OCI used a temporary registry and the workflow is still
a guarded script rather than a finished App interface. The 2026-08-20 receipt records
useful mutation previews for both environment promotions, a closed rollback ChangeSet,
and passing forward and rollback results on both clusters.

The [AI Change Review proof](../../data/ai-change-review-live-proof/summary.md)
sends an unsafe and a reviewed AICR training object through the live checks.
ConfigHub reports the mutable nested image and blocks the inline API key in the
unsafe version. The reviewed version clears both checks, and the ordinary
Deployment checks leave both AICR objects alone. ConfigHub stores the reviewed
Kubernetes fields, blocks a dry run until the exact head revision is approved,
and allows the same dry run to an OCI target after approval.

The four-node training limit remains a repository check because it depends on a
fact about the selected target. It should become a ConfigHub check only when the
policy can read that recorded target fact.

## AI use

AI can help maintain a large catalog, explain a chart, propose a preset
configuration, update a version, or suggest a correction. It does not make the result
correct by itself. The reviewed objects, source record, diff, tests, policy result,
approval, and live observation decide what can ship.

This is also how the catalog can grow without becoming unmaintainable. Chart-specific
and use-case-specific work is acceptable when its inputs, generated result, tests, and
maintenance steps are recorded.

## Rules for the catalog

1. Put information a user must understand on the human website. Keep the machine record
   and detailed evidence linked from it.
2. Generate both views from the same maintained facts where possible.
3. Do not hide hooks, CRDs, setup jobs, Secrets, or target requirements.
4. Do not claim a universal Helm replacement. Solve common real cases with
   chart-specific preset configurations and keep the original Helm chart.
5. Distinguish generated examples, offline checks, live tests, and supported paths.
6. Do not call a controller path proven because a different controller passed.
7. Keep install-time choices small and typed when the source format supports that.
8. Show why an entry exists, what problem it solves, how to try it, what was checked,
   and what remains.
9. A record that names a file must name the file it currently points at, and a lane
   must read back every fact a generator writes into a file another generator owns.
   A fact nothing reads back disappears the next time the other generator runs, and
   the disappearance looks exactly like a decision nobody made.
10. A lane covers every subject of its kind, or it records which subjects it leaves
    out and why. A check that reads ten charts is a sample of the catalog, and
    treating a sample as a gate is how twenty-four stale records stayed invisible
    while the lane that could have found them kept passing.
