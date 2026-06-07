# Chart to Recipe to Manifest Flow

This note describes the proposed ConfigHub/cub installer flow for Helm-derived packages, where every source of new information is made explicit and every risky Helm feature is handled at the right stage.

## Mission

The Helm mission is to remove as much Helm pain as possible by moving hidden
rendering, variation, review, delivery, and observation concerns into explicit
ConfigHub artifacts and receipts.

That does not mean "never use Helm". It means Helm stops being the only place
where the user has to reason about hidden state, invisible generator behavior,
values-file guesswork, and fragile one-off deployment scripts.

The promise:

```text
Use the Helm ecosystem.
Import once.
Vary freely.
Review the exact Kubernetes objects.
Scan every important variant.
Deploy approved revisions without re-rendering and hoping.
Keep receipts for what changed, who approved it, what was applied, and what external observers saw live.
```

The 60-second story:

```text
Helm generates Kubernetes objects. ConfigHub captures those objects as
immutable variant revisions. You approve the exact rendered objects, scan them
before install, promote the same revision to prod, see why environments differ,
and get receipts proving what changed and what was observed.

Use Helm charts. Ship ConfigHub variants.
```

From the attached "first two problems" note, the product should directly answer these user pains:

- "I do not want to approve a values file and hope. I want to approve the exact Kubernetes objects that will be applied."
- "I deployed the same thing to prod and got something subtly different. I have no idea why."
- "I need the thing we tested in staging to be the exact thing we promote to prod, not a generator we rerun and hope produces the same output."
- "Our vendor pushed a chart upgrade. Half my customisations still work, half conflict."
- "SecOps patched the base image. I need to roll it across 12 customer environments without breaking any of them."
- "I can't tell what changed, what landed, or whether prod saw the same thing dev approved."

So the mission is not just deterministic import. The mission is a managed variant family:

```text
managed variants
+ tracked operations
+ signed receipts
+ exact rendered artifacts
+ bulk checks
+ day-2 propagation
= less hidden Helm pain, with explicit blockers where automation is unsafe
```

## Variants Are the Product Spine

The ConfigHub variants model should be the center of the Helm story.

Helm's native unit is a chart release. Git's native unit is a file change. Argo CD and Flux mainly operate desired-state sources and sync status. None of those is quite the object the user cares about when they say:

```text
dev, staging, prod, EU, Customer A, GPU region, HA mode, TLS mode
```

Those are variants.

In the new flow:

```text
recipe
  -> variant
  -> variant revision
  -> rendered manifest set
  -> scan results
  -> install/operate receipts
```

Definitions:

- **Recipe**: the reusable source model imported from Helm/Kustomize/raw manifests/etc.
- **Variant**: a named desired-state member of the family, such as `prod-eu`, `customer-a`, `ha-tls`, or `gke-gpu`.
- **Variant revision**: an immutable approved version of that variant, with values, overlays, facts, capability profile, generated facts, and rendered manifests fixed.
- **Operation**: an action against one or more variant revisions: install, promote, deploy, remediate, rollback, rescan, reobserve.
- **Receipt**: evidence for the operation or observation: inputs, outputs, authority, target, result, observer, and freshness.

This is the user promise:

```text
You do not manage piles of Helm values files.
You manage a family of variants.
Each variant has approved revisions.
Each revision has exact rendered objects and receipts.
```

A variant is only real if it carries enough state to be approved, promoted,
compared, scanned, and operated. A values file with a nicer label is not a
complete variant.

A ConfigHub variant revision must include:

- Recipe inputs.
- Environment and target fact values used during render, satisfying the
  target fact requirements declared by the recipe.
- Capability profile.
- Generated facts or generated secret handles.
- Rendered release objects.
- Immutable revision identity.
- Diff from another variant or revision.
- Scan and gate result.
- Operation and observation receipts.

## Five Objections, Five Answers

The answer must be:

```text
Less Helm pain. Not more platform ceremony.
```

### 1. "Is this another abstraction on top of Helm?"

No. Helm remains the chart ecosystem. ConfigHub adds the missing managed object:

```text
Use Helm charts.
Ship ConfigHub variants.
```

ConfigHub is not a new templating religion. It is a variant manager, receipt layer, and operation record.

### 2. "Will this work with my real charts?"

The first job is to explain the chart before install:

```text
OK: values, dependencies, CRDs
Needs facts: lookup Secret redis-password
Needs policy: pre-install hook
Blocked: unpinned post-renderer
```

That is already better than Helm failing late, silently ignoring values, or hiding behavior inside render-time side effects.

### 3. "Is this too much process for small teams?"

The simple path stays simple:

```text
install
review/plan
publish
```

Receipts, scans, and variant records are produced automatically. Teams can add approvals, variant matrices, initiatives, and promotion workflows when they need them.

### 4. "Who owns truth: Git, Helm, Argo, Flux, the cluster, or ConfigHub?"

Each keeps its job:

```text
Helm supplies charts.
Git stores files.
Argo/Flux sync clusters.
ConfigHub records variants, operations, and proof.
cub-scout, GitOps, CI, and other external observers report live state.
```

ConfigHub is the operational system of record. It can emit Git, OCI, YAML, or GitOps inputs instead of replacing delivery tools.

### 5. "What happens when YAML needs to change?"

Change the variant. Do not guess through values files.

```text
Helm: change values, hope the path works, rerender, compare noise.
ConfigHub: change variant, see affected fields, scan exact output, promote approved revision.
```

The crisp headline:

```text
Helm gives you charts.
ConfigHub gives you managed, reviewable, scannable, promotable variants from those charts.
```

User-facing naming should stay simple:

| Technical phrase | Public phrase |
| --- | --- |
| recipe import | Helm Recipe Import |
| base variants | Install Variants |
| rendered manifest sets | Rendered Release Objects |
| install gate | Verified Install Gate |
| operation records | Receipts |
| captured target/capability/generated facts | environment facts used during render |

Keep the heavier terms in schemas and technical docs. Do not put them in the headline.

Core flow:

```text
Helm chart source
  -> Helm Recipe Import
  -> ConfigHub Install Variants
  -> immutable variant revisions
  -> environment facts used during render
  -> Rendered Release Objects
  -> scan exact objects before install
  -> Verified Install Gate
  -> ConfigHub operate/day-2 lifecycle
```

The important product claim is not "ConfigHub scans Helm charts once". It is:

```text
ConfigHub makes Helm's possible install outputs explicit, reproducible, attributable, and scannable.
```

The user-facing version is:

```text
With cub, Helm becomes an input format. The thing you approve, scan, promote, roll back, and operate is an addressable ConfigHub variant revision with receipts.
```

## Build on `confighub/installer`

This plan should be built on [`confighub/installer`](https://github.com/confighub/installer), not as a separate Helm system.

Installer already has much of the substrate:

- `cub installer` plugin entrypoint.
- Package authoring with `installer.yaml`.
- Kustomize bases and components.
- Inputs, selection, and deterministic `out/spec/` state.
- Collector-produced `facts.yaml`.
- ConfigHub function chains and validators.
- Dependency resolution and lock files.
- Deterministic package bundling.
- OCI push/pull/inspect/list/tag.
- Cosign sign/verify and trust policy.
- Render/upload/day-2 lifecycle.

The Helm work should add the missing layer:

- Helm Recipe Import from chart source into installer package/recipe structure.
- Source/dependency locks for Helm chart closure.
- Import diagnostics and control-point classification.
- ConfigHub Install Variant definitions.
- Immutable variant revision receipts.
- Recipe-declared target fact requirements plus capability/generated fact
  profiles for Helm-specific nondeterminism.
- Rendered Release Object receipts.
- Scan/gate receipts.
- External observation receipt integration for `cub-scout`, GitOps, CI/CD, and other observers.

So the implementation claim is:

```text
Extend confighub/installer so Helm charts become ConfigHub installer recipes
and managed variant revisions.
```

## Execution Surfaces

Every step in the plan must be executable through one or more of:

- `cub` CLI / `cub installer`, backed by `confighub/installer`.
- ConfigHub Server UI/API for stored variants, variant revisions, receipts,
  target assignments, approvals, initiatives, desired state, and the OCI
  endpoint used by the fast install path.
- `cub-scout`, GitOps controllers, CI/CD, or other external observers for live
  observation receipts.

The current proof is not trying to execute a pure serverless install path.
GitHub is the public catalog/proof surface, currently `confighub/helm-expt`.
The fast install path uses ConfigHub's OCI endpoint. A fully client-side,
serverless `cub installer` path is a deferred option and should be tracked as an
issue, not treated as part of the current proof.

Backlog gates are tracked in `docs/planning/issue-backlog.md`. Open P0 issues in that
file must not be bypassed by the flow; they are gates before credible
20/100/500 chart proof.

The detailed execution contract is in `docs/planning/agreed-execution-plan.md`. Treat
the shorthand below as candidate future porcelain, not current executable CLI.
If needed, those verbs should be proposed explicitly as Cub plugins/extensions.
The current executable installer surface includes `cub installer setup`,
`cub installer upload`, `cub installer plan`, `cub installer package`,
`cub installer push`, `cub installer pull`, `cub installer doc`,
`cub installer render`, `cub installer wizard`, `cub installer vet`, and
`cub installer verify`. During implementation the proof repo may expose more
explicit commands, but every durable chart input, recipe, variant, revision,
scan, gate, publish/apply action, and observation must map back to one of the
real execution surfaces and produce an addressable artifact or receipt.

The upstream installer docs usually write these as `installer ...` commands.
Here they are written as `cub installer ...` because the installer is used through
the Cub plugin.

Target happy path:

```text
install redis
review/plan redis
publish redis
```

The first command should quietly:

```text
resolve the Helm chart
create or update the Redis recipe candidate
create the default install variant
render an immutable variant revision
scan the exact rendered objects
prepare a Verified Install Gate
write receipts
```

The publish command should publish the approved revision through ConfigHub's
OCI endpoint for GitOps pickup and write an OCI artifact receipt. Direct apply
can exist for local kind tests or explicit customer choice, but it is not the
default public handoff.

Easy variant path:

```text
create redis HA variant
review/plan redis HA against default
publish approved HA revision
```

or:

```text
create redis reuse-existing-secret variant
bind redis-password fact or secret handle
publish approved reuse-existing-secret revision
```

Implementation may initially expose more explicit `cub installer ...` subcommands
while this is being built, but the product proof should aim at the simple UX
above. The machinery is allowed to exist; it should not be the happy path.

## Workerless Server Boundary

ConfigHub Server should not be described as having a built-in live view if the direction is workerless.

The server's job is to store and govern:

- Recipes.
- Variants.
- Variant revisions.
- Rendered manifest identities.
- Scan results.
- Operation records.
- Receipts.
- Target assignments and desired state.

Live observations come from outside the server:

- `cub-scout`.
- GitOps controller reports.
- CI/CD jobs.
- Customer-owned agents or integrations.
- Human-triggered `cub` observations.

So the state model is:

```text
intended state
  stored by ConfigHub Server

applied state
  recorded by operation receipts from cub, GitOps, CI/CD, etc.

live observation
  submitted as observation receipts by cub-scout, GitOps, CI/CD, or other external observers
```

ConfigHub Server can aggregate and display intended/applied/observed state, but it should not be the thing that directly watches every cluster unless a customer explicitly deploys an observer that reports back.

Hard rule:

```text
ConfigHub stores desired/config truth and submitted observation receipts.
It does not claim fresh runtime truth unless a current receipt says so.
```

The UI must show freshness plainly:

```text
Observed by cub-scout 4m ago.
Argo report 17m old.
No runtime receipt yet.
```

## 1. The New Flow

### Step 0: Source Selection

Input:

- Helm repository URL or OCI registry reference.
- Chart name and version.
- Optional provenance/signature.
- Expected chart archive digest.

Output:

- A pinned chart source identity:

```text
chartRef + version + chartArchiveSHA256 + acquisition metadata
```

Checks:

- Refuse mutable "latest" style imports unless resolved to a digest.
- Record the exact archive hash.
- Record repository URL and transport.
- Prefer signed/provenance-checked charts where available.
- Treat unavailable or malformed archives as a pre-recipe blocker.

This is where the five failed rows in the top-500 scan belong. They are not Helm semantics problems; they are source-acquisition failures.

### Step 1: Dependency Closure

Helm input points:

- `Chart.yaml` dependencies.
- `Chart.lock`.
- Vendored `charts/*.tgz`.
- Unpacked subcharts.
- Umbrella charts.
- Library charts.
- Remote dependency repositories.
- Version constraints.

Output:

- A dependency lock for the entire chart closure:

```text
root chart digest
+ every dependency name/version/digest
+ importer dependency policy
= helm-source-lock
```

Checks:

- Never run `helm dependency update` implicitly during import.
- Require `Chart.lock`, vendored subcharts, exact dependency digests, or a first-class dependency resolution receipt.
- Record library charts even though they do not render resources directly.
- Treat umbrella charts as dependency graphs, not as special cases.

If dependency resolution is needed, it is its own auditable step. It is not hidden inside chart-to-recipe import.

### Step 2: Recipe Import

Input:

- Pinned chart source.
- Dependency lock.
- Importer version.
- Import policy version.

Output:

- One canonical ConfigHub recipe for the chart source.
- Recipe-declared target fact requirements for any `lookup` or cluster-sourced
  render dependency.

Recommended framing:

```text
1 Helm chart source -> 1 recipe -> N ConfigHub variants -> M variant revisions
```

Only split into multiple recipes when the source package is intentionally forked or the importer policy creates materially different package semantics. Normal HA/default/TLS/cloud/environment/customer differences should be variants and variant revisions, not separate recipes.

Checks:

- The importer must be deterministic from source bytes plus policy bytes.
- Import must not contact the target cluster.
- Import must not execute hooks.
- Import must not perform live `lookup`.
- Import must not generate random values.
- Any unsupported Helm behavior becomes an explicit recipe diagnostic.

There are two acceptable import modes:

- **Symbolic recipe mode**: compile chart structure into recipe inputs, target
  fact requirements, components, function chains, and render rules.
- **Render-and-vendor mode**: render one or more explicit variants and wrap those rendered artifacts. This is easier, but the Helm render context must be captured as a receipt.

The stronger long-term story is symbolic recipe mode. Render-and-vendor remains useful for compatibility and experiments.

### Step 3: Recipe Validation

Input:

- Imported recipe.
- Extracted value schema.
- Import diagnostics.

Output:

- A recipe that can either be rendered safely or rejected early.

Checks:

- Validate recipe schema.
- Validate mapped inputs.
- Convert Helm `required` and `fail` into recipe validation rules where possible.
- Flag unbounded `tpl`, raw manifest injection, unsupported hook behavior, or missing fact declarations.
- Confirm no unresolved source dependencies remain.

This is where ConfigHub-specific malformed package checks start. Market tools generally cannot inspect this layer because it is not Kubernetes YAML yet.

### Step 4: Variant Definition

Input:

- Recipe.
- Curated variant catalog.
- Organization policy.

Output:

- A bounded set of named ConfigHub variants:

```text
default
ha
ha-with-persistence
tls-enabled
ingress-enabled
restricted-security-context
fresh-install
reuse-existing-secret
k8s-1.29
k8s-1.30
eks
gke
aks
```

Checks:

- Do not attempt every possible Helm values combination.
- Define market-relevant and organization-relevant base variants.
- Make each variant's values, selected components, overlays, capability profile,
  and target/generated fact value profile explicit. Target fact requirements
  come from the recipe.
- Require each variant to have a stable identity and digest.
- Record parent/child relationships between variants when one derives from another.
- Make local deltas explicit, so base updates can be propagated or flagged for review.

Variants are the bridge between Helm flexibility and ConfigHub auditability.

### Step 4b: Variant Revision

Input:

- Variant definition.
- Base recipe version.
- Values profile.
- Selected overlays/components.
- Target/generated fact value profiles and capability profiles.
- Approval state.

Output:

- An immutable variant revision.

Checks:

- Once approved, a variant revision is not re-rendered implicitly.
- Promotion deploys the approved revision, not a generator invocation.
- New source, values, fact values, policy, or scanner changes create a new candidate revision.
- Revisions can be compared by source, values, facts, rendered manifests, scan results, and target state.

### Step 5: Target Fact Values, Capability Profiles, and Generated Facts

Input:

- Variant.
- Recipe-declared target fact requirements.
- Target cluster snapshot, when rendering for a real target.
- Synthetic fact value profiles, when bulk scanning representative scenarios.

Output:

- Captured fact value profiles:

```text
values-profile@sha
capability-profile@sha
target-facts@sha
generated-facts@sha
```

Checks:

- Cluster state is only observed during fact collection.
- Render must not perform hidden live-cluster reads.
- Same recipe + same values + same capability profile + same target/generated
  fact values must produce byte-identical manifests.
- Sensitive values should not be stored as plain facts; store references, generated secret handles, or secret material in the existing secret path.

This is how we handle Helm `lookup`: turn cluster-sourced nondeterminism into
target fact requirements in the recipe, then bind captured target fact values
when rendering a variant revision.

Example:

```text
Helm source:
  lookup Secret redis-password

Recipe:
  requires target fact redisPasswordSecret.exists

Variant A:
  redisPasswordSecret.exists = false

Variant B:
  redisPasswordSecret.exists = true
```

Now both outcomes are renderable, scannable, and repeatable.

This aligns with the current installer direction: installer already has a
collector extension point that writes `out/spec/facts.yaml`, and render uses
`.Facts.*` from that captured file. The Helm import plan generalizes that
mechanism into recipe-declared target fact requirements, capability profiles,
and generated facts for variant revisions.

### Step 6: Render

Input:

- Recipe digest.
- Variant digest.
- Values profile.
- Capability profile.
- Target fact values satisfying the recipe's target fact requirements.
- Generated facts.
- Dependency lock.
- Renderer version.
- Helm render parameters, if Helm rendering remains part of the path:
  release name, namespace, kube version, API versions, include CRDs, install
  versus upgrade phase, and test inclusion.

Output:

- A concrete rendered manifest set:

```text
renderedManifestSet@sha
```

Checks:

- Run two-render determinism checks for the same inputs.
- Store manifest digest.
- Canonicalize rendered manifests before digesting: parse YAML documents,
  normalize to canonical JSON with sorted object keys, keep list order, remove
  empty documents, and preserve Kubernetes object identity as
  `apiVersion|kind|namespace|name`.
- Store render command/options.
- Store tool versions.
- Separate normal manifests, secrets, CRDs, hooks, and tests where useful.
- Block render if required facts are missing.
- If Helm's post-renderer mechanism is supported, represent it as a named,
  pinned recipe/function stage. Otherwise reject it.

This is the point where standard Kubernetes policy scanners become most useful,
because the output is actual Kubernetes YAML.

Expected digest formula for proof artifacts:

```text
variantRevision.digest =
  sha256(
    recipe.digest,
    effectiveValues.digest,
    capabilityProfile.digest,
    factBindings.digest,
    generatedFacts.digest,
    renderer.digest,
    renderedManifestSet.digest
  )
```

`helm-expt` defines and verifies this contract. `confighub/installer` may later
emit native receipts, but installer implementation is an upstream dependency,
not code owned by this repo.

### Step 7: Kustomize, Overlays, and ConfigHub Functions

Kustomize can appear in several places:

- As the implementation substrate of an installer package.
- As a wrapper around Helm-rendered output.
- As bases selected by recipe variants.
- As components selected by recipe variants.
- As overlays or patches.
- As `images`, `replicas`, `namespace`, name prefix/suffix, replacements, ConfigMap generators, Secret generators, and transformers.

ConfigHub functions can also appear here:

- Normalizing labels and annotations.
- Setting namespace.
- Setting container images/resources.
- Applying security defaults.
- Validating or mutating resources.
- Splitting rendered output into ConfigHub Units.

Checks:

- Kustomize remote bases must be pinned or vendored.
- Generators must have stable input files and stable generator options.
- Secret generator material must be treated as generated/secret facts, not as hidden source.
- Components and overlays must be named variant inputs.
- ConfigHub function chains must be resolved from recipe inputs/facts and written to the render receipt.
- No post-render mutation should be invisible; every overlay/function/policy bundle gets a digest.

Kustomize is not a loophole around receipts. It is another explicit stage in the same recipe-to-manifest pipeline.

### Step 8: Bulk Policy and Misconfiguration Scans

Input:

- Rendered manifest sets.
- Scanner versions.
- Policy bundle versions.

Output:

- Scan result per manifest set:

```text
renderedManifestSet@sha
+ scanner@version
+ policyBundle@sha
= scanResult@sha
```

Examples:

- Snyk IaC.
- Trivy config scanning.
- Checkov.
- Kubescape.
- kube-linter.
- kubeconform/kubeval.
- OPA/Conftest.
- ConfigHub scan.
- Custom initiative functions.

Checks:

- Scan concrete manifests, not just abstract chart source.
- Store scanner version and policy database/bundle digest.
- Treat each variant independently.
- Treat each variant revision immutably.
- Aggregate results across variants for initiatives.
- Gate install on the exact variant being installed.

The atomic audit object should be per `renderedManifestSet@sha`. A higher-level initiative result should roll up many manifest-set scan results.

### Step 9: Install Gate and Receipt

Input:

- Rendered manifest set.
- Variant revision.
- Scan results.
- Import/render receipts.
- Organization policy.

Output:

- Approved or blocked install plan.

Checks:

- Confirm the selected variant revision is the one scanned.
- Confirm scan results are fresh enough for policy.
- Confirm source, recipe, facts, generated facts, overlays, and manifest digests are all linked.
- Confirm signatures/trust policy where required.
- Refuse install if the render cannot be traced back to source and policy.

### Step 10: Operate and Day-2 Lifecycle

Input:

- Installed ConfigHub Units.
- Variant revisions.
- Installer record.
- Prior receipts.
- New target fact values.
- Observation receipts from `cub-scout`, GitOps controllers, CI/CD, or other external observers.
- User edits.
- Drift.

Output:

- Reconcile, upgrade, or re-render plan.

Checks:

- Re-rendering with the same spec and facts should be byte-identical.
- If target fact values change, create a new render context rather than silently changing output.
- Preserve post-install ConfigHub edits according to merge policy.
- Re-run scans when manifests, policies, scanner versions, or relevant facts change.
- Track observed live drift separately from source/render determinism.
- Mark observed state stale when no fresh external observation receipt exists.
- Manage promotion, rollback, and remediation against variant revisions, not loose files.

## 2. Every Entry Point for New Information

| Entry point | Examples | Where it belongs | Control |
| --- | --- | --- | --- |
| Chart source | repo URL, OCI ref, chart version, archive bytes | Source selection | digest, signature, immutable receipt |
| Chart dependencies | umbrella chart, subcharts, library charts, remote repos | Dependency closure | lock with dependency digests |
| Chart defaults | `values.yaml`, subchart defaults | Recipe import | source digest and schema extraction |
| Values overlays | `values-prod.yaml`, `--set`, org defaults | Variant definition | values profile digest |
| Remote/generated values | CI scripts, downloaded values files, copied customer values | Variant definition | capture as input artifact or reject |
| Values schema | `values.schema.json` | Recipe validation | input constraints |
| Templates | manifests, helpers, named templates | Recipe import/render | importer policy and diagnostics |
| `tpl` | template strings supplied through values | Late/literal policy | bound evaluation or reject |
| `.Files.Get` | bundled config files, dashboards, scripts | Source import | file digest and path restrictions |
| `lookup` | live Secret/CRD/ConfigMap checks | Recipe target fact requirements plus bound values | snapshot, synthetic variant, or fail |
| Capabilities | kube version, API versions | Capability profile | named profile digest |
| Release object | name, namespace, install/upgrade, revision | Variant/render phase | explicit render parameter |
| Random/cert/time funcs | `randAlphaNum`, `genCA`, `now`, `uuidv4` | Generated facts | generate once and persist |
| Hooks | pre-install jobs, test hooks, weights, delete policies | Lifecycle policy and hook receipt | inventory deterministically; execute only through target-aware lifecycle proof |
| CRDs | `crds/`, CRD templates | Operate policy | CRD phase, ownership, ordering |
| Raw manifest escape hatches | `extraObjects`, `extraManifests` | Late/literal policy | scan, constrain, or disable |
| Kustomize bases | selected top-level base | Variant definition | base selection receipt |
| Kustomize components | optional components | Variant definition | component selection receipt |
| Kustomize overlays/patches | patches, replacements, images | Render stage | overlay digest and deterministic build |
| Secret/config generators | configMapGenerator, secretGenerator | Render/generated facts | input-file digest and secret handling |
| ConfigHub functions | set namespace/image/resources, validators | Render/validation | resolved function-chain digest |
| Helm post-renderer | external post-render command | Render stage | explicit pinned function stage or reject |
| Helm/getter plugins | nonstandard fetch/render behavior | Source/render stage | pinned toolchain receipt or reject |
| Kustomize exec plugins | alpha/exec plugins | Render stage | pinned allowed plugin set and digest |
| Image references | mutable tags, registry digests | Render/scan stage | optional image digest resolution receipt |
| CRD/OpenAPI schemas | schemas used by validators | Scan stage | schema source/digest |
| Scanner policy | policy bundles, vulnerability DBs | Scan stage | scanner/policy digest |
| Delivery target | target namespace/cluster/space | Install gate | target binding receipt |
| Live observation | `cub-scout`, GitOps report, CI/CD report | Operate | observation receipt with observer, method, timestamp, freshness |
| Day-2 edits | ConfigHub mutations, drift, upgrades | Operate | merge/reconcile policy |

## 3. Checks by Failure Type

| Problem type | Failure mode | Control |
| --- | --- | --- |
| Mutable source | same chart ref gives different bytes | require archive digest or signed immutable ref |
| Unlocked dependencies | dependency resolution changes | require dependency lock/digests |
| Missing archive | chart cannot be fetched | fail before recipe |
| Cluster lookup | live cluster state changes render output | recipe target fact requirement plus target fact snapshot or synthetic variants |
| Kube capability branch | target cluster changes output | named capability profiles |
| Random generation | repeated render differs | generated facts persisted once |
| Time/UUID | repeated render differs | generated facts or forbid in strict mode |
| Required/fail | render fails only after late values | recipe input validation |
| `tpl` escape hatch | values become code | bound evaluation, explicit allowed fields, or reject |
| Raw manifests | arbitrary resource injection | explicit extension slot plus scanning |
| Hooks | procedural lifecycle hidden in chart; execution depends on live cluster facts | inventory first; map to phases/tests, target-aware lifecycle receipts, explicit skip, or blocker where safe |
| CRDs/webhooks/APIService | ordering and cluster-wide blast radius | operate policy and install phases |
| Kustomize remote base | remote content changes | vendor or pin digest |
| Kustomize generator | name/content changes unexpectedly | deterministic generator options and input digests |
| Post-render command | arbitrary code changes rendered YAML | explicit pinned stage or reject |
| Tool/plugin drift | different Helm/Kustomize/plugin behavior | toolchain receipt and allowed versions |
| Mutable images | same image tag points to different image | optional image digest resolution |
| Validator schema drift | different schemas change validation result | schema source/digest receipt |
| Scanner drift | same manifest gives different result | scanner/policy bundle receipt |
| Day-2 drift | externally observed live state diverges | observation receipt separate from render receipt |

## 4. How This Solves the First Two Problems

### Problem 1: Install Config Correctly

The current pain is that users approve abstract inputs and hope the generated output is correct. The new flow changes the review object.

Old flow:

```text
approve values.yaml
run helm somewhere
hope the cluster got what was intended
```

New flow:

```text
create/update variant
render candidate variant revision
approve variant revision
review exact rendered YAML
scan exact rendered YAML
install exact approved manifest set
record receipt
```

Controls:

- Values that do not apply without warning become recipe validation and dead-key checks.
- Non-deterministic re-renders become recipe-declared target fact requirements,
  bound target fact values, generated facts, capability profiles, and two-render
  determinism checks.
- Helm CLI versus Argo CD versus Flux render differences become explicit renderer/toolchain receipts.
- "Which value set this field?" becomes recipe/variant provenance.
- "What will be deployed?" becomes `renderedManifestSet@sha`.
- "What did we approve?" becomes `variantRevision@sha`.

### Problem 1b: Small-Scale Helm Pain

Even small teams see the same failure modes:

- Wrong values path.
- Merge conflicts between Helm and GitOps controllers.
- Random secrets and timestamps.
- CRD upgrade gaps.
- Controller-injected diff noise.
- Missing resource requests, HPA settings, topology spread, and other reliability defaults.

In the new flow, these are not all solved by one scanner. They are solved at different points:

- Wrong values path: recipe validation and values schema checks.
- Merge conflicts: ConfigHub ownership and operate policy.
- Random secrets/timestamps: generated facts.
- CRD gaps: CRD phase and schema/upgrade policy.
- Diff noise: intended/applied/observed-live views are separated, with observed-live data supplied by `cub-scout`, GitOps, CI/CD, or other external observers.
- Reliability defaults: bulk policy scans over concrete manifest variants.

### Problem 2: Manage Related Variants Over Time

The server-side version of the plan is about managing a family of related approved states, not re-running generators whenever a target changes.

Old flow:

```text
many values files
+ many clusters
+ custom scripts
+ GitOps sync events
= no durable variant/operation record
```

New flow:

```text
base recipe update
  -> affected variants
  -> candidate variant revisions
  -> render and scan each candidate revision
  -> approve exact variant revisions
  -> promote/deploy those approved revisions to targets
  -> record operation receipts
  -> ingest external observation receipts for live freshness
```

Controls:

- Promotion is not a copy; it advances one variant from one approved revision to another while preserving prod/customer constraints.
- Rollback is variant-relative; it moves a variant/target back to a prior approved revision without reverting unrelated variants.
- Base updates are propagated through explicit variant deltas.
- Operations are first-class records, not just commits or sync events.
- Operation receipts include authority, target, artifact, and result.
- Observation receipts include observer, method, timestamp, and freshness.

This is why "deploy and vary however much you like" is plausible: variation happens in the ConfigHub variants model, and deployment operates approved variant revisions.

## 5. Legacy Top-500 Source Scan

The existing workbook scan is legacy/reference material. It covered 500
Artifact Hub Helm packages sorted by stars and statically scanned chart source;
it did not execute templates, hooks, or lookups.

Do not treat the existing workbook as the current proof pathway. The current
plan requires new chart proof repos and new generated spreadsheets backed by
recipe, variant, revision, scan, gate, and receipt artifacts.

The chart count alone proves nothing. The evidence matters only if each chart
can be connected to real recipe candidates, bounded install variants, rendered
objects, scan results, gates, and failure classifications.

The new top-20/top-100/top-500 proof should show breadth across complex Helm
reality:

- CRDs.
- Hooks.
- Dependencies.
- Globals.
- Values schemas.
- Cloud-specific knobs.
- Generated names and generated secrets/certs.
- SecurityContext and policy drift.
- Image override patterns.
- Ingress and TLS variants.
- Upgrade/customization conflicts.

Legacy scan summary:

| Category | Count |
| --- | ---: |
| Requested charts | 500 |
| Scanned charts | 495 |
| Source/archive failures | 5 |
| Registry rate-limited during final run | 0 |
| P0 source/dependency risk | 154 |
| P1 compiler policy needed | 165 |
| P2 recipe/render/install policy | 174 |
| P3 plain/static-ish | 2 |

Feature counts among scanned charts:

| Feature | Count | Where the new system handles it |
| --- | ---: | --- |
| Non-exact dependency constraints | 152 | dependency lock before import/render |
| HTTP chart repo URL | 5 | source acquisition warning/policy |
| Hooks | 54 | lifecycle policy, phases/tests, or explicit blocker |
| Non-test hooks | 42 | install phase mapping or unsupported |
| Test hooks | 16 | map to test/check actions |
| `lookup` | 244 | recipe target fact requirements and lookup policy |
| Generated facts candidates | 282 | generated facts persisted in receipts |
| Random funcs | 220 | generated facts |
| Certificate funcs | 169 | generated cert facts or secret material |
| Hash/password funcs | 19 | generated facts/secrets |
| Time/UUID funcs | 140 | generated facts or strict reject |
| `required`/`fail` | 309 | recipe input validation |
| `.Capabilities.APIVersions` | 281 | capability profiles |
| `.Capabilities.KubeVersion` | 319 | capability profiles |
| `semverCompare` | 309 | capability/value validation profiles |
| Release install/upgrade/revision branching | 177 | render phase variants |
| `tpl` | 362 | late/literal policy |
| Extra/raw manifest values | 254 | explicit extension slots and scans |
| `.Files` access | 129 | source file digest and path policy |
| `values.schema.json` | 178 | recipe validation input |
| CRDs | 131 | install ordering/ownership policy |
| Cluster RBAC | 250 | policy scans and operate review |
| Webhooks | 77 | policy scans and operate review |
| APIService | 17 | policy scans and operate review |
| Stateful/PVC footprint | 296 | stateful operate policy |

Important overlaps:

| Combination | Count | Meaning |
| --- | ---: | --- |
| `lookup` + generated facts | 221 | many charts combine cluster-derived and generated state |
| `lookup` + capabilities | 228 | target fact requirements and capability profiles must be designed together |
| Hooks + generated facts | 43 | lifecycle handling must preserve generated state |
| `tpl` + raw/extra manifests | 253 | late/literal escape hatches are common |
| CRDs + webhooks | 55 | install ordering and admission risk often travel together |
| Stateful/PVC + generated facts | 215 | databases often need generated secrets/certs plus persistence |
| P0 source risk + P1 features | 148 | source locking and compiler policy often both matter |

Conclusion from the legacy scan:

```text
The top-500 chart features do not defeat the plan.
They force the plan to be explicit.
```

Every observed feature class has a control:

- Lock and verify source/dependencies.
- Convert cluster reads into recipe-declared target fact requirements and bound
  target fact values.
- Convert random/time/cert generation into generated facts.
- Convert required/fail into input validation.
- Convert capabilities into named capability profiles.
- Convert install/upgrade branching into render phase variants.
- Convert hooks into lifecycle phases/tests or fail early.
- Convert raw/tpl escape hatches into explicit extension slots or reject them.
- Scan concrete manifest sets for Kubernetes policy and misconfiguration.

The system cannot make an unavailable chart archive available. It should block or require mirroring. It also cannot prove semantic safety from a static regex scan alone. The importer must eventually use a proper chart/template parser and record importer diagnostics.

## 6. Bulk Policy, Scan, and Misconfiguration Checks

The bulk-scanning model still works:

```text
recipe@sha
  variant: default
    revision: default@2026-05-25.1
    renderedManifestSet@sha -> Snyk/Trivy/Checkov/Kubescape/ConfigHub scan
  variant: ha
    revision: ha@2026-05-25.1
    renderedManifestSet@sha -> Snyk/Trivy/Checkov/Kubescape/ConfigHub scan
  variant: tls-enabled
    revision: tls-enabled@2026-05-25.1
    renderedManifestSet@sha -> Snyk/Trivy/Checkov/Kubescape/ConfigHub scan
```

There should be two result levels:

- **Atomic result**: scanner result for one `renderedManifestSet@sha` and one policy bundle.
- **Variant revision result**: aggregate over all scans/checks for one immutable variant revision.
- **Initiative result**: aggregate over many variants, revisions, charts, targets, and scanners.

This lets ConfigHub answer both questions:

- "Is this exact variant revision safe to publish or apply?"
- "How healthy is our Redis/Ingress/Monitoring initiative across all standard variants?"

Market scanners belong mostly after render. ConfigHub scan belongs both before and after render:

- Before render: recipe validity, missing fact values, unsupported `lookup`, unbounded `tpl`, unsafe generated fact handling, invalid variant definitions.
- After render: Kubernetes object validity, policy violations, image/security checks, RBAC, CRDs, webhooks, storage, network exposure.

## 7. Leftover Design Questions

These are not optional details. They are the remaining defaults that turn the plan into a product.

### Top Target Facts

Likely top target fact requirements Helm recipes need:

1. Kubernetes version.
2. Available API versions and CRDs.
3. Target namespace exists, plus labels/annotations when charts branch on them.
4. Named Secret exists and required keys exist.
5. Named ConfigMap exists and required keys exist.
6. Existing CRD ownership and served versions.
7. StorageClass/default storage class/volume expansion support.
8. IngressClass or GatewayClass availability/defaults.
9. Existing ServiceAccount/RBAC objects when charts support reuse.
10. Certificate issuer or TLS secret availability.
11. ImagePullSecret availability.
12. Existing PVC availability for stateful reuse/upgrade flows.

The first two are closer to capability profiles than ordinary facts, but users
will think of them as target facts. The UI can group them while keeping the
receipt model precise. The recipe declares these requirements; a render context
or variant revision binds the concrete target fact values.

### Lookup Default

Recommended policy:

- **Strict import**: `lookup` must map to a declared target fact requirement or import fails.
- **Bulk scan**: render synthetic variants for common fact values.
- **Real install**: run a collector once, store target fact values, render from the stored snapshot.

Do not allow hidden live `lookup` during render.

### Variant-Specific vs Recipe-Wide Misconfigs

Recipe-wide:

- Unsupported Helm functions.
- Unlocked dependencies.
- Unbounded `tpl`.
- Invalid recipe schema.
- Missing fact declarations.
- Unsafe importer policy.

Variant-specific:

- Bad values.
- Missing target fact values.
- Policy scanner findings.
- RBAC/webhook/CRD footprint.
- Persistence/ingress/TLS/security context choices.
- Fresh-install versus reuse-existing-resource behavior.
- Approval, promotion, rollback, and target assignment state.

### Result Object

Use both:

- `ScanResult` per `renderedManifestSet@sha`.
- `VariantRevisionResult` per immutable variant revision.
- `InitiativeResult` as an aggregate roll-up across variants/revisions.

The per-manifest-set result is the scan audit primitive. The variant revision is the user-facing approval and promotion primitive. The initiative result is the workflow/dashboard primitive.

## 8. What We May Still Be Missing

After reviewing the conversation and the legacy 500-chart feature matrix, the
likely missing or under-specified areas are:

1. **Chart tests as first-class checks**: Helm test hooks should probably become optional post-render or post-install test actions, not just "hooks".
2. **Notes and human instructions**: `NOTES.txt` sometimes carries required operational steps. We need a policy for extracting or preserving operator notes.
3. **Image resolution**: scanners inspect image strings, but mutable image tags can still move. We need optional image digest resolution as a render or scan step.
4. **Policy database drift**: scanner output can change when vulnerability DBs update. Receipts must include scanner database/policy bundle versions.
5. **CRD schema-dependent validation**: kubeconform-style checks need the right CRD schemas for custom resources, not just built-in Kubernetes schemas.
6. **Admission-controller reality**: rendered YAML can pass static scans but fail target admission policies. A dry-run/server-side validation stage may be needed for real targets.
7. **Secret value scanning**: rendered Secrets may be withheld from uploaded Units, but install gating still needs a safe way to validate secret shape without leaking material.
8. **Cross-resource references**: Services, ServiceAccounts, Secrets, PVCs, Ingress classes, and RBAC references need graph checks, not only object-local checks.
9. **Subchart value propagation**: umbrella charts can pass values deeply into dependencies. Variant definitions must include subchart values explicitly.
10. **Library charts**: they do not render resources but strongly affect templates. They must be represented in the source lock and importer diagnostics.
11. **Post-renderers**: Helm supports post-renderers. If supported, they need to become explicit recipe/Kustomize/function stages; otherwise reject.
12. **Upgrade/downgrade semantics**: `.Release.IsUpgrade`, hook delete policies, CRD upgrades, and PVC retention need explicit phase variants.
13. **Namespace and cluster-scope collisions**: cluster-scoped resources need ownership and conflict checks across installs, not just within one rendered set.
14. **Remote values or generated values files**: if a workflow fetches values from URLs or CI scripts, that source must be captured as an input artifact.
15. **OCI registry throttling/availability**: source-acquisition failure is not chart behavior, but it affects import reliability. Mirroring may be part of the product story.
16. **False positives in static chart scanning**: the legacy top-500 matrix is a source scan heuristic. It is good enough to prioritize controls, not enough to certify a chart. New matrices must be generated from chart proof artifacts and receipts.
17. **Bounded capability profiles**: we should name the supported Kubernetes/API profiles rather than imply an unbounded continuum.
18. **Scanner coverage gaps**: Snyk/Trivy/Checkov/Kubescape overlap but do not fully substitute for ConfigHub recipe/fact/variant checks.
19. **Operator override governance**: raw manifest slots and `tpl` need role/policy controls, not just technical receipts.
20. **Receipt UX**: the receipt has to be understandable to Helm users. A receipt no one can read will not build trust.
21. **Values dead-key detection**: the attached note calls out values that do not apply without warning. Helm does not reliably prove that a values path affected output. The importer should report unknown values, unused values where detectable, and field-level provenance for generated manifests where possible.
22. **Field ownership across tools**: Helm, GitOps controllers, operators, and ConfigHub functions can all touch the same fields. The operate model needs ownership/conflict checks, not just render determinism.
23. **Intended versus applied versus observed live**: scanning rendered YAML is necessary but not enough. ConfigHub Server should store intended state and applied-operation receipts, while `cub-scout`, GitOps, CI/CD, or other external observers submit live observation receipts with freshness.
24. **Variant propagation semantics**: "deploy to prod" must mean promote an approved variant revision while preserving prod-only constraints, not copy dev YAML blindly.
25. **Rollback semantics**: rollback must be scoped to a variant/target and operation, not a Git revert that pulls unrelated changes with it.

## 9. Recommended Product Defaults

Start with these defaults:

- Import requires pinned chart bytes and dependency lock/digests.
- Import fails on hidden live cluster access.
- `lookup` must become a recipe-declared target fact requirement.
- Random/time/cert/password generation must become generated facts or secrets.
- `tpl` is allowed only for declared values paths and is visible in diagnostics.
- Raw manifest injection is disabled by default for trusted base variants, allowed only in explicit extension variants.
- Hooks are split into test hooks, install-phase hooks, upgrade/delete lifecycle
  actions, explicit skips, and unsupported procedural hooks. Hook templates can
  be inventoried deterministically; hook execution is proven only by
  target-aware lifecycle receipts and live observations.
- Capability profiles are named and finite for scanning.
- Every standard variant is rendered and scanned in bulk.
- Install is gated on the exact selected variant revision and its rendered manifest set.
- Receipts include source, dependency lock, recipe, variant, facts, renderer, overlays/functions, manifest digest, scanner versions, and scan results.

That is the cleanest version of The Plan.

## 10. What `helm-expt` Must Prove

The repo rewrite should make these artifacts visible:

- Corpus manifest: chart name, version, source, category.
- Core recipe candidates.
- Bounded install variants.
- Rendered release object snapshots.
- Per-variant diffs.
- Policy and misconfiguration scan results.
- Verified install gate receipts.
- Upgrade simulation: old chart plus customizations to new chart conflicts.
- Promotion example: staging rendered revision promoted to prod without re-rendering.
- Failure catalog: unsupported hooks, missing schemas, conflicting overrides, CRD risks.
- One 60-second skeptical-engineer walkthrough.

The repo should not merely say "top 500 charts". It should show:

```text
Helm complexity
  -> explicit ConfigHub control point
  -> deterministic variant revision
  -> scanned and gated rendered objects
```
