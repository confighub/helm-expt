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

case "$base" in
  'default')
    if [ "$check_mode" = "live" ]; then
      live_check_secret 'default' 'opentelemetry-operator-controller-manager-service-cert' 'tls.crt'
      live_check_secret 'default' 'opentelemetry-operator-controller-manager-service-cert' 'tls.key'
      live_check_crd 'certificates.cert-manager.io'
      live_check_crd 'issuers.cert-manager.io'
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
    name: opentelemetry-operator-controller-manager-service-cert
    namespace: default
    purpose: Webhook serving certificate Secret mounted by the operator Deployment
    suggestedSource: Run cert-manager controller to satisfy the chart-rendered Certificate,
      or stage a valid TLS Secret before waiting for the operator

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: certificates.cert-manager.io
    purpose: cert-manager Certificate CRD required by the chart-rendered serving certificate
      object
    sourcePath: ../../../jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled
    suggestedSource: Install cert-manager or apply the cert-manager Certificate CRD
      before applying this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: issuers.cert-manager.io
    purpose: cert-manager Issuer CRD required by the chart-rendered self-signed issuer
      object
    sourcePath: ../../../jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled
    suggestedSource: Install cert-manager or apply the cert-manager Issuer CRD before
      applying this base

targetFactChecks:
  base: "default"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  'no-crds')
    if [ "$check_mode" = "live" ]; then
      live_check_secret 'default' 'opentelemetry-operator-controller-manager-service-cert' 'tls.crt'
      live_check_secret 'default' 'opentelemetry-operator-controller-manager-service-cert' 'tls.key'
      live_check_crd 'certificates.cert-manager.io'
      live_check_crd 'issuers.cert-manager.io'
      live_check_crd 'instrumentations.opentelemetry.io'
      live_check_crd 'opampbridges.opentelemetry.io'
      live_check_crd 'opentelemetrycollectors.opentelemetry.io'
      live_check_crd 'targetallocators.opentelemetry.io'
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
    name: opentelemetry-operator-controller-manager-service-cert
    namespace: default
    purpose: Webhook serving certificate Secret mounted by the operator Deployment
    suggestedSource: Run cert-manager controller to satisfy the chart-rendered Certificate,
      or stage a valid TLS Secret before waiting for the operator

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: certificates.cert-manager.io
    purpose: cert-manager Certificate CRD required by the chart-rendered serving certificate
      object
    sourcePath: ../../../jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled
    suggestedSource: Install cert-manager or apply the cert-manager Certificate CRD
      before applying this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: issuers.cert-manager.io
    purpose: cert-manager Issuer CRD required by the chart-rendered self-signed issuer
      object
    sourcePath: ../../../jetstack/cert-manager/v1.20.2/revisions/crds-enabled/r001/rendered/release-objects.yaml
    sourceVariant: jetstack/cert-manager@v1.20.2/crds-enabled
    suggestedSource: Install cert-manager or apply the cert-manager Issuer CRD before
      applying this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: instrumentations.opentelemetry.io
    purpose: OpenTelemetry Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install the OpenTelemetry Operator
      CRDs before applying this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: opampbridges.opentelemetry.io
    purpose: OpenTelemetry Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install the OpenTelemetry Operator
      CRDs before applying this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: opentelemetrycollectors.opentelemetry.io
    purpose: OpenTelemetry Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install the OpenTelemetry Operator
      CRDs before applying this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: targetallocators.opentelemetry.io
    purpose: OpenTelemetry Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install the OpenTelemetry Operator
      CRDs before applying this base

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
