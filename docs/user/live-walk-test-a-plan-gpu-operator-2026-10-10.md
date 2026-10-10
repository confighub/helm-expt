# Live walk: test the GPU Operator's plan on a throwaway cluster, 2026-10-10

**UNOFFICIAL/EXPERIMENTAL**

This log records one run. It took the script the site ships for one Catalog
base, NVIDIA's GPU Operator v26.7.1 `default`, and ran it against a new local
cluster. The script carries out the install part of the base's plan: it creates
the namespace, applies the CRDs first and waits for each, then applies the
rest.

This is a dated record of one run. It is not a Guide. Every line that starts
with `$` is a command that was run, and the text under it is the output it
printed. Times are UTC.

## Versions and setting

- cub v0.8.7 with the installer plugin, in a home directory that holds no ConfigHub credentials. No account was used.
- kind v0.31.0 with a node at Kubernetes v1.35.0, kubectl client v1.36.0, kustomize v5.8.1, Docker 29.4.0.
- The cluster had one node and no GPUs.
- The script was fetched from the live site and is byte-for-byte the file at `site/sh/nvidia-gpu-operator-v26-7-1/default/try.sh` in this repository.
- The scratch directory is written `<work>`. The cluster had its own kubeconfig file there, so the machine's default kubeconfig was not touched.

## The answer in brief

The script ran from start to finish in 8 seconds and exited 0. All eight CRDs
were established before any other object was applied. The operator and the
three node-feature-discovery workloads were running 47 seconds after the
script ended. The ClusterPolicy reported `ready`. The operator created none of
its GPU DaemonSets, because the cluster had no GPU nodes.

## Make the cluster

```
$ kind create cluster --name cwtest-1010-gpuop --kubeconfig <work>/kubeconfig --wait 120s
$ kubectl get nodes
started 2026-10-10T20:34:36Z

kubectl cluster-info --context kind-cwtest-1010-gpuop --kubeconfig <work>/kubeconfig

Thanks for using kind! 😊
NAME                              STATUS   ROLES           AGE   VERSION
cwtest-1010-gpuop-control-plane   Ready    control-plane   22s   v1.35.0
```

## Fetch the script and run it

```
$ curl -s -o try.sh https://confighub.github.io/helm-expt/site/sh/nvidia-gpu-operator-v26-7-1/default/try.sh
$ bash ./try.sh
started 2026-10-10T20:35:11Z

>> Pull the package and render the default base variant into ./nvidia-gpu-operator-v26-7-1-default
Wizard wrote <work>/nvidia-gpu-operator-v26-7-1-default/out/spec/selection.yaml and inputs.yaml
Collector produced 2 fact(s) in <work>/nvidia-gpu-operator-v26-7-1-default/out/spec/facts.yaml
Base: default; components: []
Namespace: gpu-operator
Rendered 28 manifest(s) to <work>/nvidia-gpu-operator-v26-7-1-default/out/manifests
Next: cub installer upload --work-dir <work>/nvidia-gpu-operator-v26-7-1-default --space <slug>

>> Read what was rendered; nothing has touched the cluster yet
clusterpolicy-cluster-policy.yaml
clusterrole-gpu-operator-node-feature-discovery-gc.yaml
clusterrole-gpu-operator-node-feature-discovery.yaml
clusterrole-gpu-operator.yaml
clusterrolebinding-gpu-operator-node-feature-discovery-gc.yaml
clusterrolebinding-gpu-operator-node-feature-discovery.yaml
clusterrolebinding-gpu-operator.yaml
configmap-gpu-operator-gpu-operator-node-feature-discovery-master-conf.yaml
configmap-gpu-operator-gpu-operator-node-feature-discovery-worker-conf.yaml
customresourcedefinition-clusterpolicies-nvidia-com.yaml
customresourcedefinition-computedomaincliques-resource-nvidia-com.yaml
customresourcedefinition-computedomains-resource-nvidia-com.yaml
customresourcedefinition-gpuclusters-nvidia-com.yaml
customresourcedefinition-nodefeaturegroups-nfd-k8s-sigs-io.yaml
customresourcedefinition-nodefeaturerules-nfd-k8s-sigs-io.yaml
customresourcedefinition-nodefeatures-nfd-k8s-sigs-io.yaml
customresourcedefinition-nvidiadrivers-nvidia-com.yaml
daemonset-gpu-operator-gpu-operator-node-feature-discovery-worker.yaml
deployment-gpu-operator-gpu-operator-node-feature-discovery-gc.yaml
deployment-gpu-operator-gpu-operator-node-feature-discovery-master.yaml
deployment-gpu-operator-gpu-operator.yaml
namespace-gpu-operator.yaml
role-gpu-operator-gpu-operator-node-feature-discovery-worker.yaml
role-gpu-operator-gpu-operator.yaml
rolebinding-gpu-operator-gpu-operator-node-feature-discovery-worker.yaml
rolebinding-gpu-operator-gpu-operator.yaml
serviceaccount-gpu-operator-gpu-operator.yaml
serviceaccount-gpu-operator-node-feature-discovery.yaml

>> Ensure the gpu-operator namespace exists
namespace/gpu-operator created

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

>> Apply the rendered objects
clusterpolicy.nvidia.com/cluster-policy created
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc created
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery created
clusterrole.rbac.authorization.k8s.io/gpu-operator created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator created
configmap/gpu-operator-node-feature-discovery-master-conf created
configmap/gpu-operator-node-feature-discovery-worker-conf created
Warning: resource customresourcedefinitions/clusterpolicies.nvidia.com is missing the kubectl.kubernetes.io/last-applied-configuration annotation which is required by kubectl apply. kubectl apply should only be used on resources created declaratively by either kubectl create --save-config or kubectl apply. The missing annotation will be patched automatically.
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com configured
... (7 more warnings of the same kind cut, one for each of the other CRDs)
customresourcedefinition.apiextensions.k8s.io/computedomaincliques.resource.nvidia.com configured
customresourcedefinition.apiextensions.k8s.io/computedomains.resource.nvidia.com configured
customresourcedefinition.apiextensions.k8s.io/gpuclusters.nvidia.com configured
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io configured
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io configured
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io configured
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com configured
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

>> Done. The cluster received exactly the files in ./nvidia-gpu-operator-v26-7-1-default/out, with the packaged lifecycle steps checked.
[exit 0]
finished 2026-10-10T20:35:19Z
```

## Watch what the cluster did

```
started 2026-10-10T20:35:29Z
$ kubectl -n gpu-operator rollout status deployment/gpu-operator --timeout=300s
Waiting for deployment "gpu-operator" rollout to finish: 0 of 1 updated replicas are available...
deployment "gpu-operator" successfully rolled out
$ kubectl -n gpu-operator get deploy,ds
NAME                                                         READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/gpu-operator                                 1/1     1            1           34s
deployment.apps/gpu-operator-node-feature-discovery-gc       0/1     1            0           35s
deployment.apps/gpu-operator-node-feature-discovery-master   0/1     1            0           35s

NAME                                                        DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
daemonset.apps/gpu-operator-node-feature-discovery-worker   1         1         0       1            0           <none>          35s
$ kubectl get clusterpolicy cluster-policy -o jsonpath=...
ready  Ready=True(NFDLabelsMissing) Error=False(Ready) 
$ kubectl get crd | grep -c nvidia.com\|nfd
8
$ kubectl -n gpu-operator get pods
NAME                                                          READY   STATUS              RESTARTS   AGE
gpu-operator-7486b8b7d9-wwwrm                                 1/1     Running             0          34s
gpu-operator-node-feature-discovery-gc-d4887b8cf-rg8kq        0/1     ContainerCreating   0          34s
gpu-operator-node-feature-discovery-master-74f7f6fc45-579t6   0/1     ContainerCreating   0          34s
gpu-operator-node-feature-discovery-worker-4b6pf              0/1     ContainerCreating   0          34s
deployment "gpu-operator-node-feature-discovery-master" successfully rolled out
daemon set "gpu-operator-node-feature-discovery-worker" successfully rolled out
$ kubectl -n gpu-operator get pods
NAME                                                          READY   STATUS    RESTARTS   AGE
gpu-operator-7486b8b7d9-wwwrm                                 1/1     Running   0          47s
gpu-operator-node-feature-discovery-gc-d4887b8cf-rg8kq        1/1     Running   0          47s
gpu-operator-node-feature-discovery-master-74f7f6fc45-579t6   1/1     Running   0          47s
gpu-operator-node-feature-discovery-worker-4b6pf              1/1     Running   0          47s
$ clusterpolicy
ready  Ready=True(NFDLabelsMissing) Error=False(Ready) 
$ kubectl -n gpu-operator get ds
NAME                                         DESIRED   CURRENT   READY   UP-TO-DATE   AVAILABLE   NODE SELECTOR   AGE
gpu-operator-node-feature-discovery-worker   1         1         1       1            1           <none>          48s
observed 2026-10-10T20:36:06Z
```

The first look came 10 seconds after the script ended, while three images were
still being pulled. The second look shows all four pods running.

## What went wrong in the first run

1. **The script applies the CRDs twice.** It first applies the packaged CRD file with server-side apply and waits. It then applies every rendered object with a plain `kubectl apply`, and the rendered objects include the same eight CRDs. Kubernetes prints one warning for each CRD about a missing `last-applied-configuration` annotation. Nothing failed. A reader will still wonder what the eight warnings mean.
2. **The closing line says more than the script did.** It ends with "with the packaged lifecycle steps checked". The script carried out the install steps. It did not run the Job the plan names for before an upgrade, or the Job it names for after a delete.

## The script was corrected, and run again

Both faults above were fixed in the script generator the same day. The
corrected script applies each CRD once, and its last lines say only what it
did. It was run twice more, on a second throwaway cluster, with the system's
bash 3.2.

The first of the two runs was on the empty cluster. It printed no warning and
exited 0 in 6 seconds. Its last line named the steps it had not run, in an
earlier wording that also listed `pre-apply`. That was wrong, because the
script does run the CRD step, and the wording was corrected before the second
run. This is that first run from the namespace step on.

```
$ /bin/bash ./try.sh
>> Ensure the gpu-operator namespace exists
namespace/gpu-operator created

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

>> Not run by this script: the pre-apply and pre-upgrade and pre-delete and post-delete steps of this base's plan. Those belong to an upgrade or a delete.
[exit 0]
finished 2026-10-10T21:31:56Z
```

The second run used the final script on the same cluster, where everything
already existed. It left the eight CRDs alone, reported every other object
unchanged, printed no warning and exited 0 in 5 seconds.

```
$ /bin/bash ./try.sh
>> Ensure the gpu-operator namespace exists
namespace/gpu-operator configured

>> Check 8 CRDs included with this package

>> The required CRDs already exist; leave them under their current owner
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/computedomaincliques.resource.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/computedomains.resource.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/gpuclusters.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com condition met

>> Apply the rendered objects, except the CRDs already settled above
clusterpolicy.nvidia.com/cluster-policy unchanged
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc unchanged
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery unchanged
clusterrole.rbac.authorization.k8s.io/gpu-operator unchanged
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc unchanged
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery unchanged
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator unchanged
configmap/gpu-operator-node-feature-discovery-master-conf unchanged
configmap/gpu-operator-node-feature-discovery-worker-conf unchanged
daemonset.apps/gpu-operator-node-feature-discovery-worker configured
deployment.apps/gpu-operator-node-feature-discovery-gc configured
deployment.apps/gpu-operator-node-feature-discovery-master configured
deployment.apps/gpu-operator configured
namespace/gpu-operator configured
role.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker unchanged
role.rbac.authorization.k8s.io/gpu-operator unchanged
rolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker unchanged
rolebinding.rbac.authorization.k8s.io/gpu-operator unchanged
serviceaccount/gpu-operator unchanged
serviceaccount/node-feature-discovery unchanged

>> Done. The cluster received the files in ./nvidia-gpu-operator-v26-7-1-default/out. Its CRDs were settled first, from the package.

>> Not run by this script: the pre-upgrade, pre-delete and post-delete steps of this base's plan. The entry page says who runs each one.
[exit 0]
finished 2026-10-10T21:34:45Z
```

After it, the four pods were running and the ClusterPolicy reported `ready`.
The second cluster was deleted in the same way as the first.

## What the walk did not cover

- No GPU. The ClusterPolicy's `Ready` condition carries the reason `NFDLabelsMissing`, and no driver, toolkit or device-plugin DaemonSet was created.
- The upgrade and delete steps of the plan were not run.
- One run, on one machine, with one node.
- Only the `default` base of one version. The other bases of this chart have their own scripts, and they were not run here.
- The plain-objects bundle was not used. The script renders the installer package locally.

## Clean-up

```
$ kind delete cluster --name cwtest-1010-gpuop --kubeconfig <work>/kubeconfig
Deleted nodes: ["cwtest-1010-gpuop-control-plane"]
```

No cluster or container with the walk's name remained, and the checksum of the
machine's default kubeconfig was the same as before the walk.
