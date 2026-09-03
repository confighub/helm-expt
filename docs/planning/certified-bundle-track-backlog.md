# The certified bundle track backlog

Status: working backlog. It lists what is left, grouped by theme rather than
strict priority, and marks the ones that change how the Catalog and the ConfigHub Workshop work as a whole.

Sizes are rough: S is under a session, M is a session, L is more than one. A
task marked **Workshop-wide** changes a shared surface, so it needs the same
care a doctrine change needs. The evidence discipline every task here inherits
is rule 10 of [the doctrine](../../tests/doctrine.md); the model itself is
[the certified bundle spec](../reference/certified-bundle-spec.md).

The track has a closing record at
[certified-bundle-track-conclusion.md](./certified-bundle-track-conclusion.md),
which says what it proves and what it refuses to claim. This file is the detail
underneath it: the work that is still open.

## Where the track stands

The catalog holds 140 entries. All of them carry an installer-package receipt
and a publication receipt, and 134 carry a flattening witness. On top of that
floor, 90 audited bases across 82 chart versions have a decided lane: 42 safe to
flatten, 32 needing companions, 16 refused.

71 of those bases are published as certified bundles, alongside 14 receipts from
other producers. Between them they carry 45 routes: 34 ordering, 7 prune
protection, 4 lifecycle. Strict ingest admits all 85 receipts and proves 17
distinct refusals against a real one.

The honest gaps are what the themes below address. Roughly forty charts are
still undecided, and the remaining ones are the hard cases rather than the cheap
ones. No route has a proven runtime. Nothing teaches a delivery runtime to read
a route, so a human applies every one of them. And no receipt records
convergence, because the model certifies packaging and not runtime health.

## What has shipped

Numbers are kept so older pull requests still resolve.

- **1.** Lanes for the top-20 charts.
- **2.** Lanes for the charts the examples install.
- **3.** The lane-decision procedure, at docs/reference/deciding-a-flattening-lane.md.
- **8.** CRD ordering routes for the remaining flatten-with-routes bundles.
- **9.** Prune-protection routes for keep-policy; seven bundles ship one.
- **11.** The first lifecycle route built from a live observation, on gatekeeper, then tigera-operator.
- **12.** automatic stays false for anything that runs a Job, enforced rather than stated.
- **16, 31.** companionRequired, so a bundle owes prune protection rather than owing something, and a certified bundle missing a companion it names is refused.
- **18.** The verdict on every chart page.
- **19.** The evidence for undecided charts, which says undecided is not safe.
- **20.** The claim-integrity gate: no page may claim a chart is flattenable without a verdict.
- **27.** The Space guide as the bundle's third artifact class.
- **28.** A published flattened bundle for every base whose lane permits one.
- **33.** What a receipt says about an image digest, and the boundary it does not cover.
- **34.** Weekly byte-drift detection on locked versions.
- **35.** Re-witnessing on a cadence, carried by task 34.

Plus one item no task asked for, which a lesson demanded: `verdict-render-parity:verify`
refuses any verdict calling a class absent that its own render contains. It
exists because a witness sees generated credentials and is blind to a literal
one, and deciding a lane from the witness alone would have published a working
root credential.

## Theme 1: decide lanes where the evidence already sits

4. **Adversarially verify every new lane before it lands.** The first drafting
   pass produced real errors that only a refutation pass caught, including a
   wrong object count and a mis-quoted secret mount path. Keep the pass. S per
   batch.
5. **Record why a chart stays undecided.** An entry with evidence and no lane
   should say what is missing, so the backlog reads from the data instead of
   from memory. S.
6. **Report lane coverage as a number the site can show.** 82 decided chart
   versions against 134 witnessed is a fact worth publishing, and publishing it
   is what keeps the remainder visible. S.
7. **Decide the two first-party Kubara charts.** homer-dashboard and the
   template library carry provisional lanes in that repository because no
   upstream audit covers them. They need a first-party rule. S. **Workshop-wide**,
   because it decides how the model treats charts nobody else publishes.

## Theme 2: extend routes until the lane means something

10. **Observe cert-manager's startupapicheck before routing it.** No
    lifecycle-route action packet exists for it, and emitting a hook route
    without recorded evidence would be inventing one. Run the hook lifecycle
    lane first. M.
13. **Prove a route executes under Argo.** The route declares that Argo can
    express it as sync waves. Nothing has watched it happen, and until recently
    eight routes claimed otherwise. The claim is now gated: `proven` requires a
    `provenBy` receipt that exists, and strict ingest refuses it otherwise. So
    this task is now to produce that receipt rather than to correct a flag. M.
14. **Prove the same route under Flux.** One artifact, three runtimes, is the
    claim. Zero of three are proven today, stated plainly in each route. M.
15. **Prove the same route under the cub-direct applier.** M.

    The nearest existing evidence is worth knowing before anyone starts.
    `runs/oci-hook-delivery-proof` records one OCI bundle consumed by Argo, Flux
    and cub-direct with a routed hook observed running under each, which proves
    the mechanism for a fixture rather than for any shipped route.
    `runs/aicr-cpu-starter-delivery` proves sync waves survive delivery, and
    says in its own limits that no sync ever started. Neither is a substitute
    for watching a shipped route execute.
17. **Teach the delivery runtime to read a route.** Everything above produces
    routes that a human applies. The model claims the runtime executes them. L.
    **Workshop-wide**.

## Theme 3: put the evidence in front of a reader

21. **Add a catalog-wide flattening page.** The evidence view answers "what is
    in these charts" in one table, which is a question a buyer asks before a
    chart page can help them. M.
22. **Show the retained-exact charts on their own pages.** A reader deciding
    whether to install goldilocks should see that its version string moved
    upstream. S.
23. **Explain the lanes in plain words on the site.** The vocabulary is precise
    and unexplained. One page, three lanes, one example each. S.
24. **Link the day-2 upgrade story to the verdicts.** The page tells a reader to
    re-read the verdict on every upgrade, and cannot link to most of them. S.
25. **Show which bundles ship routes.** A route is a product feature, not an
    implementation detail. S.
26. **Publish the component and OCI table on the site.** It exists in the
    repository and answers the question buyers actually ask, which is what is
    ready and where it lives. S.

## Theme 4: finish the bundle

29. **Emit a receipt per published bundle rather than per reference bundle.**
    The framing this task carried was wrong and is corrected here, because it
    read as 120 unreceipted entries. Every catalog entry already carries an
    installer-package receipt and a publication receipt, 140 of each. What the
    older family does not carry is the flattening verdict, the quirk
    dispositions, the routes, and the space guide. So this is a convergence
    question rather than a coverage gap, and it applies only where a bundle is
    actually published. An `unsafe-to-flatten` entry must never carry a
    certified-bundle receipt: producing one would contradict its own verdict,
    which is the lane doing its job. L.
30. **Record the composition index in the receipt.** Kubara pins components with
    a digest index and the receipt only points at it. A composition digest would
    let a consumer verify a platform rather than a component. M.
32. **Add convergence receipts to the model.** The receipt certifies rendering
    and packaging, and says so. What happened on the cluster is a separate
    record that does not exist yet. L. **Workshop-wide**.
## Theme 5: upstream drift and retention

36. **Decide the retention rule for republished bytes.** Two charts are
    retained-exact by decision. The next one should follow a rule rather than a
    conversation. S. **Workshop-wide**.
37. **Recover sealed-secrets or retire it.** Its repository is unreachable, so
    it has no witness and cannot get one. Decide which. S.
38. **Record where a retained artifact can still be fetched.** Retaining bytes
    upstream no longer serves raises the question of where a consumer gets them.
    M.
39. **Check the published installer packages against their receipts.** 135 are
    published and nothing re-verifies that the remote bytes still match. M.
40. **Report retention state per entry.** retained-exact exists in the Kubara
    registry vocabulary and now in the drift lane, and not on the entries
    themselves. S.

## Theme 6: the consumers

41. **Give the eks-inference charts their live lanes.** Their entries have
    offline proof and no kind-parity or hook-lifecycle evidence. L.
42. **Replace their guard with the receipt.** Their pipeline still greps five
    hazard patterns and exits. The receipt now carries per-class findings, so
    the guard can consume it instead. M.
43. **Adopt the route artifact in their pipeline.** They already implement CRD
    ordering as sync waves. Emitting it as a route makes the practice portable.
    M.
44. **Publish their receipts beside their bundles.** The receipts live in this
    repository and describe artifacts in theirs. M. **Workshop-wide**, because it
    decides where a receipt lives.
45. **Re-point the Kubara receipt when the mirror is stripped.** Its
    canonicalHome block already names the maintained repository and commit, so
    the move is a re-point rather than a break. S.
46. **Extend the Kubara adoption to its 1.1 catalog.** Nine components carry
    receipts. The catalog it ships is larger. L.
47. **Give the AICR entries certified-bundle receipts.** They are pinned by
    digest indexes and have no receipts in the shared shape. M.
48. **Reconcile the Kubara release scope constant.** It was scoped by
    subtraction and broke when the catalog grew, and the fix records the scope
    instead of inferring it. S.
49. **Fan a certified bundle across the Sveltos fleet.** The fleet chapters
    deliver a ClusterProfile. Delivering a certified bundle to a labeled fleet
    is the model's fleet claim, unproven. L.
50. **Write the one-page model story.** Five briefs, four producers, and a dozen
    surfaces exist. Nobody can read them in order. M.

## Two things this backlog refuses to do

It does not promise a lane for every chart on a schedule. Deciding a lane is
judgment, and the first drafting pass produced errors that only refutation
caught. Coverage will move in reviewed batches, not by throughput.

It does not treat publication as progress. A bundle without a receipt is a
tarball, and a receipt without a verdict is a description. The order in these
themes is evidence, then decision, then publication, and reversing it would
produce a catalog that claims more than it knows.
