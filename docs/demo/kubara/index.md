# Kubara with ConfigHub

**ConfigHub simplifies Kubara without making it fundamentally different.**

Kubara users keep choosing components and wiring in Kubara, generating the
familiar platform tree, committing it to Git, and using Argo CD to reconcile
clusters. ConfigHub adds a component-first Catalog, immutable releases,
review and promotion history, a fleet-wide platform view, and visible wiring.

The shortest description is:

> **Kubara composes. ConfigHub governs. Argo CD reconciles.**

This is an adoption path, not an AI-led rewrite. Catalog references and
configuration may need ordinary reviewed updates, but the Kubara model and
generated artifacts remain recognizable and portable.

## Choose your path

| If you want to... | Start here |
| --- | --- |
| Decide whether ConfigHub makes Kubara better for your team | Continue on this page. |
| Adopt it from an existing Kubara repository | Follow the [six-step adoption tutorial](adoption.md). |
| See exactly what has been proved | Open the [evidence checkpoints](checkpoints.md). |
| Walk through the result in ConfigHub | Use the [GUI tour](gui-tour.md). |
| Reproduce every implementation and release gate | Use the [complete technical reference](single-platform.md). |
| Understand the importer contract in full | Read [Import one Kubara Git revision into ConfigHub](../../../examples/kubara/git-import/README.md). |

## What stays, what becomes better, and how to verify it

| Kubara stays | ConfigHub adds | Proof to show |
| --- | --- | --- |
| `config.yaml`, ordered catalogs, values overlays, service definitions, and generated files | A component-first Catalog that retains reusable components and older versions independently of one platform selection | The current Catalog retains 103 components and 130 versions, including all 18 exact Kubara selections, under additive-only retention. |
| Kubara's platform package and per-platform selection and wiring | Governed definitions, effective configurations, target instances, and explicit relationships without flattening the platform into one object | The official and ConfigHub-aligned catalog lanes generate the same 135 files, path-and-byte-for-byte. |
| Git as the portable platform hand-off | Exact-source verification and immutable per-component/config OCI packages plus a digest-bound platform index | The deterministic importer self-test compiles the exact Git source into 22 component/config packages and refuses dirty, ambiguous, or mismatched inputs. |
| The familiar hub, ApplicationSets, AppProjects, and registered spokes | A faithful lane for unchanged Kubara topology and an adapted lane in which ConfigHub takes the hub role while each cluster keeps a local reconciler | The faithful and adapted lanes are separately receipt-gated so one cannot be mistaken for the other. |
| Argo CD as the cluster reconciler | Approvals, promotion, rollback, retained departures, release history, and OCI digest provenance before Argo receives a release | The current mini-IDP uses hx-web and Cubbychat across development, staging, and two production targets. Live claims require the current receipt. |
| Kubara's generated component and cluster placement | A component-by-cluster matrix and visible provides/needs wiring | The generated platform view contains 36 component/application cells and a deterministic wiring graph; live state is shown only when a source-current receipt exists. |

## The adoption journey

Every buyer, tutorial reader, and future repository user should see the same
six steps in the same order:

1. **Choose platform components and wiring in Kubara.**
2. **Run Kubara to generate the platform, add-ons, ApplicationSets, overrides,
   and cluster wiring.**
3. **Commit and push the complete reviewed hand-off to Git.**
4. **Run the deterministic ConfigHub importer against that exact Git revision;
   verify and publish immutable OCI packages.**
5. **Load the result into the organization selected by the user and materialize
   the familiar topology as governed ConfigHub objects.**
6. **Add, promote, and deploy applications through ConfigHub while Argo CD
   remains the cluster reconciler.**

The [tutorial](adoption.md) expands these steps without changing their
order. Internal preparation, scanning, packaging, binding, and verification
operations appear as checkpoints inside the relevant step rather than as a
second competing journey.

## Why a Kubara user should prefer this

### Keep the platform portable

The exact Git revision remains the neutral hand-off. OCI is the immutable
delivery form; ConfigHub is the governance and release plane. A user can still
inspect the generated tree and continue to understand it with Kubara's own
documentation.

### Retain components beyond one platform package

Kubara's catalogs describe reusable platform architecture and each platform's
configuration selects and wires a package. ConfigHub's Catalog starts with the
component: every retained version remains independently discoverable, with
deployable variants and effective configurations following from it. Neither
catalog model is discarded.

### See the platform as live data

Instead of treating the fleet matrix and wiring as documentation diagrams,
ConfigHub can expose exact component instances, target placement, departures,
release state, and curated `NeedsProvides` relationships. Generated evidence
views remain available outside the GUI and explicitly distinguish desired,
historical, and live-observed state.

### Govern changes without replacing reconciliation

ConfigHub records the review, approval, promotion, rollback, release digest,
and revision history. Argo CD continues doing the in-cluster reconciliation a
Kubara operator already understands.

## Honest boundaries

- The selected ConfigHub organization, Targets, and cluster-local delivery
  runtime must exist before the current importer applies the platform. The
  importer never silently chooses an organization.
- Secrets and target-local facts stay outside Git and the portable OCI
  packages.
- A generated matrix cell is not called live until an accepted exact-source
  receipt supplies its observation.
- Publication proves immutable packaging and retrieval, not production support
  for every possible chart configuration.
- Performance is measured as part of the live receipt. It is not a sales claim
  until the end-to-end target is demonstrated.

## Graduation to a dedicated repository

The eventual `github.com/confighub/kubara-confighub` repository should contain
this same six-step journey, the importer, a small reproducible example,
contracts, tests, and current evidence. It graduates from this proof repository
only after the current example passes twice idempotently, the organization is
orphan-free, the GUI walkthrough is current, and a fresh user-selected
organization import reaches one healthy application.

Next: [follow the six-step adoption tutorial](adoption.md).
