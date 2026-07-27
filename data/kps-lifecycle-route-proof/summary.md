# Kube Prometheus Stack lifecycle route proof

This example runs the extra work that regular Helm normally performs around kube-prometheus-stack 85.3.3. It uses the locked upstream chart, the committed `default` render, and one throwaway kind cluster.

The run rendered 124 ordinary Kubernetes objects and seven Helm hook objects. The 124 ordinary objects matched the committed catalog render exactly. The script then:

1. applied ten CRDs and waited for each one to become Established;
2. ran the chart's admission certificate creation Job;
3. checked that the resulting Secret contained `ca`, `cert`, and `key`;
4. applied the 124 ordinary objects;
5. ran the chart's webhook patch Job;
6. checked all three webhook CA bundles, the operator endpoint, a server dry-run, and six workloads;
7. removed the successful hook Jobs and their temporary RBAC objects.

Overall result: **pass**.

## Route results

| Route | Direct result | Automatic | What happened |
| --- | --- | --- | --- |
| `crds-first` | pass | yes, in the direct script | Applied ten CRDs and waited for Established before dependent objects. |
| `postsync-check-or-observation` | pass | yes, in the direct script | Ran the chart's admission-patch Job after the webhook objects existed. |
| `preflight-or-presync` | pass | yes, in the direct script | Ran the chart's admission-create Job and observed the ca, cert, and key Secret. |
| `preserve-cleanup-policy` | pass | yes, in the direct script | Removed the successful hook Jobs and their temporary RBAC support objects. |
| `preserve-ordering` | pass | yes, in the direct script | Executed CRDs, certificate creation, ordinary objects, and webhook patching in order. |
| `target-facts-or-preflight` | pass | yes, in the direct script | Created the chart-required admission Secret through the recorded pre-install Job. |
| `upgrade-action-with-receipt` | not-run | no | This receipt covers a fresh install only; chart upgrade behavior remains unproved. |
| `webhook-readiness-observation` | pass | yes, in the direct script | Observed three matching CA bundles, a ready operator endpoint, and a successful server dry-run. |

## Workloads

| Kind | Name | Result |
| --- | --- | --- |
| daemonset | `kube-prometheus-stack-prometheus-node-exporter` | pass |
| deployment | `kube-prometheus-stack-grafana` | pass |
| deployment | `kube-prometheus-stack-kube-state-metrics` | pass |
| deployment | `kube-prometheus-stack-operator` | pass |
| statefulset | `alertmanager-kube-prometheus-stack-alertmanager` | pass |
| statefulset | `prometheus-kube-prometheus-stack-prometheus` | pass |

## What this proves

The direct script can perform the fresh-install lifecycle for this chart and version in the recorded order. It uses the chart's own certificate and patch Jobs rather than inventing a generic replacement. The ordinary manifest set remains the checked catalog render.

## What remains

- This receipt covers one fresh direct-apply installation on one local kind cluster.
- It does not prove the Argo CD or Flux implementation of these chart-specific routes.
- It does not prove the 85.3.3 to 86.1.0 upgrade route.
- The chart's own hook Jobs were rendered from the locked upstream chart and run explicitly; ConfigHub did not choose the route automatically.

Receipt: [`runs/kps-lifecycle-route-proof/receipt.yaml`](../../runs/kps-lifecycle-route-proof/receipt.yaml).
