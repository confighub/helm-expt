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
  'existing-tls-ingress')
    if [ "$check_mode" = "live" ]; then
      live_check_secret 'nginx' 'nginx-backend-tls' 'tls.crt'
      live_check_secret 'nginx' 'nginx-backend-tls' 'tls.key'
      live_check_secret 'nginx' 'nginx-backend-tls' 'ca.crt'
      live_check_secret 'nginx' 'nginx-ingress-tls' 'tls.crt'
      live_check_secret 'nginx' 'nginx-ingress-tls' 'tls.key'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets:
  - keys:
    - tls.crt
    - tls.key
    - ca.crt
    name: nginx-backend-tls
    namespace: nginx
    purpose: TLS certificate material mounted by the NGINX pod
  - keys:
    - tls.crt
    - tls.key
    name: nginx-ingress-tls
    namespace: nginx
    purpose: TLS certificate material referenced by the Ingress

  requiredCRDs: []

targetFactChecks:
  base: "existing-tls-ingress"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  *)
    emit_empty
    ;;
esac
