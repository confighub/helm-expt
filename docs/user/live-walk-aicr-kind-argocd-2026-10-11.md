# Live walk: one AICR recipe's Applications under Argo CD on a throwaway cluster, 2026-10-11

**UNOFFICIAL/EXPERIMENTAL**

This log records one run. An AICR entry is kept as a set of Argo CD
Applications, so no script on the site tests one. This walk did the test once
by hand for the smallest recipe, `kind` v1.0.0. It installed Argo CD on a new
local cluster, applied the recipe's 12 component Applications, and watched
for nine minutes.

This is a dated record of one run. It is not a Guide. Every line that starts
with `$` is a command that was run, and the text under it is the output it
printed. Times are UTC. A line longer than 220 characters is cut and ends with
`...`. Two waits between the looks, and six diagnostic commands that added
nothing, are left out.

## Versions and setting

- kind v0.31.0 with a node at Kubernetes v1.35.0, kubectl client v1.36.0, Docker 29.4.0.
- Argo CD v3.4.5, installed from the Catalog's own entry for the argo-cd chart 10.1.3 with that entry's `try-objects.sh`.
- The cluster had one node and no GPUs. It had its own kubeconfig file, so the machine's default kubeconfig was not touched. No ConfigHub account was used.
- The Applications came from a checkout, under `examples/aicr/kind/argocd-rendered/templates/`.
- The scratch directory is written `<work>`.

## The answer in brief

| Question | What the walk saw |
| --- | --- |
| Did Argo CD accept the Applications? | Yes. All 12 reported `Synced` within four minutes. |
| Did the components come up? | Ten of the 12 reported `Healthy`. 42 pods were running and none was pending. |
| What failed? | cert-manager stayed `Progressing`, because its webhook was killed four times. kube-prometheus-stack was `Degraded`, because the recipe asks for a storage class named `gp3` and the cluster has none. |
| Were the sync-waves followed? | No. The walk applied the Applications directly, and every one synced at once. |
| Was the recipe's parent Application used? | No. It pulls the recipe from a registry, and this recipe is not published there. |

## Make the cluster and install Argo CD

The recipe's values select nodes that carry the label
`nodeGroup=system-worker`, which the plan calls a placeholder. The walk gave
the one node that label, so that pods could be scheduled.

```
$ kind create cluster --name cwtest-1011-aicr --kubeconfig <work>/kubeconfig --wait 120s 2>&1 | tail -3
kubectl cluster-info --context kind-cwtest-1011-aicr --kubeconfig <work>/kubeconfig

Have a nice day! 👋
[exit 0 at 11:13:15Z]

$ kubectl get nodes -o wide | cut -c1-110
NAME                             STATUS   ROLES           AGE   VERSION   INTERNAL-IP     EXTERNAL-IP   OS-IMA
cwtest-1011-aicr-control-plane   Ready    control-plane   27s   v1.35.0   192.168.97.18   <none>        Debian
[exit 0 at 11:13:16Z]

$ kubectl label node cwtest-1011-aicr-control-plane nodeGroup=system-worker
node/cwtest-1011-aicr-control-plane labeled
[exit 0 at 11:13:16Z]
```

The Catalog's argo-cd entry has one plan step that its script cannot do, a
Redis Secret. The walk created it with a random value and then ran the script.
Lines that end `serverside-applied`, `condition met`, `created` or
`configured` are filtered out.

```
$ kubectl create namespace argocd && kubectl -n argocd create secret generic argocd-redis --from-literal=auth="$(openssl rand -hex 16)"
namespace/argocd created
secret/argocd-redis created
[exit 0 at 11:13:17Z]

$ REQUIREMENTS_READY=1 bash ./argocd-try-objects.sh 2>&1 | grep -v 'serverside-applied\|condition met\| created$\| configured$\|^doc-'

>> Fetch the retained objects into ./argo-cd-argo-cd-10-1-3-default-objects/objects.yaml

>> Check the file against the SHA-256 in the listing
The file matches: sha256 b2cbe21e58abbf285edb7710df9df299c93bb288293eed091ef7e24f83f850b5

>> Split the file into its 55 objects. The cluster is untouched so far
./argo-cd-argo-cd-10-1-3-default-objects/crds:

./argo-cd-argo-cd-10-1-3-default-objects/rest:

>> REQUIREMENTS_READY=1 is set. The script takes your word for 1 step and does not check it

>> Check that kubectl reaches a cluster
kind-cwtest-1011-aicr

>> Create the argocd namespace if it does not exist

>> Check the 3 CRDs this file holds

>> A CRD is missing, so apply the file's CRDs first

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
[exit 0 at 11:13:22Z]

$ kubectl -n argocd wait deployment --all --for=condition=Available --timeout=420s && kubectl -n argocd rollout status statefulset --timeout=300s 2>&1 | tail -2
deployment.apps/argo-cd-argocd-applicationset-controller condition met
deployment.apps/argo-cd-argocd-dex-server condition met
deployment.apps/argo-cd-argocd-notifications-controller condition met
deployment.apps/argo-cd-argocd-redis condition met
deployment.apps/argo-cd-argocd-repo-server condition met
deployment.apps/argo-cd-argocd-server condition met
partitioned roll out complete: 1 new pods have been updated...
[exit 0 at 11:15:38Z]

$ kubectl get pods -n argocd -o jsonpath='{range .items[*]}{.spec.containers[0].image}{"\n"}{end}' | sort -u | head -3
ecr-public.aws.com/docker/library/redis:8.2.3-alpine
ghcr.io/dexidp/dex:v2.45.1
quay.io/argoproj/argocd:v3.4.5
[exit 0 at 11:15:49Z]
```

## Apply the 12 component Applications

The recipe holds 13 Applications. One of them, `aicr-stack`, is the parent
that pulls the whole recipe from a registry. This recipe has no published
copy, so the walk left the parent out and applied the other 12.

```
$ for f in $(ls examples/aicr/kind/argocd-rendered/templates | grep -v aicr-stack.yaml); do kubectl apply -f examples/aicr/kind/argocd-rendered/templates/$f; done
application.argoproj.io/cert-manager created
application.argoproj.io/gpu-operator created
application.argoproj.io/k8s-ephemeral-storage-metrics created
application.argoproj.io/kai-scheduler created
application.argoproj.io/kube-prometheus-stack created
application.argoproj.io/network-operator created
application.argoproj.io/nfd created
application.argoproj.io/nodewright-operator created
application.argoproj.io/nvidia-dra-driver-gpu created
application.argoproj.io/nvsentinel created
application.argoproj.io/prometheus-adapter created
application.argoproj.io/prometheus-operator-crds created
[exit 0 at 11:15:50Z]
```

## Look after four minutes and after nine

```
$ kubectl -n argocd get applications -o custom-columns='NAME:.metadata.name,WAVE:.metadata.annotations.argocd\.argoproj\.io/sync-wave,SYNC:.status.sync.status,HEALTH:.status.health.status,PHASE:.status.operationState ...
NAME                            WAVE   SYNC     HEALTH        PHASE
cert-manager                    1      Synced   Progressing   Running
gpu-operator                    9      Synced   Healthy       Succeeded
k8s-ephemeral-storage-metrics   9      Synced   Healthy       Succeeded
kai-scheduler                   13     Synced   Healthy       Succeeded
kube-prometheus-stack           5      Synced   Degraded      Running
network-operator                5      Synced   Healthy       Succeeded
nfd                             1      Synced   Healthy       Succeeded
nodewright-operator             1      Synced   Healthy       Succeeded
nvidia-dra-driver-gpu           13     Synced   Healthy       Succeeded
nvsentinel                      13     Synced   Healthy       Succeeded
prometheus-adapter              9      Synced   Healthy       Succeeded
prometheus-operator-crds        1      Synced   Healthy       Succeeded
[exit 0 at 11:19:51Z]

$ kubectl -n argocd get applications -o custom-columns='NAME:.metadata.name,WAVE:.metadata.annotations.argocd\.argoproj\.io/sync-wave,SYNC:.status.sync.status,HEALTH:.status.health.status,PHASE:.status.operationState ...
NAME                            WAVE   SYNC     HEALTH        PHASE
cert-manager                    1      Synced   Progressing   Running
gpu-operator                    9      Synced   Healthy       Succeeded
k8s-ephemeral-storage-metrics   9      Synced   Healthy       Succeeded
kai-scheduler                   13     Synced   Healthy       Succeeded
kube-prometheus-stack           5      Synced   Degraded      Running
network-operator                5      Synced   Healthy       Succeeded
nfd                             1      Synced   Healthy       Succeeded
nodewright-operator             1      Synced   Healthy       Succeeded
nvidia-dra-driver-gpu           13     Synced   Healthy       Succeeded
nvsentinel                      13     Synced   Healthy       Succeeded
prometheus-adapter              9      Synced   Healthy       Succeeded
prometheus-operator-crds        1      Synced   Healthy       Succeeded
[exit 0 at 11:24:31Z]

$ kubectl -n argocd get applications --no-headers | awk '{print $2, $3}' | sort | uniq -c
   1 Synced Degraded
  10 Synced Healthy
   1 Synced Progressing
[exit 0 at 11:25:14Z]
```

The `WAVE` column is the sync-wave each Application carries. Applications in
waves 9 and 13 were healthy while one in wave 1 was not, so the waves did not
order anything here.

## Why cert-manager stayed Progressing

```
$ kubectl -n argocd get application cert-manager kube-prometheus-stack -o jsonpath='{range .items[*]}{.metadata.name}{": "}{.status.operationState.message}{"\n"}{end}' | cut -c1-400
cert-manager: waiting for healthy state of apps/Deployment/cert-manager-webhook
kube-prometheus-stack: one or more synchronization tasks completed unsuccessfully. Retrying attempt #5 at 11:23AM.
[exit 0 at 11:24:42Z]

$ kubectl get deployment,statefulset,daemonset -A --no-headers | awk '{split($3,a,"/"); if ($2 ~ /^deployment|^statefulset/ && a[1]!=a[2]) print $1, $2, $3; if ($2 ~ /^daemonset/ && $3!=$5) print $1, $2, "desired="$3 ...
cert-manager deployment.apps/cert-manager-webhook 0/1
[exit 0 at 11:24:52Z]

$ kubectl -n cert-manager logs deployment/cert-manager-webhook --tail=4 2>&1 | cut -c1-260; kubectl -n cert-manager get deployment cert-manager-webhook -o jsonpath='{.spec.template.spec.containers[0].resources}{"\n"} ...
{"limits":{"cpu":"50m","memory":"40Mi"},"requests":{"cpu":"50m","memory":"40Mi"}}
{"failureThreshold":3,"httpGet":{"path":"/livez","port":"healthcheck","scheme":"HTTP"},"initialDelaySeconds":60,"periodSeconds":10,"successThreshold":1,"timeoutSeconds":1}
[exit 0 at 11:25:02Z]

$ kubectl -n cert-manager get pods -l app.kubernetes.io/component=webhook -o jsonpath='{range .items[*]}{.status.containerStatuses[0].restartCount}{" restarts, last ended: "}{.status.containerStatuses[0].lastState.te ...
4 restarts, last ended: Error exit 137
I1011 11:24:23.780303       1 server.go:336] "Health check failed as CertificateSource is unhealthy" logger="cert-manager"
I1011 11:24:24.180025       1 server.go:336] "Health check failed as CertificateSource is unhealthy" logger="cert-manager"
I1011 11:24:24.180183       1 internal.go:571] "Stopping and waiting for non leader election runnables" logger="cert-manager.webhook"
[exit 0 at 11:25:14Z]
```

The webhook container has a limit of 50m CPU and 40Mi memory, set by the
recipe's values. It reported "CertificateSource is unhealthy", failed its
liveness probe, and was killed four times in nine minutes.

## Why kube-prometheus-stack was Degraded

```
$ kubectl -n argocd get application kube-prometheus-stack -o jsonpath='{range .status.operationState.syncResult.resources[*]}{.hookPhase}{" "}{.kind}{"/"}{.name}{": "}{.message}{"\n"}{end}' | grep -v '^Succeeded\|^ ' ...
Failed Prometheus/kube-prometheus-prometheus: shard 0: statefulset monitoring/prometheus-kube-prometheus-prometheus not found
[exit 0 at 11:25:02Z]

$ kubectl -n monitoring get prometheus kube-prometheus-prometheus -o jsonpath='{range .status.conditions[*]}{.type}{"="}{.status}{" "}{.reason}{": "}{.message}{"\n"}{end}' | cut -c1-420; kubectl -n monitoring logs de ...
Available=False StatefulSetNotFound: shard 0: statefulset monitoring/prometheus-kube-prometheus-prometheus not found
Reconciled=False ReconciliationFailed: storage class "gp3" does not exist
ts=2026-10-11T11:21:27.205986399Z level=error caller=/workspace/pkg/operator/resource_reconciler.go:688 msg="Unhandled Error" logger=UnhandledError err="sync \"monitoring/kube-prometheus-prometheus\" failed: storage  ...
ts=2026-10-11T11:24:11.158929902Z level=error caller=/workspace/pkg/operator/resource_reconciler.go:688 msg="Unhandled Error" logger=UnhandledError err="sync \"monitoring/kube-prometheus-prometheus\" failed: storage  ...
[exit 0 at 11:25:14Z]
```

The recipe's values give Prometheus a volume claim with the storage class
`gp3`. A kind cluster has no storage class of that name, so the operator
never created the Prometheus StatefulSet. The other parts of the stack ran.

## What else was on the cluster

```
$ kubectl get pods -A --no-headers | awk '{print $4}' | sort | uniq -c
  42 Running
[exit 0 at 11:24:42Z]

$ kubectl -n gpu-operator get pods,clusterpolicy --no-headers 2>&1 | cut -c1-110
pod/gpu-operator-568566585c-q26zk   1/1   Running   0     7m9s
clusterpolicy.nvidia.com/cluster-policy   ready   2026-10-11T11:17:43Z
[exit 0 at 11:24:52Z]

$ kubectl get crd --no-headers | wc -l; kubectl get ns --no-headers | awk '{print $1}' | tr '\n' ' '
      43
argocd cert-manager default gpu-operator kai-resource-reservation kai-scheduler kube-node-lease kube-public kube-system local-path-storage monitoring node-feature-discovery nodewright nvidia-dra-driver nvidia-network ...
```

## Clean-up

```
$ kind delete cluster --name cwtest-1011-aicr --kubeconfig <work>/kubeconfig
Deleting cluster "cwtest-1011-aicr" ...
Deleted nodes: ["cwtest-1011-aicr-control-plane"]
[exit 0 at 11:25:20Z]
```

No cluster or container with the walk's name remained, and the checksum of the
machine's default kubeconfig was the same as before the walk.

## What the walk found

1. **The `kind` recipe asks for the storage class `gp3`.** The file `examples/aicr/kind/argocd-rendered/templates/kube-prometheus-stack.yaml` names it. The entry's plan has no step for it. On a kind cluster Prometheus does not start until a storage class of that name exists or the value is changed.
2. **The cert-manager webhook did not stay up under the recipe's limits.** The walk did not find out whether the CPU limit, the memory limit or the single busy node was the cause.
3. **Applied directly, the Applications ignore their sync-waves.** The waves order the children of the parent Application. The plan's first step says to apply the Applications in wave order, and nothing in this walk did that.
4. **The node label is needed before anything is scheduled.** The walk labelled the node first. It did not run the recipe without the label.
5. **Argo CD v3.4.5 fetched all 12 sources without credentials.** Four of them are `oci://` chart addresses.

## What the walk did not cover

- The parent Application `aicr-stack`, and so the sync-wave order.
- No GPU. The GPU Operator's ClusterPolicy reported `ready` and no GPU workload ran.
- One recipe out of 138, one run, on one machine, with one node.
- Nine minutes. The walk did not wait to see whether cert-manager settled later.
- No upgrade, delete or rollback.
- ConfigHub was not used. The Applications were applied with `kubectl`.
