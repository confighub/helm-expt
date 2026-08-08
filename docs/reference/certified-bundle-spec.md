# The certified bundle spec

A certified bundle is a config bundle that travels with a receipt. The bundle carries the files a cluster will run. The receipt carries what the bytes cannot say: where they came from, what inputs produced them, what Helm behavior was discharged or lost when they were made, and whether flattening this source is safe at all.

One receipt shape serves every producer. The catalog, Kubara, eks-inference, and the Sveltos example each emit different artifacts today, and the same receipt fits all four. The reference receipts under [data/certified-bundles/](../../data/certified-bundles/summary.md) prove it, including one for a bundle this repository did not build.

## The bundle shape

The bundle format is the one the eks-inference example already publishes. This spec adopts it rather than inventing a competitor.

- The artifact is an OCI manifest of type `application/vnd.confighub.config.bundle.v1` with one gzipped tar layer.
- The tarball is byte-reproducible. Sorted names, zeroed owners, epoch timestamps, and no gzip name field, so unchanged content republishes at the same digest.
- Consumers ingest one Unit per file with `cub variant upload --granularity per-file`, into a base Space no target deploys.
- The resolved digest is recorded on the Space as a `confighub.com/external-source` annotation, so the exact installed bytes stay auditable.

A producer that has not published to OCI yet can still emit a receipt, and publication adds digests to the same receipt shape rather than changing what it claims.

The catalog publishes both products. The installer package stays the render-late route, and a flattened bundle is the render-early one wherever a verdict permits it. `scripts/publish-certified-bundles.mjs` builds the bundle from the three artifact classes the receipt already names, checks it is byte-reproducible by building it twice, pushes it, and records what the registry reported. A chart whose verdict says `do-not-flatten` is refused: publishing a flattened bundle for it would contradict its own verdict, and the installer package is its certified route. Verification pulls the published artifact rather than rebuilding it, because tar implementations differ across platforms and the published bytes are the fact.

## The receipt

Schema: [schemas/certified-bundle-receipt.schema.json](../../schemas/certified-bundle-receipt.schema.json). Kind `CertifiedBundleReceipt`, apiVersion `evidence.confighub.com/v1alpha1`, matching the receipt family Kubara already ships. Reference implementation: `scripts/generate-certified-bundle-receipts.mjs`, deterministic over committed sources, with the standard `--generate` and `--verify` pair.

The receipt records six things.

1. **Source identity.** The chart, component, Unit, or literal file, with exact versions and package hashes. When the generator reads a mirror, a `canonicalHome` block pins the maintained repository, commit, and path.
2. **Render inputs.** Renderer, pinned kube version and api-versions, values reference and hash, hook policy. Literal sources omit this block because nothing renders.
3. **The bundle manifest.** Artifact type, OCI reference and digests where published, and a SHA-256 and byte count for every file. `contentsKind` states what the files are: `rendered-config` and `literal-config` deliver without Helm; `chart-package` and `component-definition` record the render-late lane.
4. **The ingest contract.** Per-file granularity, the Space pattern, the external-source annotation.
5. **Dispositions.** One row per quirk class from the flattening-safety taxonomy: hooks, keep-policy, lookup, webhook CA, capabilities, generated secrets, CRD ordering, immutable fields, namespace creation, subchart conditions, test hooks. Each row states a finding and a disposition. A finding of `not-evaluated` is a recorded gap, never a silent one.
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

It also checks that routes and dispositions agree. A disposition pointing at a route the bundle does not ship is refused, and so is a route no disposition references, because a route nothing claims is either unused or a disposition that forgot it. One case is deliberately not a refusal. A certified `flatten-with-routes` bundle that ships no route at all is unfinished work rather than a broken artifact, so the verifier names those bundles on every run instead of failing them. Two carry that state today, both from the eks-inference example, whose pipeline expresses its ordering as Argo sync waves rather than as a route. Silence there would let unfinished work read as finished.
