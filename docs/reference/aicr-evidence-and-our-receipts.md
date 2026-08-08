# AICR's evidence, our receipts, and what this project actually adds

Maintained reference, written 2026-08-08. It answers two questions the
composition study raised and left open: how AICR's own evidence machinery
compares with this project's receipts, and whether the catalog's public claims
still hold now that we know what upstream ships.

The short answer is that the overlap is real and the contributions are
different, but some of our wording was written as though upstream had no
evidence discipline at all. That wording is wrong and is corrected here and on
the pages.

## What AICR ships

AICR validates its own recipes against real hardware and emits attestable
evidence about the result.

- **Declarative health checks per component.** `recipes/checks/<component>/health-check.yaml`
  holds a `chainsaw.kyverno.io/v1alpha1` `Test`. The Kube Prometheus Stack
  check asserts that the operator Deployment has an available replica and that
  no pod in the monitoring namespace is unhealthy, with a five-minute assert
  timeout. Twenty-one components carry one at the version we retain.
- **Validation runs that produce evidence.** `aicr validate` runs containerized
  validators against a cluster, and `--emit-attestation` turns the result into
  a recipe-evidence bundle.
- **Offline evidence operations.** `aicr evidence digest` prints the canonical
  digest of a resolved recipe, and `aicr evidence verify` checks a bundle's
  integrity claims. Upstream describes the purpose precisely: it lets
  maintainers and CI verify a recipe contribution without re-running the
  validators against hardware they may not have access to.
- **Per-recipe evidence in the repository.** Current upstream carries an
  `recipes/evidence/` tree with a directory per validated recipe shape.
- **A signed recipe catalog**, verified by this project's own lane.

That last sentence is the important one. A project that emits attested
evidence so third parties can check its claims without the hardware is doing
the same thing this project does, for the same reason.

## What this project ships

The catalog's receipts cover a different span of the same problem.

- **Receipts about configuration operations**, not about component health.
  Ours record that an import was byte-faithful, that a reviewed change touched
  exactly the documents it declared, that a promotion carried the reviewed
  configuration, and that a delivery was accepted with no sync started.
- **Retention and digest pinning across producers.** AICR pins its own recipes.
  The catalog pins AICR beside charts, Kubara components, and Sveltos
  profiles, under one discipline, so a team can ask the same provenance
  question of every piece of its platform.
- **Governance evidence.** Dry-run previews, approvals, variant lineage, and
  promotion history are ConfigHub concerns that AICR does not address and does
  not claim to.
- **Refusals as artifacts.** The blast-radius checker, the credential guard,
  and the signature lane all record what they refuse.

## Where they overlap, and who is authoritative

| Question | Authoritative source | Why |
| --- | --- | --- |
| Is this component healthy on a real cluster | AICR check files and validators | Upstream defines what healthy means per component, and validates on hardware |
| Does this recipe resolve to these components in this order | The recipe, checked by our ordering lane | Upstream computes it; the catalog verifies its bundles preserve it |
| Where does a value such as a storage class land | The AICR component registry | Upstream declares the paths; our control points now cite them |
| Did an import keep the bytes faithful | Catalog receipts | AICR has no view of a governed configuration store |
| Did a reviewed change land where it was declared | Catalog receipts | This is a governance question, not a platform question |
| Is the upstream release genuinely from NVIDIA | Sigstore, checked by either tool | Both verify; the catalog uses an independent verifier deliberately |

The honest division is that AICR answers whether a platform works, and the
catalog answers whether a change to it was governed. Neither is a substitute
for the other, and each is weak where the other is strong. The catalog cannot
tell you that the GPU operator came up healthy on an H100 node. AICR cannot
tell you who approved the storage-class change or what it touched.

## What we were saying that needs correcting

Three claims were written before anyone here read AICR's evidence surface.

1. **"Nobody offers governed, provenance-carrying configuration for this
   space."** The catalog overview says this. It is defensible about
   *governed* configuration, and it is wrong about *provenance-carrying*:
   AICR carries provenance, signs its catalog, and emits attestable evidence.
   The claim is narrowed on the page to the governance half.
2. **The implication that receipts were a novel answer.** The receipts idea is
   good and it is not ours alone. Saying so costs nothing and makes the
   catalog more credible, not less.
3. **"Ordering is a decision the catalog has not earned."** The delivery proof
   said this. The ordering is declared upstream, and the
   [ordering-parity lane](../../data/aicr-ordering-parity/summary.md) now
   proves our bundles preserve it. The controller still stays at zero in that
   proof, which remains right for a config-plane proof, but the reason is that
   the catalog declines to run the sync, not that it lacks a defensible order.

## What this does not change

The retention, the digest spine, the derivation chain, the licensing boundary,
and the governance receipts all stand exactly as they were. Nothing above
weakens a claim that rests on evidence this project produced. What changes is
the framing around them, and framing that overstates is the kind of claim this
project exists to refuse.

## What is still unread

The evidence bundle format itself, the containerized validators, the snapshot
schema, and the `aicrd` daemon. A later increment should read the bundle
format and decide whether a catalog entry can carry an upstream evidence
bundle alongside its own receipts, which would let the two disciplines meet in
one artifact rather than two.
