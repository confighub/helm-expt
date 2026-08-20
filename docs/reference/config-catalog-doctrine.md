# Config catalog doctrine

The simplest architecture for this project is **OCI in, managed configuration, OCI
out**.

The [official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/)
owns the product onboarding journey. This catalog owns source-specific preparation,
public package testing, and evidence. See
[Onboarding And Entry Paths](../planning/onboarding-and-entry-paths.md).

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

The work may run as a local command or a CI job. We also intend to offer a public
hosted path for open configuration: inspect, test, and serve a public package without
signing in, then claim it later. That hosted path is not yet shipped. Anonymous use
must not quietly create private history, saved edits, variants, or approvals.

The optional handoff is **Claim this configuration in ConfigHub**. A user can work
anonymously with public packages before or after any OCI boundary. Claiming saves the
objects and their history so a team can transform, approve, promote, and roll them
out. It is not a required first step or a fixed position in every delivery flow.

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

## The ways configuration enters

There are three current entry paths.

1. A Helm user chooses a preset configuration from the Configuration Catalog. `cub
   installer` pulls the chart package, renders the chosen preset locally, and keeps the
   chart, values, source lock, and known Helm lifecycle work together.
2. An AICR user generates a versioned recipe and a deployer bundle. The reviewed bundle,
   its checksums, OCI digest, and any controller requirements can be uploaded and
   recorded as a ConfigHub base variant.
3. A team with existing Kubernetes YAML can package the literal files as OCI, or point
   `cub variant upload` at files directly. This is also the path `cub installer` can use
   after it has rendered a selected preset.

These paths do not require a replacement chart language. Teams keep their Helm charts,
AICR recipes, and existing files.

## What a base variant records

A ConfigHub base variant needs more than a directory of YAML.

- The literal Kubernetes objects that ConfigHub can query, diff, revise, approve, and
  deliver.
- The source and intent record that explains where the configuration came from, which
  choices produced these objects, and what remains to be supplied or performed.
- The choices fixed at build time and the small set still allowed at install time.
- Prerequisites and lifecycle work such as CRDs, hooks, webhook certificates, setup
  jobs, Secrets, storage, namespaces, and target capabilities.
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
| Existing OCI | An OCI source record containing the input reference and digest, package role, object inventory, checks, and any recorded transformation |
| Plain Kubernetes YAML | A source record containing the source revision or path, file checksums, object inventory, checks, and later OCI or ConfigHub revision |

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

The [flattening decision guide](./flattening-alignment.md) states when those objects
can stand alone, when lifecycle work must travel beside them, and when the source must
still render late.

Every real base must also state whether those surrounding records are complete:

- lifecycle work is either attached, explicitly unnecessary, or an actionable gap;
- target prerequisites are either declared, explicitly unnecessary, or an actionable
  gap;
- a route copied from another chart version remains a gap until the exact version has
  its own receipt;
- an Argo CD or Flux mapping explains the intended handling, but it is not execution
  proof;
- prerequisite checks expire at the next render or apply unless a stricter recorded
  rule says otherwise.

These states belong in the generated render intent, the master matrix, and the chart
page. Missing information must not be presented as “nothing required.”

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

The standard policy profile applies the same basic checks to Helm, AICR, `cub
installer`, Kubara, Sveltos, and existing YAML after they become ConfigHub data.
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
source was Helm, AICR, `cub installer`, Kubara, Sveltos, or ordinary YAML. Individual
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
partial because its historical receipt predates the current mutation-preview output,
the portable OCI used a temporary registry, and the workflow is still a guarded script
rather than a finished App interface. The current CLI exposes
`cub variant promote --dry-run -o mutations`; rerun the exact proof before using that
newer output to strengthen the App claim.

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
