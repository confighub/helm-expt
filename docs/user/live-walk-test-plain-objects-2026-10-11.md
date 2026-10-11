# Live walk: testing an entry's plain objects with kubectl, 2026-10-11

**UNOFFICIAL/EXPERIMENTAL**

This log records one walk. The site now ships a second test script for an
entry, `try-objects.sh`. It tests the entry's retained objects themselves, the
one file a reader holds when they take the published bundle. It fetches that
file, checks its SHA-256 against the entry's listing, and applies it with
`kubectl`. It uses `curl`, `shasum`, `awk` and `kubectl`. It needs no `cub` CLI
and no account. This walk ran seven of those scripts on two throwaway local
clusters.

This is a dated record of one walk. It is not a Guide. Every line that starts
with `$` is a command that was run, and the text under it is the output it
printed. Times are UTC. A line longer than 220 characters is cut and ends with
`...`.

## Versions and setting

- kind v0.31.0 with a node at Kubernetes v1.35.0, kubectl client v1.36.0, Docker 29.4.0, on macOS.
- Every script ran under `/bin/bash`, which is GNU bash 3.2.57 on this machine.
- The home directory held no ConfigHub credentials. No `cub` command ran and no account was used.
- Each cluster had one node and no GPUs. The clusters had their own kubeconfig file, so the machine's default kubeconfig was not touched.
- The scratch directory is written `<work>`. `$SITE` is the `site/` directory of a checkout of this repository at the commit that added the scripts. The scripts ran from the checkout because the site had not published them yet.
- Each script fetched its retained file from this repository's `main` branch on GitHub, as a reader's copy would.

## The answer in brief

| Entry | What the script did | What the walk saw afterwards |
| --- | --- | --- |
| `nvidia/gpu-operator` v26.3.3, base `default`. Its verdict is `flatten-with-routes`, and it has no other test script. | It created the namespace, applied the 5 CRDs and waited for each, then applied the other 19 objects. It exited 0. | The operator and the three node-feature-discovery workloads rolled out. The ClusterPolicy reported `ready`. |
| The same entry, run again on the same cluster | It found the 5 CRDs present and matching, left them alone, and applied the other 19 objects again. It exited 0. | The same four Pods were still running and the ClusterPolicy still reported `ready`. |
| `nvidia/gpu-operator` v25.10.1, base `default`, on the cluster that held v26.3.3 | It found CRDs that differ from its file and stopped. It exited 1. | The operator image was still v26.3.3. |
| `prometheus-community/prometheus-blackbox-exporter` 11.18.0, base `default`. Its verdict is `safe-to-flatten`. | It created the `monitoring` namespace and applied 4 objects. It exited 0. | The Deployment rolled out and one Pod ran. |
| `valkey/valkey` 0.11.0, base `default`. Its verdict is `safe-to-flatten`, and its 4 objects name no namespace. | It applied the 4 objects into `default`, the namespace the entry was built for. It exited 0. | The Deployment rolled out and one Pod ran. |
| `argo-cd/argo-cd` 10.1.3, base `default`. Its plan says a Secret must exist before apply. | It stopped before it applied anything and printed the step. It exited 1. | The cluster held no `argocd` namespace, no Argo CD CRD and no Argo CD ClusterRole. |
| The same entry, after the walk created the Secret, with `REQUIREMENTS_READY=1` | It applied the 3 CRDs and the other 52 objects. It exited 0. | Six Deployments and one StatefulSet rolled out, and seven Pods ran. |
| `k8s-ephemeral-storage-metrics` 1.19.2, base `default`. Its file holds a ServiceMonitor and does not define that kind. | It stopped before it applied anything, because the cluster did not serve the kind. It exited 1. | No object of the entry was on the cluster. |
| `prometheus-community/prometheus-operator-crds` 28.0.1, base `default`, then `k8s-ephemeral-storage-metrics` again | The first applied its 10 CRDs. The second then passed its check and applied its 6 objects. Both exited 0. | The walk did not check these workloads further. |

No run failed because of a fault in a generated script.

## Run 1. The GPU Operator v26.3.3, which has no other test script

The cluster was new.

```
$ kind create cluster --name cwtest-1011-obj-1 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Thanks for using kind! 😊
NAME                              STATUS   ROLES           AGE   VERSION
cwtest-1011-obj-1-control-plane   Ready    control-plane   46s   v1.35.0
[exit 0 at 07:33:45Z]

$ /bin/bash "$SITE/sh/nvidia-gpu-operator-v26-3-3/default/try-objects.sh"

>> Fetch the retained objects into ./nvidia-gpu-operator-v26-3-3-default-objects/objects.yaml

>> Check the file against the SHA-256 in the listing
The file matches: sha256 73ebb5f6de3d1f010330d266db11b99b508be84dfc92b9d5deb01a39b66fee7c

>> Split the file into its 24 objects. The cluster is untouched so far
./nvidia-gpu-operator-v26-3-3-default-objects/crds:
doc-0002.yaml
doc-0004.yaml
doc-0006.yaml
doc-0007.yaml
doc-0008.yaml

./nvidia-gpu-operator-v26-3-3-default-objects/rest:
doc-0009.yaml
doc-0010.yaml
doc-0011.yaml
doc-0012.yaml
doc-0013.yaml
doc-0014.yaml
doc-0015.yaml
doc-0016.yaml
doc-0017.yaml
doc-0018.yaml
doc-0019.yaml
doc-0020.yaml
doc-0021.yaml
doc-0022.yaml
doc-0023.yaml
doc-0024.yaml
doc-0025.yaml
doc-0026.yaml
doc-0027.yaml

>> Check that kubectl reaches a cluster
kind-cwtest-1011-obj-1

>> Create the gpu-operator namespace if it does not exist
namespace/gpu-operator created

>> Check the 5 CRDs this file holds

>> A CRD is missing, so apply the file's CRDs first
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io condition met

>> Apply the other 19 objects
serviceaccount/node-feature-discovery created
serviceaccount/gpu-operator created
configmap/gpu-operator-node-feature-discovery-master-conf created
configmap/gpu-operator-node-feature-discovery-worker-conf created
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery created
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc created
clusterrole.rbac.authorization.k8s.io/gpu-operator created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc created
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator created
role.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker created
role.rbac.authorization.k8s.io/gpu-operator created
rolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker created
rolebinding.rbac.authorization.k8s.io/gpu-operator created
daemonset.apps/gpu-operator-node-feature-discovery-worker created
deployment.apps/gpu-operator-node-feature-discovery-master created
deployment.apps/gpu-operator-node-feature-discovery-gc created
deployment.apps/gpu-operator created
clusterpolicy.nvidia.com/cluster-policy created

>> Done. The 5 CRDs were applied first. kubectl applied the other 19 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 2 steps of this entry's plan. The entry page says who runs each one.
   - Before an upgrade, move the CRDs to the new version. Helm does not upgrade CRDs from a chart's crds directory, so the chart ships this Job. The listing gives the rest.
   - After deleting, prune node-feature-discovery labels from the nodes. The Job runs nfd-master -prune, which removes node-feature-discovery labels, annotations and taints from every node, with its own ServiceAccoun ...
[exit 0 at 07:34:10Z]
```

The script does not wait for workloads. The walk checked them by hand.

```
$ kubectl -n gpu-operator rollout status deployment/gpu-operator --timeout=300s | tail -1; kubectl -n gpu-operator rollout status deployment/gpu-operator-node-feature-discovery-master --timeout=300s | tail -1; kubect ...
deployment "gpu-operator" successfully rolled out
deployment "gpu-operator-node-feature-discovery-master" successfully rolled out
daemon set "gpu-operator-node-feature-discovery-worker" successfully rolled out
[exit 0 at 07:35:20Z]

$ for i in 1 2 3 4 5 6 7 8 9 10 11 12; do s="$(kubectl get clusterpolicy cluster-policy -o jsonpath="{.status.state}")"; [ "$s" = "ready" ] && break; sleep 10; done; kubectl get clusterpolicy cluster-policy -o jsonpa ...
ready
NAME                                                          READY   STATUS    RESTARTS   AGE
gpu-operator-6f4cbc9d8f-mzzt4                                 1/1     Running   0          71s
gpu-operator-node-feature-discovery-gc-585b876f9c-s7xq2       1/1     Running   0          71s
gpu-operator-node-feature-discovery-master-7f6684fb45-rjlfb   1/1     Running   0          71s
gpu-operator-node-feature-discovery-worker-rl5hj              1/1     Running   0          71s
[exit 0 at 07:35:20Z]
```

### The same script a second time

The second run exercised the case where every CRD exists and matches the
file. The script left the CRDs alone and applied the other objects again.
`kubectl` printed `configured` for the four workloads and `unchanged` for the
rest.

```
$ /bin/bash "$SITE/sh/nvidia-gpu-operator-v26-3-3/default/try-objects.sh" 2>&1 | sed -n "/Check the 5 CRDs/,\$p"
>> Check the 5 CRDs this file holds

>> The CRDs already exist and match this file. The script leaves them under their current owner
customresourcedefinition.apiextensions.k8s.io/clusterpolicies.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nvidiadrivers.nvidia.com condition met
customresourcedefinition.apiextensions.k8s.io/nodefeatures.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturegroups.nfd.k8s-sigs.io condition met
customresourcedefinition.apiextensions.k8s.io/nodefeaturerules.nfd.k8s-sigs.io condition met

>> Apply the other 19 objects
serviceaccount/node-feature-discovery unchanged
serviceaccount/gpu-operator unchanged
configmap/gpu-operator-node-feature-discovery-master-conf unchanged
configmap/gpu-operator-node-feature-discovery-worker-conf unchanged
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery unchanged
clusterrole.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc unchanged
clusterrole.rbac.authorization.k8s.io/gpu-operator unchanged
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery unchanged
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-gc unchanged
clusterrolebinding.rbac.authorization.k8s.io/gpu-operator unchanged
role.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker unchanged
role.rbac.authorization.k8s.io/gpu-operator unchanged
rolebinding.rbac.authorization.k8s.io/gpu-operator-node-feature-discovery-worker unchanged
rolebinding.rbac.authorization.k8s.io/gpu-operator unchanged
daemonset.apps/gpu-operator-node-feature-discovery-worker configured
deployment.apps/gpu-operator-node-feature-discovery-master configured
deployment.apps/gpu-operator-node-feature-discovery-gc configured
deployment.apps/gpu-operator configured
clusterpolicy.nvidia.com/cluster-policy unchanged

>> Done. The 5 CRDs already existed and matched, so the script left them alone. kubectl applied the other 19 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 2 steps of this entry's plan. The entry page says who runs each one.
   - Before an upgrade, move the CRDs to the new version. Helm does not upgrade CRDs from a chart's crds directory, so the chart ships this Job. The listing gives the rest.
   - After deleting, prune node-feature-discovery labels from the nodes. The Job runs nfd-master -prune, which removes node-feature-discovery labels, annotations and taints from every node, with its own ServiceAccoun ...
[exit 0 at 07:35:38Z]
```

That command pipes the script into `sed`, so the exit code under it is the
pipeline's. A third run printed the script's own exit code.

```
$ /bin/bash "$SITE/sh/nvidia-gpu-operator-v26-3-3/default/try-objects.sh" >/dev/null 2>&1; echo "the script exited $?"; kubectl get clusterpolicy cluster-policy -o jsonpath="{.status.state}{\"\n\"}"; kubectl -n gpu-o ...
the script exited 0
ready
NAME                                                          READY   STATUS    RESTARTS   AGE
gpu-operator-6f4cbc9d8f-mzzt4                                 1/1     Running   0          105s
gpu-operator-node-feature-discovery-gc-585b876f9c-s7xq2       1/1     Running   0          105s
gpu-operator-node-feature-discovery-master-7f6684fb45-rjlfb   1/1     Running   0          105s
gpu-operator-node-feature-discovery-worker-rl5hj              1/1     Running   0          105s
[exit 0 at 07:35:54Z]
```

### An older version's script on the same cluster

The walk then ran the script for v25.10.1 against the cluster that held
v26.3.3. Its CRD files differ from the ones on the cluster, so the script
stopped before it applied any other object. It prints how to let it apply the
file's CRDs. The walk did not do that.

```
$ /bin/bash "$SITE/sh/nvidia-gpu-operator-v25-10-1/default/try-objects.sh" > older.log 2>&1; echo "the script exited $?"; sed -n "/Check the .* CRDs/,\$p" older.log; kubectl -n gpu-operator get deployment gpu-operato ...
the script exited 1
>> Check the 5 CRDs this file holds

>> The CRDs already exist and differ from this file, or another tool owns them
This script does not change CRDs it did not just create.
If this is an upgrade, the objects that follow may need the newer CRDs.
To let this script apply the file's CRDs, re-run with:
  APPLY_CRDS=1 bash try-objects.sh
nvcr.io/nvidia/gpu-operator:v26.3.3
[exit 0 at 07:36:06Z]
```

The first cluster was then deleted.

```
$ kind delete cluster --name cwtest-1011-obj-1 --kubeconfig ./kubeconfig; kind get clusters | grep -c cwtest-1011-obj
Deleting cluster "cwtest-1011-obj-1" ...
Deleted nodes: ["cwtest-1011-obj-1-control-plane"]
0
[exit 1 at 07:36:21Z]
```

`grep -c` exits 1 when it counts nothing, which is why that line ends in
`exit 1`. The count is 0.

## Run 2. Two entries with the verdict safe-to-flatten

A second cluster was created. The first entry is the Prometheus blackbox
exporter. Its image comes from `quay.io` and pulls with no sign-in.

```
$ kind create cluster --name cwtest-1011-obj-2 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -2; kubectl get nodes

Have a nice day! 👋
NAME                              STATUS   ROLES           AGE   VERSION
cwtest-1011-obj-2-control-plane   Ready    control-plane   26s   v1.35.0
[exit 0 at 07:37:38Z]

$ /bin/bash "$SITE/sh/prometheus-community-prometheus-blackbox-exporter-11-18-0/default/try-objects.sh"; echo "the script exited $?"

>> Fetch the retained objects into ./prometheus-community-prometheus-blackbox-exporter-11-18-0-default-objects/objects.yaml

>> Check the file against the SHA-256 in the listing
The file matches: sha256 f9a8cddd436d84f31bcb4903756d6a1e149e7f4197d33d18013e33b077195aa2

>> Split the file into its 4 objects. The cluster is untouched so far
doc-0001.yaml
doc-0002.yaml
doc-0003.yaml
doc-0004.yaml

>> Check that kubectl reaches a cluster
kind-cwtest-1011-obj-2

>> Create the monitoring namespace if it does not exist
namespace/monitoring created

>> Apply the 4 objects
serviceaccount/prometheus-blackbox-exporter created
configmap/prometheus-blackbox-exporter created
service/prometheus-blackbox-exporter created
deployment.apps/prometheus-blackbox-exporter created

>> Done. kubectl applied the 4 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start
the script exited 0
[exit 0 at 07:37:38Z]

$ kubectl -n monitoring rollout status deployment --timeout=300s | tail -1; kubectl -n monitoring get pods,svc
deployment "prometheus-blackbox-exporter" successfully rolled out
NAME                                                READY   STATUS    RESTARTS   AGE
pod/prometheus-blackbox-exporter-576cfd6497-g9jj7   1/1     Running   0          7s

NAME                                   TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)    AGE
service/prometheus-blackbox-exporter   ClusterIP   10.96.57.223   <none>        9115/TCP   7s
[exit 0 at 07:37:45Z]
```

The second entry is Valkey. Its four objects name no namespace, so `kubectl`
would put them wherever the reader's context points. The script applies them
into `default`, which is the namespace the listing records for the entry. Its
image comes from Docker Hub and pulled with no sign-in.

```
$ /bin/bash "$SITE/sh/valkey-valkey-0-11-0/default/try-objects.sh" 2>&1 | sed -n "/Split the file/,\$p"
>> Split the file into its 4 objects. The cluster is untouched so far
doc-0001.yaml
doc-0002.yaml
doc-0003.yaml
doc-0004.yaml

>> Check that kubectl reaches a cluster
kind-cwtest-1011-obj-2

>> Create the default namespace if it does not exist

>> Apply 4 objects that name no namespace into default, the namespace this entry was built for
serviceaccount/valkey created
configmap/valkey-init-scripts created
service/valkey created
deployment.apps/valkey created

>> Done. kubectl applied the 4 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start
[exit 0 at 07:37:51Z]

$ kubectl -n default rollout status deployment/valkey --timeout=300s | tail -1; kubectl -n default get pods,svc,sa,cm
deployment "valkey" successfully rolled out
NAME                         READY   STATUS    RESTARTS   AGE
pod/valkey-fc7549967-ldtpw   1/1     Running   0          21s

NAME                 TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)    AGE
service/kubernetes   ClusterIP   10.96.0.1       <none>        443/TCP    58s
service/valkey       ClusterIP   10.96.142.129   <none>        6379/TCP   22s

NAME                     AGE
serviceaccount/default   51s
serviceaccount/valkey    22s

NAME                            DATA   AGE
configmap/kube-root-ca.crt      1      51s
configmap/valkey-init-scripts   1      22s
[exit 0 at 07:38:13Z]
```

The first command pipes the script into `sed`. A second run printed the
script's own exit code.

```
$ /bin/bash "$SITE/sh/valkey-valkey-0-11-0/default/try-objects.sh" >/dev/null 2>&1; echo "the script exited $?"
the script exited 0
[exit 0 at 07:38:20Z]
```

## Run 3. An entry whose plan has a step the script must stop for

The plan for Argo CD 10.1.3 says the Secret `argocd/argocd-redis` must exist
before apply. Helm creates it with a hook, and plain objects carry no hook.
The script cannot make that Secret for the reader, so it stops before it
applies anything. The command leaves out the 55 file names the script lists.

```
$ /bin/bash "$SITE/sh/argo-cd-argo-cd-10-1-3/default/try-objects.sh" 2>&1 | grep -v "^doc-"; echo "the script exited ${PIPESTATUS[0]}"

>> Fetch the retained objects into ./argo-cd-argo-cd-10-1-3-default-objects/objects.yaml

>> Check the file against the SHA-256 in the listing
The file matches: sha256 b2cbe21e58abbf285edb7710df9df299c93bb288293eed091ef7e24f83f850b5

>> Split the file into its 55 objects. The cluster is untouched so far
./argo-cd-argo-cd-10-1-3-default-objects/crds:

./argo-cd-argo-cd-10-1-3-default-objects/rest:

>> Stop before applying anything. This entry's plan has 1 step that an install needs first
This script cannot carry out this step of the plan. It is yours to do, with your own values:
  - Secret argocd/argocd-redis must exist before apply. Redis auth Secret normally generated by the chart secret-init hook; config-only delivery lanes stage it explicitly.
Nothing was applied. Complete it before you apply the objects.
When it is done, re-run with:
  REQUIREMENTS_READY=1 bash try-objects.sh
the script exited 1
[exit 0 at 07:39:53Z]

$ kubectl get namespace argocd; kubectl get crd -o name | grep argoproj || echo "no argoproj CRD"; kubectl get clusterrole -o name | grep argocd || echo "no argocd ClusterRole"
Error from server (NotFound): namespaces "argocd" not found
no argoproj CRD
no argocd ClusterRole
[exit 0 at 07:39:54Z]
```

The walk then did the step by hand, with a random value that it did not
print, and ran the script again with `REQUIREMENTS_READY=1`.

```
$ kubectl create namespace argocd; kubectl -n argocd create secret generic argocd-redis --from-literal=auth="$(openssl rand -hex 16)"
namespace/argocd created
secret/argocd-redis created
[exit 0 at 07:40:02Z]

$ REQUIREMENTS_READY=1 /bin/bash "$SITE/sh/argo-cd-argo-cd-10-1-3/default/try-objects.sh" > ready.log 2>&1; echo "the script exited $?"; sed -n "/REQUIREMENTS_READY=1 is set/,\$p" ready.log | grep -v " created$\|cond ...
the script exited 0
>> REQUIREMENTS_READY=1 is set. The script takes your word for 1 step and does not check it

>> Check that kubectl reaches a cluster
kind-cwtest-1011-obj-2

>> Create the argocd namespace if it does not exist

>> Check the 3 CRDs this file holds

>> A CRD is missing, so apply the file's CRDs first
customresourcedefinition.apiextensions.k8s.io/applications.argoproj.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/applicationsets.argoproj.io serverside-applied
customresourcedefinition.apiextensions.k8s.io/appprojects.argoproj.io serverside-applied

>> Apply the other 52 objects
networkpolicy.networking.k8s.io/argo-cd-argocd-application-controller created
networkpolicy.networking.k8s.io/argo-cd-argocd-notifications-controller created
networkpolicy.networking.k8s.io/argo-cd-argocd-repo-server created
networkpolicy.networking.k8s.io/argo-cd-argocd-server created
networkpolicy.networking.k8s.io/argo-cd-argocd-dex-server created
networkpolicy.networking.k8s.io/argo-cd-argocd-redis created
serviceaccount/argocd-application-controller created
serviceaccount/argocd-applicationset-controller created
serviceaccount/argocd-notifications-controller created
serviceaccount/argo-cd-argocd-repo-server created
serviceaccount/argocd-server created
serviceaccount/argocd-dex-server created
secret/argocd-notifications-secret created
secret/argocd-secret created
configmap/argocd-cm created
configmap/argocd-cmd-params-cm created
configmap/argocd-gpg-keys-cm created
configmap/argocd-notifications-cm created
configmap/argocd-rbac-cm created
configmap/argocd-ssh-known-hosts-cm created
configmap/argocd-tls-certs-cm created
configmap/argo-cd-argocd-redis-health-configmap created
clusterrole.rbac.authorization.k8s.io/argo-cd-argocd-application-controller created
clusterrole.rbac.authorization.k8s.io/argo-cd-argocd-notifications-controller created
clusterrole.rbac.authorization.k8s.io/argo-cd-argocd-server created
clusterrolebinding.rbac.authorization.k8s.io/argo-cd-argocd-application-controller created
clusterrolebinding.rbac.authorization.k8s.io/argo-cd-argocd-notifications-controller created
clusterrolebinding.rbac.authorization.k8s.io/argo-cd-argocd-server created
role.rbac.authorization.k8s.io/argo-cd-argocd-application-controller created
role.rbac.authorization.k8s.io/argo-cd-argocd-applicationset-controller created
role.rbac.authorization.k8s.io/argo-cd-argocd-notifications-controller created
role.rbac.authorization.k8s.io/argo-cd-argocd-repo-server created
role.rbac.authorization.k8s.io/argo-cd-argocd-server created
role.rbac.authorization.k8s.io/argo-cd-argocd-dex-server created
rolebinding.rbac.authorization.k8s.io/argo-cd-argocd-application-controller created
rolebinding.rbac.authorization.k8s.io/argo-cd-argocd-applicationset-controller created
rolebinding.rbac.authorization.k8s.io/argo-cd-argocd-notifications-controller created
rolebinding.rbac.authorization.k8s.io/argo-cd-argocd-repo-server created
rolebinding.rbac.authorization.k8s.io/argo-cd-argocd-server created
rolebinding.rbac.authorization.k8s.io/argo-cd-argocd-dex-server created
service/argo-cd-argocd-applicationset-controller created
service/argo-cd-argocd-repo-server created
service/argo-cd-argocd-server created
service/argo-cd-argocd-dex-server created
service/argo-cd-argocd-redis created
deployment.apps/argo-cd-argocd-applicationset-controller created
deployment.apps/argo-cd-argocd-notifications-controller created
deployment.apps/argo-cd-argocd-repo-server created
deployment.apps/argo-cd-argocd-server created
deployment.apps/argo-cd-argocd-dex-server created
deployment.apps/argo-cd-argocd-redis created
statefulset.apps/argo-cd-argocd-application-controller created

>> Done. The 3 CRDs were applied first. kubectl applied the other 52 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start

>> Not run by this script: 1 step of this entry's plan. The entry page says who runs it.
   - Secret argocd/argocd-redis must exist before apply. Redis auth Secret normally generated by the chart secret-init hook; config-only delivery lanes stage it explicitly.
52
[exit 0 at 07:40:12Z]
```

The filter in that command was meant to drop the `created` lines and did not.
The output above is what it printed. The last line, 52, is the count of
`created` lines.

```
$ kubectl -n argocd rollout status deployment --timeout=420s | grep -c "successfully rolled out"; kubectl -n argocd rollout status statefulset/argo-cd-argocd-application-controller --timeout=300s | tail -1; kubectl - ...
6
partitioned roll out complete: 1 new pods have been updated...
NAME                                                       READY   STATUS    RESTARTS   AGE
argo-cd-argocd-application-controller-0                    1/1     Running   0          56s
argo-cd-argocd-applicationset-controller-5fd5c8dc7-mmch8   1/1     Running   0          56s
argo-cd-argocd-dex-server-755bdbf66c-d8cbp                 1/1     Running   0          56s
argo-cd-argocd-notifications-controller-b6cf49795-znmjk    1/1     Running   0          56s
argo-cd-argocd-redis-75c4bd9966-zb7b7                      1/1     Running   0          56s
argo-cd-argocd-repo-server-69c4b456c5-xvn2v                1/1     Running   0          56s
argo-cd-argocd-server-966f64bd9-x4hps                      1/1     Running   0          56s
[exit 0 at 07:41:08Z]
```

The script's last lines still name the Secret step as not run by the script,
which is true. The reader ran it.

## Run 4. A file that uses a kind it does not define

The file for `k8s-ephemeral-storage-metrics` holds a ServiceMonitor. That kind
belongs to the Prometheus Operator, and the file does not define it. The entry's
plan has no step about it. On a cluster without the kind, `kubectl apply` would
fail part of the way through. The script checks first and stops before it
applies anything.

```
$ /bin/bash "$SITE/sh/k8s-ephemeral-storage-metrics-k8s-ephemeral-storage-metrics-1-19-2/default/try-objects.sh" > kinds.log 2>&1; echo "the script exited $?"; sed -n "/Split the file/,\$p" kinds.log; kubectl get all ...
the script exited 1
>> Split the file into its 6 objects. The cluster is untouched so far
doc-0001.yaml
doc-0002.yaml
doc-0003.yaml
doc-0004.yaml
doc-0005.yaml
doc-0006.yaml

>> Check that kubectl reaches a cluster
kind-cwtest-1011-obj-2

>> Check that the cluster serves the 1 kind this file uses and does not define
The cluster does not serve: ServiceMonitor.monitoring.coreos.com
This file uses these kinds and does not define them. Install what defines them, then re-run this script. Nothing was applied.
1
[exit 0 at 07:38:21Z]
```

The last line of that output is 1 because the search word also matches
`ephemeral-volume-controller`, a ServiceAccount that every cluster has in
`kube-system`. A narrower search found nothing from the entry.

```
$ kubectl get deployment,serviceaccount,servicemonitor -A 2>&1 | grep -c k8s-ephemeral-storage-metrics
0
[exit 1 at 07:39:39Z]
```

The walk then ran the script for the entry that holds those definitions,
`prometheus-community/prometheus-operator-crds` 28.0.1, and ran the first
script again. This time the check passed.

```
$ /bin/bash "$SITE/sh/prometheus-community-prometheus-operator-crds-28-0-1/default/try-objects.sh" > crds.log 2>&1; echo "the script exited $?"; sed -n "/Check the 10 CRDs/,\$p" crds.log | grep -v "condition met"
the script exited 0
>> Check the 10 CRDs this file holds

>> A CRD is missing, so apply the file's CRDs first
customresourcedefinition.apiextensions.k8s.io/alertmanagerconfigs.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/alertmanagers.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/podmonitors.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/probes.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/prometheusagents.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/prometheuses.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/prometheusrules.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/scrapeconfigs.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/servicemonitors.monitoring.coreos.com serverside-applied
customresourcedefinition.apiextensions.k8s.io/thanosrulers.monitoring.coreos.com serverside-applied

>> Done. The 10 CRDs of this entry's retained file were applied.

>> The script stops here. It did not wait for any workload to start
[exit 0 at 07:39:45Z]

$ /bin/bash "$SITE/sh/k8s-ephemeral-storage-metrics-k8s-ephemeral-storage-metrics-1-19-2/default/try-objects.sh" > kinds2.log 2>&1; echo "the script exited $?"; sed -n "/Check that the cluster serves/,\$p" kinds2.log
the script exited 0
>> Check that the cluster serves the 1 kind this file uses and does not define

>> Create the monitoring namespace if it does not exist

>> Apply the 6 objects
serviceaccount/k8s-ephemeral-storage-metrics created
clusterrole.rbac.authorization.k8s.io/k8s-ephemeral-storage-metrics created
clusterrolebinding.rbac.authorization.k8s.io/k8s-ephemeral-storage-metrics created
service/k8s-ephemeral-storage-metrics created
deployment.apps/k8s-ephemeral-storage-metrics created
servicemonitor.monitoring.coreos.com/k8s-ephemeral-storage-metrics created

>> Done. kubectl applied the 6 objects of this entry's retained file.

>> The script stops here. It did not wait for any workload to start
[exit 0 at 07:39:46Z]
```

## What went wrong

- No generated script failed. Two faults of wording were found by reading the scripts, and both were fixed in the generator. A script whose file holds only CRDs ended with "The 10 CRDs of this entry's retained file were applied first", and "first" meant nothing there. That was fixed before that script ran. A script whose file holds one CRD said "The 1 CRD were applied first". That was fixed after the walk, and no such script was run. After each fix the scripts that had already run were compared by SHA-256, and none had changed.
- Two of the walk's own checks were wrong, and both are shown above. One search matched a ServiceAccount that Kubernetes ships. One filter did not drop the lines it was meant to drop.
- Three commands pipe a script into `sed` or `grep`, so the exit code under them is the pipeline's. Each of those scripts has its own exit code in the same command or in the one after it.

## What the walk did not cover

- No GPU. No driver, toolkit or device-plugin workload ran.
- One walk, on one machine, with one node per cluster.
- Seven scripts ran, out of the 228 the site ships. The other 221 passed `/bin/bash -n` and were not run.
- The scripts ran from a checkout. No script was fetched from the published site.
- No script ran with `APPLY_CRDS=1`, so the case where the script replaces differing CRDs was not exercised.
- No upgrade, delete or rollback step of any plan was run. Each script names those steps in its last lines and leaves them to the reader.
- The walk checked that workloads started. It did not check that any of them did useful work. Valkey, Argo CD and the blackbox exporter were given no request.
- Linux was not tested. The scripts fall back to `sha256sum` where `shasum` is missing, and that branch did not run.

## Clean-up

Both clusters were deleted, and no cluster of this walk was left.

```
$ kind delete cluster --name cwtest-1011-obj-2 --kubeconfig ./kubeconfig; kind get clusters | grep cwtest-1011-obj || echo "no cwtest-1011-obj cluster is left"
Deleting cluster "cwtest-1011-obj-2" ...
Deleted nodes: ["cwtest-1011-obj-2-control-plane"]
no cwtest-1011-obj cluster is left
[exit 0 at 07:41:17Z]
```

The SHA-256 of the machine's default kubeconfig was the same before and after
the walk.
