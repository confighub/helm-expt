# Minimal Prometheus Operator candidate

This is a **candidate, static-only** profile for
`prometheus-community/kube-prometheus-stack` 87.19.2. The chart archive is
bound to SHA-256
`b846cc368aaafd122148c8eec9b361d3893c6068d6301ec20d41c8023dcd8c88`.
It enables CRDs, the Prometheus Operator, and Prometheus, while disabling
Grafana, Alertmanager, kube-state-metrics, node-exporter, default rules, and
the chart's Kubernetes ServiceMonitors.

The companion application is deliberately small and explicitly synthetic: its
Python standard-library HTTP server returns one static Prometheus fixture at
`/metrics`. It has a Deployment, Service, and ServiceMonitor in `monitoring`.
Its ServiceMonitor has
`release: kube-prometheus-stack`, and its named `metrics` endpoint binds to
the Service's named port. This makes the intended scrape relationship explicit
without claiming that a target has accepted or scraped it.

Render the pinned chart for the stated release, namespace, and Kubernetes
version, then append the application objects before checking the result:

```sh
(
set -eu
curl --fail --location --output kube-prometheus-stack-87.19.2.tgz \
  https://github.com/prometheus-community/helm-charts/releases/download/kube-prometheus-stack-87.19.2/kube-prometheus-stack-87.19.2.tgz
printf '%s  %s\n' \
  b846cc368aaafd122148c8eec9b361d3893c6068d6301ec20d41c8023dcd8c88 \
  kube-prometheus-stack-87.19.2.tgz | shasum -a 256 -c -
helm template kube-prometheus-stack ./kube-prometheus-stack-87.19.2.tgz \
  --version 87.19.2 \
  --include-crds \
  --namespace monitoring \
  --kube-version 1.30.0 \
  --values examples/prometheus-operator-minimal/values.yaml > rendered.yaml
printf '\n---\n' >> rendered.yaml
cat examples/prometheus-operator-minimal/app.yaml >> rendered.yaml
node scripts/verify-prometheus-operator-minimal.mjs rendered.yaml
)
```

Do not add `--no-hooks`: the render must retain the admission create and patch
Jobs as lifecycle evidence alongside the admission webhook configurations.
`kubernetesServiceMonitors.enabled: false` removes the chart's Kubernetes
component monitors; the operator and Prometheus self-monitors intentionally
remain, along with this candidate application's monitor.

This candidate has no lifecycle, publication, or runtime proof. It trades away
dashboards, alerts, and node or cluster exporters. It does not claim CRD
establishment, hook execution, webhook readiness, Prometheus readiness,
ServiceMonitor discovery, scrape success, upgrades, rollback, ConfigHub
retention, OCI publication, GitOps delivery, or cluster admission.
