# Live walk: kai-scheduler's install hooks on a throwaway cluster, 2026-10-11

**UNOFFICIAL/EXPERIMENTAL**

This log records two runs. The chart kai-scheduler v0.16.9 has two hook phases
that Helm runs around an install. The site's test script for its `default`
base did not run them, and said so. The first run shows what that left on the
cluster and what the hooks then did by hand. The second run shows the script
after it was changed to carry the hooks out itself.

This is a dated record. It is not a Guide. Every line that starts with `$` is
a command that was run, and the text under it is the output it printed. Times
are UTC. A line longer than 220 characters is cut and ends with `...`.

## Versions and setting

- cub v0.8.7 with the installer plugin, in a home directory that holds no ConfigHub credentials. No account was used.
- kind v0.31.0 with a node at Kubernetes v1.35.0, kubectl client v1.36.0, kustomize v5.8.1, Docker 29.4.0.
- Each run had its own new cluster with one node and its own kubeconfig file. The machine's default kubeconfig was not touched.
- The scripts ran under the system's bash 3.2.
- The scratch directory is written `<work>`.

## The answer in brief

| Run | What ran | What was on the cluster afterwards |
| --- | --- | --- |
| 1, the script as it stood | CRDs, then the rendered objects | One Deployment, `kai-operator`. No `Config` object and no scheduler. |
| 1, then the two hook phases by hand | The pre-install objects, then the post-install objects | The `kai-config` object and seven Deployments, the scheduler among them. |
| 2, the changed script | CRDs, the pre-install hooks, the rendered objects, the post-install hooks | The `kai-config` object and the same seven Deployments. |

## Run 1. The script as it stood

The script ended by saying the install was not finished and naming the two
steps it had left out. A minute later only the operator was running.

```
$ kind create cluster --name cwtest-1011-kai --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -1; kubectl get nodes --no-headers
Thanks for using kind! 😊
cwtest-1011-kai-control-plane   Ready   control-plane   21s   v1.35.0
[exit 0 at 07:00:24Z]

$ /bin/bash ./try.sh 2>&1 | grep -v "condition met\|created$\|configured$\|serverside-applied$"

>> Pull the package and render the default base variant into ./kai-scheduler-kai-scheduler-v0-16-9-default
Wizard wrote <work>/kai-scheduler-kai-scheduler-v0-16-9-default/out/spec/selection.yaml and inputs.yaml
Collector produced 2 fact(s) in <work>/kai-scheduler-kai-scheduler-v0-16-9-default/out/spec/facts.yaml
Base: default; components: []
Namespace: kai-scheduler
Rendered 37 manifest(s) to <work>/kai-scheduler-kai-scheduler-v0-16-9-default/out/manifests
Next: cub installer upload --work-dir <work>/kai-scheduler-kai-scheduler-v0-16-9-default --space <slug>

>> Read what was rendered; nothing has touched the cluster yet
clusterrole-kai-admission.yaml
clusterrole-kai-binder.yaml
clusterrole-kai-node-scale-adjuster.yaml
clusterrole-kai-numa-placement-exporter.yaml
clusterrole-kai-operator.yaml
clusterrole-kai-podgroup-controller.yaml
clusterrole-kai-podgrouper.yaml
clusterrole-kai-resource-reservation.yaml
clusterrole-kai-scheduler.yaml
clusterrole-queuecontroller.yaml
clusterrolebinding-kai-admission.yaml
clusterrolebinding-kai-binder.yaml
clusterrolebinding-kai-node-scale-adjuster.yaml
clusterrolebinding-kai-numa-placement-exporter.yaml
clusterrolebinding-kai-operator.yaml
clusterrolebinding-kai-podgroup-controller.yaml
clusterrolebinding-kai-podgrouper.yaml
clusterrolebinding-kai-queuecontroller.yaml
clusterrolebinding-kai-scheduler.yaml
customresourcedefinition-bindrequests-scheduling-run-ai.yaml
customresourcedefinition-configs-kai-scheduler.yaml
customresourcedefinition-podgroups-scheduling-run-ai.yaml
customresourcedefinition-queues-scheduling-run-ai.yaml
customresourcedefinition-schedulingshards-kai-scheduler.yaml
customresourcedefinition-topologies-kai-scheduler.yaml
deployment-kai-scheduler-kai-operator.yaml
namespace-kai-resource-reservation.yaml
priorityclass-build-preemptible.yaml
priorityclass-build.yaml
priorityclass-inference.yaml
priorityclass-train.yaml
queue-default-parent-queue.yaml
queue-default-queue.yaml
rolebinding-kai-resource-reservation-kai-resource-reservation.yaml
schedulingshard-default.yaml
serviceaccount-kai-resource-reservation-kai-resource-reservation.yaml
serviceaccount-kai-scheduler-kai-operator.yaml

>> Ensure the kai-scheduler namespace exists
namespace/kai-scheduler created

>> Check 6 CRDs included with this package

>> Apply the rendered objects, except the CRDs already settled above
clusterrole.rbac.authorization.k8s.io/kai-admission created
clusterrole.rbac.authorization.k8s.io/kai-binder created
clusterrole.rbac.authorization.k8s.io/kai-node-scale-adjuster created
clusterrole.rbac.authorization.k8s.io/kai-numa-placement-exporter created
clusterrole.rbac.authorization.k8s.io/kai-operator created
clusterrole.rbac.authorization.k8s.io/kai-podgroup-controller created
clusterrole.rbac.authorization.k8s.io/kai-podgrouper created
clusterrole.rbac.authorization.k8s.io/kai-resource-reservation created
clusterrole.rbac.authorization.k8s.io/kai-scheduler created
clusterrole.rbac.authorization.k8s.io/queuecontroller created
clusterrolebinding.rbac.authorization.k8s.io/kai-admission created
clusterrolebinding.rbac.authorization.k8s.io/kai-binder created
clusterrolebinding.rbac.authorization.k8s.io/kai-node-scale-adjuster created
clusterrolebinding.rbac.authorization.k8s.io/kai-numa-placement-exporter created
clusterrolebinding.rbac.authorization.k8s.io/kai-operator created
clusterrolebinding.rbac.authorization.k8s.io/kai-podgroup-controller created
clusterrolebinding.rbac.authorization.k8s.io/kai-podgrouper created
clusterrolebinding.rbac.authorization.k8s.io/kai-queuecontroller created
clusterrolebinding.rbac.authorization.k8s.io/kai-scheduler created
deployment.apps/kai-operator created
namespace/kai-resource-reservation created
priorityclass.scheduling.k8s.io/build-preemptible created
priorityclass.scheduling.k8s.io/build created
priorityclass.scheduling.k8s.io/inference created
priorityclass.scheduling.k8s.io/train created
queue.scheduling.run.ai/default-parent-queue created
queue.scheduling.run.ai/default-queue created
rolebinding.rbac.authorization.k8s.io/kai-resource-reservation created
schedulingshard.kai.scheduler/default created
serviceaccount/kai-resource-reservation created
serviceaccount/kai-operator created

>> Applied. The cluster received the files in ./kai-scheduler-kai-scheduler-v0-16-9-default/out. Its CRDs were settled first, from the package.

>> This install is not finished. The plan has 2 install steps that this script does not run:
   - Before an install or an upgrade, move the CRDs forward and migrate topologies
   - After an install or an upgrade, apply the Config that tells the operator what to run

>> Not run by this script: the pre-install/pre-upgrade, post-install/post-upgrade and post-delete steps of this base's plan. The entry page says who runs each one.
[exit 0 at 07:00:31Z]

$ sleep 60; kubectl -n kai-scheduler get pods --no-headers | cut -c1-90; kubectl -n kai-scheduler get deploy --no-headers | cut -c1-70; kubectl get configs.kai.scheduler 2>&1 | head -3
kai-operator-7559d7f54c-dv9wk   1/1   Running   0     60s
kai-operator   1/1   1     1     60s
No resources found
[exit 0 at 07:01:31Z]
```

## Run 1, continued. The two hook phases by hand

The pre-install objects were applied after the rendered objects here, which is
later than Helm would run them. Both Jobs completed. The topology migration
found nothing to migrate.

```
$ kubectl apply -f ./kai-scheduler-kai-scheduler-v0-16-9-default/package/prerequisites/kai-scheduler-lifecycle/default/pre-install-pre-upgrade.yaml | tail -3; kubectl -n kai-scheduler wait --for=condition=complete -- ...
clusterrolebinding.rbac.authorization.k8s.io/kai-scheduler-crd-manager created
job.batch/crd-upgrader created
job.batch/topology-migration created
job.batch/crd-upgrader condition met
job.batch/topology-migration condition met
Checking for Kueue Topology CRD...
Kueue Topology CRD not found, skipping migration.
job.batch "crd-upgrader" deleted from kai-scheduler namespace
job.batch "topology-migration" deleted from kai-scheduler namespace
[exit 0 at 07:01:54Z]
```

The post-install Job applied the `kai-config` object. Seventy-five seconds
later the operator had deployed the scheduler and five other workloads.

```
$ kubectl apply -f ./kai-scheduler-kai-scheduler-v0-16-9-default/package/prerequisites/kai-scheduler-lifecycle/default/post-install-post-upgrade.yaml | tail -2; kubectl -n kai-scheduler wait --for=condition=complete  ...
clusterrolebinding.rbac.authorization.k8s.io/kai-scheduler-config-deployer created
job.batch/kai-config-deployer created
job.batch/kai-config-deployer condition met
config.kai.scheduler/kai-config serverside-applied
clusterrolebinding.rbac.authorization.k8s.io "kai-scheduler-config-deployer" deleted
job.batch "kai-config-deployer" deleted from kai-scheduler namespace
[exit 0 at 07:01:57Z]

$ sleep 75; kubectl get configs.kai.scheduler --no-headers 2>&1 | cut -c1-80; kubectl -n kai-scheduler get deploy --no-headers | cut -c1-70
kai-config   79s
admission               1/1   1     1     78s
binder                  1/1   1     1     78s
kai-operator            1/1   1     1     2m42s
kai-scheduler-default   1/1   1     1     78s
pod-grouper             1/1   1     1     78s
podgroup-controller     1/1   1     1     78s
queue-controller        1/1   1     1     78s
[exit 0 at 07:03:13Z]
```

## Run 2. The changed script

The script generator was changed after run 1. For an install hook that the
package ships and the plan assigns to the delivery workflow, the script now
applies the hook's objects in Helm's hook-weight order, waits for each Job,
and deletes the hook objects. Pre-install hooks run before the rendered
objects and post-install hooks after them.

This run used a new cluster. Lines that end `condition met` or
`serverside-applied` are filtered out of the script's output.

```
$ kind create cluster --name cwtest-1011-kai2 --kubeconfig ./kubeconfig --wait 120s 2>&1 | tail -1; kubectl get nodes --no-headers
Thanks for using kind! 😊
cwtest-1011-kai2-control-plane   Ready   control-plane   24s   v1.35.0
[exit 0 at 07:06:50Z]

$ /bin/bash ./try.sh 2>&1 | sed -n "/Ensure the kai-scheduler namespace/,\$p" | grep -v "condition met$\|serverside-applied$"
>> Ensure the kai-scheduler namespace exists
namespace/kai-scheduler created

>> Check 6 CRDs included with this package
customresourcedefinition.apiextensions.k8s.io/bindrequests.scheduling.run.ai condition met
customresourcedefinition.apiextensions.k8s.io/configs.kai.scheduler condition met
customresourcedefinition.apiextensions.k8s.io/podgroups.scheduling.run.ai condition met
customresourcedefinition.apiextensions.k8s.io/queues.scheduling.run.ai condition met
customresourcedefinition.apiextensions.k8s.io/schedulingshards.kai.scheduler condition met
customresourcedefinition.apiextensions.k8s.io/topologies.kai.scheduler condition met

>> Before an install or an upgrade, move the CRDs forward and migrate topologies
serviceaccount/kai-scheduler-crd-manager created
clusterrole.rbac.authorization.k8s.io/kai-scheduler-crd-manager created
clusterrolebinding.rbac.authorization.k8s.io/kai-scheduler-crd-manager created
serviceaccount/kai-topology-migration created
clusterrole.rbac.authorization.k8s.io/kai-topology-migration created
clusterrolebinding.rbac.authorization.k8s.io/kai-topology-migration created
job.batch/crd-upgrader created
job.batch/crd-upgrader condition met
configmap/topology-migration-script created
job.batch/topology-migration created
job.batch/topology-migration condition met
serviceaccount "kai-topology-migration" deleted from kai-scheduler namespace
serviceaccount "kai-scheduler-crd-manager" deleted from kai-scheduler namespace
configmap "topology-migration-script" deleted from kai-scheduler namespace
clusterrole.rbac.authorization.k8s.io "kai-topology-migration" deleted
clusterrole.rbac.authorization.k8s.io "kai-scheduler-crd-manager" deleted
clusterrolebinding.rbac.authorization.k8s.io "kai-topology-migration" deleted
clusterrolebinding.rbac.authorization.k8s.io "kai-scheduler-crd-manager" deleted
job.batch "crd-upgrader" deleted from kai-scheduler namespace
job.batch "topology-migration" deleted from kai-scheduler namespace

>> Apply the rendered objects, except the CRDs already settled above
clusterrole.rbac.authorization.k8s.io/kai-admission created
clusterrole.rbac.authorization.k8s.io/kai-binder created
clusterrole.rbac.authorization.k8s.io/kai-node-scale-adjuster created
clusterrole.rbac.authorization.k8s.io/kai-numa-placement-exporter created
clusterrole.rbac.authorization.k8s.io/kai-operator created
clusterrole.rbac.authorization.k8s.io/kai-podgroup-controller created
clusterrole.rbac.authorization.k8s.io/kai-podgrouper created
clusterrole.rbac.authorization.k8s.io/kai-resource-reservation created
clusterrole.rbac.authorization.k8s.io/kai-scheduler created
clusterrole.rbac.authorization.k8s.io/queuecontroller created
clusterrolebinding.rbac.authorization.k8s.io/kai-admission created
clusterrolebinding.rbac.authorization.k8s.io/kai-binder created
clusterrolebinding.rbac.authorization.k8s.io/kai-node-scale-adjuster created
clusterrolebinding.rbac.authorization.k8s.io/kai-numa-placement-exporter created
clusterrolebinding.rbac.authorization.k8s.io/kai-operator created
clusterrolebinding.rbac.authorization.k8s.io/kai-podgroup-controller created
clusterrolebinding.rbac.authorization.k8s.io/kai-podgrouper created
clusterrolebinding.rbac.authorization.k8s.io/kai-queuecontroller created
clusterrolebinding.rbac.authorization.k8s.io/kai-scheduler created
deployment.apps/kai-operator created
namespace/kai-resource-reservation created
priorityclass.scheduling.k8s.io/build-preemptible created
priorityclass.scheduling.k8s.io/build created
priorityclass.scheduling.k8s.io/inference created
priorityclass.scheduling.k8s.io/train created
queue.scheduling.run.ai/default-parent-queue created
queue.scheduling.run.ai/default-queue created
rolebinding.rbac.authorization.k8s.io/kai-resource-reservation created
schedulingshard.kai.scheduler/default created
serviceaccount/kai-resource-reservation created
serviceaccount/kai-operator created

>> After an install or an upgrade, apply the Config that tells the operator what to run
serviceaccount/kai-config-deployer created
configmap/kai-config-manifest created
clusterrole.rbac.authorization.k8s.io/kai-scheduler-config-deployer created
clusterrolebinding.rbac.authorization.k8s.io/kai-scheduler-config-deployer created
job.batch/kai-config-deployer created
job.batch/kai-config-deployer condition met
serviceaccount "kai-config-deployer" deleted from kai-scheduler namespace
configmap "kai-config-manifest" deleted from kai-scheduler namespace
clusterrole.rbac.authorization.k8s.io "kai-scheduler-config-deployer" deleted
clusterrolebinding.rbac.authorization.k8s.io "kai-scheduler-config-deployer" deleted
job.batch "kai-config-deployer" deleted from kai-scheduler namespace

>> Done. The cluster received the files in ./kai-scheduler-kai-scheduler-v0-16-9-default/out. Its CRDs were settled first, from the package. 2 packaged steps ran with the apply.

>> Not run by this script: the post-delete step of this base's plan. The entry page says who runs it.
[exit 0 at 07:07:12Z]

$ sleep 75; kubectl get configs.kai.scheduler --no-headers | cut -c1-40; kubectl -n kai-scheduler get deploy --no-headers | cut -c1-60
kai-config   85s
admission               1/1   1     1     76s
binder                  1/1   1     1     76s
kai-operator            1/1   1     1     86s
kai-scheduler-default   1/1   1     1     77s
pod-grouper             1/1   1     1     76s
podgroup-controller     1/1   1     1     76s
queue-controller        1/1   1     1     76s
[exit 0 at 07:08:35Z]
```

Both clusters were deleted with `kind delete cluster`, and the checksum of the
machine's default kubeconfig was the same as before the walk.

## What the walk did not cover

- The `aicr-eks-training` base of the same chart, whose script changed in the same way, was not run.
- The post-delete step of the plan was not run.
- No upgrade was run, so the hooks were seen only at install.
- No workload was scheduled. The walk shows the scheduler's Deployments available and says nothing about scheduling.
- One run of each kind, on one machine, with one node and no GPUs.
