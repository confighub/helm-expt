# Config catalog demonstration programme

This plan turns the current Helm catalog into the first part of a wider configuration
catalog. It keeps the Helm work concrete while adding AICR, fleet placement, policy,
promotion, and ConfigHub App examples in a controlled order.

## Strategy

The front door owns the work before OCI enters ConfigHub. It should help a Helm, AICR,
`cub installer`, Kubara, Sveltos, or existing-YAML user inspect the source, choose a
useful configuration, make prerequisites and lifecycle work explicit, run tests, and
produce a literal configuration OCI with a source record.

People can use that front door in three directions without an account:

- `work -> OCI`: start with a Helm chart, AICR recipe, installer package, or
  Kubernetes files, then inspect, test, and package the result;
- `OCI -> work`: pull a public OCI package to inspect it, explain it, scan it,
  or compare it with another version;
- `OCI -> work -> OCI`: pull a package, check or change the exact objects, and
  serve the resulting package.

Serverless means this work does not depend on ConfigHub Server. Anonymous means it
uses no ConfigHub account. A local command or CI job can be both. These terms do not
mean the work must happen at the start of a user's journey.

`work` is the useful operation: render, inspect, explain, test, scan, compare, or
edit. The three shapes are reusable parts of a delivery flow. They may run before the
first OCI is built, after an OCI is pulled, or between an input OCI and an output OCI.
They are not a separate beginner-only journey.

The current proofs run the anonymous work locally and in GitHub Actions. The
[CI receipt](../../data/anonymous-oci-ci-proof/summary.md) records the public input
digest, six rendered objects, the output OCI-layout digest, and a successful
pull-back comparison with no ConfigHub credentials. A later public service should
let someone inspect, test, and serve public configuration without signing in, then
claim the result in ConfigHub. Until that service exists, the site must call it
planned and must not imply that anonymous users already have hosted storage or saved
edits.

These paths remain useful without ConfigHub. The handoff is **Claim this
configuration in ConfigHub**. Claiming saves the objects and their history so a
team can make variants, require approvals, promote changes, and roll them out.

The live [public OCI to Flux proof](../../data/serverless-oci-gitops-proof/summary.md)
demonstrates the third path with `bitnami/nginx@24.0.2`. It anonymously pulls the
public installer OCI, renders six objects in an isolated cub home with no ConfigHub
token, packages the reviewed files as a second OCI, and pins that output digest in
Flux. The output registry is temporary, so hosted public output remains open work.

ConfigHub owns the middle. It stores the exact objects, lets teams make variants and
review diffs, runs checks and approvals, promotes changes, and records releases and
observations.

ConfigHub can be inserted into an existing `Git -> CI -> OCI -> Argo CD or Flux ->
Kubernetes` flow. The resulting path is `Git -> CI -> OCI -> ConfigHub -> OCI ->
Argo CD or Flux -> Kubernetes`. The first use can be a checked pass-through: record
the package and publish the same specs and user-supplied metadata. The ConfigHub
release has a new OCI digest and adds `confighub.com/origin` for provenance. Later,
the team can create specific variants and promote them to selected clusters. One
recorded base can also feed several environment, customer, region, or cluster-group
outputs.

`cub release publish` creates an immutable Space release OCI from reviewed Units.
The same reviewed objects can also be packaged as a portable OCI for anonymous or
external consumers. Argo CD, Flux, or another recorded delivery path consumes the
chosen artifact without rendering the source package again.

The website should make the first step useful even before a visitor signs up. It should
then show why storing and operating the result in ConfigHub is more valuable than
stopping at an OCI file.

The maintained status is generated from
[config-catalog/program.yaml](../../config-catalog/program.yaml). This file explains the
sequence and the acceptance criteria.

## Immediate product slice

The shortest complete demonstration uses one exact OCI package:

1. Import it as a base without rerunning its source generator.
2. Create development and staging variants.
3. Change one field and promote it in sequence.
4. Package the reviewed staging objects once.
5. Reconcile that same OCI digest on two clusters and record controller and
   workload health.

This slice joins the public front door to ConfigHub's stored operations and then
back to OCI delivery. It is deliberately smaller than a production fleet claim.

It must distinguish three results:

1. congruent pass-through: the ConfigHub output keeps the input specs and
   user-supplied metadata, adds only the named ConfigHub provenance annotation, and
   records both OCI digests;
2. transformation: a reviewed variant changes named fields and the output records the
   new digest;
3. fan-out: the same reviewed release is sent to more than one target, with delivery
   and workload status recorded for each target.

## Phase 1: shared records

Generate one source-neutral `BaseVariantRecord` for every real Helm base row. The record
points to the existing `HelmRenderIntent`, literal objects, revision digest, routes,
target facts, proof lanes, installer package OCI, and delivery status.

Add the same record shape for non-Helm sources as examples become real. Do not force
AICR, Kubara, or Sveltos into Helm fields.

Complete when:

- every real Helm base has a generated base-variant record;
- the Helm render-intent schema accepts every generated intent;
- each record distinguishes installer OCI, literal configuration OCI, and ConfigHub
  release OCI;
- missing typed input schemas and missing OCI publications are shown as gaps.

## Phase 2: AICR

Keep one real AICR v0.14.0 recipe and generated Flux bundle in the repo. Record the
criteria, remaining install-time inputs, component versions, generation command, and
checksums.

Next, package the literal bundle as OCI and run `cub variant upload` against a test
ConfigHub org. A later live lane should reconcile it through Flux on a suitable target.

Complete when:

- the example regenerates from its `AICRConfig`;
- all bundle checksums verify;
- the literal bundle OCI digest is recorded;
- upload creates the expected base Space and Units;
- a Flux receipt shows reconciliation, or the page remains marked partial.

The Argo CD form now completes the ConfigHub upload step: 17 generated `Application`
objects were imported from one literal OCI artifact as one policy-covered base variant.
The live base is classed as system configuration. A dry-run apply of its exact
17-Application Unit was rejected because it had no recorded approval; its revision and
data hash did not change, and no target was attached.
The first staging variant is ready as a concrete Grafana existing-Secret change, but
the live demo organization is at its 1,000-Link quota. The failed clone left no Units
and its partial Space was removed. Public registry publication and live Argo CD or GPU
reconciliation also remain open, so the example is still partial.

## Phase 3: Helm and cub installer

Keep the public installer packages as the no-account route for selecting and rendering
chart preset configurations. Add a literal configuration OCI for selected base
variants so the same reviewed output can seed a ConfigHub base Space directly.

Complete when:

- the catalog page names the two OCI artifacts correctly;
- `cub installer setup --pull` works for the multi-preset source package;
- `cub variant upload oci://...` works for the single literal base bundle;
- the resulting ConfigHub Units match the committed object inventory.

## Phase 3A: release OCI delivery

Keep Argo CD or Flux as the delivery controller. Publish the approved ConfigHub
Units once as a release OCI so each controller consumes the same Kubernetes
objects instead of rendering the source package again.

There are two separate checks. The routed-hook fixture proves that the delivery
mechanism works through Argo CD, Flux, and direct apply. Every catalog
configuration still needs its own receipt before its page claims that the
controller reconciled it successfully.

Complete when:

- the mechanism receipt continues to pass for Argo CD, Flux, and direct apply;
- each claimed catalog path names the exact release OCI, controller, target, and
  workload receipt;
- controller sync and workload health are reported separately;
- a fixture receipt cannot be used as a catalog-wide delivery claim.

## Phase 4: promotions and policy

Use the same environment path for Helm, AICR, and existing YAML after each source has
become a base variant.

Apply `catalog-standard` everywhere. Production receives the baseline checks plus one
approval requirement. The offline verifier must reject the earlier failure mode where
approval leaked onto every Space.

Complete when:

- the baseline and production trigger sets pass the scope verifier;
- a test fixture proves that a broad or miswired filter fails;
- a promotion receipt shows the exact mutations through test, development, staging,
  and production;
- production apply cannot proceed without approval;
- the live-org receipt states the Space and Trigger counts it actually observed.

## Phase 5: fleet paths

Add a real Kubara-generated Kubernetes configuration and upload it as a platform base
variant. Use ConfigHub variants for cluster classes and rollout waves.

Keep the Sveltos `ClusterProfile` example as a placement contract. Build a live lane
only after the desired ConfigHub ownership and Sveltos reconciliation boundary are
clear.

Complete when:

- Kubara generation and upload have a reproducible receipt;
- blast-radius output names the affected clusters before promotion;
- Sveltos reconciliation reports the selected clusters and deployed add-ons;
- every page distinguishes source generation, ConfigHub desired state, and the
  delivery controller.

## Phase 6: Apps

Build the five Apps in this order:

1. Upgrade App, because the repo already has promotion and blast-radius evidence.
2. Hooks and CRDs App, because the route records and CRD-ordering receipts already
   exist.
3. RBAC Review App. The catalog-wide scan now leads to one live reviewed correction:
   ConfigHub stores the exact change, blocks it until approval, and the approved data
   removes Secret access on an isolated cluster while preserving ConfigMap access.
   Automated delivery and fleet-wide binding analysis remain open.
4. Fleet Platform App, after Kubara or Sveltos has one complete live lane.
5. AI Change Review App, after the diff, policy, approval, and unwind path can be shown
   in one run.

Each App needs a problem statement, a five-minute path, committed inputs, a receipt,
and a plain account of what the example does not prove.

## Website rules

Keep the homepage styling and current narrative intact. Put the detailed programme in
the documentation and link it from How it works, Testing, Apps, and the catalog.

Human pages explain why an example exists and what to do next. Generated data pages
carry exact records and evidence. Both must come from the same programme and policy
files so their statuses cannot drift independently.
