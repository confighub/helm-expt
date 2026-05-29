# prometheus-community/kube-prometheus-stack 85.3.3 Proof

This is the promoted proof slice for the kube-prometheus-stack public Helm chart.

Variants:

- `default`: default stack with Grafana admin password bound as a generated fact; 124 Helm objects, 125 cub installer objects including Namespace.
- `no-crds`: CRDs disabled with Grafana admin password bound; 114 Helm objects, 115 cub installer objects including Namespace.

What this proves:

- regular Helm output is preserved by `cub installer setup`, plus the explained Namespace support object;
- default chart render becomes deterministic when grafana.adminPassword is bound before render;
- the no-crds variant deliberately removes the 10 Prometheus Operator CRDs;
- CRD lifecycle, admission webhook, generated Grafana credential, umbrella dependency, and cluster RBAC risks are visible as scan/gate findings instead of hidden Helm behavior.

Useful commands:

```sh
npm run kube-prometheus-stack:generate-proof
npm run kube-prometheus-stack:generate-package
npm run kube-prometheus-stack:verify-proof
npm run kube-prometheus-stack:verify-package
npm run kube-prometheus-stack:compare
```
