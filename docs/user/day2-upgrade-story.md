# The day-2 upgrade story

Installing is one decision. Upgrading is a stream of them, and each one can change your running system. This page is the upgrade path for configuration that came from this catalog, written so that a consumer of flattened bundles, such as the eks-inference stack or an AICR platform recipe, can follow it directly.

The rule underneath everything here: an upgrade is a new artifact at a new digest, never a mutation of an old one. You move by choosing the new artifact, comparing it to what you run, and promoting exact revisions. Published versions stay published, so the path you imported from keeps working and a vanished file can never masquerade as an upgrade signal.

## Before you upgrade, diff the value model

A new chart version changes more than image tags. Values appear, die, or change meaning, and a values file that rendered cleanly last month can silently do something different now.

- Read the recorded walkthrough of a real upgrade: [Upgrade and rollback](./day2-upgrade-rollback.md) takes Redis from 25.5.3 to 27.0.0 in ten steps, including what happens to an edit you made after install.
- The live receipt for that sequence is recorded in the [Redis upgrade proof](../../data/redis-upgrade-app-proof/summary.md): chart 25.5.3 became 27.0.0, Redis 8.6.3 became 8.8.0, and the replica count you chose survived.
- The field-level differ design is in [one differ for dry-run and drift](./cub-scout-diff-design.md). Day-1 dry-run and day-2 drift are the same comparison: desired configuration held as rendered data against what the cluster runs. A re-render at upgrade time is not that comparison, because lookup calls and generated values make re-renders lie.
- The cautionary tale, if you want it in narrative form: [what a Helm upgrade can do to a Friday](./helm-upgrade-crash-example.md).

## Check the control points still hold

Every catalog recipe records its control points: the source lock, the dependency closure, the capability profile, the lifecycle policy. An upgrade replaces the source lock by definition, so the question is whether the other controls carry over. Compare the old and new recipe's control-points ledger before promoting; the traefik entry shows the shape of the record. When a control point changes class between versions, that is a decision for a person, not a merge.

## Watch for immutable fields

Some Kubernetes fields cannot change on a live object. A second release that alters a StatefulSet's selector or volume claim template fails on the server, after your pipeline said everything rendered fine.

- The catalog records cross-version CRD deltas for its serious charts; the kube-prometheus-stack delta receipt (`data/serious-chart-reviews/kps-crd-upgrade-delta-85.3.3-to-86.1.0.yaml`) is the model: schema changes named per CRD before anything touches a cluster.
- The torture suite holds the refusal case: a chart whose every render produces a different immutable selector lands in `refused-nondeterministic-render`, never in silence. See the [torture suite summary](../../data/torture-suite/summary.md).
- When an immutable field must change, the route is versioned replacement, not in-place mutation. The upgrade and rollback simulation receipts (`schemas/upgrade-rollback-receipt.schema.json`) record from-revision, to-revision, both rendered digests, and every conflict found.

## Upgrading flattened bundles

A certified bundle is rendered once, hashed per file, and receipted. Its day-2 story follows from that shape. The [certified bundle spec](../reference/certified-bundle-spec.md) holds the receipt contract; the [flattening-safety verdicts](../../data/flattening-safety/summary.md) hold the lanes.

1. **A new chart version is a new bundle at a new digest.** Nothing republishes in place. Your change detection is digest comparison: hash the fetched files and compare against the receipt's per-file manifest, and note the receipt travels beside the bundle precisely so you do not have to trust a path.
2. **The verdict is per version and per base.** A chart that was safe to flatten at one version can grow a hook or a lookup at the next, and the same version changes lane when its base changes. Karpenter 1.14.0 is flatten-with-routes with its CRDs in the bundle and safe-to-flatten with them managed out of band; the device plugin flips the other way when its node-feature-discovery gate opens. Re-read the verdict on every upgrade, the same way you re-read a diff.
3. **Re-import from the published path, then promote.** Bases are the shared upstream; variants clone from them and carry the links promotion needs. Today a base Space is pinned to the bundle it was installed from: refreshing an existing base from a newer bundle is an open ConfigHub capability (confighubai/confighub#4976), so the current loop is recreate, in order. Replace the bases with the new bundles, recreate variants, publish. The eks-inference plugin enforces the one ordering that matters with its recreate flow: it refuses to delete a base while variants still point at it, because a deleted base orphans its variants permanently, and being out of date is recoverable while being orphaned is not.
4. **Rollback is promotion of an older exact revision.** Releases are immutable digests, so moving back is the same governed operation as moving forward, applied to a revision that already exists.

## For AICR and platform-recipe consumers

An AICR entry is a composition pinned by a digest index: the platform is upgraded by publishing a new index whose members are themselves exact artifacts. The same four rules above apply member by member, and the index digest gives you one comparison for the whole platform. What this catalog adds per member is the evidence: the value-model history, the control-point ledger, the immutable-field deltas, and the flattening-safety verdict that says which members may ship flattened at all.

## What this page does not promise

Convergence on the cluster is observed by delivery receipts, not assumed by this page. And the catalog index today is a version-1 contract: consumers who need a change canary hash the files they fetch, which is honest work we intend to remove rather than a design.
