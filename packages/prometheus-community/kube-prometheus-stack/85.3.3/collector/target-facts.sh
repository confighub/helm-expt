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
      live_check_secret 'monitoring' 'kube-prometheus-stack-admission' 'cert'
      live_check_secret 'monitoring' 'kube-prometheus-stack-admission' 'key'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets:
  - deliveryLanes:
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    keys:
    - cert
    - key
    name: kube-prometheus-stack-admission
    namespace: monitoring
    purpose: Prometheus Operator admission webhook TLS material normally created by
      Helm hook lifecycle

  requiredCRDs: []

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
      live_check_secret 'monitoring' 'kube-prometheus-stack-admission' 'cert'
      live_check_secret 'monitoring' 'kube-prometheus-stack-admission' 'key'
      live_check_crd 'alertmanagerconfigs.monitoring.coreos.com'
      live_check_crd 'alertmanagers.monitoring.coreos.com'
      live_check_crd 'podmonitors.monitoring.coreos.com'
      live_check_crd 'probes.monitoring.coreos.com'
      live_check_crd 'prometheusagents.monitoring.coreos.com'
      live_check_crd 'prometheuses.monitoring.coreos.com'
      live_check_crd 'prometheusrules.monitoring.coreos.com'
      live_check_crd 'scrapeconfigs.monitoring.coreos.com'
      live_check_crd 'servicemonitors.monitoring.coreos.com'
      live_check_crd 'thanosrulers.monitoring.coreos.com'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets:
  - deliveryLanes:
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    keys:
    - cert
    - key
    name: kube-prometheus-stack-admission
    namespace: monitoring
    purpose: Prometheus Operator admission webhook TLS material normally created by
      Helm hook lifecycle

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: alertmanagerconfigs.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: alertmanagers.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: podmonitors.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: probes.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: prometheusagents.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: prometheuses.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: prometheusrules.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: scrapeconfigs.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: servicemonitors.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: thanosrulers.monitoring.coreos.com
    purpose: Prometheus Operator CRD managed outside this no-crds base
    sourceVariant: default

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
