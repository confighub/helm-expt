# A sample of OCI bundle entries run end to end, 2026-11-02

**UNOFFICIAL/EXPERIMENTAL**

This log records the commands twelve Helm entry pages printed for their OCI bundles, run
from upload to a sync on a local kind cluster. It also records one entry delivered through
Flux. This is a dated record of one run. It is not a Guide and it is not a receipt for any
entry.

## How the sample was chosen

The entries were drawn at random with a fixed seed from the bundle entries with at most 60
objects: 4 of 96 with verdict `safe-to-flatten` and 8 of 129 with verdict `flatten-with-routes`.
Each ran alone, with cub v0.9.0, and was removed before the next one.

"Synced" means Argo CD applied every object and the sync succeeded. "Healthy" means Argo CD
reported the objects healthy at the moment the run looked. "Progressing" means a workload
had not finished starting, and the run moved on after about two to five minutes.

## Results with Argo CD

| Entry | Objects | Has a plan | Result |
| --- | --- | --- | --- |
| `prometheus-community-kube-state-metrics-7-4-0-default` | 5 | No | Synced, Healthy |
| `bitnami-apache-11-4-29-default` | 5 | No | Synced, Progressing |
| `nats-nack-0-34-0-no-crds` | 4 | No | Synced, Healthy |
| `prometheus-community-prometheus-blackbox-exporter-11-10-0-cluster-metrics-readonly` | 4 | No | Synced, Healthy |
| `external-secrets-external-secrets-2-5-0-default` | 42 | Yes | Not tested: the organization hit its Link quota |
| `dra-driver-nvidia-dra-driver-nvidia-gpu-0-5-0-default` | 21 | Yes | Not tested: the organization hit its Link quota |
| `nvidia-gpu-operator-v26-7-1-driver-580-105-08` | 27 | Yes | Not tested: the organization hit its Link quota |
| `argo-cd-argo-rollouts-2-40-9-default` | 14 | Yes | Synced, Healthy |
| `grafana-rollout-operator-0-49-0-no-crds` | 13 | Yes | Synced, Progressing |
| `nvidia-gpu-operator-v26-3-3-preinstalled-driver` | 24 | Yes | Not tested: the organization hit its Link quota |
| `projectcalico-tigera-operator-v3-32-0-default` | 10 | Yes | Failed, see below |
| `grafana-alloy-1-8-2-default` | 7 | Yes | Synced, Healthy |

Seven entries delivered, and one failed. Four were not tested, on the first attempt or on a retry.

## The entry that failed

`projectcalico-tigera-operator-v3-32-0-default` holds `Installation`, `Whisker` and `Goldmane`
resources whose CRDs the operator creates when it starts. Argo CD stopped before applying
anything.

```text
one or more synchronization tasks are not valid: failed to discover server resources for group version operator.tigera.io/v1: the server could not find the requested resource.
```

The entry's plan names this. Its step `preflight-or-presync` says the operator must create
four CRDs before these objects are installed, and it leaves that to the delivery workflow.
The printed commands do not carry out that step, so they fail until someone does. This shows a
plan step that a GitOps tool does not do for you.

## The entries not tested

The hosted organization holds about 941 Links, close to its limit of about 1,000. The four
larger entries failed at `cub variant create` with this message.

```text
Failed: HTTP 403: exceeded maximum quota for entity type Link
```

This says nothing about whether those entries deliver.

## One entry through Flux

The run used `nvidia-gpu-operator-v26-3-3-external-nfd` on a cluster made with
`cub cluster up --name workshop --controller flux --no-k8sbot`.

| Check | Result |
| --- | --- |
| A Release holding the plan's documents | Flux refused it, with `no matches for kind "BundleRoute"`, as Argo CD does. The two CRDs were still applied. |
| The same Release without the plan documents | Flux applied the objects. |
| The CRD ordering step | The CRDs were created and Established at 19:50:38, from the earlier attempt. The `ClusterPolicy` and the Deployment were created at 19:53:42. |
| The Kustomization's Ready condition | **It still read "Reconciliation in progress" after about five minutes, when the run stopped watching.** The run did not find out why. |

## Technical notes and disclaimers

- Because the first Flux attempt had already applied the CRDs, this run does not show Flux ordering a fresh install. It shows the CRDs arriving before the resource that needs them.
- Twelve entries is a small sample. It does not show that the other entries deliver.
- No entry's plan steps other than CRD ordering were carried out. Entries whose plan names a Secret or another precondition may not start without it.
- The run ran no workload on a GPU, and it did not test an upgrade.
