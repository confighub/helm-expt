# Live walk: the GPU Operator's upgrade and delete steps on a throwaway cluster, 2026-10-11

**UNOFFICIAL/EXPERIMENTAL**

This log records one run. The plan for NVIDIA's GPU Operator names a step for
before an upgrade and two steps around a delete. No script on the site runs
them. This walk carried each one out by hand on a new local cluster, moving
from v26.3.3 to v26.7.1 and then deleting the result.

This is a dated record of one run. It is not a Guide. Every line that starts
with `$` is a command that was run, and the text under it is the output it
printed. Times are UTC. A line longer than 220 characters is cut and ends with
`...`.

## Versions and setting

- cub v0.8.7 with the installer plugin, in a home directory that holds no ConfigHub credentials. No account was used.
- kind v0.31.0 with a node at Kubernetes v1.35.0, kubectl client v1.36.0, kustomize v5.8.1, Docker 29.4.0.
- The cluster had one node and no GPUs. It had its own kubeconfig file, so the machine's default kubeconfig was not touched.
- The scratch directory is written `<work>`.
- The two installer packages were pulled by digest. The step files came from the v26.7.1 package, under `prerequisites/gpu-operator-lifecycle/default/`.

## The answer in brief

| Step in the plan | What the walk did | What it saw |
| --- | --- | --- |
| Before an upgrade, move the CRDs to the new version | Applied the four pre-upgrade objects, waited for the Job, deleted them | The Job logged "Successfully applied 6 CRD(s)". Two CRDs moved to generation 2 and `gpuclusters.nvidia.com` was created. |
| Apply the new version | Ran the site's script for v26.7.1 | It applied the package's CRD file, because two of the eight CRDs were still missing, then applied the other objects. The operator image became v26.7.1 and the ClusterPolicy reported `ready`. |
| Before deleting, remove a chart-managed GPUCluster | Applied the pre-delete Job, waited, deleted it | The Job completed in 3 seconds. |
| Delete the base | Deleted every rendered object except the Namespace and the CRDs | All objects went. |
| After deleting, prune node-feature-discovery labels | Applied the four post-delete objects, waited for the Job, deleted them | The node carried 55 `feature.node.kubernetes.io/` labels before the Job and none after it. |

## Install v26.3.3

There is no site script for v26.3.3, so the walk ran by hand what the script
for a newer version does: pull and render the package, create the namespace,
apply the CRDs and wait, then apply the other objects.

```
$ kind create cluster --name cwtest-1011-gpuop --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Thanks for using kind! 😊
NAME                              STATUS   ROLES           AGE   VERSION
cwtest-1011-gpuop-control-plane   Ready    control-plane   20s   v1.35.0
[exit 0 at 06:22:30Z]

$ cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/nvidia-gpu-operator:v26.3.3@sha256:abd8475d6bfeabe88acc2d6a319a04054a9e84046d69926dcee4717674329a8f --base default --work-di ...
Base: default; components: []
Namespace: gpu-operator
Rendered 25 manifest(s) to <work>/nvidia-gpu-operator-v26-3-3-default/out/manifests
Next: cub installer upload --work-dir <work>/nvidia-gpu-operator-v26-3-3-default --space <slug>
[exit 0 at 06:22:32Z]

$ kubectl create namespace gpu-operator
namespace/gpu-operator created
[exit 0 at 06:22:32Z]

$ kubectl apply --server-side -f ./nvidia-gpu-operator-v26-3-3-default/package/prerequisites/target-facts/default-crds.yaml && kubectl wait --for=condition=Established --timeout=120s crd/clusterpolicies.nvidia.com cr ...
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io condition met
[exit 0 at 06:22:33Z]

$ ls ./nvidia-gpu-operator-v26-3-3-default/out/manifests | grep -v "^customresourcedefinition-" | sed "s#^#-f ./nvidia-gpu-operator-v26-3-3-default/out/manifests/#" | xargs kubectl apply | tail -4
Warning: resource namespaces/gpu-operator is missing the kubectl.kubernetes.io/last-applied-configuration annotation which is required by kubectl apply. kubectl apply should only be used on resources created declarat ...
rolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker created
rolebinding.rbac.authorization.k8s.io/gpu-operator created
serviceaccount/gpu-operator created
serviceaccount/node-feature-discovery created
[exit 0 at 06:22:35Z]

$ kubectl -n gpu-operator rollout status deployment/gpu-operator --timeout=300s | tail -1; kubectl get clusterpolicy cluster-policy -o jsonpath="{.status.state}{\"\n\"}"; kubectl get crd -o name | grep -c "nvidia.com ...
deployment "gpu-operator" successfully rolled out
ready
5
nvcr.io/nvidia/gpu-operator:v26.3.3
[exit 0 at 06:23:12Z]
```

Five CRDs exist, the operator runs image v26.3.3 and the ClusterPolicy is
`ready`.

## Run the pre-upgrade step

```
$ cub installer setup --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/nvidia-gpu-operator:v26.7.1@sha256:03fa8aec9221b64cc5c25f3334775338a9f98c0529bad66f12340d124c238b71 --base default --work-di ...
Namespace: gpu-operator
Rendered 28 manifest(s) to <work>/nvidia-gpu-operator-v26-7-1-default/out/manifests
Next: cub installer upload --work-dir <work>/nvidia-gpu-operator-v26-7-1-default --space <slug>
[exit 0 at 06:23:25Z]

$ kubectl get crd -o custom-columns=NAME:.metadata.name,GENERATION:.metadata.generation | grep "nvidia.com\|nfd.k8s-sigs.io"
clusterpolicies.nvidia.com          1
nodefeaturegroups.nfd.k8s-sigs.io   1
nodefeaturerules.nfd.k8s-sigs.io    1
nodefeatures.nfd.k8s-sigs.io        1
nvidiadrivers.nvidia.com            1
[exit 0 at 06:23:26Z]

$ kubectl apply -f ./nvidia-gpu-operator-v26-7-1-default/package/prerequisites/gpu-operator-lifecycle/default/pre-upgrade.yaml
serviceaccount/gpu-operator-upgrade-crd-hook-sa created
clusterrole.rbac.authorization.k8s.io/gpu-operator-upgrade-crd-hook-role created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-upgrade-crd-hook-binding created
job.batch/gpu-operator-upgrade-crd created
[exit 0 at 06:23:34Z]

$ kubectl -n gpu-operator wait --for=condition=complete --timeout=300s job/gpu-operator-upgrade-crd; kubectl -n gpu-operator logs job/gpu-operator-upgrade-crd | tail -12
job.batch/gpu-operator-upgrade-crd condition met
2026/10/11 06:23:57 Creating CRD: gpuclusters.nvidia.com
2026/10/11 06:23:57 Updating CRD: nodefeatures.nfd.k8s-sigs.io
2026/10/11 06:23:57 Updating CRD: nodefeaturegroups.nfd.k8s-sigs.io
2026/10/11 06:23:58 Updating CRD: nodefeaturerules.nfd.k8s-sigs.io
2026/10/11 06:23:58 Waiting for CRD to be ready: clusterpolicies.nvidia.com
2026/10/11 06:23:58 Waiting for CRD to be ready: nvidiadrivers.nvidia.com
2026/10/11 06:23:58 Waiting for CRD to be ready: gpuclusters.nvidia.com
2026/10/11 06:23:58 Waiting for CRD to be ready: nodefeatures.nfd.k8s-sigs.io
2026/10/11 06:23:58 Waiting for CRD to be ready: nodefeaturegroups.nfd.k8s-sigs.io
2026/10/11 06:23:58 Waiting for CRD to be ready: nodefeaturerules.nfd.k8s-sigs.io
2026/10/11 06:23:58 Successfully applied 6 CRD(s)
time="2026-10-11T06:23:58Z" level=info msg="Successfully applied CRDs"
[exit 0 at 06:24:01Z]

$ kubectl get crd -o custom-columns=NAME:.metadata.name,GENERATION:.metadata.generation | grep "nvidia.com\|nfd.k8s-sigs.io"
clusterpolicies.nvidia.com          2
gpuclusters.nvidia.com              1
nodefeaturegroups.nfd.k8s-sigs.io   1
nodefeaturerules.nfd.k8s-sigs.io    1
nodefeatures.nfd.k8s-sigs.io        1
nvidiadrivers.nvidia.com            2
[exit 0 at 06:24:01Z]

$ kubectl delete -f ./nvidia-gpu-operator-v26-7-1-default/package/prerequisites/gpu-operator-lifecycle/default/pre-upgrade.yaml
serviceaccount "gpu-operator-upgrade-crd-hook-sa" deleted from gpu-operator namespace
clusterrole.rbac.authorization.k8s.io "gpu-operator-upgrade-crd-hook-role" deleted
clusterrolebinding.rbac.authorization.k8s.io "gpu-operator-upgrade-crd-hook-binding" deleted
job.batch "gpu-operator-upgrade-crd" deleted from gpu-operator namespace
[exit 0 at 06:24:01Z]
```

The Job moved `clusterpolicies.nvidia.com` and `nvidiadrivers.nvidia.com` to
generation 2 and created `gpuclusters.nvidia.com`. Six CRDs exist after it.

## Apply v26.7.1 with the site's script

```
$ /bin/bash ./try.sh 2>&1 | sed -n "/Ensure the gpu-operator namespace/,\$p"
>> Ensure the gpu-operator namespace exists
namespace/gpu-operator configured

>> Check 8 CRDs included with this package
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/computedomaincliques.resource.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/computedomains.resource.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/gpuclusters.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/computedomaincliques.resource.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/computedomains.resource.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/gpuclusters.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com condition met

>> Apply the rendered objects, except the CRDs already settled above
clusterpolicy.nvidia.com/cluster-policy configured
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc configured
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery configured
clusterrole.rbac.authorization.k8s.io/gpu-operator configured
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc configured
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery configured
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator configured
configmap/gpu-operator-node-feature-discovery-master-conf configured
configmap/gpu-operator-node-feature-discovery-worker-conf configured
daemonset.apps/gpu-operator-node-feature-discovery-worker configured
deployment.apps/gpu-operator-node-feature-discovery-gc configured
deployment.apps/gpu-operator-node-feature-discovery-master configured
deployment.apps/gpu-operator configured
namespace/gpu-operator configured
role.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker configured
role.rbac.authorization.k8s.io/gpu-operator configured
rolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker configured
rolebinding.rbac.authorization.k8s.io/gpu-operator configured
serviceaccount/gpu-operator configured
serviceaccount/node-feature-discovery configured

>> Done. The cluster received the files in ./nvidia-gpu-operator-v26-7-1-default/out. Its CRDs were settled first, from the package.

>> Not run by this script: the pre-upgrade, pre-delete and post-delete steps of this base's plan. The entry page says who runs each one.
[exit 0 at 06:24:18Z]

$ kubectl -n gpu-operator rollout status deployment/gpu-operator --timeout=300s | tail -1; kubectl -n gpu-operator get deploy gpu-operator -o jsonpath="{.spec.template.spec.containers[0].image}{\"\n\"}"; kubectl get  ...
deployment "gpu-operator" successfully rolled out
nvcr.io/nvidia/gpu-operator:v26.7.1
notReady
8
gpu-operator-6f4cbc9d8f-x8wlq                                 1/1   Terminating         0
gpu-operator-7486b8b7d9-h627c                                 1/1   Running             0
gpu-operator-node-feature-discovery-gc-585b876f9c-9zpnc       1/1   Running             0
gpu-operator-node-feature-discovery-gc-d4887b8cf-jdfp6        0/1   ContainerCreating   0
gpu-operator-node-feature-discovery-master-74f7f6fc45-hhmxg   0/1   ContainerCreating   0
gpu-operator-node-feature-discovery-master-7f6684fb45-kbj58   1/1   Running             0
gpu-operator-node-feature-discovery-worker-r4qjd              0/1   ContainerCreating   0
[exit 0 at 06:24:31Z]
```

Two of the eight CRDs the base needs were still missing, so the script applied
the package's whole CRD file and waited for all eight.

## Run the pre-delete step, delete the base, run the post-delete step

```
$ kubectl -n gpu-operator rollout status daemonset/gpu-operator-node-feature-discovery-worker --timeout=300s | tail -1; kubectl -n gpu-operator rollout status deployment/gpu-operator-node-feature-discovery-master --t ...
daemon set "gpu-operator-node-feature-discovery-worker" successfully rolled out
deployment "gpu-operator-node-feature-discovery-master" successfully rolled out
gpu-operator-7486b8b7d9-h627c                                 1/1   Running   0     47s
gpu-operator-node-feature-discovery-gc-d4887b8cf-jdfp6        1/1   Running   0     47s
gpu-operator-node-feature-discovery-master-74f7f6fc45-hhmxg   1/1   Running   0     47s
gpu-operator-node-feature-discovery-worker-r4qjd              1/1   Running   0     47s
55
[exit 0 at 06:25:05Z]

$ kubectl apply -f ./nvidia-gpu-operator-v26-7-1-default/package/prerequisites/gpu-operator-lifecycle/default/pre-delete.yaml && kubectl -n gpu-operator wait --for=condition=complete --timeout=300s job/gpu-operator-c ...
job.batch/gpu-operator-cleanup-gpucluster created
job.batch/gpu-operator-cleanup-gpucluster condition met
time="2026-10-11T06:25:06Z" level=info msg="GPUCluster gpu-cluster deleted"
job.batch "gpu-operator-cleanup-gpucluster" deleted from gpu-operator namespace
[exit 0 at 06:25:09Z]

$ ls ./nvidia-gpu-operator-v26-7-1-default/out/manifests | grep -v "^customresourcedefinition-\|^namespace-" | sed "s#^#-f ./nvidia-gpu-operator-v26-7-1-default/out/manifests/#" | xargs kubectl delete --timeout=180s  ...
role.rbac.authorization.k8s.io "gpu-operator" deleted from gpu-operator namespace
rolebinding.rbac.authorization.k8s.io "gpu-operator-node-feature-discovery-worker" deleted from gpu-operator namespace
rolebinding.rbac.authorization.k8s.io "gpu-operator" deleted from gpu-operator namespace
serviceaccount "gpu-operator" deleted from gpu-operator namespace
serviceaccount "node-feature-discovery" deleted from gpu-operator namespace
pod/gpu-operator-7486b8b7d9-h627c                                 1/1   Running   0     63s
pod/gpu-operator-node-feature-discovery-gc-d4887b8cf-jdfp6        1/1   Running   0     63s
pod/gpu-operator-node-feature-discovery-master-74f7f6fc45-hhmxg   1/1   Running   0     63s
pod/gpu-operator-node-feature-discovery-worker-r4qjd              1/1   Running   0     63s
replicaset.apps/gpu-operator-6f4cbc9d8f                                 0     0     0     2m46s
replicaset.apps/gpu-operator-7486b8b7d9                                 1     1     1     63s
replicaset.apps/gpu-operator-node-feature-discovery-gc-585b876f9c       0     0     0     2m46s
replicaset.apps/gpu-operator-node-feature-discovery-gc-d4887b8cf        1     1     1     63s
[exit 0 at 06:25:21Z]

$ kubectl get node -o json | grep -c "feature.node.kubernetes.io/"
55
[exit 0 at 06:25:21Z]

$ kubectl apply -f ./nvidia-gpu-operator-v26-7-1-default/package/prerequisites/gpu-operator-lifecycle/default/post-delete.yaml && kubectl -n gpu-operator wait --for=condition=complete --timeout=300s job/gpu-operator- ...
serviceaccount/gpu-operator-node-feature-discovery-prune created
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-prune created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-prune created
job.batch/gpu-operator-node-feature-discovery-prune created
job.batch/gpu-operator-node-feature-discovery-prune condition met
	  NodeFeatureNamespaceSelector: null
	ResyncPeriod:
	  Duration: 3600000000000
 >
I1011 06:25:23.400096       1 nfd-master.go:452] "pruning node..." nodeName="cwtest-1011-gpuop-control-plane"
I1011 06:25:23.405430       1 nfd-master.go:1243] "node updated" nodeName="cwtest-1011-gpuop-control-plane"
0
serviceaccount "gpu-operator-node-feature-discovery-prune" deleted from gpu-operator namespace
clusterrole.rbac.authorization.k8s.io "gpu-operator-node-feature-discovery-prune" deleted
clusterrolebinding.rbac.authorization.k8s.io "gpu-operator-node-feature-discovery-prune" deleted
job.batch "gpu-operator-node-feature-discovery-prune" deleted from gpu-operator namespace
[exit 0 at 06:25:25Z]
```

The first look after the delete still lists pods, because it came in the same
second. The next command but one shows the namespace empty.

## The end state, and clean-up

```
$ kubectl -n gpu-operator wait --for=delete pod --all --timeout=120s 2>&1 | tail -1; kubectl -n gpu-operator get all --no-headers 2>&1 | head -3; kubectl get clusterpolicy 2>&1 | head -2; kubectl get crd -o name | gr ...
No resources found in gpu-operator namespace.
No resources found
8
[exit 0 at 06:25:38Z]
```

```
$ kind delete cluster --name cwtest-1011-gpuop --kubeconfig <work>/kubeconfig
Deleted nodes: ["cwtest-1011-gpuop-control-plane"]
```

The eight CRDs were left in place and went with the cluster. No cluster or
container with the walk's name remained, and the checksum of the machine's
default kubeconfig was the same as before the walk.

## What the walk found

1. **The pre-upgrade Job covers six CRDs, and the base has eight.** The Job left out `computedomaincliques.resource.nvidia.com` and `computedomains.resource.nvidia.com`. The package's text for this step says a workflow that applies the base's CRD bundle "does the same work and should skip the Job". The bundle does more than the Job. Anyone who runs only the Job must still apply those two definitions.
2. **The site's script would have skipped the CRDs if all eight had existed.** Here two were missing, so it applied the file. On an upgrade between two versions with the same CRD names, the script as it stood left the older definitions in place and applied the new objects over them. The next section records the fix.
3. **The pre-delete Job logged "GPUCluster gpu-cluster deleted" although the base renders no GPUCluster.** The package's text says the Job does nothing in that case. The Job completed, so the message reads as a no-op reported as a deletion.
4. **Nothing in the plan says to keep the Namespace until the post-delete step has run.** The post-delete objects live in the `gpu-operator` namespace. The walk kept the Namespace and the CRDs out of the delete for that reason.

## The script's CRD check was changed, and tested

After this walk the script generator was changed. When every CRD the package
names already exists, the script now compares them with the package's copy. A
match goes on. A difference stops the script and tells the reader how to let
it apply the package's CRDs.

The change was tested on a second throwaway cluster. The walk applied the
v26.7.1 CRD file and then the v26.3.3 file over it, so that all eight CRDs
existed and two were older than v26.7.1 needs.

```
$ kind create cluster --name cwtest-1011-crds --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -1; kubectl get nodes --no-headers
Have a nice day! 👋
cwtest-1011-crds-control-plane   Ready   control-plane   23s   v1.35.0
[exit 0 at 06:27:34Z]

$ kubectl apply --server-side -f packages/nvidia/gpu-operator/v26.7.1/prerequisites/target-facts/default-crds.yaml | tail -2; kubectl apply --server-side -f packages/nvidia/gpu-operator/v26.3.3/prerequisites/target-f ...
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com serverside-applied
8
[exit 0 at 06:27:34Z]
```

The first run stopped. The exit line below is the pipe's and not the script's.

```
$ /bin/bash ./try.sh 2>&1 | sed -n "/Check 8 CRDs/,\$p"
>> Check 8 CRDs included with this package

>> The CRDs already exist and differ from this package, or another tool owns them
This script does not change CRDs it did not just create.
If this is an upgrade, the objects that follow may need the newer CRDs.
To let this script apply the package's CRDs, re-run with:
  APPLY_CRDS=1 bash try.sh
[exit 0 at 06:27:36Z]
```

The second run set `APPLY_CRDS=1`, applied the package's CRDs and went on to
the end. Lines that end `created`, `configured`, `unchanged` or `condition met`
are filtered out of this run and the next.

```
$ APPLY_CRDS=1 /bin/bash ./try.sh 2>&1 | sed -n "/Check 8 CRDs/,\$p" | grep -v "condition met\|created$\|configured$\|unchanged$"
>> Check 8 CRDs included with this package

>> The existing CRDs differ from this package. APPLY_CRDS=1 is set, so apply the package's CRDs
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/computedomaincliques.resource.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/computedomains.resource.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/gpuclusters.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com serverside-applied

>> Apply the rendered objects, except the CRDs already settled above
clusterpolicy.nvidia.com/cluster-policy created
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc created
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery created
clusterrole.rbac.authorization.k8s.io/gpu-operator created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator created
configmap/gpu-operator-node-feature-discovery-master-conf created
configmap/gpu-operator-node-feature-discovery-worker-conf created
daemonset.apps/gpu-operator-node-feature-discovery-worker created
deployment.apps/gpu-operator-node-feature-discovery-gc created
deployment.apps/gpu-operator-node-feature-discovery-master created
deployment.apps/gpu-operator created
namespace/gpu-operator configured
role.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker created
role.rbac.authorization.k8s.io/gpu-operator created
rolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker created
rolebinding.rbac.authorization.k8s.io/gpu-operator created
serviceaccount/gpu-operator created
serviceaccount/node-feature-discovery created

>> Done. The cluster received the files in ./nvidia-gpu-operator-v26-7-1-default/out. Its CRDs were settled first, from the package.

>> Not run by this script: the pre-upgrade, pre-delete and post-delete steps of this base's plan. The entry page says who runs each one.
[exit 0 at 06:27:40Z]
```

The third run found the CRDs matching and left them alone.

```
$ /bin/bash ./try.sh 2>&1 | sed -n "/Check 8 CRDs/,\$p" | grep -v "condition met\|created$\|configured$\|unchanged$"
>> Check 8 CRDs included with this package

>> The required CRDs already exist and match this package; leave them under their current owner

>> Apply the rendered objects, except the CRDs already settled above
daemonset.apps/gpu-operator-node-feature-discovery-worker configured
deployment.apps/gpu-operator-node-feature-discovery-gc configured
deployment.apps/gpu-operator-node-feature-discovery-master configured
deployment.apps/gpu-operator configured
namespace/gpu-operator configured

>> Done. The cluster received the files in ./nvidia-gpu-operator-v26-7-1-default/out. Its CRDs were settled first, from the package.

>> Not run by this script: the pre-upgrade, pre-delete and post-delete steps of this base's plan. The entry page says who runs each one.
[exit 0 at 06:27:46Z]
```

The second cluster was deleted in the same way as the first.

## What the walk did not cover

- No GPU. No driver, toolkit or device-plugin workload ran, so the walk says nothing about what an upgrade does to a GPU node.
- One run, on one machine, with one node.
- The upgrade was v26.3.3 to v26.7.1 of the `default` base only.
- The steps were carried out by hand. Argo CD and Flux were not used, and no script on the site runs the upgrade or delete steps.
- No rollback was run.
- The CRDs were not deleted as a step of their own.
