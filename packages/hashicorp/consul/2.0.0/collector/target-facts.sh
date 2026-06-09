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
  'secure-mesh-existing-secrets')
    if [ "$check_mode" = "live" ]; then
      live_check_secret 'consul' 'consul-ca-cert' 'tls.crt'
      live_check_secret 'consul' 'consul-server-cert' 'tls.crt'
      live_check_secret 'consul' 'consul-server-cert' 'tls.key'
      live_check_secret 'consul' 'consul-gossip-encryption-key' 'key'
      live_check_secret 'consul' 'consul-bootstrap-acl-token' 'token'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets:
  - keys:
    - tls.crt
    name: consul-ca-cert
    namespace: consul
    purpose: Consul TLS CA certificate
  - keys:
    - tls.crt
    - tls.key
    name: consul-server-cert
    namespace: consul
    purpose: Consul server TLS certificate and private key
  - keys:
    - key
    name: consul-gossip-encryption-key
    namespace: consul
    purpose: Consul gossip encryption key
  - keys:
    - token
    name: consul-bootstrap-acl-token
    namespace: consul
    purpose: Consul ACL bootstrap token

  requiredCRDs: []

targetFactChecks:
  base: "secure-mesh-existing-secrets"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  *)
    emit_empty
    ;;
esac
