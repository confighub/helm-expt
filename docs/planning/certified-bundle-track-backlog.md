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
9. **Emit a prune-protection route for keep-policy.** cert-manager's verdict
   names it and nothing ships it. The route must say which objects survive a
   prune and how each runtime expresses that. M. **Workshop-wide**.
10. **Observe cert-manager's startupapicheck before routing it.** No
    lifecycle-route action packet exists for it, and emitting a hook route
    without recorded evidence would be inventing one. Run the hook lifecycle
    lane first. M.
11. **Emit a lifecycle-job route from an observed hook.** kyverno and
    kube-prometheus-stack have observed hook evidence and 53 recorded action
    packets between them. Turning one packet into a shipped route is the first
    hook route. M.
12. **Keep automatic false for anything that runs a Job.** Ordering earned
    automatic because it is idempotent. A Job does not, and the discipline only
    survives if it is stated when the first Job route lands. S.
13. **Prove a route executes under Argo.** The route declares that Argo can
    express it as sync waves. Nothing has watched it happen. M.
14. **Prove the same route under Flux.** One artifact, three runtimes, is the
    claim. Two of three are asserted from the declaration alone. M.
15. **Prove the same route under the cub-direct applier.** Its proven flag is
    false today and should either become true or be explained. M.
16. **Fail a bundle whose verdict names a route it does not ship.** The receipt
    can already tell; nothing checks. S. **Workshop-wide**.
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

27. **Ship the Space guide README as the third artifact class.** The model
    promises rendered config, routes, and the Space guide travel together. Two
    of three ship. M. **Workshop-wide**.
28. **Decide whether the catalog publishes certified bundles as bundles.** The
    catalog publishes installer packages. It does not publish certified bundles,
    so its own receipts describe committed files rather than published
    artifacts. M. **Workshop-wide**, because it decides what the catalog sells.
29. **Emit a receipt per published bundle rather than per reference bundle.**
    Four of the eleven receipts are references chosen to prove the spec fits.
    The other 131 catalog entries have none. L.
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

34. **Detect byte drift on locked versions in the weekly job.** It detects
    version movement today. The two Fairwinds charts drifted without moving
    version, and only a manual sweep found them. M. **Workshop-wide**.
35. **Re-witness on a cadence rather than on demand.** A witness is a claim
    about bytes at a moment. Nothing re-checks it. S.
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
