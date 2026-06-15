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
  requiredNamespaces: []
  requiredTopology: null
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
  if [ -z "$key" ]; then
    return 0
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

live_check_namespace() {
  name="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl get namespace "$name" >/dev/null 2>&1; then
    echo "required Namespace $name was not found" >&2
    exit 1
  fi
}

live_check_min_schedulable_nodes() {
  required="$1"
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  count="$(kubectl get nodes -o jsonpath='{range .items[*]}{.spec.unschedulable}{"\n"}{end}' | awk '$1 != "true" { c++ } END { print c + 0 }')"
  if [ "$count" -lt "$required" ]; then
    echo "required at least $required schedulable node(s); found $count" >&2
    exit 1
  fi
}

case "$base" in
  'default')
    if [ "$check_mode" = "live" ]; then
      live_check_secret 'default' 'trust-manager-tls' 'tls.crt'
      live_check_secret 'default' 'trust-manager-tls' 'tls.key'
      live_check_crd 'certificates.cert-manager.io'
      live_check_crd 'issuers.cert-manager.io'
      live_check_namespace 'cert-manager'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    keys:
    - tls.crt
    - tls.key
    name: trust-manager-tls
    namespace: default
    purpose: trust-manager admission webhook TLS material normally produced by the rendered
      cert-manager Certificate lifecycle

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: certificates.cert-manager.io
    purpose: cert-manager Certificate CRD required by trust-manager certificate.yaml
    sourcePath: ../../cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: issuers.cert-manager.io
    purpose: cert-manager Issuer CRD required by trust-manager certificate.yaml
    sourcePath: ../../cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled

  requiredValues: []

  requiredObjectStores: []

  requiredNamespaces:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: cert-manager
    purpose: trust-manager uses cert-manager as the default trust namespace and regular
      Helm does not create it for this base

  requiredTopology: null

targetFactChecks:
  base: "default"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  'no-crds')
    if [ "$check_mode" = "live" ]; then
      live_check_secret 'default' 'trust-manager-tls' 'tls.crt'
      live_check_secret 'default' 'trust-manager-tls' 'tls.key'
      live_check_crd 'bundles.trust.cert-manager.io'
      live_check_crd 'certificates.cert-manager.io'
      live_check_crd 'issuers.cert-manager.io'
      live_check_namespace 'cert-manager'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    keys:
    - tls.crt
    - tls.key
    name: trust-manager-tls
    namespace: default
    purpose: trust-manager admission webhook TLS material normally produced by the rendered
      cert-manager Certificate lifecycle

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: bundles.trust.cert-manager.io
    purpose: trust-manager CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: certificates.cert-manager.io
    purpose: cert-manager Certificate CRD required by trust-manager certificate.yaml
    sourcePath: ../../cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: issuers.cert-manager.io
    purpose: cert-manager Issuer CRD required by trust-manager certificate.yaml
    sourcePath: ../../cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled

  requiredValues: []

  requiredObjectStores: []

  requiredNamespaces:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: cert-manager
    purpose: trust-manager uses cert-manager as the default trust namespace and regular
      Helm does not create it for the no-crds base

  requiredTopology: null

targetFactChecks:
  base: "no-crds"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  *)
    emit_empty
    ;;
esac
