# A plan step watched through Argo CD, 2026-11-02

**UNOFFICIAL/EXPERIMENTAL**

This log records one run of the commands a Helm entry page printed for its OCI bundle,
for an entry whose plan has a CRD ordering step. The entry was
`nvidia-gpu-operator-v26-3-3-external-nfd`. Its `ClusterPolicy` cannot be accepted
until its CRD exists, so the order can visibly fail.

This is a dated record of one run. It is not a Guide and it is not a receipt for the
entry. Lines that start with `$` are commands that were run, and the text under them
is what they printed, trimmed where it says so. Colour codes are removed.

## Versions and setting

- The client is cub v0.9.0 and the cluster was a local kind cluster with Argo CD, made with `cub cluster up --name workshop --no-k8sbot`.
- The organization is a hosted ConfigHub organization. Every Space, Component and cluster the run created was deleted at the end.
- The run used no GPU. It checked delivery and ordering. The operator's pod was still starting when the run looked, and nothing ran on a GPU.

## What the run found

| Check | Result |
| --- | --- |
| The commands as printed that day | **Nothing was delivered.** The plan's documents went into the Release, and Argo CD could not apply them. |
| The same Release without the plan documents | Argo CD reported Synced, and the sync succeeded. |
| The plan's CRD ordering step | Argo CD created both CRDs first, and they were Established. It created the `ClusterPolicy` last. No sync waves or other setup were added. |
| A promotion from the base | It added the plan documents back, so they have to come out again before each publish. |
| An edit made to the variant, through that promotion | It survived, and the base change reached the cluster. |

## The failure

```text
$ cub variant create dev nvidia-gpu-operator-v26-3-3-external-nfd --target workshop/target --space-pattern "template:nvidia-gpu-operator-v26-3-3-external-nfd-dev"
  Success: 14 unit(s)
```

```text
$ cub release publish nvidia-gpu-operator-v26-3-3-external-nfd-dev
Successfully created release 847592c8-6cd0-46ca-8421-fdec78da8d58 (847592c8-6cd0-46ca-8421-fdec78da8d58)
```

Argo CD reported this after five retries, with no object created on the cluster.

```text
one or more synchronization tasks are not valid: failed to discover server resources for group version evidence.confighub.com/v1alpha1: the server could not find the requested resource (retried 5 times).
BundleTargetRequirements  SyncFailed  The Kubernetes API could not find evidence.confighub.com/BundleTargetRequirements
BundleRoute               SyncFailed  The Kubernetes API could not find evidence.confighub.com/BundleRoute
BundleRoute               SyncFailed  The Kubernetes API could not find evidence.confighub.com/BundleRoute
```

## The plan's documents in ConfigHub

The upload made a Unit for each document in the plan, beside the objects.

```text
Pulled oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-nvidia-gpu-operator-v26-3-3-external-nfd:r001@sha256:eccf5cc231753db9b686fe4f37b2dbedadb066794c8b4b0d8447bd26fd7b48b7 (sha256:eccf5cc231753db9b686fe4f37b2dbedadb066794c8b4b0d8447bd26fd7b48b7)
Space nvidia-gpu-operator-v26-3-3-external-nfd (Create)
  Create    namespace
  Create    v26-3-3-external-nfd-target-requirements-bundletargetrequirements
  Create    v26-3-3-external-nfd-crd-ordering-bundleroute
  Create    v26-3-3-external-nfd-lifecycle-actions-bundleroute
  Create    clusterpolicies.nvidia.com-crd
  Create    nvidiadrivers.nvidia.com-crd
  Create    gpu-operator-serviceaccount
  Create    gpu-operator-clusterrole
  Create    gpu-operator-clusterrolebinding
  Create    gpu-operator-role
  Create    gpu-operator-rolebinding
  Create    gpu-operator
  Create    cluster-policy-clusterpolicy
  Create    README.md
Note: the following references didn't resolve to any uploaded Unit (expected when the
target lives in the cluster, e.g. a Secret created out-of-band):
  - gpu-operator -> scheduling.k8s.io/v1/PriorityClass "system-node-critical"
```

## With the plan documents removed

```text
$ cub unit delete --space nvidia-gpu-operator-v26-3-3-external-nfd-dev --where "Slug LIKE '%-bundleroute'"

Bulk delete operation completed:
  Success: 2 unit(s)
  Context: Slug LIKE '%-bundleroute' AND SpaceID = '8951229e-d357-4872-8a92-ae115a3af514'
$ cub unit delete --space nvidia-gpu-operator-v26-3-3-external-nfd-dev --where "Slug LIKE '%-bundletargetrequirements'"

Bulk delete operation completed:
  Success: 1 unit(s)
  Context: Slug LIKE '%-bundletargetrequirements' AND SpaceID = '8951229e-d357-4872-8a92-ae115a3af514'
```

```text
$ cub release publish nvidia-gpu-operator-v26-3-3-external-nfd-dev
Successfully created release 9bdecb55-dee7-4db7-bd57-9d34fa59aa53 (9bdecb55-dee7-4db7-bd57-9d34fa59aa53)
```

Argo CD's record of the sync lists the objects in this order.

```text
Namespace                 gpu-operator                 Synced
ServiceAccount            gpu-operator                 Synced
CustomResourceDefinition  nvidiadrivers.nvidia.com     Synced
CustomResourceDefinition  clusterpolicies.nvidia.com   Synced
ClusterRole               gpu-operator                 Synced
ClusterRoleBinding        gpu-operator                 Synced
Role                      gpu-operator                 Synced
RoleBinding               gpu-operator                 Synced
Deployment                gpu-operator                 Synced
ClusterPolicy             cluster-policy               Synced
```

The cluster's timestamps agree.

```text
clusterpolicies.nvidia.com  created 2026-11-02T17:08:02Z  Established 2026-11-02T17:08:02Z
nvidiadrivers.nvidia.com    created 2026-11-02T17:08:02Z  Established 2026-11-02T17:08:02Z
cluster-policy              created 2026-11-02T17:08:05Z
```

## Promoting a change

The run set two replicas on the dev variant, added an annotation to the base, and
promoted. The promotion added the three plan documents back. After removing them and
publishing, the cluster held both changes.

```text
$ kubectl -n gpu-operator get deploy gpu-operator -o jsonpath=...
replicas=2 anno=yes
```

## Technical notes and disclaimers

- This is one run of one step on one entry. It shows Argo CD applied this entry's CRDs before the resource that needs them. It does not show how Argo CD behaves for every entry.
- The run did not exercise the entry's other plan step, which is due before an upgrade.
- Flux was not run.
- The Catalog's own records still mark this step as not proven for any runtime, because that claim needs a receipt.
