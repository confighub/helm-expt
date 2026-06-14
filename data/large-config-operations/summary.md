# Large ConfigHub Operations

Generated from committed live Helm-vs-ConfigHub receipts. This report shows
large ConfigHub operations as a funnel, so a 100+ Unit upload/apply/GitOps path
does not collapse into a vague wait.

This is evidence about current receipts, not a claim that the CLI already emits
perfect progress streams. Rows with missing upload/apply timing keep that product
gap visible. Current live parity receipts mostly exercise direct apply and
OCI/GitOps; a separate `cub unit apply --wait` receipt should be added when
that path is the operation under review.

```text
large rows: 6
minimum ConfigHub OCI objects: 50
latest observed receipt: 2026-06-14T13:11:10Z
complete: 5
workload-convergence: 1
```

## Rows

| Chart | Base | Result | OCI objects | Units | Stage | GitOps | Workload | Timings | Target profile | Residue | Missing progress | Receipt | Next action |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | `default` | pass | 50 |  | complete | Synced/Healthy | pass |  |  |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/argo-cd-argo-cd-default/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `hashicorp/consul@2.0.0` | `default-control-plane` | pass | 69 |  | complete | Synced/Healthy | pass |  |  |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/hashicorp-consul-default-control-plane/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `hashicorp/consul@2.0.0` | `secure-mesh-existing-secrets` | watch | 98 | 98 | workload-convergence | Synced/Progressing | watch | upload 310.744s; unit apply 322.912s; app apply 1.504s; argo wait 422.712s | kind-three-node; 3 nodes; pass | Deployment/consul/consul-consul-connect-injector:Synced/Progressing; Deployment/consul/consul-consul-ingress-gateway:Synced/Progressing; Deployment/consul/consul-consul-mesh-gateway:Synced/Progressing; Deployment/consul/consul-consul-terminating-gateway:Synced/Progressing; Ingress/consul/consul-consul-ui:Synced/Progressing; Job/consul/consul-consul-server-acl-init:Synced/Progressing; StatefulSet/consul/consul-consul-server:Synced/Progressing |  | [receipt](../../runs/live-helm-confighub-compare/hashicorp-consul-secure-mesh-existing-secrets/receipt.yaml) | Preserve the row as watch, name the first non-green stage, and rerun only after the target/controller policy is explicit. |
| `kyverno/kyverno@3.8.1` | `default` | pass | 70 |  | complete | Synced/Healthy | pass |  | none; pass |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/kyverno-kyverno-default/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `default` | pass | 125 |  | complete | Synced/Healthy | pass |  |  |  | gitops-operation-elapsed; confighub-upload-elapsed | [receipt](../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-default/receipt.yaml) | Add upload/apply elapsed-time evidence in the next live run so this pass also proves progress visibility. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `no-crds` | pass | 115 |  | complete | Synced/Healthy | pass | upload 234.236s; unit apply 61.145s; app apply 0.992s; argo wait 40.266s | none; pass |  |  | [receipt](../../runs/live-helm-confighub-compare/prometheus-community-kube-prometheus-stack-no-crds/receipt.yaml) | Keep the evidence fresh before using as a large-operation example. |

## Reading Rule

Read these rows stage by stage:

1. regular Helm runtime;
2. ConfigHub direct apply;
3. ConfigHub OCI/GitOps sync;
4. target facts and lifecycle prerequisites;
5. workload convergence;
6. controller aggregate health;
7. upload/apply progress evidence.

A row can prove render/runtime parity and still remain `watch` if controller
aggregate health has a named residue. A row can pass and still need better
progress evidence if upload/apply elapsed time is not recorded.

The machine-readable table is [operations.csv](./operations.csv).
