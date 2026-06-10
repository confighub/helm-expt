#!/bin/sh
set -eu

base="${INSTALLER_BASE:-default}"
check_mode="${TARGET_FACT_CHECK_MODE:-record}"

emit_empty() {
  cat <<YAML
targetFacts:
  requiredSecrets: []
  requiredCRDs: []
  requiredValues: []
  requiredObjectStores: []
targetFactChecks:
  base: "$base"
  mode: not-required
  result: pass
YAML
}

live_check_secret() {
  namespace="$1"
  name="$2"
  key="$3"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl -n "$namespace" get secret "$name" >/dev/null 2>&1; then
    echo "required Secret $namespace/$name was not found" >&2
    exit 1
  fi
  if ! kubectl -n "$namespace" get secret "$name" -o yaml | awk -v key="$key" '$1 == key ":" { found=1 } END { exit found ? 0 : 1 }'; then
    echo "required Secret $namespace/$name is missing key $key" >&2
    exit 1
  fi
}

live_check_crd() {
  name="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl get crd "$name" >/dev/null 2>&1; then
    echo "required CRD $name was not found" >&2
    exit 1
  fi
}

case "$base" in
  's3-query-observability')
    if [ "$check_mode" = "live" ]; then
      live_check_secret 'tempo' 'tempo-s3-credentials' 'access_key'
      live_check_secret 'tempo' 'tempo-s3-credentials' 'secret_key'
      live_check_crd 'servicemonitors.monitoring.coreos.com'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets:
  -
    namespace: "tempo"
    name: "tempo-s3-credentials"
    keys:
      - "access_key"
      - "secret_key"
    purpose: "S3 access credentials referenced by Tempo environment variables"
  requiredCRDs:
  -
    name: "servicemonitors.monitoring.coreos.com"
    sourcePath: "../../../prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml"
    sourceVariant: "prometheus-community/kube-prometheus-stack@85.3.3/default"
    purpose: "Prometheus Operator ServiceMonitor CRD required by Tempo's ServiceMonitor object"
    deliveryLanes:
      - "regularHelm"
      - "cubInstallerApply"
      - "configHubKubectlApply"
      - "configHubOciArgo"
  requiredValues:
  -
    path: "tempo.storage.trace.s3.endpoint"
    purpose: "S3-compatible endpoint that Tempo will write traces to"
    stage: "pre-render"
    deliveryLanes:
      - "recipe"
  -
    path: "tempo.storage.trace.s3.bucket"
    purpose: "Existing bucket for Tempo trace blocks"
    stage: "pre-render"
    deliveryLanes:
      - "recipe"
  -
    path: "tempo.storage.trace.s3.region"
    purpose: "Object-store region used with the selected endpoint and bucket"
    stage: "pre-render"
    deliveryLanes:
      - "recipe"
  requiredObjectStores:
  -
    kind: "S3CompatibleObjectStore"
    namespace: "tempo"
    name: "tempo-object-store"
    serviceName: "tempo-object-store"
    endpoint: "tempo-object-store.tempo.svc.cluster.local:9000"
    bucket: "tempo-traces"
    credentialsSecret:
      name: "tempo-s3-credentials"
      accessKey: "access_key"
      secretKey: "secret_key"
    purpose: "Local S3-compatible object-store fixture used to prove the S3 base can become ready when its target prerequisite exists"
    deliveryLanes:
      - "regularHelm"
      - "cubInstallerApply"
targetFactChecks:
  base: "$base"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  *)
    emit_empty
    ;;
esac
