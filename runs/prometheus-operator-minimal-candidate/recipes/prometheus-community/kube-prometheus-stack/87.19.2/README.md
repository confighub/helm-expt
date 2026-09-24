# prometheus-community/kube-prometheus-stack 87.19.2 Proof

> **Offline candidate only.** This artifact is for local, deterministic evaluation. It is not root-Catalog-retained, Kubara-compatible, live-qualified, or published.

This is an offline candidate proof slice for the kube-prometheus-stack minimal Prometheus Operator platform.

Variants:

- `minimal`: Prometheus Operator platform without Grafana, Alertmanager, default rules, or exporter dependencies; 24 Helm objects, 25 cub installer objects including Namespace.

What this proves:

- the minimal platform renders 24 ordinary objects, including 10 Prometheus Operator CRDs, and no Secrets;
- the admission webhook lifecycle remains a target fact and requires observation after apply;
- no sample application is packaged, so application ServiceMonitor selection and runtime scraping need separate acceptance.

Useful commands:

```sh
npm run kube-prometheus-stack:generate
npm run kube-prometheus-stack:verify
```
