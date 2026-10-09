# See what a gpu-operator upgrade changes

Render NVIDIA's public `gpu-operator` Helm chart at two versions and compare
the Kubernetes objects each one installs. This Guide walks a version upgrade,
a patch upgrade and a driver version change. Each comparison names every
changed field.

Steps 1 to 5 run on your machine with Helm and `cub`, with no account and no
cluster. The comparison reads configuration only. The Catalog holds this chart
at four versions, each with several bases. This Guide renders the chart
itself, so you can pass your own values. It does not test the chart on a
cluster or say an upgrade is safe.
Step 6 is optional. It makes the same comparisons inside ConfigHub, and it
needs an account.

You can run the steps yourself or
[give an assistant the task](#a-task-for-an-assistant).

If your question is which of these changes can restart pods on GPU nodes or
take a node out of service, read
[what a changed field can do to a GPU node](#what-a-changed-field-can-do-to-a-gpu-node)
after step 4.

## Set up the tools

Install [the cub CLI](https://confighub.github.io/helm-expt/site/try.html#install-cub)
and [Helm](https://helm.sh/docs/intro/install/). Then install the Workshop
plugin release this Guide was checked with (version 0.6.58).

```sh
cub plugin install confighub/cub-workshop@v0.6.58
```

The commands below were checked with cub 0.8.7 and Helm `v4.1.4`.

## 1. Render the three chart versions

The chart pulls from NVIDIA's public Helm repository without a login. Its
version strings start with `v`. The `--repo` flag reads the repository
directly, so your Helm repository list stays as it is.

```sh
mkdir gpu-operator-diff
cd gpu-operator-diff
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v25.10.1 --namespace gpu-operator > gpu-operator-25.10.1.yaml
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v26.3.2 --namespace gpu-operator > gpu-operator-26.3.2.yaml
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v26.3.3 --namespace gpu-operator > gpu-operator-26.3.3.yaml
```

Each command exits `0`, and each file holds 27 objects. These renders use the
chart's default values. To compare what you run, pass your own values file to
both renders with `--values`.

## 2. Compare 25.10.1 with 26.3.3

Start with the summary.

```sh
cub config diff gpu-operator-25.10.1.yaml gpu-operator-26.3.3.yaml --summary
```

```text
Configuration diff: 1 added, 1 removed, 24 changed, 2 unchanged
Kind summary (inventory only):
  apps/v1 DaemonSet: 1 -> 1 (+0)
  apps/v1 Deployment: 3 -> 3 (+0)
  batch/v1 Job: 2 -> 2 (+0)
  nvidia.com/v1 ClusterPolicy: 1 -> 1 (+0)
  rbac.authorization.k8s.io/v1 ClusterRole: 5 -> 5 (+0)
  rbac.authorization.k8s.io/v1 ClusterRoleBinding: 5 -> 5 (+0)
  rbac.authorization.k8s.io/v1 Role: 2 -> 2 (+0)
  rbac.authorization.k8s.io/v1 RoleBinding: 2 -> 2 (+0)
  v1 ConfigMap: 2 -> 2 (+0)
  v1 ServiceAccount: 4 -> 4 (+0)
Local inventory comparison only. Matching kind counts do not establish object or behavior equivalence; this does not merge, protect edits or inspect a live target.
```

The kind counts match on both sides, yet 24 of the 27 objects changed. Save
the full field list next.

```sh
cub config diff gpu-operator-25.10.1.yaml gpu-operator-26.3.3.yaml --json --out upgrade.json
```

The command exits `0`, prints the JSON and writes the same JSON to
`upgrade.json`. The file records a SHA-256 hash for each input file. It lists
104 changed fields across the 24 changed objects. Run the same command with no
flags to read those fields as text.

Seventeen of the 24 objects changed only in two labels,
`app.kubernetes.io/version` and `helm.sh/chart`. The other seven hold the
changes to read.

| Object | Changed fields | What changed besides the labels |
| --- | --- | --- |
| ClusterPolicy `cluster-policy` | 35 | The component versions and several defaults. The next table lists nine of them. |
| Deployment `gpu-operator` | 10 | The image moves from `v25.10.1` to `v26.3.3`. The `host-os-release` volume and its mount are removed. The tolerations and node affinity drop `node-role.kubernetes.io/master`. |
| Job `gpu-operator-upgrade-crd` | 8 | The image moves to `v26.3.3`. The command changes from a shell that runs `kubectl apply` to `/usr/bin/manage-crds`. |
| DaemonSet `gpu-operator-node-feature-discovery-worker` | 5 | The image moves from `v0.18.2` to `v0.18.3`. The `checksum/config` annotation and the tolerations change. |
| Job `gpu-operator-node-feature-discovery-prune` | 5 | The image moves to `v0.18.3`. |
| Deployment `gpu-operator-node-feature-discovery-master` | 4 | The image moves to `v0.18.3`, and the `checksum/config` annotation changes. |
| Deployment `gpu-operator-node-feature-discovery-gc` | 3 | The image moves to `v0.18.3`. |

The ClusterPolicy carries most of the upgrade. Eighteen of its 35 changed
fields replace a version string. These nine show the kinds of change to look
for.

| ClusterPolicy field | Before | After |
| --- | --- | --- |
| `/spec/driver/version` | `580.105.08` | `580.126.20` |
| `/spec/toolkit/version` | `v1.18.1` | `v1.19.1` |
| `/spec/devicePlugin/version` | `v0.18.1` | `v0.19.3` |
| `/spec/ccManager/enabled` | `false` | `true` |
| `/spec/ccManager/defaultMode` | `off` | `on` |
| `/spec/sandboxWorkloads/mode` | absent | `kubevirt` |
| `/spec/kataSandboxDevicePlugin` | absent | added, with `enabled: true` |
| `/spec/kataManager/config` | present | removed |
| `/spec/operator/initContainer` | present | removed |

The added object and the removed object are the same ServiceAccount,
`gpu-operator-upgrade-crd-hook-sa`. Chart v25.10.1 renders it with no
namespace, and chart v26.3.3 renders it in `gpu-operator`. The diff identifies
an object by API version, kind, written namespace and name. It applies no
Kubernetes defaults, so it reports one removal and one addition.

## 3. Compare 26.3.2 with 26.3.3

Run the same two commands on the patch pair.

```sh
cub config diff gpu-operator-26.3.2.yaml gpu-operator-26.3.3.yaml --summary
cub config diff gpu-operator-26.3.2.yaml gpu-operator-26.3.3.yaml --json --out patch.json
```

The summary starts with this line, and the kind counts are the same as in
step 2.

```text
Configuration diff: 0 added, 0 removed, 8 changed, 19 unchanged
```

`patch.json` lists 27 changed fields in eight objects. Five of the eight
changed only in the two version labels. Three hold other changes.

| Object | Changed fields | What changed besides the labels |
| --- | --- | --- |
| ClusterPolicy `cluster-policy` | 7 | `/spec/devicePlugin/version` and `/spec/gfd/version` move from `v0.19.2` to `v0.19.3`. `/spec/nodeStatusExporter/version` and `/spec/validator/version` move from `v26.3.2` to `v26.3.3`. |
| Deployment `gpu-operator` | 5 | The image moves from `v26.3.2` to `v26.3.3`. |
| Job `gpu-operator-upgrade-crd` | 5 | The image moves from `v26.3.2` to `v26.3.3`. |

The driver version stays at `580.126.20` in this pair. The Node Feature
Discovery objects are all among the 19 unchanged.

## 4. Compare a driver version change

Chart v25.10.1 sets `driver.version` to `580.105.08` by default. Charts
v26.3.2 and v26.3.3 set it to `580.126.20`. This step keeps the chart at
v25.10.1 and changes only the driver version.

```sh
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v25.10.1 --namespace gpu-operator --set driver.version=580.105.08 > driver-before.yaml
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v25.10.1 --namespace gpu-operator --set driver.version=580.126.20 > driver-after.yaml
cub config diff driver-before.yaml driver-after.yaml
```

```text
Configuration diff: 0 added, 0 removed, 1 changed, 26 unchanged
  changed: nvidia.com/v1 ClusterPolicy (namespace unspecified)/cluster-policy
    /spec/driver/version replace: "580.105.08" -> "580.126.20"
Local comparison only. This does not merge, protect edits or inspect a live target.
```

One field changes on one object. The version string appears once in each
render, on the ClusterPolicy. What the operator does on each node after that
field changes is outside this diff. NVIDIA documents it, and
[step 5 sets it out](#what-a-changed-field-can-do-to-a-gpu-node).

Keep the result as a file in the same way.

```sh
cub config diff driver-before.yaml driver-after.yaml --json --out driver.json
```

This Guide does not check that driver `580.126.20` exists for your operating
system. It does not check that chart v25.10.1 supports that driver either.
Check both in NVIDIA's documentation before you use the value.

## 5. Know what the diff does not show

### What a changed field can do to a GPU node

The diff names fields. It cannot show what the operator does when it reads
them. This part maps the fields from steps 2 to 4 to what NVIDIA documents.
The Catalog has observed none of it, because the one cluster it delivered to
had no GPU.

NVIDIA separates two cases. Its page
[Upgrading the NVIDIA GPU Operator](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/upgrade.html)
says most of the DaemonSets the operator manages update in place, and that the
driver DaemonSet needs special care. Its page
[GPU Driver Upgrades](https://docs.nvidia.com/datacenter/cloud-native/gpu-operator/latest/gpu-driver-upgrades.html)
describes that care.

#### A driver version change takes GPU workloads off each node in turn

When the driver version changes, the operator's upgrade controller moves each
GPU node through a fixed sequence. It cordons the node. It waits for the pods
or jobs you told it to wait for. It deletes the pods that hold GPUs. It
restarts the driver pod at the new version, validates the node and uncordons
it. A workload that uses a GPU on that node stops when its pod is deleted.
NVIDIA's page does not say whether those pods are rescheduled. That depends on
what created them.

The rendered ClusterPolicy carries the settings that govern the sequence, under
`spec.driver.upgradePolicy`. All four chart versions in the Catalog render the
same values on the default base.

| Field | Rendered value | What NVIDIA documents for it |
| --- | --- | --- |
| `autoUpgrade` | `true` | The upgrade controller acts on the affected nodes without a further step from you. Set it to `false` to pause automatic driver upgrades. |
| `maxParallelUpgrades` | `1` | One node is upgraded at a time. |
| `maxUnavailable` | `25%` | At most a quarter of the affected nodes are unavailable during the upgrade. |
| `drain.enable` | `false` | The node is not drained. A drain is a fallback for when deleting the GPU pods fails, and it evicts every pod on the node. |
| `podDeletion.force` | `false` | This group controls the deletion of pods that hold GPUs. NVIDIA's page says force must be on to evict GPU pods that no controller manages. |
| `waitForCompletion.timeoutSeconds` | `0` | A value of `0` waits without limit for the pods or jobs you select. The render selects none. |

Three more things from the same page are worth knowing before a driver change.
A node labelled `nvidia.com/gpu-driver-upgrade.skip=true` is left out. A node
whose upgrade fails is labelled `upgrade-failed`, and the page gives the label
that starts it again. A note on the same page says GPU pods are evicted
whenever the driver DaemonSet specification is updated, so the driver version
may not be the only field that starts the sequence.

Read your own values before you rely on this table. Check
`spec.driver.upgradePolicy` in your render, because a values file can change
every row.

```sh
grep -n -A 14 "upgradePolicy:" gpu-operator-26.3.3.yaml
```

#### Which version steps change the driver

These are the versions the chart's default values render. A values file that
pins `driver.version` keeps the driver where you pinned it.

| Step | Driver | Container toolkit | Device plugin and GPU feature discovery | Also changes |
| --- | --- | --- | --- | --- |
| v25.10.1 to v26.3.2 | `580.105.08` to `580.126.20` | `v1.18.1` to `v1.19.1` | `v0.18.1` to `v0.19.2` | DCGM exporter, MIG manager, validator |
| v26.3.2 to v26.3.3 | no change | no change | `v0.19.2` to `v0.19.3` | validator |
| v26.3.3 to v26.7.1 | `580.126.20` to `595.91.07` | `v1.19.1` to `v1.20.1` | `v0.19.3` to `v0.20.1` | DCGM exporter, MIG manager, validator |

So the patch step in step 3 does not change the driver, and the sequence above
does not start on its account. The step from v25.10.1 to v26.3.3 in step 2
does change it, unless your values pin the driver.

Check this for your own pair of renders. The command prints every changed
field under `spec.driver`, and nothing when there is none.

```sh
cub config diff gpu-operator-26.3.2.yaml gpu-operator-26.3.3.yaml | grep "/spec/driver/"
cub config diff gpu-operator-25.10.1.yaml gpu-operator-26.3.3.yaml | grep "/spec/driver/"
```

The first command prints nothing. The second prints two lines.

```text
    /spec/driver/manager/version replace: "v0.9.1" -> "v0.11.0"
    /spec/driver/version replace: "580.105.08" -> "580.126.20"
```

The second pair also changes the driver manager version, which sits under the
same `spec.driver` settings.

#### The other version fields replace pods and leave the node in service

Each of the other version fields on the ClusterPolicy names the image of a
DaemonSet the operator runs on GPU nodes. These are the container toolkit, the
device plugin, GPU feature discovery, the DCGM exporter, the MIG manager and
the validator. When a version changes, the operator updates that DaemonSet,
and its pods are replaced. The render sets `spec.daemonsets.updateStrategy` to
`RollingUpdate` with `maxUnavailable` of `1`, so the pods are replaced one node
at a time.

NVIDIA's upgrade page says most of these DaemonSets upgrade without special
handling. It does not say what a running GPU workload sees while the device
plugin or the container toolkit pod restarts on its node, and the Catalog has
not measured it. Treat that as an open question for your own workloads.

Two changed fields in step 3 replace nothing on a GPU node.
`spec.nodeStatusExporter.version` changes, and the render sets
`spec.nodeStatusExporter.enabled` to `false`, so the operator runs no such
pods. The image of the `gpu-operator` Deployment changes, which restarts the
operator's own pod.

#### Four questions, and how far this Guide answers them

| Question | What you have after this Guide |
| --- | --- |
| Is this candidate safe to deploy to my clusters? | Not answered. The diff shows what changes. Whether the new driver supports your operating system, kernel and GPUs is in NVIDIA's documentation. |
| Can it deploy without disruption? | Partly. The diff and the table above tell you whether the driver sequence starts and which settings govern it. Nothing here was observed on a GPU node. |
| Would a rollback keep my workloads and their data? | Not answered. Moving the driver version back is another driver version change, and it runs the same sequence. |
| Has the reversal been shown to work? | No. The Catalog has no run of an upgrade or a rollback of this chart. |

### The diff compares files, not a cluster

Both inputs are files that Helm rendered from the chart's default values. Your
cluster can hold other values, edits made in place and objects that exist
only there. Neither file contains them.

Each JSON file names four things the comparison did not check, under
`notChecked`.

- Kubernetes schema or admission validity
- upstream merge and protected-field preservation
- target readiness or live drift
- application availability

### Hooks appear as ordinary objects

Eight of the 27 objects in each render are Helm hooks. `helm template` prints
them in the same stream as every other object, and the diff compares them the
same way. A hook carries a `helm.sh/hook` annotation.

Four are `pre-upgrade` hooks. They are the Job `gpu-operator-upgrade-crd` and
its ServiceAccount, ClusterRole and ClusterRoleBinding. The other four are
`post-delete` hooks for the Job `gpu-operator-node-feature-discovery-prune`.
Render without hooks to see the split.

```sh
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v26.3.3 --namespace gpu-operator --no-hooks > no-hooks-26.3.3.yaml
cub config diff gpu-operator-26.3.3.yaml no-hooks-26.3.3.yaml --summary
```

The summary starts with this line.

```text
Configuration diff: 0 added, 8 removed, 0 changed, 19 unchanged
```

Rendering a hook does not run it. The annotation says what Helm does with the
object. It does not show that Argo CD, Flux or `kubectl apply` does the same.
The [hooks and CRDs Guide](./workshop-lifecycle-guide.md) shows how to review
that work.

### CRDs stay out unless you ask for them

`helm template` leaves out the chart's `crds/` directory unless you add
`--include-crds`. The steps above leave it out. Helm's
[CRD documentation](https://helm.sh/docs/chart_best_practices/custom_resource_definitions/)
says Helm has no support for upgrading CRDs. A `helm upgrade` therefore does
not apply that directory.

This chart handles CRDs with its `pre-upgrade` hook instead. In v26.3.3 the
`gpu-operator-upgrade-crd` Job applies three CRD files from inside the
operator image. The render names those files. It cannot show what they
contain.

To see the CRD changes that the chart package carries, render both versions
again with CRDs.

```sh
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v25.10.1 --namespace gpu-operator --include-crds > with-crds-25.10.1.yaml
helm template gpu-operator gpu-operator --repo https://helm.ngc.nvidia.com/nvidia --version v26.3.3 --namespace gpu-operator --include-crds > with-crds-26.3.3.yaml
cub config diff with-crds-25.10.1.yaml with-crds-26.3.3.yaml --json --out crds.json
```

Each file now holds 32 objects, and five of them are CRDs. Two CRDs changed.
`clusterpolicies.nvidia.com` has 42 changed fields and
`nvidiadrivers.nvidia.com` has five. The three Node Feature Discovery CRDs did
not change.

### Exit 0 is not approval

Every `cub config diff` command above exits `0`, including the one that found
24 changed objects. Exit `0` means the comparison ran. With `--exit-code` the
command exits `1` when the files differ and `0` when they match. Neither exit
code says the upgrade is safe to apply.

### One delivery to a cluster with no GPUs

On 2026-10-08 the default base of v26.3.3 was deployed through ConfigHub and
Argo CD v3.5.4 to a kind cluster that had no GPUs. The
[walk log](./live-walk-entry-steps-2026-10-08.md) holds every command and its
output.

Argo CD accepted all 25 objects in one sync, with the CRDs before the
workloads. The Application ended Synced and Healthy. The ClusterPolicy
reported `ready` with the reason `NoGPUNodes`, and the operator created none of
its eight GPU DaemonSets. The chart's hooks are `pre-upgrade` and
`post-delete` only, so nothing was missing at install.

That run did not exercise an upgrade or a removal. It did not show the chart's
CRD upgrade Job or its post-delete cleanup, and it did not run on a node with a
GPU. The run does not show that the operator works on GPU hardware.

## 6. Compare the versions in ConfigHub

This step needs a ConfigHub account, and it writes Spaces to your
organization. It was run once, on 2026-10-08, with cub v0.8.7 and files
rendered on a laptop. No cluster, Worker or Target was involved, and nothing
was applied. The [run log](./live-run-log-2026-10-08.md) holds every command
and its output.

That run used renders of the same three chart versions that held 24 objects
each, and five of the 24 were CRDs. The log does not record the Helm flags of
those renders. Your files from step 1 hold 27 objects, so your counts differ
from the counts below. Add `--dry-run` to an upload to preview it.

### Upload each version as a variant of one component

Sign in with `cub auth login` first.

```sh
cub variant upload --component gpu-operator --variant v25-10-1 --namespace gpu-operator --unit-annotation chart-version=v25.10.1 gpu-operator-25.10.1.yaml
cub variant upload --component gpu-operator --variant v26-3-2 --namespace gpu-operator --unit-annotation chart-version=v26.3.2 gpu-operator-26.3.2.yaml
cub variant upload --component gpu-operator --variant v26-3-3 --namespace gpu-operator --unit-annotation chart-version=v26.3.3 gpu-operator-26.3.3.yaml
cub space list --component gpu-operator
```

In the run, each upload created one Space named `<component>-<variant>`. The
three Spaces held 24 Units each, with the same Unit names. Every object
becomes its own Unit, except Secrets, which the upload skips. The files in the
run held no Secret.

Read the whole output of each upload. A later upload in the run printed
`link FAILED` with `exceeded maximum quota for entity type Link`, and the
command still exited `0`. Its Units were written and its Links were missing.
Check your Link quota before you keep several Spaces of this size.

### Compare one Unit across two versions

`cub unit diff` compares the same Unit in two Spaces.

```sh
cub unit diff --space gpu-operator-v26-3-2 cluster-policy-clusterpolicy --with-unit gpu-operator-v26-3-3/cluster-policy-clusterpolicy -o mutations
```

In the run, this printed seven changed paths on the ClusterPolicy. Two of them
follow.

```text
  ~ [Update] spec.validator.version
      v26.3.2 → v26.3.3
  ~ [Update] spec.devicePlugin.version
      v0.19.2 → v0.19.3
```

The same command for v25.10.1 and v26.3.2 printed 35 changed paths.

cub v0.8.7 has no single command that compares two whole Spaces. A loop over
the Unit names covers a whole version.

```sh
cub unit list --space gpu-operator-v26-3-2 --no-headers -o jq='.[].Unit.Slug' | sort > slugs.txt
while read -r u; do cub unit diff --space gpu-operator-v26-3-2 "$u" --with-unit "gpu-operator-v26-3-3/$u" -o mutations; done < slugs.txt
```

In the run, the loop from v26.3.2 to v26.3.3 printed 22 changed paths in seven
Units, and the other 17 Units printed "No changes". From v25.10.1 to v26.3.2
it printed 132 changed paths in 21 Units.

### See a whole version step in one command

Upload the next version into the same variant. The upload updates only the
Units whose content changed, and it records one ChangeSet. `cub variant diff`
then compares the whole Space before and after that ChangeSet.

```sh
cub variant upload --component gpu-operator --variant rolling --namespace gpu-operator --change-desc "chart v26.3.2" gpu-operator-26.3.2.yaml
cub variant upload --component gpu-operator --variant rolling --namespace gpu-operator --change-desc "chart v26.3.3" gpu-operator-26.3.3.yaml
cub changeset list --space gpu-operator-rolling
cub variant diff gpu-operator-rolling Before:ChangeSet:<upload> ChangeSet:<upload> -o mutations
```

Replace `<upload>` with the name that `cub changeset list` prints for the
later upload. In the run, this diff reported 7 of 24 Units changed, with the
same 22 paths as the loop. Use the ChangeSet form. A diff between the end tags
of two different uploads shows every Unit that the later upload left unchanged
as "absent".

### See the driver version change

The run uploaded a v25.10.1 render with driver `580.126.20` into the v25.10.1
variant. The upload updated one Unit and left 23 unchanged.

```sh
cub variant upload --component gpu-operator --variant v25-10-1 --namespace gpu-operator --unit-annotation chart-version=v25.10.1 --change-desc "driver 580.126.20 base" driver-after.yaml
cub variant diff -u gpu-operator-v25-10-1 Before:ChangeSet:<upload> ChangeSet:<upload>
```

The diff showed one changed path, `spec.driver.version`, on the ClusterPolicy
Unit.

```text
-    version: "580.105.08"
+    version: "580.126.20"
```

The run deleted its Spaces and its Component afterwards, and the log shows
those commands. This step deploys nothing.

## A task for an assistant

Start a fresh session in an empty directory with normal approvals.

```text
Render the NVIDIA gpu-operator chart from https://helm.ngc.nvidia.com/nvidia
at v25.10.1, v26.3.2 and v26.3.3 with helm template, using release name
gpu-operator and namespace gpu-operator, one file per version. Compare
v25.10.1 with v26.3.3, then v26.3.2 with v26.3.3, using cub config diff with
--summary and then with --json --out. Read every changed object and field.
Separate the objects that changed only in version labels from the rest. Then
render v25.10.1 twice, changing only driver.version from 580.105.08 to
580.126.20, and compare the two renders. List the objects that carry a
helm.sh/hook annotation and say what each hook Job runs. Say whether CRDs
were rendered. Report actual exit codes, counts and input hashes. Do not
infer a safe upgrade from exit 0 or from a short diff. Do not say a driver
version is supported unless I give you a source. Do not contact a cluster or
ConfigHub, and do not install, publish, approve or upgrade anything.
```

## Where the next step belongs

You now hold the renders and a JSON comparison for each case. Steps 1 to 5
upgraded, approved and sent nothing.

To turn a comparison into a review packet, follow
[Review a chart upgrade before promoting it](./workshop-upgrade-guide.md). It
adds the preconditions, the decision and the recovery plan that a diff cannot
supply. Use the [hooks and CRDs Guide](./workshop-lifecycle-guide.md) to
decide who runs the `pre-upgrade` Job and the CRD changes.

The Catalog holds this chart as an entry. Open
[gpu-operator v26.3.3](https://confighub.github.io/helm-expt/site/charts/nvidia-gpu-operator-v26-3-3.html)
for its retained objects, its driver bases and the five ConfigHub steps.
