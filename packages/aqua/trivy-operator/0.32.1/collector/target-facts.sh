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
  'no-crds')
    if [ "$check_mode" = "live" ]; then
      live_check_crd 'clustercompliancereports.aquasecurity.github.io'
      live_check_crd 'clusterconfigauditreports.aquasecurity.github.io'
      live_check_crd 'clusterinfraassessmentreports.aquasecurity.github.io'
      live_check_crd 'clusterrbacassessmentreports.aquasecurity.github.io'
      live_check_crd 'clustersbomreports.aquasecurity.github.io'
      live_check_crd 'clustervulnerabilityreports.aquasecurity.github.io'
      live_check_crd 'configauditreports.aquasecurity.github.io'
      live_check_crd 'exposedsecretreports.aquasecurity.github.io'
      live_check_crd 'infraassessmentreports.aquasecurity.github.io'
      live_check_crd 'rbacassessmentreports.aquasecurity.github.io'
      live_check_crd 'sbomreports.aquasecurity.github.io'
      live_check_crd 'vulnerabilityreports.aquasecurity.github.io'
      result="pass"
    else
      result="recorded"
    fi
    cat <<YAML
targetFacts:
  requiredSecrets: []

  requiredCRDs:
  - name: clustercompliancereports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: clusterconfigauditreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: clusterinfraassessmentreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: clusterrbacassessmentreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: clustersbomreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: clustervulnerabilityreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: configauditreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: exposedsecretreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: infraassessmentreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: rbacassessmentreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: sbomreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base
  - name: vulnerabilityreports.aquasecurity.github.io
    purpose: Trivy Operator CRD managed outside this no-crds base
    sourcePath: revisions/default/r001/rendered/release-objects.yaml
    sourceVariant: default
    suggestedSource: Apply the default base CRDs or install Trivy Operator CRDs before
      applying this base

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
