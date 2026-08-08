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
      live_check_min_schedulable_nodes '2'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs: []

  requiredValues:
  - installerInput: clusterName
    path: settings.clusterName
    purpose: EKS cluster name; required with no chart default, the deployment template
      refuses to render without it
    source: platform-profile
    stage: pre-render

  requiredObjectStores: []

  requiredTopology:
    minimumSchedulableNodes: 2
    purpose: replicas 2 with the chart-default required pod anti-affinity needs two
      schedulable non-Karpenter nodes

targetFactChecks:
  base: "default"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  'eks-inference')
    if [ "$check_mode" = "live" ]; then
      live_check_min_schedulable_nodes '1'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs: []

  requiredValues:
  - installerInput: awsRegion
    path: controller.env[AWS_REGION]
    purpose: AWS region for the controller; the chart supplies nothing and EKS Pod Identity
      does not inject it, so an absent value panics the controller at startup
    source: platform-profile
    stage: pre-render

  requiredObjectStores: []

  requiredTopology:
    minimumSchedulableNodes: 1
    purpose: replicas 1 needs one schedulable non-Karpenter node on the system nodegroup

targetFactChecks:
  base: "eks-inference"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  'crds-managed')
    if [ "$check_mode" = "live" ]; then
      live_check_crd 'capacitybuffers.autoscaling.x-k8s.io'
      live_check_crd 'ec2nodeclasses.karpenter.k8s.aws'
      live_check_crd 'nodeclaims.karpenter.sh'
      live_check_crd 'nodeoverlays.karpenter.sh'
      live_check_crd 'nodepools.karpenter.sh'
      live_check_min_schedulable_nodes '1'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs:
  - name: capacitybuffers.autoscaling.x-k8s.io
    suggestedSource: helm install karpenter-crd oci://public.ecr.aws/karpenter/karpenter-crd
      --version 1.14.0 --namespace kube-system
  - name: ec2nodeclasses.karpenter.k8s.aws
    suggestedSource: helm install karpenter-crd oci://public.ecr.aws/karpenter/karpenter-crd
      --version 1.14.0 --namespace kube-system
  - name: nodeclaims.karpenter.sh
    suggestedSource: helm install karpenter-crd oci://public.ecr.aws/karpenter/karpenter-crd
      --version 1.14.0 --namespace kube-system
  - name: nodeoverlays.karpenter.sh
    suggestedSource: helm install karpenter-crd oci://public.ecr.aws/karpenter/karpenter-crd
      --version 1.14.0 --namespace kube-system
  - name: nodepools.karpenter.sh
    suggestedSource: helm install karpenter-crd oci://public.ecr.aws/karpenter/karpenter-crd
      --version 1.14.0 --namespace kube-system

  requiredValues:
  - installerInput: awsRegion
    path: controller.env[AWS_REGION]
    purpose: AWS region for the controller; the chart supplies nothing and EKS Pod Identity
      does not inject it, so an absent value panics the controller at startup
    source: platform-profile
    stage: pre-render

  requiredObjectStores: []

  requiredTopology:
    minimumSchedulableNodes: 1
    purpose: replicas 1 needs one schedulable non-Karpenter node on the system nodegroup

targetFactChecks:
  base: "crds-managed"
  mode: "$check_mode"
  result: "$result"
YAML
    ;;
  *)
    emit_empty
    ;;
esac
