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

This candidate has static lifecycle generation evidence, but no lifecycle execution,
publication, or runtime proof. It trades away
dashboards, alerts, and node or cluster exporters. It does not claim CRD
establishment, hook execution, webhook readiness, Prometheus readiness,
ServiceMonitor discovery, scrape success, upgrades, rollback, ConfigHub
retention, OCI publication, GitOps delivery, or cluster admission.

## Reproduce the offline installer candidate

The candidate keeps the platform separate from the sample app. Its 24 ordinary
objects retain ten CRDs and the two chart self-monitors. Seven Helm hook
objects become explicit lifecycle companions: establish CRDs, prepare the
admission Secret, then finish the webhook and clean up temporary resources.
These steps are recorded, not executed by this evaluation.

From the repository root, use an isolated output directory. The timestamp below
reproduces this retained evaluation; omit it to date a new run at execution time:

```sh
(
set -eu
export HELM_EXPT_PROOF_RECORDED_AT=2026-09-24
export HELM_EXPT_KPS_MINIMAL_CANDIDATE=1
export HELM_EXPT_PROOF_OFFLINE_CANDIDATE=1
export HELM_EXPT_PROOF_OUTPUT_ROOT=runs/prometheus-operator-minimal-candidate
export HELM_EXPT_CHART_VERSION=87.19.2
export HELM_EXPT_CHART_ARTIFACT_URL=https://github.com/prometheus-community/helm-charts/releases/download/kube-prometheus-stack-87.19.2/kube-prometheus-stack-87.19.2.tgz
export HELM_EXPT_CHART_ARTIFACT_SHA256=b846cc368aaafd122148c8eec9b361d3893c6068d6301ec20d41c8023dcd8c88
export HELM_EXPT_KPS_PACKAGE_EXTRAS_ROOT="$HELM_EXPT_PROOF_OUTPUT_ROOT/config-catalog/package-extras/prometheus-community/kube-prometheus-stack"
node scripts/kube-prometheus-stack-proof.mjs --generate-proof
node scripts/generate-kps-packaged-lifecycle.mjs --generate --version 87.19.2
node scripts/kube-prometheus-stack-proof.mjs --generate-package
node scripts/kube-prometheus-stack-proof.mjs --verify-proof
node scripts/generate-kps-packaged-lifecycle.mjs --verify --version 87.19.2
node scripts/kube-prometheus-stack-proof.mjs --verify-package
node scripts/kube-prometheus-stack-proof.mjs --compare
)
```

The receipt binds the lifecycle files to the exact chart, values, and retained
render. Installer evaluation checks object equivalence and explicit target
requirements. It does not publish a Catalog identity or prove a successful
scrape. Keep the application connection check above as a separate test.
