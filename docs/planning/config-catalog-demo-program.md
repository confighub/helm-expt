# Config catalog demonstration programme

This plan turns the current Helm catalog into the first part of a wider configuration
catalog. It keeps the Helm work concrete while adding AICR, fleet placement, policy,
promotion, and ConfigHub App examples in a controlled order.

The maintained status is generated from
[config-catalog/program.yaml](../../config-catalog/program.yaml). This file explains the
sequence and the acceptance criteria.

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
3. RBAC Review App, extending the current read-only scan into a reviewed correction.
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
