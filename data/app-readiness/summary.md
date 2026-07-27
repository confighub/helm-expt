# RBAC permissions in catalog charts

This report checks the rendered default configuration for every catalog chart and lists RBAC rules that deserve review. It reads the committed Kubernetes objects, so it does not need access to a cluster and does not run Helm again.

Broad permissions are sometimes necessary, especially for operators and platform services. The purpose of this report is to show where those permissions occur so a team can decide whether each one is appropriate for its use.

Scanned **95** default renders; **69** ship RBAC; **50** contain at least one broad/risky rule by these conservative heuristics.

Findings across the catalog:

| Finding | Charts | Meaning |
| --- | ---: | --- |
| `full-wildcard` | 8 | a rule grants `*` verbs on `*` resources (admin-like) |
| `secret-read` | 46 | a rule can read Secrets (`get`/`list`/`watch` or `*`) |
| `priv-escalation` | 2 | a rule has `escalate`/`bind`/`impersonate` |
| `all-resources` | 8 | a rule targets `*` resources (non-wildcard verbs) |

## Charts to review first

| Chart | ClusterRoles | Roles | Risky rules | Findings |
| --- | ---: | ---: | ---: | --- |
| `crossplane-stable/crossplane/2.3.1` | 12 | 0 | 22 | `all-resources`, `full-wildcard`, `priv-escalation`, `secret-read` |
| `rook-release/rook-ceph/v1.19.5` | 33 | 14 | 16 | `secret-read` |
| `argo-cd/argo-cd/9.5.15` | 3 | 6 | 10 | `all-resources`, `full-wildcard`, `secret-read` |
| `argo-cd/argo-cd/9.5.17` | 3 | 6 | 10 | `all-resources`, `full-wildcard`, `secret-read` |
| `jetstack/cert-manager/v1.20.2` | 13 | 4 | 8 | `secret-read` |
| `istio/istiod/1.30.0` | 3 | 1 | 6 | `all-resources`, `secret-read` |
| `gatekeeper/gatekeeper/3.22.2` | 1 | 1 | 4 | `all-resources`, `secret-read` |
| `kyverno/kyverno/3.8.1` | 16 | 4 | 4 | `secret-read` |
| `haproxytech/kubernetes-ingress/1.52.0` | 1 | 0 | 3 | `all-resources`, `secret-read` |
| `kedacore/keda/2.19.0` | 4 | 1 | 3 | `all-resources`, `secret-read` |
| `minio-operator/operator/7.1.1` | 1 | 0 | 3 | `full-wildcard`, `secret-read` |
| `prometheus-community/kube-prometheus-stack/85.3.3` | 4 | 0 | 3 | `secret-read` |
| `prometheus-community/kube-prometheus-stack/86.1.0` | 4 | 0 | 3 | `secret-read` |
| `sealed-secrets/sealed-secrets/2.18.6` | 1 | 2 | 3 | `secret-read` |
| `hashicorp/terraform/1.1.2` | 0 | 1 | 2 | `full-wildcard`, `secret-read` |
| `projectcalico/tigera-operator/v3.32.0` | 2 | 0 | 2 | `priv-escalation`, `secret-read` |
| `aqua/trivy-operator/0.32.1` | 4 | 2 | 2 | `secret-read` |
| `argo-cd/argo-workflows/1.0.14` | 7 | 1 | 2 | `secret-read` |
| `external-secrets/external-secrets/2.5.0` | 5 | 1 | 2 | `secret-read` |
| `fairwinds-stable/goldilocks/10.3.0` | 2 | 0 | 2 | `all-resources` |
| `ingress-nginx/ingress-nginx/4.15.1` | 1 | 1 | 2 | `secret-read` |
| `longhorn/longhorn/1.11.2` | 1 | 1 | 2 | `secret-read` |
| `strimzi/strimzi-kafka-operator/1.0.0` | 7 | 0 | 2 | `secret-read` |
| `argo-cd/argo-events/2.4.21` | 1 | 0 | 1 | `secret-read` |
| `argo-cd/argo-rollouts/2.40.9` | 4 | 0 | 1 | `secret-read` |
| _… and 25 more_ | | | | |

## What happens after a finding

A finding is a reason to inspect the rendered Role or ClusterRole. If the permission is not needed, propose a precise object change, review the diff, run the normal policy checks, and require approval before delivery.

The [live RBAC review example](../rbac-review-live-proof/summary.md) follows that path for one namespaced service account. It removes Secret access, keeps ConfigMap access, proves that ConfigHub blocked the correction until approval, publishes the approved objects as OCI, and lets Argo CD deliver the result to an isolated Kubernetes cluster. The [walkthrough](../../docs/demo/apps/rbac-review.md) explains each step.


## Limits

- The rules are conservative. A finding asks for review; it does not declare that a chart is wrong.
- The report does not expand aggregated ClusterRoles or resolve the complete RoleBinding and ClusterRoleBinding graph.
- The catalog-wide scan is read-only. The live example proves one reviewed correction and Argo CD delivery on one throwaway cluster. It does not prove a permanent public package, Flux delivery, or fleet-wide RBAC analysis.

## Regenerate

~~~sh
npm run app-readiness:generate
npm run app-readiness:verify
~~~
