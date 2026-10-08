# prometheus-community/kube-prometheus-stack 84.4.0 Proof

This is the exact-artifact ConfigHub component package for kube-prometheus-stack@84.4.0. kube-prometheus-stack installs the Prometheus Operator with a Prometheus, an Alertmanager, Grafana, kube-state-metrics, the node exporter, and default rules, ServiceMonitors and dashboards.

Variants:

- `default`: chart defaults with the Grafana admin password bound to a placeholder, as in the other Catalog versions of this chart; with no password set the chart generates a random one on every render; 126 Helm objects, 127 cub installer objects including Namespace.
- `aicr-eks-training-v0-20-0`: the values the AICR v0.20.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v0-20-0/argocd-helm-bundle/008-kube-prometheus-stack/values.yaml): the chart's CRDs off, the full name overridden to kube-prometheus and the subcharts renamed, the Grafana admin password set to the literal value admin, Prometheus given 15 days of retention and a 50Gi gp3 volume, resource requests and limits set, and every pod tolerating every taint; 116 Helm objects, 117 cub installer objects including Namespace.
- `aicr-eks-training-v1-0-0`: the values the AICR v1.0.0 EKS training entry supplies (examples/aicr/eks-h100-training-kubeflow-v1-0-0/argocd-helm-bundle/008-kube-prometheus-stack/values.yaml): the v0.20.0 values with every component except the node exporter also selected onto the system-worker node group; 116 Helm objects, 117 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run aicr-nested-charts-coverage:generate -- --only kube-prometheus-stack@84.4.0
npm run aicr-nested-charts-coverage:verify -- --only kube-prometheus-stack@84.4.0
```
