# Large ConfigHub Operations

Generated from committed live Helm-vs-ConfigHub receipts. This report shows
large ConfigHub operations as a funnel, so a 100+ Unit upload/apply/GitOps path
does not collapse into a vague wait.

This is evidence about current receipts, not a claim that the CLI already emits
perfect progress streams. Rows with missing upload or release-publish timing keep
that product gap visible. Current live parity receipts exercise direct apply and
the workload-Space and cluster-Space release publications used by OCI/GitOps.

```text
large rows: 10
minimum ConfigHub OCI objects: 50
latest observed receipt: 2026-06-15T05:11:39Z
complete: 8
controller-health-watch: 1
gitops-sync: 1
```

## Rows

| Chart | Base | Result | OCI objects | Units | Stage | GitOps | Workload | Timings | Target profile | Residue | Missing progress | Receipt | Next action |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | `default` | pass | 50 |  | complete | Synced/Healthy | pass |  |  |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/argo-cd-argo-cd-default/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `argo-cd/argo-cd@9.5.17` | `default` | watch | 50 |  | gitops-sync | unknown/unknown | watch | upload 150.478s; workload publish 34.253s; app publish 0.989s; argo wait 422.643s | none; pass | gitops-health:unknown |  | [receipt](../../runs/live-helm-confighub-compare/argo-cd-argo-cd-default-9-5-17/receipt.yaml) | Preserve the row as watch, name the first non-green stage, and rerun only after the target/controller policy is explicit. |
| `hashicorp/consul@2.0.0` | `default-control-plane` | pass | 69 |  | complete | Synced/Healthy | pass |  |  |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/hashicorp-consul-default-control-plane/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `hashicorp/consul@2.0.0` | `secure-mesh-existing-secrets` | watch | 98 | 98 | controller-health-watch | Synced/Progressing | pass | upload 302.519s; workload publish 326.841s; app publish 1.038s; argo wait 422.615s | kind-three-node; 3 nodes; pass | Ingress/consul/consul-consul-ui:Synced/Progressing |  | [receipt](../../runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml) | Keep as watch until the controller-health residue is explained or accepted for the target scope (Ingress/consul/consul-consul-ui:Synced/Progressing); add upload/apply elapsed-time evidence on rerun. |
| `kyverno/kyverno@3.8.1` | `default` | pass | 70 |  | complete | Synced/Healthy | pass |  | none; pass |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/kyverno-kyverno-default/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `default` | pass | 125 |  | complete | Synced/Healthy | pass |  |  |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `no-crds` | pass | 115 |  | complete | Synced/Healthy | pass | upload 234.236s; workload publish 61.145s; app publish 0.992s; argo wait 40.266s | none; pass |  |  | [receipt](../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml) | Keep the evidence fresh before using as a large-operation example. |
| `prometheus-community/kube-prometheus-stack@86.1.0` | `default` | pass | 125 |  | complete | Synced/Healthy | pass | upload 340.426s; workload publish 79.984s; app publish 0.908s; argo wait 50.342s | none; pass |  |  | [receipt](../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default-86-1-0/receipt.yaml) | Keep the evidence fresh before using as a large-operation example. |
| `prometheus-community/kube-prometheus-stack@86.1.0` | `no-crds` | pass | 115 |  | complete | Synced/Healthy | pass | upload 227.808s; workload publish 70.946s; app publish 1.129s; argo wait 50.351s | none; pass |  |  | [receipt](../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds-86-1-0/receipt.yaml) | Keep the evidence fresh before using as a large-operation example. |
| `rook-release/rook-ceph@v1.19.5` | `default` | pass | 134 |  | complete | Synced/Healthy | pass | upload 339.623s; workload publish 90.003s; app publish 1.023s; argo wait 30.229s | none; pass |  |  | [receipt](../../runs/live-helm-confighub-compare/rook-release-rook-ceph-default/receipt.yaml) | Keep the evidence fresh before using as a large-operation example. |

## Reading Rule

Read these rows stage by stage:

1. regular Helm runtime;
2. ConfigHub direct apply;
3. ConfigHub OCI/GitOps sync;
4. target facts and lifecycle prerequisites;
5. workload convergence;
6. controller aggregate health;
7. upload and release-publish progress evidence.

A row can prove render/runtime parity and still remain `watch` if controller
aggregate health has a named residue. A row can pass and still need better
progress evidence if upload or release-publish elapsed time is not recorded.

The machine-readable table is [operations.csv](./operations.csv).
