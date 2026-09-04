# Kube Prometheus Stack lifecycle route proof

These tests install kube-prometheus-stack 85.3.3 from its local `cub installer` package. The package contains the checked Kubernetes objects plus the CRDs and admission-webhook work that regular Helm runs around them.

Both catalog bases were tested on new kind clusters. Each package output matched its committed catalog render. The runner then applied ten CRDs, created the admission certificate, applied the workload, patched the webhooks, checked the running system, and removed the temporary Jobs and RBAC objects.

The upgrade routes are separate tests. The `default` package moved from 85.3.3 to 86.1.0 through the direct package route. The `no-crds` package moved through the four-stage Argo CD and Flux route. [Open the detailed default-package upgrade result](../kps-default-package-upgrade-proof/summary.md).

| Base | Checked chart objects | Established CRDs | Ready workloads | Upgrade route | Fresh install | Evidence |
| --- | ---: | ---: | ---: | --- | --- | --- |
| `default` | 124 | 10 | 6 | pass | pass | [receipt](../../runs/kps-lifecycle-route-proof/receipt.yaml) |
| `no-crds` | 114 | 10 | 6 | pass | pass | [receipt](../../runs/kps-lifecycle-route-proof/no-crds-receipt.yaml) |

## What this proves

The package can perform this chart's fresh-install work in the recorded order for both catalog bases. It uses the chart's own certificate and patch Jobs. The checked manifest set is unchanged. The two upgrade receipts show the same CRD, certificate, workload, webhook, runtime, and cleanup order for the named version pair.

## What remains

- The `default` upgrade has not been repeated through Argo CD or Flux.
- Rollback and long-running checks remain separate work.
- ConfigHub records the route but does not yet choose and execute it automatically.

## default

| Route | Direct result | Automatic | What happened |
| --- | --- | --- | --- |
| `crds-first` | pass | yes, in the direct script | Applied ten CRDs and waited for Established before dependent objects. |
| `postsync-check-or-observation` | pass | yes, in the direct script | Ran the chart's admission-patch Job after the webhook objects existed. |
| `preflight-or-presync` | pass | yes, in the direct script | Ran the chart's admission-create Job and observed the ca, cert, and key Secret. |
| `preserve-cleanup-policy` | pass | yes, in the direct script | Removed the successful hook Jobs and their temporary RBAC support objects. |
| `preserve-ordering` | pass | yes, in the direct script | Executed CRDs, certificate creation, ordinary objects, and webhook patching in order. |
| `target-facts-or-preflight` | pass | yes, in the direct script | Created the chart-required admission Secret through the recorded pre-install Job. |
| `upgrade-action-with-receipt` | pass | no | The direct package route upgraded the default preset from 85.3.3 to 86.1.0, established the updated CRDs, retained the admission Secret, reran the webhook step, checked six workloads, and removed the temporary Jobs. |
| `webhook-readiness-observation` | pass | yes, in the direct script | Observed three matching CA bundles, a ready operator endpoint, and a successful server dry-run. |

| Workload kind | Name | Result |
| --- | --- | --- |
| daemonset | `kube-prometheus-stack-prometheus-node-exporter` | pass |
| deployment | `kube-prometheus-stack-grafana` | pass |
| deployment | `kube-prometheus-stack-kube-state-metrics` | pass |
| deployment | `kube-prometheus-stack-operator` | pass |
| statefulset | `alertmanager-kube-prometheus-stack-alertmanager` | pass |
| statefulset | `prometheus-kube-prometheus-stack-prometheus` | pass |

Receipt: [`runs/kps-lifecycle-route-proof/receipt.yaml`](../../runs/kps-lifecycle-route-proof/receipt.yaml).

## no-crds

| Route | Direct result | Automatic | What happened |
| --- | --- | --- | --- |
| `crds-first` | pass | yes, in the direct script | Applied ten CRDs and waited for Established before dependent objects. |
| `postsync-check-or-observation` | pass | yes, in the direct script | Ran the chart's admission-patch Job after the webhook objects existed. |
| `preflight-or-presync` | pass | yes, in the direct script | Ran the chart's admission-create Job and observed the ca, cert, and key Secret. |
| `preserve-cleanup-policy` | pass | yes, in the direct script | Removed the successful hook Jobs and their temporary RBAC support objects. |
| `preserve-ordering` | pass | yes, in the direct script | Executed CRDs, certificate creation, ordinary objects, and webhook patching in order. |
| `target-facts-or-preflight` | pass | yes, in the direct script | Created the chart-required admission Secret through the recorded pre-install Job. |
| `upgrade-action-with-receipt` | pass | no | Argo CD and Flux upgraded the no-crds preset from 85.3.3 to 86.1.0, reran the four ordered stages, replaced both hook Jobs, and passed the runtime checks. |
| `webhook-readiness-observation` | pass | yes, in the direct script | Observed three matching CA bundles, a ready operator endpoint, and a successful server dry-run. |

| Workload kind | Name | Result |
| --- | --- | --- |
| daemonset | `kube-prometheus-stack-prometheus-node-exporter` | pass |
| deployment | `kube-prometheus-stack-grafana` | pass |
| deployment | `kube-prometheus-stack-kube-state-metrics` | pass |
| deployment | `kube-prometheus-stack-operator` | pass |
| statefulset | `alertmanager-kube-prometheus-stack-alertmanager` | pass |
| statefulset | `prometheus-kube-prometheus-stack-prometheus` | pass |

Receipt: [`runs/kps-lifecycle-route-proof/no-crds-receipt.yaml`](../../runs/kps-lifecycle-route-proof/no-crds-receipt.yaml).
