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
      live_check_secret 'default' 'terraformrc' 'credentials'
      live_check_secret 'default' 'workspacesecrets' ''
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
    evidence:
    - runs/live-helm-confighub-compare/hashicorp-terraform-default/receipt.yaml
    - runs/live-kind-parity/hashicorp-terraform-default/receipt.yaml
    keys:
    - credentials
    name: terraformrc
    namespace: default
    purpose: Terraform CLI credentials mounted at /etc/terraform/.terraformrc
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl -n default create secret generic terraformrc --from-file=credentials=<path-to-terraform-cli-config>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - runs/live-helm-confighub-compare/hashicorp-terraform-default/receipt.yaml
    - runs/live-kind-parity/hashicorp-terraform-default/receipt.yaml
    name: workspacesecrets
    namespace: default
    purpose: Sensitive Terraform workspace variables mounted at /tmp/secrets
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl -n default apply -f <workspacesecrets-manifest.yaml>

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
      live_check_secret 'default' 'terraformrc' 'credentials'
      live_check_secret 'default' 'workspacesecrets' ''
      live_check_crd 'workspaces.app.terraform.io'
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
    evidence:
    - runs/live-helm-confighub-compare/hashicorp-terraform-no-crds/receipt.yaml
    - runs/live-kind-parity/hashicorp-terraform-no-crds/receipt.yaml
    keys:
    - credentials
    name: terraformrc
    namespace: default
    purpose: Terraform CLI credentials mounted at /etc/terraform/.terraformrc
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl -n default create secret generic terraformrc --from-file=credentials=<path-to-terraform-cli-config>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - runs/live-helm-confighub-compare/hashicorp-terraform-no-crds/receipt.yaml
    - runs/live-kind-parity/hashicorp-terraform-no-crds/receipt.yaml
    name: workspacesecrets
    namespace: default
    purpose: Sensitive Terraform workspace variables mounted at /tmp/secrets
    sourcePath: ../../target-prerequisite-plan.yaml
    suggestedSource: kubectl -n default apply -f <workspacesecrets-manifest.yaml>

  requiredCRDs:
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    evidence:
    - recipes/hashicorp/terraform/1.1.2/revisions/default/r001/rendered/release-objects.yaml
    name: workspaces.app.terraform.io
    purpose: Terraform Workspace CRD managed outside this no-crds preset
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: kubectl apply -f <terraform-workspace-crd.yaml>

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
