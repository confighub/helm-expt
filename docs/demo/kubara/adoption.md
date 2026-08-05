# Adopt an existing Kubara platform with ConfigHub

This tutorial follows one continuous path from an ordinary Kubara selection to
applications deployed through ConfigHub and Argo CD. It preserves the six
adoption steps exactly; implementation details appear as checkpoints within
those steps.

Start with [why a Kubara user would add ConfigHub](index.md), consult the
[checkpoint ledger](checkpoints.md) while reproducing the journey, and use the
[complete mini-IDP reference](single-platform.md) when you need every command
and safety condition.

| Step | User action | Detailed chapter |
| --- | --- | --- |
| 1 | Choose platform components and wiring | [Choose in Kubara](adoption-1-choose.md) |
| 2 | Run Kubara to generate platform, add-ons, and wiring | [Generate the platform](adoption-2-generate.md) |
| 3 | Push the complete portable hand-off to Git | [Prepare, scan, commit, and push](adoption-3-git.md) |
| 4 | Import the exact Git revision and create OCI | [Verify and publish immutable packages](adoption-4-oci.md) |
| 5 | Load the selected ConfigHub organization | [Materialize, rerun, and audit](adoption-5-confighub-org.md) |
| 6 | Deploy applications | [Promote through ConfigHub; reconcile with Argo](adoption-6-apps.md) |

## Before you begin

You need:

- an existing Kubara repository or the committed current example;
- the exact Kubara and Helm versions named by its source lock;
- a clean Git commit pushed to the reviewed HTTPS remote;
- an explicitly selected ConfigHub organization;
- one ConfigHub Target and cluster-local Argo delivery runtime for each target
  cluster; and
- credentials for the selected organization and the OCI repository used by
  the importer.

The current importer does not create or guess an organization, Target, or
cluster-local delivery runtime. These prerequisites are deliberate security
and ownership boundaries, not hidden work performed by AI.

## Step 1: [Choose components and wiring in Kubara](adoption-1-choose.md)

Work in Kubara's normal inputs:

- `config.yaml` chooses the platform components and per-cluster placement;
- the effective ordered catalogs resolve those choices;
- ordinary `values-*.yaml` files specialize components; and
- Kubara's service definitions express the familiar platform wiring.

For the reproducible example, inspect
[`source/config.yaml`](../../../examples/kubara/current-platform/source/config.yaml)
and its adjacent reviewed overlays. It describes one hub, three spokes, seven
platform roles, and the placement used by hx-web and Cubbychat.

**Checkpoint 1 — recognizable input:** a Kubara operator can review the source
without learning a replacement schema. ConfigHub has not transformed or
rewritten it.

## Step 2: [Run Kubara](adoption-2-generate.md)

Run Kubara's ordinary generation path. Kubara, not ConfigHub, creates the
platform components, add-ons, ApplicationSets, AppProjects, overrides, and
cluster configuration.

The current example checks two catalog lanes:

1. the immutable snapshot of Kubara's official catalog release; and
2. the ConfigHub-aligned export of the same catalogs.

Both lanes must produce the same path set and the same bytes. Verify the
committed example with:

```sh
npm run kubara-current-example:verify
```

**Checkpoint 2 — no semantic migration:** Kubara v0.13.0 produces 135
byte-identical generated files from both catalog lanes and 13 deterministic
effective renders across four clusters.

Evidence:

- [catalog parity receipt](../../../examples/kubara/current-platform/catalog-parity-receipt.yaml)
- [generation receipt](../../../examples/kubara/current-platform/generation-receipt.yaml)

## Step 3: [Commit and push the complete hand-off to Git](adoption-3-git.md)

Git remains the portable Kubara hand-off. Commit and push:

- Kubara's source configuration and documented overlays;
- its generated platform, add-on, ApplicationSet, and cluster trees;
- exact source, binary, chart, image, and dependency locks;
- deterministic renders and the provides/needs wiring ledger; and
- checksums plus the external secret-scan attestation required by the import
  request.

Keep application source trees, credentials, private keys, secret values, and
target-local facts outside the portable platform path.

The deterministic preparer creates a separate clean subtree without modifying
Kubara's ordinary output. Verify the committed example offline with:

```sh
npm run kubara-git-handoff:verify-current
```

**Checkpoint 3 — exact portable source:** the importer receives one clean,
pushed Git object ID and one fully inventoried path. Dirty files, untracked
files, mutable revisions, symlinks, missing locks, source changes during
compilation, and credential-shaped material are refused.

## Step 4: [Import the exact Git revision and publish OCI](adoption-4-oci.md)

The ConfigHub Kubara importer reads the exact detached Git revision, verifies
the prepared hand-off, resolves every component against the component-first
Catalog, and builds:

- one immutable target-neutral OCI package per reusable component definition;
- one immutable target-neutral OCI package per effective component/config set;
- one platform index that references every exact manifest and layer digest;
  and
- a separate destination binding lock for the selected organization, Spaces,
  Targets, workloads, and delivery identities.

It deliberately does not flatten the platform into one giant OCI artifact.
Secrets and target facts remain outside both Git and portable OCI.

Exercise the complete isolated importer contract with:

```sh
npm run kubara-git-import:self-test
```

**Checkpoint 4 — deterministic immutable delivery:** the current self-test
produces 22 component/config packages plus a digest index, verifies pulled
payloads, creates pinned delivery topology, declares 12 platform Argo
Applications and four root releases, produces zero actions on the second run,
and passes its adversarial refusal cases.

The self-test proves the importer contract without claiming that a fresh live
organization has already completed the same path. The exact live destination
is the next checkpoint.

## Step 5: [Load the platform into the selected ConfigHub organization](adoption-5-confighub-org.md)

The user explicitly selects the ConfigHub organization and confirms its exact
identity. Each Kubara cluster has a pre-existing ConfigHub Target and local
Argo delivery runtime. The importer then materializes the platform as:

- reusable component definitions and exact versions;
- effective component/config instances for their selected targets;
- faithful and adapted delivery definitions kept visibly separate;
- cluster and environment Spaces;
- platform, lifecycle, and application Units;
- curated `NeedsProvides` Links; and
- exact source, release, approval, and OCI digest metadata.

The recognizable shape is preserved:

```text
Kubara source and catalogs
          |
          v
exact Git revision -> immutable OCI members + platform index
          |
          v
ConfigHub governance plane
          |
          +--> local Argo reconciler -> development
          +--> local Argo reconciler -> staging
          +--> local Argo reconciler -> production A
          +--> local Argo reconciler -> production B
```

Apply is serialized. Run it a second time immediately: the second accepted run
must report zero semantic changes. Then run the exact inventory and orphan
audit before treating the organization as a clean example.

**Checkpoint 5 — governed and repeatable organization:** the exact current
mini-IDP receipt must prove materialization, ConfigHub release heads, Argo
revisions, workload health, operation-journal completion, and a zero-action
second run. The orphan receipt must prove no unexpected ConfigHub objects,
dangling Links, Argo pruning residue, unclassified durable workloads, or stale
ownership metadata.

Until both receipts pass, describe this step as implemented but not
source-current live evidence. See the [checkpoint ledger](checkpoints.md).

## Step 6: [Add, promote, and deploy applications](adoption-6-apps.md)

Applications remain separate from the portable platform import. Add an
application source, bind it to the services the platform provides, and promote
reviewed revisions through ConfigHub. Argo CD pulls the released OCI digest and
reconciles each target.

The mini-IDP uses:

- **hx-web**, a small NGINX application that consumes shared certificate and
  ingress services; and
- **Cubbychat**, a multi-workload application with three digest-pinned images.

The demonstration sequence is:

1. deploy the initial release to development;
2. promote the exact revision to staging;
3. require production approval for the exact Unit revision and data hash;
4. promote to both production targets;
5. create one reviewed target departure;
6. roll back one production target to its exact earlier revision; and
7. show the retained source, approval, release, departure, rollback, and Argo
   histories together.

**Checkpoint 6 — better day-two operation:** every selected Application must
report the exact current ConfigHub release digest, `Synced`, and the health
required by its reviewed contract. The live matrix, native Links, and GUI tour
are regenerated only from that accepted receipt.

## What the user has at the end

- the original recognizable Kubara source and generated tree in Git;
- immutable component/config OCI members plus a digest-bound platform index;
- a component-first Catalog that retains old and new versions;
- a governed platform topology in the organization they selected;
- local Argo reconciliation on every cluster;
- visible component placement and wiring;
- approval, promotion, rollback, departure, and release history; and
- applications deployed on the platform without turning AI into a required
  migration tool.

Next: begin with [Step 1 — choose components and wiring](adoption-1-choose.md),
inspect every [evidence checkpoint](checkpoints.md), then follow the
[GUI tour](gui-tour.md).
