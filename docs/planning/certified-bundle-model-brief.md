# Brief: the certified bundle model

Status: proposal, 2026-08-07. The umbrella the AICR catalog, Sveltos fleet, flattening-safety, and eks-inference workstreams plug into.

## The question this answers

Two delivery models now coexist in the portfolio. The catalog packages charts render-late: the installer package carries the un-rendered chart with its value model and control points, and ConfigHub's toolchain renders at install time. The eks-inference example packages render-early: CI flattens charts to literal YAML, publishes OCI bundles, and delivery never runs Helm. Which one wins?

Neither, as a doctrine. The answer is a per-component decision made by evidence: **the catalog machinery certifies, the flattened-bundle shape delivers wherever certification allows, and the flattening-safety verdict arbitrates.** Render-late remains the certified route for the charts the verdict rejects, chosen by receipt rather than by taste.

## The pipeline

Any source — a Helm chart, a Kubara-generated tree, an AICR recipe, ACK custom resources, raw YAML — flows through one shape:

1. **Render or flatten once**, with declared inputs (values, api-versions, chart version), at build time, never in the delivery path.
2. **Package as a certified bundle**: one OCI artifact per component, a digest-bound index pinning the whole composition, and a quirk-disposition receipt.
3. **Ingest as Units**: per-file granularity, the bundle digest recorded as an external-source annotation, in a base Space no target ever deploys.
4. **Vary per target**, then publish governed releases: immutable ManifestDigest, approvals on production, promotion of exact revisions, one-target rollback.
5. **Any reconciler syncs the exact digest**: Argo per cluster, Sveltos fanning a labeled fleet, plain kubectl for the minimal path.
6. **Receipts close the loop**: convergence observed and recorded, in the retained receipt discipline.

Every stage exists and is proven somewhere today: the OCI-single-transport doctrine (same bundle through Argo, Flux, kubectl), the Kubara importer (per-component OCI plus digest-bound index), eks-inference (per-file Units, external-source digests, plugin-grade install), the catalog (recipes, dossiers, control points, hook evidence), the Sveltos two-wave proof (fleet fanout of one artifact). The missing piece is only the join: one bundle spec and one receipt spec shared by all producers and consumers.

## The certified bundle, concretely

The OCI artifact holds the rendered files. Beside it, a receipt records: source identity and version; values and render-input digests; one disposition line per quirk class from the flattening-safety verdict (hooks routed where, secrets externalized how, ordering declared, prune protections emitted, api-versions pinned); SHA-256 per file; and the verdict itself. Consumers verify before ingesting; a strict ingest mode refuses un-receipted bundles. The quirk knowledge travels with the artifact instead of living with whoever flattened it.

## The three lanes

- `safe-to-flatten`: bundle ships as-is.
- `flatten-with-routes`: bundle ships with companion artifacts — lifecycle routes executed by the delivery runtime, external Secret references, ordering declarations, prune protections.
- `do-not-flatten`: the render-late installer package remains that chart's certified route. Not deprecated; named.

Components that are not charts — ACK custom resources, Kubara's generated files, literal YAML — are born flattened: they take a certified-bundle receipt with a trivial verdict and skip the chart-quirk table.

## Three artifact classes travel inside the bundle

The bundle carries the rendered configuration files, the route files, and the Space guide, and ingest turns all three into Units:

- **Rendered config** — the literal resources, one Unit per file.
- **Routes** — for the flatten-with-routes lane, declarative YAML emitted at flatten time; the receipt names each route file and the quirk it discharges, and the delivery runtime executes them at apply time.
- **The Space guide** — the per-Space README Unit the catalog already generates and uploads today, so the operator reading the Space in ConfigHub sees what this component is, which variant produced it, and what its routes owe, in context.

Nothing operational or explanatory lives out of band: one artifact carries the configuration, the knowledge of how to apply it, and the words a human needs beside it.

## One bundle per chart version and recipe variant

Catalog recipes already come in variants per chart (default, no-crds, crds-enabled, existing-secret, external-tls-ca), and variants change the rendered output. The certified bundle is therefore keyed by chart version and recipe variant together: one bundle, one receipt, and one verdict per pair, because dispositions genuinely differ per base — a crds-enabled variant changes the CRD-ordering disposition, an existing-secret variant removes the generated-secret hazard entirely. Each variant bundle installs into its own base Space via the component-and-variant space pattern. A new variant is always a new recipe producing a new certified bundle, parity-gated before publication, never a mutation of an existing bundle.

## What each consumer gets

- **The catalog** keeps its machinery and changes its primary product: certified bundles wherever the verdict allows, installer packages where it does not, both receipted.
- **Kubara** already packages generated files per component with a digest index; it adopts the shared receipt spec and inherits the verdict lane for the charts inside its umbrella components.
- **eks-inference** replaces its private bundling and guard scripts with catalog-certified inputs, keeping only its genuine content: the EKS, ACK, and Karpenter composition and the plugin experience. Its chart-sourced components (the ACK controller charts, Karpenter, the GPU runtime) become new catalog entries — roughly four to six — while its CR and literal components take born-flattened receipts.
- **AICR** entries are upstream-validated recipes bundled the same way, with the config-plane boundary stated in every receipt.
- **Sveltos** fans the same certified bundles across a labeled fleet; the fleet chapters consume bundles identically to single-cluster delivery.

## Boundaries

The receipt certifies rendering and packaging, not runtime health; convergence receipts remain separate. GPU workload claims stay out of scope per the AICR brief. The verdict lane must never be overridden by hand: a chart moves lanes when its receipt changes, not when a deadline does.

## First increment

Write the bundle and receipt spec as a schema plus one reference implementation, then re-emit one existing artifact from each producer against it: one catalog chart (traefik), one Kubara component, one eks-inference component, one Sveltos profile. Four receipts proving one spec fits all four producers is the entire point demonstrated.

## What the AICR producer added, 2026-08-08

AICR joined as the fifth producer, and it turned out to be a shape the three
lanes did not previously describe. Recording it here because the answer
generalizes beyond AICR.

**A platform shape's bundle is pointers, not payload.** Each AICR entry ships
a set of rendered Argo CD Application objects. Those objects are flattened
output, produced once by rendering AICR's bundle chart, and they are literal
from then on. But each one points at a chart that Argo CD renders at sync
time. So the bundle contains no flattened chart at all.

That splits the verdict question in two, and both halves have to be answered
separately.

- **The wrapper** is flattened output carrying an ordering declaration that the
  delivery runtime executes. Ordering declarations are what `flatten-with-routes`
  covers, so that is the lane, and the route ships beside the receipt.
- **The components** are not flattened by this bundle, so this bundle cannot
  carry their verdicts. A component chart may be `do-not-flatten` and still
  ship safely inside a platform shape, because the shape defers rendering to
  the runtime rather than flattening it away. Those verdicts remain the chart
  catalog's, read per chart.

The practical rule is that a verdict decides the artifact it describes, and a
platform shape describes a wrapper. Reading a shape's verdict as though it
covered its components would be the exact overreach the audit lane exists to
prevent.

**The ordering is upstream's, which is what makes the route honest.** AICR
computes `deploymentOrder` from the component dependency graph, and the
ordering-parity lane checks that the sync-waves preserve it. The route
declaration is therefore a restatement of an upstream fact rather than an
ordering this project invented, and the route says so in its boundedness.

**The strict ingest gate did its job.** The first attempt asserted the lane in
the receipt and was refused, because a certified lane must cite the verdict
that decided it. That refusal is what forced the platform-shape question to be
answered in an artifact rather than in prose.

