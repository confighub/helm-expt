# The AICR and NIM track backlog

Status: working backlog, written 2026-08-07 after the three entries and their
proof ladders landed. It lists the next fifty tasks in order of theme rather
than strict priority, and it marks the ones that change how the Catalog and
the ConfigHub Workshop work as a whole, because several of them are not really
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

14. **Done 2026-08-21: build document-set parity.** The platform-variant gate
    refuses additions, removals, and identity changes relative to the base.
15. **Done 2026-08-21 for structured control points: wire field-level parity
    to platform shapes.** A `path` or `valuesPath` identifies the one field a
    request may change. Text-token control points remain ineligible until they
    are upgraded to a structured path.
16. **Done 2026-08-21: emit refusal receipts.** The over-broad fixture leaves
    a receipt naming its unrequested namespace edit, but no candidate file.
17. **Done 2026-08-21: generate one variant on demand and gate it.** The CPU
    starter request changes Prometheus storage from `gp3` to `standard`; the
    gate writes the complete seven-Application candidate only after its
    document set, blast radius, and exact field all pass.
18. **Declare the remaining control points for the training entry.** Its four
    open choices are named in prose and not yet in a record. S.
19. **Teach the blast-radius checker locator forms beyond a literal token.**
    A field path would express control points a substring cannot. M.
20. **Check control-point coverage.** Report which control points have no
    reviewed change yet, so gaps stay visible rather than implied. S.

## Theme 4: join AICR to the certified bundle model

21. **Done 2026-08-08**, along with 22 and 23. AICR is the fifth producer;
    four receipts, three platform-shape flattening verdicts, and three
    ordering routes are emitted by the shared generator and admitted by the
    strict ingest gate. The original framing follows.

    **Give AICR entries certified-bundle receipts.** The model names AICR as a
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

27. **Done 2026-08-08.** Published under `platformEvidence` in
    `site/catalog.json`, generated from committed digest indexes and receipts
    by `npm run aicr-platform-evidence:generate`. The record carries the
    evidence contract, each entry's platform digest, every path a consumer
    needs, the ladder rungs that have receipts, and the rungs no entry has
    climbed. The original framing follows.

    **Decide how platform shapes appear in catalog.json.** The file has keys
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

## Theme 6: surface the work in the ConfigHub Workshop

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

49. **Decided 2026-08-08: evidence, not a product line.** The entries record
    what was proven about governing AI-platform configuration. Nobody is meant
    to install one from the catalog the way they install a chart, and no
    support posture attaches to them. Task 27 was built to that decision, and
    the record carries it machine-readably in its `contract` block. The
    original framing follows.

    **Decide whether the catalog certifies AI-platform shapes as a product
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

## Tasks the composition study added, 2026-08-07

Reading AICR properly, and running the pinned binary, turned up work the
original fifty did not contain. These are numbered from 51 so the earlier list
keeps its references.

51. **Decide whether to retain the AICR-native NIM recipe.** `platform: nim`
    exists at the retained version and produces seventeen components including
    the NIM operator. The catalog retains a different NVIDIA source. Either
    retain both and say why, or switch. **Workshop-wide**, because it is the
    first time two credible upstream sources compete for one entry.
52. **Derive control points from `aicr query` instead of hand-writing them.**
    AICR resolves dot-path selectors against the hydrated recipe, which is the
    machine-readable form of what the control-point records declare by hand.
    **Workshop-wide**, because it changes where control-point truth lives.
53. **Compare AICR evidence bundles with catalog receipts.** `aicr evidence`
    operates on recipe-evidence v1 bundles from `aicr validate
    --emit-attestation`, for the same reason this project emits receipts.
    **Workshop-wide**, and it may change how the catalog describes its own
    contribution.
54. **Cite the upstream `deploymentOrder` in the delivery proof.** The proof
    holds the controller at zero because ordering was treated as unearned, and
    the recipe declares the order explicitly.
55. **Compare `aicr trust` with the committed trust root decision.** Upstream
    ships trusted-root management; the decision record should say why the
    catalog pins its own. **Workshop-wide**. Compared at v0.20.0 in the
    [reference](../reference/aicr-evidence-and-our-receipts.md#trust-authenticated-acquisition-and-reviewed-retention); TUF acquisition remains a follow-up.
56. **Compare `aicr mirror` with the remote dependency closure work.** Both
    address different scopes: upstream discovers recipe chart/image references;
    our report joins retained chart dependency locks. **Workshop-wide**. See
    the [comparison](../reference/aicr-evidence-and-our-receipts.md#mirror-discovery-is-different-from-retained-dependency-closure).
57. **Compare `aicr snapshot` and `aicr diff` with the reverse-reconcile and
    cub-scout designs.** Upstream already detects drift against a recipe.
    **Workshop-wide**.
58. **Look at `aicr skill`, which writes an agent skill file for the CLI.**
    The catalog maps chart facts to thematic playbooks. The scopes differ;
    the [comparison](../reference/aicr-evidence-and-our-receipts.md#skill-cli-syntax-versus-chart-specific-operating-guidance) records an offline stdout run.
    **Workshop-wide**.
59. **Study the parts this increment skipped.** The `aicrd` daemon, the
    containerized validators, the evidence bundle format, the snapshot schema,
    and the validation dashboard were all left unread.
60. **Re-check the catalog's stated contribution against upstream's.** The
    public pages should not imply this project invented provenance for a
    project that ships its own attestation chain. **Workshop-wide**.

## Progress, 2026-08-08

Done and merged: 51 (the AICR-native NIM entry, retained beside the KServe
one), 52 (control points derived from the upstream registry), 54 (the
ordering-parity lane, which retires the unearned-ordering caveat), and 53 with
60 together in
[AICR's evidence and our receipts](../reference/aicr-evidence-and-our-receipts.md),
which also corrected three public claims.

Also merged since: 49 (the blast-radius parity checker), 27 (the entries
published as evidence in the catalog index), 21, 22 and 23 (the join to the
certified bundle model), 8 (the inference delivery proof on kind), 2 (the
attested subject bound to bytes this repository holds), 16 and 14 together as
[the refusal corpus](../demo/aicr/refusal-corpus.md), and 48 as
[the claim-integrity lane](../demo/aicr/claim-integrity.md).

Two things are worth carrying forward from those. Writing the refusal corpus
showed that retained-byte parity misses exactly the changes that are
internally consistent, which is the case a checksum cannot see. Writing the
claim register found two undeclared counted claims and one stale sentence on
the overview page, which is the argument for the gate rather than a curated
list.

Theme 1 then landed. Task 4 was done first, as the brief advised, followed by
tasks 1, 5 and 6 together in the v0.18.0 retained entry: the entry itself, the
version difference recorded as computed data, and the answer to whether the
stricter resolver changes what our criteria resolve to, which it does not.

That entry produced the most useful finding of the day. Upstream's move to
parallel deployment broke two of our checks, and both were wrong rather than
upstream. A rule that only understood total orders would have refused an entry
for doing what upstream now intends, so the ordering claim is now checked
against the recipe's dependency edges instead. That lesson generalises beyond
AICR: a parity check should verify the property, not the shape the property
happened to take in the version it was written against.

Task 40 is done, and it belongs to no theme's schedule because it was the
easiest workshop-wide win available. The credential guard the AICR inference
compiler has carried since the license read now applies to every producer:
[the credential boundary](../../data/credential-boundary/summary.md) walks
every committed YAML document structurally and refuses a literal value assigned
to a credential-shaped environment variable. Scanning 9958 documents found
eight distinct shapes, all of them declared with reasons rather than silenced,
and the lane refuses an exception that stops matching anything. The two worth
reading are a key that looks leaked and is the finding a review demonstrates
catching, and Vault's own dev-mode token in a base named dev-mode.

Tasks 41, 42 and 11 are done together, because they turned out to be one
piece of work. The gated-artifact rules are
[doctrine](../../tests/doctrine.md) now rather than a decision inside one
planning note, every gated reference the retained configuration names is
enumerated in a register with a lane refusing both an unlisted reference and a
listing nothing names, and the re-read cadence is keyed to the reference
instead of a calendar, so a version bump forces a fresh read while a passing
date cannot.

Nine of the ten references still have no per-artifact terms recorded. The
reason is published: those NGC catalog pages are served behind bot detection,
and reading them automatically would mean working around it. Measuring the gap
was the honest option, and it leaves task 11 open as a reading job for a person
rather than a lane nobody can build.

Theme 3 moved too. Tasks 18 and 20 turned out to be already satisfied: the
training entry's four choices are three declared control points plus one
recorded gap, and the coverage section names which points have no reviewed
change. Task 19 is done. The blast-radius checker now locates a control point
three ways, and which form fits is a property of where the value lives rather
than a preference. A token is a substring, a path resolves through the parsed
document, and a valuesPath resolves inside the Helm values these Applications
carry as an embedded YAML string, which is where most platform choices actually
live. The v0.18.0 entry's record uses the precise forms and exists partly to
prove them on real bytes. The checker also reads every record in its directory
now instead of a list, so a new entry's record cannot be added and never read.

Tasks 14 through 17 are done as a single platform-variant proof. The accepted
CPU starter request changes one structured Helm-values field and emits a full
candidate plus receipt. The over-broad fixture adds a valid-looking namespace
edit and is refused at exact-field parity, while self-tests also refuse object
identity changes and changes to the wrong Application. This is deliberately
not a claim that every control point can be edited safely: a text-token locator
must first become a structured path.

Tasks 43 and 44 are done, and the answer to 43 is a number nobody had. The
AICR track proved a provenance chain end to end, so the obvious question was
how far it could reach.
[The survey](../../data/upstream-provenance/summary.md) asks once per retained
chart whether its publisher ships a Helm provenance file: 33 of 139 do, which
is 24% of the catalog and the ceiling on any provenance claim by that
mechanism. Twenty-one more are bitnami charts whose index now points at OCI
rather than a tarball, so the convention does not reach them at all, which ties
the provenance story to the repricing migration already recorded elsewhere.

Building it was a lesson in not shipping a plausible number. The first run said
3%, because the index scan was reading each entry's sources URL rather than its
tarball URL, and a survey that answers the right question about the wrong file
looks exactly like a survey. Two more defects followed: relative index URLs and
a 403 counted as evidence of absence. The published number is the fourth one.

Task 44 is the policy half and it is doctrine now. A provenance claim may not
degrade silently, so each run compares its answers against the previous
snapshot and records every chart whose verdict moved. An unanswered question is
recorded as unknown, never as unsigned.

Theme 1 is now closed. Task 3 is decided: the CPU starter tracks the one
retained version it derives from and does not follow a newer one, because every
proof it holds was produced from those bytes. The decision is in its derivation
receipt and the compiler refuses when that version disagrees with the naming
register, so repointing the starter means moving both together.

Task 7 is decided too, and the interesting part is that the expected shape was
wrong. The trust root has no expiry to count down to: every active entry
carries a start date and no end date, and the two that ended did so years ago
and are kept so older signatures still verify. The trigger is drift, so the
lane compares the committed trust root against the one sigstore publishes,
records the result either way, and refuses offline when the committed file
changes without a review. At the first review the two were byte-identical.

Task 45 is done. The
[upstream watch](../../data/aicr-upstream-watch/summary.md) takes a committed
snapshot of the release list and measures every retained version against it,
offline after the fetch. It reports zero gap today, because the catalog's
newest retained version is upstream's newest release, which is a fact with a
date on it rather than a state. It also computes the release cadence, which
turned up a small lesson: the median across every tag is one day, because the
project publishes several tags together, so the measurement covers minor
releases only and says so. A number that looked wrong was worth chasing rather
than shipping.

Task 46 is done too, and it left the workshop with a number nobody had. Every
proof here writes a receipt, and a receipt is a claim about one moment, but
nothing reported how old any of it was. Measuring found 1628 committed
receipts, and 530 of them record no date in any form, so their evidence cannot
be aged at all. That is a stronger problem than being old and it was invisible
until someone counted. The
[aging surface](../../data/receipt-aging/summary.md) publishes the spread and
ratchets the undated count rather than failing on it, because a red build over
530 files written by other work would either block everyone or get
suppressed.

## The track is concluded, 2026-08-09

[The closing record](./aicr-track-conclusion.md) says what the track built,
what it proves, what it refuses to claim, and what is deliberately left. This
backlog stays as the task-level history behind it, including what each
increment found while doing the work.

Roughly two thirds of the tasks here are done. What remains is real work rather
than tidying, and the conclusion groups it three ways: surfacing the evidence on
the site, deeper parity with the first Pilot generation gated by it, and the
three AICR CLI comparisons nobody has made. Two items stay open with reasons
instead of dates: nine gated references need a person to read their catalog
pages, and NIM_TELEMETRY_MODE needs a structural editing path that does not
exist yet.
