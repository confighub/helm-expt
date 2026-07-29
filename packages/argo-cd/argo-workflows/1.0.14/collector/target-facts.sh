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
      live_check_crd 'clusterworkflowtemplates.argoproj.io'
      live_check_crd 'cronworkflows.argoproj.io'
      live_check_crd 'workflowartifactgctasks.argoproj.io'
      live_check_crd 'workfloweventbindings.argoproj.io'
      live_check_crd 'workflows.argoproj.io'
      live_check_crd 'workflowtaskresults.argoproj.io'
      live_check_crd 'workflowtasksets.argoproj.io'
      live_check_crd 'workflowtemplates.argoproj.io'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs:
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: clusterworkflowtemplates.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_clusterworkflowtemplates.yaml
    sourceSHA256: 6451671e3cca063fdc31a242d1eeedbe07240667f3801c0ece62557f71405838
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_clusterworkflowtemplates.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: cronworkflows.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_cronworkflows.yaml
    sourceSHA256: 83d3bd6dff62fce97b6db5a7413b25de26bed9f25a3f223aa4b6bf7499290fc6
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_cronworkflows.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowartifactgctasks.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowartifactgctasks.yaml
    sourceSHA256: 9dd524792dfa35513afe0f754b02f76ac6e1b7488479fcd895fb08faeb8ddbd2
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowartifactgctasks.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workfloweventbindings.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workfloweventbindings.yaml
    sourceSHA256: 0941c8fda9cde30fd320313f8c0c2f1decf323f673e73bf679614af9e815093f
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workfloweventbindings.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflows.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflows.yaml
    sourceSHA256: 4dea37845b8ce92a2c255f5a72a92243674d6ba9c63637146ade88d4ef03484e
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflows.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowtaskresults.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowtaskresults.yaml
    sourceSHA256: 86fb637b4268b3993f65f240d184604b3de77ecbf803662b9393ef116bfefe04
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowtaskresults.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowtasksets.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowtasksets.yaml
    sourceSHA256: b83e656ce12393c833c3c3356f59eb7500e96adb896c53ec0313a2a3ba8a3f8e
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowtasksets.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowtemplates.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowtemplates.yaml
    sourceSHA256: 5aa32400ce3f1fca44c6cc6547a5f74173a9d29ec3fdb2b3da6d40f89a2ea152
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowtemplates.yaml

  requiredValues: []

  requiredObjectStores: []

  requiredTopology: null

targetFactChecks:
  base: "default"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  'controller-default-reviewed')
    if [ "$check_mode" = "live" ]; then
      live_check_crd 'clusterworkflowtemplates.argoproj.io'
      live_check_crd 'cronworkflows.argoproj.io'
      live_check_crd 'workflowartifactgctasks.argoproj.io'
      live_check_crd 'workfloweventbindings.argoproj.io'
      live_check_crd 'workflows.argoproj.io'
      live_check_crd 'workflowtaskresults.argoproj.io'
      live_check_crd 'workflowtasksets.argoproj.io'
      live_check_crd 'workflowtemplates.argoproj.io'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs:
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: clusterworkflowtemplates.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_clusterworkflowtemplates.yaml
    sourceSHA256: 6451671e3cca063fdc31a242d1eeedbe07240667f3801c0ece62557f71405838
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_clusterworkflowtemplates.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: cronworkflows.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_cronworkflows.yaml
    sourceSHA256: 83d3bd6dff62fce97b6db5a7413b25de26bed9f25a3f223aa4b6bf7499290fc6
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_cronworkflows.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowartifactgctasks.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowartifactgctasks.yaml
    sourceSHA256: 9dd524792dfa35513afe0f754b02f76ac6e1b7488479fcd895fb08faeb8ddbd2
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowartifactgctasks.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workfloweventbindings.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workfloweventbindings.yaml
    sourceSHA256: 0941c8fda9cde30fd320313f8c0c2f1decf323f673e73bf679614af9e815093f
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workfloweventbindings.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflows.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflows.yaml
    sourceSHA256: 4dea37845b8ce92a2c255f5a72a92243674d6ba9c63637146ade88d4ef03484e
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflows.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowtaskresults.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowtaskresults.yaml
    sourceSHA256: 86fb637b4268b3993f65f240d184604b3de77ecbf803662b9393ef116bfefe04
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowtaskresults.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowtasksets.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowtasksets.yaml
    sourceSHA256: b83e656ce12393c833c3c3356f59eb7500e96adb896c53ec0313a2a3ba8a3f8e
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowtasksets.yaml
  - applyMode: server-side-force-conflicts
    deliveryLanes:
    - cubInstallerApply
    name: workflowtemplates.argoproj.io
    sourcePath: upstream/full-crds/argoproj.io_workflowtemplates.yaml
    sourceSHA256: 5aa32400ce3f1fca44c6cc6547a5f74173a9d29ec3fdb2b3da6d40f89a2ea152
    sourceURL: https://raw.githubusercontent.com/argoproj/argo-helm/argo-workflows-1.0.14/charts/argo-workflows/files/crds/full/argoproj.io_workflowtemplates.yaml

  requiredValues: []

  requiredObjectStores: []

  requiredTopology: null

targetFactChecks:
  base: "controller-default-reviewed"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  *)
    emit_empty
    ;;
esac
