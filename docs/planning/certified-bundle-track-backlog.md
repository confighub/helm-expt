# The certified bundle track backlog

Status: working backlog, written 2026-08-07 after the model's first increments
landed. It lists the next fifty tasks grouped by theme rather than strict
priority, and it marks the ones that change how the Catalog and the Config
Workshop work as a whole, because several of them are not really
certified-bundle tasks at all.

Each task names what to do and why it matters. Sizes are rough: S is under a
session, M is a session, L is more than one. A task marked **Workshop-wide**
changes a shared surface, so it needs the same care a doctrine change needs.

## What exists today

The receipt spec exists and four producers emit against it. The catalog holds
135 entries, and all 135 installer packages are published with receipts. Eleven
certified-bundle receipts describe real bundles, including all eight the
eks-inference example publishes, each cross-checked against that repository's
committed render. A strict consumer refuses malformed, tampered, uncited, or
lane-drifted receipts, and proves each refusal in a self-test.

The flattening lane has evidence for 132 of 135 entries and a decided lane for
12 chart versions across 19 audited bases. One route ships inside a bundle. Two
charts are recorded as retained-exact after upstream republished their version
strings under different bytes. CI refreshes the catalog weekly and gates the
site on every pull request.

The honest gaps are the ones these themes address. Most entries have evidence
but no lane. No chart page shows either. The bundle carries two of its three
promised artifact classes. Nothing yet stops a page claiming a chart is
flattenable without a verdict.

## Theme 1: decide lanes where the evidence already sits

1. **Decide lanes for the top-20 charts.** The evidence view already names
   which of them carry hooks, lookup, keep-policy, or generated credentials, so
   the review has a starting point rather than a blank page. Scope it the way
   the consumer contract scoped assessment coverage. L, and everything in this
   theme depends on it.
2. **Decide lanes for the charts the examples install.** A chart an example
   deploys should not be undecided while the example claims it works. S to M.
3. **Write the lane-decision procedure down.** Today the judgment lives in the
   generator's decision table and in the heads of whoever wrote it. A short
   procedure makes the next fifty decisions cheaper and more consistent. S.
4. **Adversarially verify every new lane before it lands.** The first drafting
   pass produced real errors that only a refutation pass caught, including a
   wrong object count and a mis-quoted secret mount path. Keep the pass. S per
   batch.
5. **Record why a chart stays undecided.** An entry with evidence and no lane
   should say what is missing, so the backlog reads from the data instead of
   from memory. S.
6. **Report lane coverage as a number the site can show.** 12 of 135 is a fact
   worth publishing, and publishing it is what makes it embarrassing enough to
   fix. S.
7. **Decide the two first-party Kubara charts.** homer-dashboard and the
   template library carry provisional lanes in that repository because no
   upstream audit covers them. They need a first-party rule. S. **Workshop-wide**,
   because it decides how the model treats charts nobody else publishes.

## Theme 2: extend routes until the lane means something

8. **Emit the CRD ordering route for the other five flatten-with-routes
   bundles.** external-secrets, the three ACK charts, and karpenter all name the
   same companion. The machinery exists, so this is mechanical. S.
9. **Emit a prune-protection route for keep-policy.** Blocked, and worth
   recording why before someone picks it up. No bundle that exists today has
   keep-policy present, so the route has nothing honest to attach to.
   cert-manager is the natural first case, and giving it a bundle means
   shipping the three routes its verdict names, one of which is the
   startupapicheck lifecycle route that task 10 must observe first. So this
   follows task 10 rather than leading it. M. **Workshop-wide**.
10. **Observe cert-manager's startupapicheck before routing it.** No
    lifecycle-route action packet exists for it, and emitting a hook route
    without recorded evidence would be inventing one. Run the hook lifecycle
    lane first. M.
11. **Emit a lifecycle-job route from an observed hook.** Done, on gatekeeper
    3.22.2 rather than kyverno. Kyverno's lane is do-not-flatten, so it can
    carry no bundle and therefore no route. Gatekeeper had the same quality of
    observation, a chart whose only real hazards are hooks and CRDs, and a
    rendered base to bundle. Its 17 hook objects do not survive flattening, and
    the route's 14 stages are the checks a recorded live run watched instead,
    each citing its evidence file and hash. Strict ingest re-hashes every stage,
    so a route cannot outlive the observation it claims.
12. **Keep automatic false for anything that runs a Job.** Done, and enforced
    rather than stated. A lifecycle route with `automatic: true` is refused, and
    the self-test proves it. Ordering earned automatic because re-applying it
    changes nothing; work does not get that by default.
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
16. **Fail a bundle whose verdict names a route it does not ship.** Done.
    `companionRequired` now sits on the disposition row, drawn from the same
    vocabulary as a route's `routeKind`, and strict ingest reads each shipped
    route's own document to match it. A certified flatten-with-routes bundle
    missing a companion it names is refused and the message says which class
    owes which kind; a row owing a companion while its finding is absent is
    refused too. Provisional bundles are named rather than failed. Only classes
    whose evidence settles the question set the field, so webhook CA stays out:
    a controller travelling in the same bundle fills an empty caBundle that
    looks identical to one nothing will fill. Two self-test refusals cover it.
17. **Teach the delivery runtime to read a route.** Everything above produces
    routes that a human applies. The model claims the runtime executes them. L.
    **Workshop-wide**.

## Theme 3: put the evidence in front of a reader

18. **Render the flattening verdict on each chart page.** Twelve decided lanes
    are invisible to anyone who does not read the repository. M.
19. **Render the evidence for undecided charts.** "No hooks, no lookup, 25 CRDs
    found, lane not yet decided" is more useful than silence and does not
    overclaim. M.
20. **Build the claim-integrity gate the flattening brief asked for.** A page
    may not claim a chart is flattenable without a current verdict receipt. It
    was deferred once and should not be deferred twice. M. **Workshop-wide**.
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

27. **Ship the Space guide README as the third artifact class.** Done. Every
    receipt now ships exactly one guide, written from the receipt so it cannot
    drift from what the bundle contains, and strict ingest refuses a bundle
    without one. **Workshop-wide**.
28. **Publish flattened bundles for the lanes that permit them.** Decided. The
    catalog becomes a two-product thing: the installer package stays the
    render-late route, and a flattened bundle becomes the render-early one
    wherever a verdict permits it. Receipt-per-published-bundle becomes the
    rule. Note the coupling this creates, because it sets the order of work: a
    bundle may only be published for a base whose lane is decided and permits
    flattening, so publication is gated on theme 1. Sixteen audited bases
    qualify today. L. **Workshop-wide**, because it decides what the catalog
    sells.
29. **Emit a receipt per published bundle rather than per reference bundle.**
    The framing this task carried was wrong and is corrected here, because it
    read as 120 unreceipted entries. Every catalog entry already carries an
    installer-package receipt and a publication receipt, 135 of each. What the
    older family does not carry is the flattening verdict, the quirk
    dispositions, the routes, and the space guide. So this is a convergence
    question rather than a coverage gap, and it applies only where a bundle is
    actually published. A `do-not-flatten` entry must never carry a
    certified-bundle receipt: producing one would contradict its own verdict,
    which is the lane doing its job. L.
30. **Record the composition index in the receipt.** Kubara pins components with
    a digest index and the receipt only points at it. A composition digest would
    let a consumer verify a platform rather than a component. M.
31. **Make strict ingest refuse an unshipped route.** It refuses tampering and
    uncited lanes. A missing companion artifact is the same class of defect. S.
32. **Add convergence receipts to the model.** The receipt certifies rendering
    and packaging, and says so. What happened on the cluster is a separate
    record that does not exist yet. L. **Workshop-wide**.
33. **Decide what a receipt says about an image digest.** Charts pin images and
    the image lane tracks 195 subjects, and neither shows up in a bundle
    receipt. M.

## Theme 5: upstream drift and retention

34. **Detect byte drift on locked versions in the weekly job.** Done. The
    weekly job now asks every locked package whether upstream still serves the
    bytes the catalog recorded, and stops when one drifted with no decision in
    the drift lane. The first sweep only caught the two Fairwinds charts
    because no witness existed yet; a re-run would have compared two local
    files and reported nothing. **Workshop-wide**.
35. **Re-witness on a cadence rather than on demand.** Done by task 34, and
    worth stating why rather than leaving it looking open. A witness records
    findings scanned from bytes with a known hash, so it stays true for exactly
    as long as those bytes are what upstream serves. The weekly recheck asks
    that question, which is what keeps every witness honest without rescanning
    anything.
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
