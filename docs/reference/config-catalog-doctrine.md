# Config catalog doctrine

The simplest architecture for this project is **OCI in, managed configuration, OCI
out**.

The website and catalog handle the work before configuration enters ConfigHub. They
help people turn Helm charts, AICR recipes, installer packages, Kubara output, Sveltos
objects, and existing YAML into literal configuration with recorded inputs, known
prerequisites, lifecycle work, and evidence.

That public front door must remain useful without a ConfigHub account:

- `work -> OCI`: inspect and test source material, then build a deployable OCI;
- `OCI -> work`: pull a public OCI to explain, inspect, scan, or compare it;
- `OCI -> work -> OCI`: check or change the exact objects and serve the result.

Here, `work` means rendering, inspecting, explaining, testing, scanning, comparing, or
editing configuration. These are not only first-run paths. They are small steps that
can be inserted into a delivery flow wherever they are useful:

| Shape | Example use |
| --- | --- |
| `work -> OCI` | A repository or CI job checks source files and publishes a deployable OCI package. |
| `OCI -> work` | A person or CI job pulls a package to inspect, test, or extract its exact objects. |
| `OCI -> work -> OCI` | A person or service pulls a package, checks or changes it, and serves a new package for Argo CD, Flux, or another consumer. |

The work may run as a local command or a CI job. We also intend to offer a public
hosted path for open configuration: inspect, test, and serve a public package without
signing in, then claim it later. That hosted path is not yet shipped. Anonymous use
must not quietly create private history, saved edits, variants, or approvals.

The boundary is **Claim this configuration in ConfigHub**. Before that point, a user
can work anonymously with public packages. Claiming saves the objects and their
history so a team can transform, approve, promote, and roll them out.

The [public OCI to Flux proof](../../data/serverless-oci-gitops-proof/summary.md)
checks that boundary. It starts from a public NGINX installer OCI, runs
`cub installer` with no ConfigHub token, packages the six rendered objects as a
second OCI, and records the exact digest Flux reconciled. The output registry is
temporary; the receipt does not claim a hosted public workbench.

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

## The ways configuration enters

There are three current entry paths.

1. A Helm user chooses a preset configuration from the Helm Ops Catalog. `cub
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
- The source record that explains how those objects were produced. For Helm this is the
  `HelmRenderIntent`; for AICR it is the AICR recipe and bundle receipt.
- The choices fixed at build time and the small set still allowed at install time.
- Prerequisites and lifecycle work such as CRDs, hooks, webhook certificates, setup
  jobs, Secrets, storage, namespaces, and target capabilities.

Controller requirements count as prerequisites too. For example, AICR's Flux OCI
output uses `ArtifactGenerator` and `ExternalArtifact`. Its base record must therefore
name the required Flux version, `source-watcher` controller, feature gate, and matching
`OCIRepository`; otherwise the YAML is complete as data but cannot reconcile.
- Provenance, checksums, tests, policy results, approvals, and delivery receipts.
- The operational class: user workload, system service, or system configuration, plus
  the owner and expected change cadence.

The source record and the literal objects stay connected. A rendered YAML file on its
own is useful, but it cannot explain why a hook was replaced, who owns a CRD, or which
target facts were required.

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
Public publication, route execution, and live platform health remain separate
checks.

Sveltos is one fleet placement and reconciliation path. ConfigHub stores the reviewed
`ClusterProfile`, its history, and its policy results. Sveltos selects matching
clusters and reconciles the declared add-ons. The
[Kyverno fleet example](../demo/sveltos/kyverno-fleet.md) proves that split on one
workload cluster: ConfigHub stored the exact profile, Sveltos installed Kyverno, and
Sveltos restored a changed replica count. The handoff from ConfigHub to the Sveltos
management cluster was manual, so automated delivery and a multi-cluster promotion
wave remain separate work.

Argo CD and Flux remain important delivery paths for ConfigHub release OCI. The
catalog must report their evidence separately because one controller succeeding does
not prove the other one.

Do not copy one cluster's target-scoped OCI credential into another cluster to make a
fleet demo pass. Either publish through each intended target or give all intended
controllers legitimate access to one portable release artifact.

The project also separates proof of the delivery mechanism from proof for a catalog
entry. The routed-hook fixture proves that one ConfigHub release OCI can be consumed
through Argo CD, Flux, and direct apply. A Helm base, AICR bundle, Kubara platform, or
other catalog entry earns a delivery claim only when that exact configuration has its
own controller and workload receipt.

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
includes controller status, ready workload replicas, and complete cleanup. It does not
stand in for production scale or every catalog row.

## Apply policy

The standard policy profile applies the same basic checks to Helm, AICR, `cub
installer`, Kubara, Sveltos, and existing YAML after they become ConfigHub data.
The source determines how the configuration is produced; it does not change the
minimum checks applied to the resulting Kubernetes data.

- Schema and placeholder checks block apply everywhere.
- Lifecycle route records must name their chart, version, preset, executor, disposition, and evidence. A route cannot claim automatic execution without an observed receipt.
- Digest pinning and workload probes are warnings everywhere.
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
source was Helm, AICR, `cub installer`, Kubara, Sveltos, or ordinary YAML.

The lifecycle-route check applies only when a `LifecycleRoute` is stored. It checks
whether that record is complete and honest. It does not infer that a chart needs no
route when none has been written. Chart-specific preset work and evidence still
determine which CRD, hook, certificate, setup, and observation routes are required.

The maintained profile is
[config-catalog/policies/catalog-standard.yaml](../../config-catalog/policies/catalog-standard.yaml).
The live `helm-catalog` filters and Space assignments were checked on 26 July 2026.
The result is recorded in
[data/apply-policy-profiles/live-helm-catalog.yaml](../../data/apply-policy-profiles/live-helm-catalog.yaml):
28 Spaces use the five common checks and seven Spaces use those checks plus approval:
four production Spaces and three system-configuration Spaces. Run
`npm run helm-org:policy:verify` while logged into the org to
compare the current live state with that receipt.

The topology receipt says which checks are connected. The
[functional policy proof](../../data/apply-policy-functional-proof/summary.md)
shows what they did with temporary records. ConfigHub blocked an unresolved
placeholder, invalid Kubernetes data, and unapproved system configuration. It
reported an unpinned image and missing health probes as warnings and still allowed
the dry-run apply. No fixture configuration was applied to Kubernetes.

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
