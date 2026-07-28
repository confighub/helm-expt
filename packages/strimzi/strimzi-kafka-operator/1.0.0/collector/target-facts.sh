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
      live_check_crd 'kafkas.kafka.strimzi.io'
      live_check_crd 'kafkaconnects.kafka.strimzi.io'
      live_check_crd 'strimzipodsets.core.strimzi.io'
      live_check_crd 'kafkatopics.kafka.strimzi.io'
      live_check_crd 'kafkausers.kafka.strimzi.io'
      live_check_crd 'kafkanodepools.kafka.strimzi.io'
      live_check_crd 'kafkabridges.kafka.strimzi.io'
      live_check_crd 'kafkaconnectors.kafka.strimzi.io'
      live_check_crd 'kafkamirrormaker2s.kafka.strimzi.io'
      live_check_crd 'kafkarebalances.kafka.strimzi.io'
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
    name: kafkas.kafka.strimzi.io
    purpose: Kafka CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkaconnects.kafka.strimzi.io
    purpose: KafkaConnect CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: strimzipodsets.core.strimzi.io
    purpose: StrimziPodSet CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkatopics.kafka.strimzi.io
    purpose: KafkaTopic CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkausers.kafka.strimzi.io
    purpose: KafkaUser CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkanodepools.kafka.strimzi.io
    purpose: KafkaNodePool CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkabridges.kafka.strimzi.io
    purpose: KafkaBridge CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkaconnectors.kafka.strimzi.io
    purpose: KafkaConnector CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkamirrormaker2s.kafka.strimzi.io
    purpose: KafkaMirrorMaker2 CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>
  - deliveryLanes:
    - regularHelm
    - cubInstallerApply
    - configHubKubectlApply
    - configHubOciArgo
    name: kafkarebalances.kafka.strimzi.io
    purpose: KafkaRebalance CRD managed outside this no-crds preset
    sourceVariant: default
    suggestedSource: kubectl apply -f <strimzi-crds.yaml>

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
