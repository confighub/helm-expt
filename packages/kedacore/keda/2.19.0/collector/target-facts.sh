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
  'no-crds')
    if [ "$check_mode" = "live" ]; then
      live_check_crd 'cloudeventsources.eventing.keda.sh'
      live_check_crd 'clustercloudeventsources.eventing.keda.sh'
      live_check_crd 'clustertriggerauthentications.keda.sh'
      live_check_crd 'scaledjobs.keda.sh'
      live_check_crd 'scaledobjects.keda.sh'
      live_check_crd 'triggerauthentications.keda.sh'
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
    name: cloudeventsources.eventing.keda.sh
    purpose: KEDA CRD managed outside this no-crds preset
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <keda-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: clustercloudeventsources.eventing.keda.sh
    purpose: KEDA CRD managed outside this no-crds preset
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <keda-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: clustertriggerauthentications.keda.sh
    purpose: KEDA CRD managed outside this no-crds preset
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <keda-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: scaledjobs.keda.sh
    purpose: KEDA CRD managed outside this no-crds preset
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <keda-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: scaledobjects.keda.sh
    purpose: KEDA CRD managed outside this no-crds preset
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <keda-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: triggerauthentications.keda.sh
    purpose: KEDA CRD managed outside this no-crds preset
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <keda-crds.yaml>

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
