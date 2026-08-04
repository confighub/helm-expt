# prometheus-community/kube-prometheus-stack 87.15.1

This package contains 3 ready-to-use preset configs:

- `default` includes the ten Prometheus Operator CRDs.
- `no-crds` leaves CRD ownership with the platform.
- `existing-secret` includes CRDs and references target-owned Grafana admin credentials.


All three presets carry the chart's real admission-webhook setup work. The package
includes the CRDs, the certificate creation and webhook patch Jobs, their
temporary RBAC, direct scripts, and a lifecycle action record under
`prerequisites/kube-prometheus-stack-lifecycle/`.

`cub installer setup` renders the checked Kubernetes objects. It does not
silently run the lifecycle actions. Use the generated public `try.sh`, or read `prerequisites/kube-prometheus-stack-lifecycle/README.md` and run the steps with your delivery system.

The hook image is pinned by digest. The generation receipt ties every packaged
route file to the locked upstream chart.
