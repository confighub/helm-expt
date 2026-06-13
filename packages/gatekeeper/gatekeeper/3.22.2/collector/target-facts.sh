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
      live_check_crd 'assign.mutations.gatekeeper.sh'
      live_check_crd 'assignimage.mutations.gatekeeper.sh'
      live_check_crd 'assignmetadata.mutations.gatekeeper.sh'
      live_check_crd 'configs.config.gatekeeper.sh'
      live_check_crd 'configpodstatuses.status.gatekeeper.sh'
      live_check_crd 'connections.connection.gatekeeper.sh'
      live_check_crd 'connectionpodstatuses.status.gatekeeper.sh'
      live_check_crd 'constraintpodstatuses.status.gatekeeper.sh'
      live_check_crd 'constrainttemplates.templates.gatekeeper.sh'
      live_check_crd 'constrainttemplatepodstatuses.status.gatekeeper.sh'
      live_check_crd 'expansiontemplate.expansion.gatekeeper.sh'
      live_check_crd 'expansiontemplatepodstatuses.status.gatekeeper.sh'
      live_check_crd 'modifyset.mutations.gatekeeper.sh'
      live_check_crd 'mutatorpodstatuses.status.gatekeeper.sh'
      live_check_crd 'providers.externaldata.gatekeeper.sh'
      live_check_crd 'providerpodstatuses.status.gatekeeper.sh'
      live_check_crd 'syncsets.syncset.gatekeeper.sh'
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
    name: assign.mutations.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: assignimage.mutations.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: assignmetadata.mutations.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: configs.config.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: configpodstatuses.status.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: connections.connection.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: connectionpodstatuses.status.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: constraintpodstatuses.status.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: constrainttemplates.templates.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: constrainttemplatepodstatuses.status.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: expansiontemplate.expansion.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: expansiontemplatepodstatuses.status.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: modifyset.mutations.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: mutatorpodstatuses.status.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: providers.externaldata.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: providerpodstatuses.status.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: syncsets.syncset.gatekeeper.sh
    purpose: Gatekeeper CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Gatekeeper CRDs before applying
      this base

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
