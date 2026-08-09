# The certified bundle spec

A certified bundle is a config bundle that travels with a receipt. The bundle carries the files a cluster will run. The receipt carries what the bytes cannot say: where they came from, what inputs produced them, what Helm behavior was discharged or lost when they were made, and whether flattening this source is safe at all.

One receipt shape serves every producer. The catalog, Kubara, eks-inference, and the Sveltos example each emit different artifacts today, and the same receipt fits all four. The reference receipts under [data/certified-bundles/](../../data/certified-bundles/summary.md) prove it, including one for a bundle this repository did not build.

## The question this answers

Two delivery models coexist in the portfolio. The catalog packages charts render-late: the installer package carries the un-rendered chart with its value model and control points, and the toolchain renders at install time. The eks-inference example packages render-early: CI flattens charts to literal YAML, publishes OCI bundles, and delivery never runs Helm.

Neither wins as a doctrine. **The catalog machinery certifies, the flattened-bundle shape delivers wherever certification allows, and the flattening-safety verdict arbitrates.** Render-late stays the certified route for charts the verdict rejects, chosen by receipt rather than by taste. How a lane is decided is in [deciding-a-flattening-lane.md](./deciding-a-flattening-lane.md); the evidence discipline behind every claim here is rule 10 of [the doctrine](../../tests/doctrine.md).

## The pipeline

Any source — a Helm chart, a Kubara-generated tree, an AICR recipe, ACK custom resources, raw YAML — flows through one shape.

1. **Render or flatten once**, with declared inputs, at build time and never in the delivery path.
2. **Package as a certified bundle**: one OCI artifact per component, a digest-bound index pinning the composition, and this receipt.
3. **Ingest as Units** at per-file granularity, with the bundle digest recorded as an external-source annotation, into a base Space no target deploys.
4. **Vary per target**, then publish governed releases against an immutable digest.
5. **Any reconciler syncs that digest**: Argo per cluster, Sveltos across a labeled fleet, plain kubectl for the minimal path.
6. **Receipts close the loop** where convergence is recorded, which is still outstanding.

## One bundle per chart version and recipe variant

Variants change the rendered output, so a bundle is keyed by chart version **and** recipe variant together: one bundle, one receipt, one verdict per pair. A `crds-enabled` variant changes the CRD-ordering disposition; an `existing-secret` variant removes the generated-secret hazard outright. Each variant installs into its own base Space, and a new variant is always a new bundle rather than a mutation of an existing one.

## What each producer gets

- **The catalog** keeps its machinery and gains a second product: a certified bundle wherever the verdict allows, an installer package where it does not, both receipted.
- **Kubara** already packages per component with a digest index, and adopts this receipt, inheriting the verdict lane for charts inside its umbrella components.
- **eks-inference** keeps its composition and plugin experience and takes catalog-certified inputs in place of private guard scripts. Its CR and literal components take born-flattened receipts.
- **AICR** entries are upstream-validated recipes bundled the same way, with the config-plane boundary stated in every receipt.
- **The Sveltos example** fans the same bundles across a fleet, consuming them exactly as a single cluster does.

## The bundle shape

The bundle format is the one the eks-inference example already publishes. This spec adopts it rather than inventing a competitor.

- The artifact is an OCI manifest of type `application/vnd.confighub.config.bundle.v1` with one gzipped tar layer.
- The tarball is byte-reproducible. Sorted names, zeroed owners, epoch timestamps, and no gzip name field, so unchanged content republishes at the same digest.
- Consumers ingest one Unit per file with `cub variant upload --granularity per-file`, into a base Space no target deploys.
- The resolved digest is recorded on the Space as a `confighub.com/external-source` annotation, so the exact installed bytes stay auditable.

A producer that has not published to OCI yet can still emit a receipt, and publication adds digests to the same receipt shape rather than changing what it claims.

The catalog publishes both products. The installer package stays the render-late route, and a flattened bundle is the render-early one wherever a verdict permits it. `scripts/publish-certified-bundles.mjs` builds the bundle from the three artifact classes the receipt already names, checks it is byte-reproducible by building it twice, pushes it, and records what the registry reported. It also records when it read the manifest, so a publication receipt ages like the rest of the evidence here rather than sitting outside the count. Running it with `--reobserve` reads every published manifest again and records when it looked. That path pushes nothing and needs no credential, and it refuses when the registry stops reporting the digests a receipt claims, because republishing is a decision someone makes rather than something a re-read performs. A chart whose verdict says `do-not-flatten` is refused: publishing a flattened bundle for it would contradict its own verdict, and the installer package is its certified route. Verification pulls the published artifact rather than rebuilding it, because tar implementations differ across platforms and the published bytes are the fact.

## The receipt

Schema: [schemas/certified-bundle-receipt.schema.json](../../schemas/certified-bundle-receipt.schema.json). Kind `CertifiedBundleReceipt`, apiVersion `evidence.confighub.com/v1alpha1`, matching the receipt family Kubara already ships. Reference implementation: `scripts/generate-certified-bundle-receipts.mjs`, deterministic over committed sources, with the standard `--generate` and `--verify` pair.

The receipt records six things.

1. **Source identity.** The chart, component, Unit, or literal file, with exact versions and package hashes. When the generator reads a mirror, a `canonicalHome` block pins the maintained repository, commit, and path.
2. **Render inputs.** Renderer, pinned kube version and api-versions, values reference and hash, hook policy. Literal sources omit this block because nothing renders.
3. **The bundle manifest.** Artifact type, OCI reference and digests where published, and a SHA-256 and byte count for every file. `contentsKind` states what the files are: `rendered-config` and `literal-config` deliver without Helm; `chart-package` and `component-definition` record the render-late lane.
4. **The ingest contract.** Per-file granularity, the Space pattern, the external-source annotation.
5. **Dispositions.** One row per quirk class from the flattening-safety taxonomy: hooks, keep-policy, lookup, webhook CA, capabilities, generated secrets, CRD ordering, immutable fields, namespace creation, subchart conditions, test hooks. Each row states a finding and a disposition. A finding of `not-evaluated` is a recorded gap, never a silent one.

   A row that owes a companion artifact names its kind in `companionRequired`, drawn from the same vocabulary as a route's `routeKind`. The field says the bundle owes prune protection rather than that it owes something, which is what lets the verifier check the debt instead of describing it. Absence means no companion is owed, and that includes the case where the bundle resolves the class inside itself: a chart whose namespace ships in its own bundle has nothing outstanding. Only classes whose evidence settles the question set the field. A webhook CA does not, because an empty `caBundle` filled by a controller travelling in the same bundle looks identical to one nothing will ever fill, and the receipt should not guess between them.
6. **The verdict.** A lane and a status. Lanes: `safe-to-flatten`, `flatten-with-routes`, `do-not-flatten`, and `born-flattened` for sources that never render. Status `provisional` means the lane reflects current evidence and lists its open questions; `certified` means the flattening-safety audit decided it. A lane moves when its receipt changes, never by hand.

## What each producer does with it

- **The catalog** emits a receipt beside each published bundle, drawing dispositions from its recipe evidence.
- **Kubara** keeps its component packaging and digest index and adds the receipt per component. The index format stays Kubara's own; the receipt points at it.
- **eks-inference** keeps its render, guard, and publish pipeline. The receipt replaces the guard's pass-or-fail exit code with per-class findings that travel with the artifact, and the catalog supplies chart-level evidence its pipeline never had.
- **The Sveltos example** attaches born-flattened receipts to its literal profiles; fleets consume certified bundles the same way single clusters do.

## Routes travel inside the bundle

A `flatten-with-routes` verdict names the companion artifacts a bundle must ship. Those are routes, and they travel inside the bundle so the knowledge of how to apply the configuration never depends on whoever happened to flatten the chart.

Schema: [schemas/bundle-route.schema.json](../../schemas/bundle-route.schema.json), kind `BundleRoute`. A route names the quirk class it discharges, states what breaks without it, and carries a declaration rather than a command: it says what must hold, not how one tool achieves it. The `executedBy` block lists the runtimes that can execute it and how each expresses it, and carries `automatic`, which defaults to false and is earned by observation.

The first route is traefik's CRD ordering, at `data/certified-bundles/routes/catalog/traefik-traefik-41.0.2-default/crd-ordering.yaml`. Its verdict requires an ordering declaration for 25 CRDs. The route declares two stages, the definitions first with a wait for establishment and everything else second. The receipt carries it as a bundle file with the role `route: crd-ordering`, and that quirk's disposition points at the file instead of describing an intention. Ordering is declarative and idempotent, so this route is marked automatic. A route that runs a Job is not, and stays manual until observed.

## The Space guide travels too

A bundle carries three things: the rendered configuration, the routes that say how to apply it, and the words an operator needs beside them. Nothing operational or explanatory lives out of band.

Every receipt ships exactly one space guide, written from the receipt itself, so it cannot drift from what the bundle contains. It states what produced the bundle, whether the bundle may ship as plain YAML and who decided that, what its routes owe, and the command that ingested it. A bundle whose lane requires routes and ships none says so in its own guide rather than reading as finished. Strict ingest refuses a bundle with no guide, and one with more than one, because a reader cannot tell which of two governs.

## Boundaries

The receipt certifies rendering and packaging, not runtime health. Convergence receipts stay separate. A verdict lane is never overridden by hand, and a bundle without a receipt is just a tarball: strict consumers may refuse it.

That strict consumer exists. `scripts/verify-certified-bundle.mjs` runs offline over every committed receipt and refuses a malformed structure, a file manifest that does not hash-match the committed bytes it names, a certified lane with no verdict citation, or a lane that disagrees with the verdict it cites. Run it with `npm run certified-bundles:strict`; its self-test proves each refusal fires.

It also checks that routes and dispositions agree. A disposition pointing at a route the bundle does not ship is refused, and so is a route no disposition references, because a route nothing claims is either unused or a disposition that forgot it.

## What the bundle deploys, as opposed to what it is

A receipt hashes every byte of the bundle. Those bytes name container images, and naming is not pinning: `openpolicyagent/gatekeeper:v3.22.2` is whatever that tag points at today. The bundle is fixed and the containers it starts are not, which is the same failure the catalog already records as upstream drift for two charts whose version strings moved under them.

`bundle.images` records every reference the rendered object set names, how each is pinned, and a `boundary` sentence stating plainly which of the two the receipt covers. Across the catalog's bundles today, 37 references are pinned by tag and 3 by digest.

Strict ingest re-derives the list from the bundle's own bytes rather than trusting the receipt, and refuses an image the bundle deploys and the receipt omits, an image the receipt records and the bundle does not deploy, and a reference recorded as digest-pinned that is a tag. The scan reads `image:` keys, which covers containers and initContainers and misses an image named anywhere else; the receipt says so in `scannedFrom` rather than implying completeness.

A route lists the runtimes that can express it, and each says whether it is `proven`. That word means one thing: a runtime was watched executing this route. Expressing the mechanism in principle does not count, and neither does a declaration surviving delivery. A runtime marked `proven` must name the receipt that earned it in `provenBy`, and the verifier refuses the claim if that receipt is not in the repository.

No route is proven today. Eight of them once said otherwise, for Argo CD and in three cases for Flux, with nothing cited. The run that looked closest to the proof, `runs/aicr-cpu-starter-delivery`, states in its own limits that the application controller was held at zero replicas and zero sync operations were observed. The Applications were accepted with their sync waves intact, which proves the ordering survives delivery, not that anything executed it. Every flag is now `false`, and the `provenBy` requirement exists so the claim cannot come back without evidence attached.

A lifecycle route is held to a stricter standard than the rest, because it is the only artifact in the model whose content is a claim about something that happened. Every stage names an evidence file and the hash it had when the route was written, and the verifier re-hashes each one, so a route cannot outlive the observation it cites. A lifecycle route marked `automatic: true` is refused outright: ordering earned automatic because re-applying it changes nothing, and work does not get that by default.

Companion debt is checked per class rather than per bundle. For every row naming a `companionRequired`, the verifier opens each shipped route and reads its `routeKind`, so a mislabelled route cannot satisfy a debt it does not discharge. A certified `flatten-with-routes` bundle missing a companion it names is refused, and the message says which class owes which kind. A row that owes a companion while its own finding is `absent` is refused too, because a class that found nothing cannot owe an artifact.

Provisional bundles get the softer treatment: their outstanding companions are named on every run rather than failing the gate, because unfinished work is not a broken artifact and silence would let it read as finished.

The wording of a disposition is never parsed to infer debt. That was implemented and reverted: it read four bundles as owing namespace creation when their namespace ships inside the bundle, which is a resolution and not a debt. A check that cries wolf teaches readers to skip it, so the requirement is declared as a field or not at all.
