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
      live_check_crd 'cleanuppolicies.kyverno.io'
      live_check_crd 'clustercleanuppolicies.kyverno.io'
      live_check_crd 'clusterpolicies.kyverno.io'
      live_check_crd 'globalcontextentries.kyverno.io'
      live_check_crd 'policies.kyverno.io'
      live_check_crd 'policyexceptions.kyverno.io'
      live_check_crd 'updaterequests.kyverno.io'
      live_check_crd 'clusterephemeralreports.reports.kyverno.io'
      live_check_crd 'ephemeralreports.reports.kyverno.io'
      live_check_crd 'clusterpolicyreports.wgpolicyk8s.io'
      live_check_crd 'policyreports.wgpolicyk8s.io'
      live_check_crd 'deletingpolicies.policies.kyverno.io'
      live_check_crd 'generatingpolicies.policies.kyverno.io'
      live_check_crd 'imagevalidatingpolicies.policies.kyverno.io'
      live_check_crd 'mutatingpolicies.policies.kyverno.io'
      live_check_crd 'namespaceddeletingpolicies.policies.kyverno.io'
      live_check_crd 'namespacedgeneratingpolicies.policies.kyverno.io'
      live_check_crd 'namespacedimagevalidatingpolicies.policies.kyverno.io'
      live_check_crd 'namespacedmutatingpolicies.policies.kyverno.io'
      live_check_crd 'namespacedvalidatingpolicies.policies.kyverno.io'
      live_check_crd 'policyexceptions.policies.kyverno.io'
      live_check_crd 'validatingpolicies.policies.kyverno.io'
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
    name: cleanuppolicies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: clustercleanuppolicies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: clusterpolicies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: globalcontextentries.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: policyexceptions.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: updaterequests.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: clusterephemeralreports.reports.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: ephemeralreports.reports.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: clusterpolicyreports.wgpolicyk8s.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: policyreports.wgpolicyk8s.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: deletingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: generatingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: imagevalidatingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: mutatingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: namespaceddeletingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: namespacedgeneratingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: namespacedimagevalidatingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: namespacedmutatingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: namespacedvalidatingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: policyexceptions.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
    sourceVariant: default
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: validatingpolicies.policies.kyverno.io
    purpose: Kyverno CRD managed outside this no-crds base
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
