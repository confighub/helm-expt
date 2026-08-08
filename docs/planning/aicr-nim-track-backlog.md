# The AICR and NIM track backlog

Status: working backlog, written 2026-08-07 after the three entries and their
proof ladders landed. It lists the next fifty tasks in order of theme rather
than strict priority, and it marks the ones that change how the Catalog and
the Config Workshop work as a whole, because several of them are not really
AICR tasks at all.

Each task names what to do and why it matters. Sizes are rough: S is under a
session, M is a session, L is more than one. A task marked **Workshop-wide**
changes a shared surface, so it needs the same care a doctrine change needs.

## What exists today

Three entries exist. The training entry retains AICR v0.14.0, the inference
entry retains the Apache-2.0 nim-deploy KServe subtree, and the CPU starter
derives from the training entry by recorded rules. Each carries a digest-bound
index. The starter has climbed the whole ladder from ConfigHub import through
kind delivery to one reviewed component synced. The inference entry has
climbed import and one reviewed change with promotion. Two gates now guard the
work: the upstream signature verification lane and the blast-radius parity
checker. The NGC and NIM licensing boundary is read, recorded, and enforced in
code.

## Theme 1: finish the version-refresh work the signature lane unblocked

1. **Retain AICR v0.18.0 as a second entry.** Generate the recipe and bundle
   with the pinned release, record the new asset and binary checksums, and
   compile its digest index. S to M, and everything after it in this theme
   depends on it.
2. **Bind the retained bytes to the attested subject digest.** The signature
   receipt currently proves who signed a statement. Turning cosign's claim
   checking on against a retained copy upgrades it to proof about an artifact
   we hold. **Workshop-wide**, because it is the first time any catalog
   artifact is bound to an upstream signature.
3. **Decide whether the CPU starter tracks one retained version or forks.**
   The derivation receipt already names its source version, so the decision is
   a sentence plus a check, not a rebuild. S.
4. **Do the version-scoped naming pass before the second entry lands.** Every
   page says "the training entry" where it means the v0.14.0 one. Fixing this
   after two entries exist is harder than fixing it before. S.
5. **Record what changed between v0.14.0 and v0.18.0 as data, not prose.**
   Component versions moved, recipe resolution got stricter, and deployment
   became parallel. A committed diff record makes the retention story legible.
   M.
6. **Re-read the recipe criteria against the stricter resolver.** v0.18.0
   fails fast when a recipe cannot satisfy declared criteria, and our criteria
   are the ones to test. S.
7. **Refresh the committed sigstore trust root deliberately, with a receipt.**
   It is the one input that ages. Decide the cadence now rather than when it
   expires. S, **Workshop-wide**.

## Theme 2: finish the inference entry's ladder

8. **Prove config-plane delivery of the retained KServe shapes on kind.**
   Install KServe's CRDs, apply the shapes, prove acceptance without any NIM
   image pull. M.
9. **Extend the delivery proof to the NIM Operator shape.** The operator's
   CRDs are the other public surface named in the license read, and they are
   not retained yet. M.
10. **Describe a second model profile as data.** One profile proves the
    pattern; two prove it generalizes across model families. S.
11. **Record the per-artifact governing terms for every retained image
    reference.** Ten gated references exist and one has its terms recorded.
    M, and it is licensing hygiene rather than breadth.
12. **Find a structural editing path so NIM_TELEMETRY_MODE becomes settable.**
    ConfigHub's search-replace substitutes single tokens, so inserting an
    environment entry has no expression today. **Workshop-wide**, because
    every operator-config control point with the same shape is equally stuck.
13. **Prove the model-cache claim rename end to end on a cluster.** The rename
    reached staging in ConfigHub, and nothing has yet created the claim it
    renames. M.

## Theme 3: complete the parity model the Pilot brief describes

14. **Build document-set parity.** Refuse a variant that adds or removes
    documents relative to its base. S to M.
15. **Wire field-level parity to platform shapes.** The per-chart machinery
    exists; the join is the work. M.
16. **Emit refusal receipts.** A refused variant should leave evidence, not
    just an error. **Workshop-wide**, because refusal receipts are how the
    anti-hallucination claim becomes checkable.
17. **Generate one variant on demand and gate it.** This is the first actual
    Pilot generation against a platform shape rather than a chart. L.
18. **Declare the remaining control points for the training entry.** Its four
    open choices are named in prose and not yet in a record. S.
19. **Teach the blast-radius checker locator forms beyond a literal token.**
    A field path would express control points a substring cannot. M.
20. **Check control-point coverage.** Report which control points have no
    reviewed change yet, so gaps stay visible rather than implied. S.

## Theme 4: join AICR to the certified bundle model

21. **Give AICR entries certified-bundle receipts.** The model names AICR as a
    producer, and four producers have receipts while AICR has none. M,
    **Workshop-wide**, and it is the largest single inconsistency in the
    portfolio today.
22. **Assign a flattening verdict to each AICR entry.** The entries ship
    rendered Applications, which is flattened delivery, and no entry has a
    verdict. **Workshop-wide**.
23. **Decide what a flattening verdict means for a platform shape.** Chart
    verdicts answer what breaks when Helm does not run. A platform shape's
    Applications each reference charts, so the verdict is about the referenced
    charts and about the wrapper separately. **Workshop-wide**, and the answer
    changes the audit lane's data model.
24. **Reconcile sync-wave ordering with the routes concept.** The delivery
    proof holds the controller at zero because ordering is unearned. Routes
    are how ordering gets discharged elsewhere. **Workshop-wide**.
25. **Fold the AICR digest indexes into the shared bundle spec.** Two index
    shapes exist now, one for retention and one for derivation, and the shared
    spec should absorb both or explain why not. M, **Workshop-wide**.
26. **Record the parallel-deployment change as evidence about ordering.**
    Upstream moving to dependency-graph parallelism is a fact about whether
    sync waves are the whole story. S.

## Theme 5: the catalog data model has no place for platforms

27. **Decide how platform shapes appear in catalog.json.** The file has keys
    for charts, components, and entries, and no key for platforms. Consumers
    cannot discover the AICR entries at all today. **Workshop-wide**, and it
    is the gate on every publishing task below.
28. **Publish a platform digest per entry in the index.** The consumer
    contract says every value a consumer needs comes from the JSON. The
    platform digest is that value for a platform shape. S, **Workshop-wide**.
29. **Publish paths, never conventions, for platform artifacts.** The contract
    rule is that consumers never reconstruct a path. Platform entries have
    more artifact kinds than charts do. S, **Workshop-wide**.
30. **Extend the consumer contract to say what a platform entry promises.**
    Retention, derivation, and a proof ladder are new promise kinds. M,
    **Workshop-wide**.
31. **Decide whether derived entries are first-class to consumers.** The CPU
    starter is a derivation of another entry, which no chart in the catalog
    is. **Workshop-wide**.
32. **Give platform entries a change feed entry when they move.** Retained
    versions are meant to be stable, so a platform entry changing is exactly
    the event a consumer must not miss. M, **Workshop-wide**.

## Theme 6: surface the work in the Config Workshop

33. **Add the Platforms section to the site.** Three entries exist and the
    site shows none of them. M, and it depends on task 27.
34. **Generate entry pages from the receipts rather than writing them.** The
    entry pages are hand-written today while chart pages are generated, which
    is how chart pages started drifting before the claim-integrity gate. M,
    **Workshop-wide**.
35. **Put AICR entries under the claim-integrity gate.** The gate checks that
    a page's claims match its cited receipts, and the AICR pages are outside
    it. S, **Workshop-wide**.
36. **Write the buyer-facing page for the AI-platform story.** The entries
    prove mechanics; nothing yet explains to a buyer why governed AI-platform
    configuration matters. M.
37. **Add an AICR route to the Examples page.** The page already offers Helm,
    OCI, and YAML starting points. S.
38. **Make the CPU starter a runnable first exercise.** It needs no GPU, no
    cloud account, and no NGC key, which makes it the only AI-platform thing a
    stranger can actually run. M.
39. **Record the AICR pathway in the generated demonstrations status.** That
    document already covers the other pathways. S.

## Theme 7: generalize the licensing and provenance discipline

40. **Promote the credential guard to a shared gate.** The inference compiler
    refuses literal credential values, and every producer should. S,
    **Workshop-wide**.
41. **Write the gated-artifact policy as doctrine.** The license read produced
    rules that are not AICR-specific: reference gated artifacts, never mirror
    them, keep keys as target facts, publish no vendor benchmarks.
    **Workshop-wide**.
42. **Decide the re-read cadence for per-artifact terms.** Recorded terms
    carry a date, and dates age. S, **Workshop-wide**.
43. **Extend signature verification to other upstreams.** The toolchain is not
    AICR-specific, and several catalog charts publish signatures. M,
    **Workshop-wide**, and it would upgrade the whole catalog's provenance
    claim.
44. **Decide what the catalog does with an upstream that stops signing.** A
    provenance claim that silently degrades is worse than none. S,
    **Workshop-wide**.

## Theme 8: keep the evidence honest as it ages

45. **Watch upstream releases and record drift.** AICR ships roughly every two
    weeks, and the retained-versions story only works if the gap is measured
    rather than discovered. M.
46. **Add receipt aging to the freshness surfaces.** Live receipts record a
    date and nothing yet reports how old the evidence is. S, **Workshop-wide**.
47. **Re-run the live proofs on a schedule and record the results.** Proofs
    that ran once are evidence about one day. M.
48. **Audit every AICR claim against its receipt.** The pages grew quickly
    today, and the claim-integrity discipline exists because that is when
    claims drift. S.

## Theme 9: the questions that need a decision, not a task

49. **Decide whether the catalog certifies AI-platform shapes as a product
    line or as evidence.** Everything above assumes the entries are catalog
    content. If they are instead evidence for a broader argument about
    governed configuration, the publishing and consumer-contract tasks change
    shape. **Workshop-wide**, and it should be answered before task 27.
50. **Decide what the Workshop promises about workload behavior.** Every AICR
    receipt states a config-plane boundary, and the honest question is whether
    the Workshop ever crosses it, for any producer, or whether config-plane is
    the permanent and stated edge of what this project claims.
    **Workshop-wide**.

## How these interact

Four tasks gate large parts of the rest. Task 27 gates all publishing, because
consumers cannot see platform entries until the data model has a place for
them. Task 21 gates the certified-bundle join, which is the portfolio's
largest inconsistency. Task 49 gates both, because it decides whether the
entries are product or evidence. Task 2 is the smallest of the four and the
most valuable, because it converts a signature claim about a signer into a
signature claim about bytes the catalog holds.

The tasks marked **Workshop-wide** are the ones worth reviewing together
rather than one at a time. Most of them are not really AICR work. They are
places where AICR pushed on a shared surface and found it had no answer yet,
which is the most useful thing a new entry class can do.
