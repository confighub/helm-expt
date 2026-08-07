# The certified bundle spec

A certified bundle is a config bundle that travels with a receipt. The bundle carries the files a cluster will run. The receipt carries what the bytes cannot say: where they came from, what inputs produced them, what Helm behavior was discharged or lost when they were made, and whether flattening this source is safe at all.

One receipt shape serves every producer. The catalog, Kubara, eks-inference, and the Sveltos example each emit different artifacts today, and the same receipt fits all four. The reference receipts under [data/certified-bundles/](../../data/certified-bundles/summary.md) prove it, including one for a bundle this repository did not build.

## The bundle shape

The bundle format is the one the eks-inference example already publishes. This spec adopts it rather than inventing a competitor.

- The artifact is an OCI manifest of type `application/vnd.confighub.config.bundle.v1` with one gzipped tar layer.
- The tarball is byte-reproducible. Sorted names, zeroed owners, epoch timestamps, and no gzip name field, so unchanged content republishes at the same digest.
- Consumers ingest one Unit per file with `cub variant upload --granularity per-file`, into a base Space no target deploys.
- The resolved digest is recorded on the Space as a `confighub.com/external-source` annotation, so the exact installed bytes stay auditable.

A producer that has not published to OCI yet can still emit a receipt. The catalog's traefik receipt certifies a committed rendered file; the OCI publication step comes later and adds digests to the same receipt shape.

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

## Boundaries

The receipt certifies rendering and packaging, not runtime health. Convergence receipts stay separate. A verdict lane is never overridden by hand, and a bundle without a receipt is just a tarball: strict consumers may refuse it.
