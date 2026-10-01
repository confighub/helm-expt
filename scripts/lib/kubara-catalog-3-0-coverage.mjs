// The exact chart versions Kubara catalogs 3.0 (bootstrap 3.0.0 and general 3.0.0)
// pin, and how the Workshop Catalog checks each. Twenty dependency rows collapse to
// eighteen unique chart versions: cert-manager, kube-prometheus-stack and
// external-secrets appear in both catalogs. Four were already checked at the exact
// version (external-dns 1.21.1, metallb 0.16.1, oauth2-proxy 10.7.0, velero 12.1.0)
// and are not repeated here. Each entry below is one addition, in priority order.
//
// `script` is the proof declaration that renders and packages the chart;
// `candidate` selects the entry inside scripts/kubara-catalog-3-0-proof.mjs.

const entry = (repository, chart, version, url, sha256, script, candidate) =>
  Object.freeze({
    canonicalIdentity: `${repository}/${chart}`,
    repository,
    chart,
    version,
    url,
    sha256,
    script,
    ...(candidate ? { candidate } : {}),
    recipePath: `recipes/${repository}/${chart}/${version}`,
    packagePath: `packages/${repository}/${chart}/${version}`,
  });

const generic = "kubara-catalog-3-0-proof.mjs";

export const KUBARA_CATALOG_3_0_ADDITIONS = Object.freeze([
  // The bootstrap catalog always installs these four.
  entry("argo-cd", "argo-cd", "10.7.0", "https://github.com/argoproj/argo-helm/releases/download/argo-cd-10.7.0/argo-cd-10.7.0.tgz", "820d1abc8135cb882fa3c35dfe0f828f98134b0769cbbd280d140ddc89fb9935", "argo-cd-proof.mjs"),
  entry("jetstack", "cert-manager", "v1.21.1", "https://charts.jetstack.io/charts/cert-manager-v1.21.1.tgz", "c27101f3f3e2349fb4a9e704316105bf7b52ad73b8c8257d3498ef7f2f6a4adc", "cert-manager-proof.mjs"),
  entry("prometheus-community", "kube-prometheus-stack", "88.6.3", "https://github.com/prometheus-community/helm-charts/releases/download/kube-prometheus-stack-88.6.3/kube-prometheus-stack-88.6.3.tgz", "c66cb763940b7d9e12923dd4667aabd672ae298ed39d7a4ee9ff7bf34fe45923", "kube-prometheus-stack-proof.mjs"),
  entry("external-secrets", "external-secrets", "2.10.0", "https://github.com/external-secrets/external-secrets/releases/download/helm-chart-2.10.0/external-secrets-2.10.0.tgz", "b96e948fff3674638b5d3f9e43886f3796e04739c4b4127929aed2ddac7d1418", "external-secrets-proof.mjs"),
  // The starter platform's defaults.
  entry("traefik", "traefik", "41.4.0", "oci://ghcr.io/traefik/helm/traefik:41.4.0", "d055ea3cc343e741776bf4d2e97093ab9cc698e1e05329b6a01ad47272aa983c", generic, "traefik"),
  entry("metrics-server", "metrics-server", "3.14.0", "https://github.com/kubernetes-sigs/metrics-server/releases/download/metrics-server-helm-chart-3.14.0/metrics-server-3.14.0.tgz", "c2ca1185c01e6e7f53dd1b7d131f0c9b3fa50e003ed068b784563a1b5a3422a1", "metrics-server-proof.mjs"),
  // The rest.
  entry("grafana", "loki", "7.3.0", "https://github.com/grafana/helm-charts/releases/download/helm-loki-7.3.0/loki-7.3.0.tgz", "04a339f712d770a1f599f05fc0a5a3cde18e43914e49ae6a49f7171be86bcc09", generic, "loki"),
  entry("grafana", "alloy", "1.12.1", "https://github.com/grafana/helm-charts/releases/download/alloy-1.12.1/alloy-1.12.1.tgz", "cdd1ec39f99c3c506d5b521156d72236ea143c089f50da6b64398f831734829c", generic, "alloy"),
  entry("prometheus-community", "prometheus-blackbox-exporter", "11.18.0", "https://github.com/prometheus-community/helm-charts/releases/download/prometheus-blackbox-exporter-11.18.0/prometheus-blackbox-exporter-11.18.0.tgz", "19322b26614c62d6277a1471e26c0b5379ce9ebf43897e01ab85d3e164594ab8", generic, "prometheus-blackbox-exporter"),
  entry("stakater", "reloader", "2.2.16", "https://stakater.github.io/stakater-charts/reloader-2.2.16.tgz", "5389fb496a120d6aac8f2b33c54ba21ed59014131def14cfc78f9d4a9374d2b7", generic, "reloader"),
  entry("kyverno", "kyverno", "3.9.0", "https://kyverno.github.io/kyverno/kyverno-3.9.0.tgz", "9663e8d3d15b070e5925b4f26b3f9a8824872a42ac7bf27ca105c897cb5aba51", generic, "kyverno"),
  entry("kyverno", "kyverno-policies", "3.9.0", "https://kyverno.github.io/kyverno/kyverno-policies-3.9.0.tgz", "75eece1dd8c5f995c5818ed05a60f7714a2c60cac0a9eec69d331dbba24fc501", generic, "kyverno-policies"),
  entry("policy-reporter", "policy-reporter", "3.10.0", "https://github.com/kyverno/policy-reporter/releases/download/policy-reporter-3.10.0/policy-reporter-3.10.0.tgz", "9bd9f4ab3ddd16662f8982f1c1588197346978aa2062cc9fe131c8ae70781a72", generic, "policy-reporter"),
  entry("longhorn", "longhorn", "1.12.1", "https://github.com/longhorn/charts/releases/download/longhorn-1.12.1/longhorn-1.12.1.tgz", "c8cf4b35a9d872cd5f7e44fd26d8e6ac7c2abaee42f4e2f2a0b0ebbc6e3a6116", generic, "longhorn"),
]);
