#!/bin/sh
set -eu

base="${INSTALLER_BASE:-default}"
check_mode="${TARGET_FACT_CHECK_MODE:-record}"

emit_empty() {
  cat <<YAML
targetFacts:
  requiredSecrets: []
  requiredCRDs: []
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
  - keys:
    - access_key
    - secret_key
    name: tempo-s3-credentials
    namespace: tempo
    purpose: S3 access credentials referenced by Tempo environment variables

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: servicemonitors.monitoring.coreos.com
    purpose: Prometheus Operator ServiceMonitor CRD required by Tempo's ServiceMonitor
      object
    sourcePath: ../../../prometheus-community/kube-prometheus-stack/85.3.3/revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: prometheus-community/kube-prometheus-stack@85.3.3/default

targetFactChecks:
  base: "s3-query-observability"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  *)
    emit_empty
    ;;
esac
