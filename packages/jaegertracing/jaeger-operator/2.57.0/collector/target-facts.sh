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
      live_check_crd 'certificates.cert-manager.io'
      live_check_crd 'issuers.cert-manager.io'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - runs/live-helm-confighub-compare/jaegertracing-jaeger-operator-default/receipt.yaml
    - runs/live-kind-parity/jaegertracing-jaeger-operator-default/receipt.yaml
    name: certificates.cert-manager.io
    purpose: The chart renders a cert-manager Certificate for the Jaeger admission webhook.
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl apply -f <cert-manager-install-manifest.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - runs/live-helm-confighub-compare/jaegertracing-jaeger-operator-default/receipt.yaml
    - runs/live-kind-parity/jaegertracing-jaeger-operator-default/receipt.yaml
    name: issuers.cert-manager.io
    purpose: The chart renders a cert-manager Issuer for the Jaeger admission webhook.
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl apply -f <cert-manager-install-manifest.yaml>

  requiredValues: []

  requiredObjectStores: []

  requiredTopology: null

targetFactChecks:
  base: "default"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  'no-crds')
    if [ "$check_mode" = "live" ]; then
      live_check_crd 'jaegers.jaegertracing.io'
      live_check_crd 'certificates.cert-manager.io'
      live_check_crd 'issuers.cert-manager.io'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - recipes/jaegertracing/jaeger-operator/2.57.0/revisions/default/r001/rendered/release-objects.yaml
    name: jaegers.jaegertracing.io
    purpose: Jaeger CRD managed outside this no-crds preset
    sourcePath: ../../revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <jaeger-crd.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - runs/live-helm-confighub-compare/jaegertracing-jaeger-operator-no-crds/receipt.yaml
    name: certificates.cert-manager.io
    purpose: The no-crds preset still renders a cert-manager Certificate for the Jaeger
      admission webhook.
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl apply -f <cert-manager-install-manifest.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - runs/live-helm-confighub-compare/jaegertracing-jaeger-operator-no-crds/receipt.yaml
    name: issuers.cert-manager.io
    purpose: The no-crds preset still renders a cert-manager Issuer for the Jaeger admission
      webhook.
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl apply -f <cert-manager-install-manifest.yaml>

  requiredValues: []

  requiredObjectStores: []

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
