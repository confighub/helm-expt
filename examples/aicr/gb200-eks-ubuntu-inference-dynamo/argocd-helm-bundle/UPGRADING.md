# Before You Upgrade

This bundle was generated for the `argocd-helm` deployer. The steps below apply only
when this bundle is applied over an existing installation of an earlier version.
A fresh install can skip this file.

Each entry covers only the boundary this bundle's pinned version lands in. To
check your exact move, including any earlier boundary you would cross, run
`aicr upgrade-check` against the recipe you deployed from.

## grove: manual

This bundle pins `v0.1.0-alpha.13`. Applies when upgrading from `>=0.1.0-alpha.12 <0.1.0-alpha.13` into `0.1.0-alpha.13`.

alpha.13 adds status.lastScheduled to the podcliques.grove.io CRD, which its PodGang recovery logic reads, and renames the clustertopologybindings.grove.io short name from ct to ctb. helm upgrade never applies changed crds/, and the alpha.12 PodClique status schema is structural, so a plain chart bump keeps the old CRD and the API server silently prunes lastScheduled from every status write.

**Steps for argocd-helm:**

1. `apply-new-crds`: helm show crds oci://ghcr.io/ai-dynamo/grove/grove-charts --version v0.1.0-alpha.13 | sed -n '/^---$/,$p' | kubectl apply --server-side --force-conflicts -f -\
   *Why:* Neither Flux nor Argo CD applies a changed crds/ directory on upgrade, so the CRDs are installed out of band here too.
2. `reconcile`: Reconcile or sync the affected releases as usual.\
   *Why:* The deployer picks the new chart up once the CRDs are Established.

**References:**

- https://github.com/NVIDIA/aicr/blob/main/docs/user/component-catalog.md#grove-v010-alpha12-to-v010-alpha13
- https://github.com/ai-dynamo/grove/releases/tag/v0.1.0-alpha.13
- https://github.com/ai-dynamo/grove/issues/809

## nodewright-operator: manual

This bundle pins `v0.19.0`. Applies when upgrading from `<0.18.0` into `>=0.18.0 <=0.19.0`.

v0.18.0 renames skyhook.nvidia.com/v1alpha1 Skyhook to nodewright.nvidia.com/v1alpha1 NodeWright, moves DeploymentPolicy to the same group, and shifts the on-node annotation, label and finalizer prefix. An operator-side mirror migrates the objects for you, but completion status is then written only on the new kind and the attempt to mirror it back to the legacy object fails in a reconcile conflict loop, so Skyhook.status stays empty forever on a cluster where tuning has genuinely finished. Anything still reading the legacy status waits on a value that never arrives. The legacy object also goes read-only: the post-rename admission webhook rejects any spec, pause or disable change to it, so the first attempt to alter tuning after the upgrade fails rather than the cluster merely reporting the wrong status. Deletions and identical re-applies are still accepted, which is why a steady-state sync keeps working and the break only surfaces on a real edit.

**Before you start:** Every Skyhook is complete with no nodes in progress. Upstream makes this a requirement rather than a recommendation: the migration relabels the operator's package and per-node ConfigMaps so the post-rename operator adopts them instead of recreating them, and that flow assumes no in-flight package work to disrupt. Check with `kubectl get skyhooks.skyhook.nvidia.com -o custom-columns=NAME:.metadata.name,STATUS:.status.status,INPROGRESS:.status.nodesInProgress` and proceed only when nothing is actively rolling out. paused and disabled objects are fine to leave as they are — the mirror carries that state onto the NodeWright — but do not unpause or enable one until its pre-upgrade package pods are gone.

**Reversible:** no.

**Steps for argocd-helm:**

1. `expect-operator-downtime-during-the-hook`: The chart runs a selector-migration pre-upgrade hook that DELETES the operator Deployment before it is recreated, because spec.selector is immutable and the rename changes it. If that hook fails, the sync can stop with the Deployment already gone and no operator running. Re-sync to recover.\
   *Why:* Verified on the helm path, where a hook Job that tripped its deadline left the namespace with zero operator pods and the release in `failed`. The deletion itself is correct: it avoids a release wedged on "Pending termination" when the running operator predates label-based webhook discovery. The hook ships in the chart rather than the deployer, so any path that runs the chart's hooks carries the same gap between delete and recreate; the failure was not reproduced on argocd or flux specifically.
2. `upgrade-operator`: Bump the operator's chart version in its own Application or HelmRelease and sync it, before touching any CR.\
   *Why:* The chart ships both groups' CRDs and RBAC, and the mirror imports each Skyhook into a NodeWright. Per-node state is copied to the nodewright.nvidia.com/* prefix, so packages are not re-run. The new objects are outside the reconciler's inventory at this point, so it neither prunes nor flags them.
3. `rename-crs-in-one-commit`: In a single git commit, remove each Skyhook manifest and add the NodeWright equivalent: apiVersion skyhook.nvidia.com/v1alpha1 becomes nodewright.nvidia.com/v1alpha1, kind Skyhook becomes NodeWright, metadata.name is unchanged. DeploymentPolicy changes apiVersion only. Then sync or reconcile.\
   *Why:* The reconciler adopts the mirror-created NodeWright and prunes the Skyhook in one pass. Leaving both in git opens a window where the mirror and the reconciler both write the NodeWright and a stale Skyhook re-import stomps the git edit; do not reach for kubectl here, since anything applied by hand is reverted on the next reconcile. Rewrite apiVersion and kind only: a blanket substitution also rewrites nodeSelectors and podNonInterruptLabels, which name your labels rather than the operator's, and pointing them at keys nothing carries makes the CR match no node.
4. `verify-migration`: kubectl get nodewrights.nodewright.nvidia.com lists a NodeWright for each former Skyhook, node annotations are present under the nodewright.nvidia.com/ prefix, and no package re-ran.\
   *Why:* Confirms the mirror adopted live lifecycle position rather than handing the new object a fresh rollout.

**References:**

- https://github.com/NVIDIA/nodewright/blob/main/docs/getting-started/migration.md
- https://github.com/NVIDIA/nodewright/blob/main/docs/getting-started/migration.md#prerequisite-all-skyhooks-must-be-complete
- https://github.com/NVIDIA/aicr/blob/main/docs/user/component-catalog.md#nodewright-operator-v0180-renames-skyhook-to-nodewright
- https://github.com/NVIDIA/aicr/issues/2593
- https://github.com/NVIDIA/aicr/issues/2594

## nvsentinel: manual

This bundle pins `v1.25.0`. Applies when upgrading from `>=1.22.0 <1.25.0` into `1.25.0`.

From v1.23.0 metadata-collector, which runs with hostNetwork, serves Prometheus metrics on port 2112 of every GPU node. A node process that already holds 2112, such as kube-vip's metrics endpoint, keeps the port: at v1.25.0 the collector logs "Metrics endpoint stopped; continuing without it" and runs on without metrics, so nothing but that log line shows they are gone. v1.24.0 also dropped preflight.qps and preflight.burst; an override of either still renders and is silently ignored.

**Before you start:** Nothing listens on host port 2112 on any GPU node, or the recipe moves the endpoint first.

**Reversible:** yes. helm rollback to the v1.22.0 revision restores the previous workloads. The v1.25.0 CRDs stay applied; their changes are cosmetic, so v1.22.0 runs against them unchanged. This rests on the CRD diff and on AICR running no NVSentinel datastore; the rollback itself was not exercised.

**Steps for argocd-helm:**

1. `check-host-port`: On every GPU node (kubectl get nodes -l nvidia.com/gpu.present=true), check for a listener on port 2112, for example kubectl debug node/<gpu-node> -it --image=busybox:1.38.0 -- netstat -ltn. If any node has one, set nv-sentinel:metadata-collector.metrics.port to a port free on every GPU node, or nv-sentinel:metadata-collector.metrics.enabled=false, and regenerate the bundle.\
   *Why:* The collector keeps running when the bind fails, so a collision costs that node's metrics without failing any health check, and a clean node says nothing about the others.
2. `drop-preflight-rate-limits`: If the recipe or a --set sets preflight.qps or preflight.burst, remove it. v1.24.0 removed client-side rate limiting from the preflight controller with no replacement; to limit its API load, use API Priority and Fairness on the API server.\
   *Why:* The chart no longer reads either value, so an override renders and silently stops throttling. Upstream removed the limit because preflight sits on the pod admission path, where throttling pushed gang admission past the webhook timeout.
3. `apply`: Re-run install.sh (helm), or commit the regenerated bundle and reconcile or sync it (flux, argocd, argocd-helm).\
   *Why:* These deployers apply the chart's CRDs themselves, then roll the DaemonSets and Deployments to v1.25.0.
4. `verify`: kubectl -n nvsentinel rollout status daemonset/metadata-collector, then check every collector pod's logs for "Metrics endpoint stopped": kubectl -n nvsentinel logs -l app.kubernetes.io/name=metadata-collector --prefix --tail=-1.\
   *Why:* A rolled-out DaemonSet alone does not prove the metrics endpoint bound, and logs of the DaemonSet name show only one pod.

**References:**

- https://github.com/NVIDIA/NVSentinel/releases/tag/v1.23.0
- https://github.com/NVIDIA/NVSentinel/releases/tag/v1.24.0
- https://github.com/NVIDIA/NVSentinel/releases/tag/v1.25.0
- https://github.com/NVIDIA/NVSentinel/blob/v1.25.0/metadata-collector/main.go
- https://github.com/NVIDIA/NVSentinel/pull/1849
