#!/usr/bin/env bash
# Pull the retained NVIDIA AICR configuration, select the seven-component
# CPU starter, verify every file, and write a local OCI. This script does not
# contact ConfigHub Server or Kubernetes.
set -euo pipefail

SOURCE_REF="europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.14.0"
SOURCE_DIGEST="sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010"
SOURCE_REPO="${SOURCE_REF%:*}"
SOURCE_AT_DIGEST="${SOURCE_REPO}@${SOURCE_DIGEST}"
ARTIFACT_TYPE="application/vnd.confighub.kubernetes.config.v1"
WORK_DIR="${1:-./aicr-cpu-starter}"

say() { printf '
>> %s
' "$*"; }
fail() { printf 'Error: %s
' "$*" >&2; exit 1; }

if ! command -v oras >/dev/null 2>&1; then
  fail "oras is required. Install it from https://oras.land/docs/installation/ and run this command again."
fi
if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required to fetch the source-and-intent record."
fi
if [ -e "${WORK_DIR}" ]; then
  fail "${WORK_DIR} already exists. Choose another path: bash try.sh ./another-path"
fi
case "${WORK_DIR}" in
  /*) ;;
  *) WORK_DIR="$(pwd -P)/${WORK_DIR#./}" ;;
esac
SOURCE_DIR="${WORK_DIR}/source"
CONFIG_DIR="${WORK_DIR}/config"
PULLBACK_DIR="${WORK_DIR}/pulled-back"
OCI_LAYOUT="${WORK_DIR}/aicr-cpu-starter.oci"

files=(
  "cert-manager.yaml"
  "nfd.yaml"
  "prometheus-operator-crds.yaml"
  "kube-prometheus-stack.yaml"
  "k8s-ephemeral-storage-metrics.yaml"
  "kai-scheduler.yaml"
  "prometheus-adapter.yaml"
)
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

expected_hash() {
  case "$1" in
    "cert-manager.yaml") printf '%s\n' "9429064306e0efcca02e29edafa202330de0d3cbab8b8d47d52f69a2e56b6453" ;;
    "nfd.yaml") printf '%s\n' "ef2cfedf5ff066f0255ed0d910daacec6f78225f117a3bf95f8c448d1e8b0df6" ;;
    "prometheus-operator-crds.yaml") printf '%s\n' "0a277cf4d9f6b6fed5f2b890a94a366fba0a49859c9ae852999094ee79b34292" ;;
    "kube-prometheus-stack.yaml") printf '%s\n' "83f58c797a925802b31ea5874676ad7ee51b2c3439e9a86d06bbcf52a87a7656" ;;
    "k8s-ephemeral-storage-metrics.yaml") printf '%s\n' "069c54ea067bee6e041f6356b6f72e1a00ce41294217fb5edaed085bbaeb1b2f" ;;
    "kai-scheduler.yaml") printf '%s\n' "740ea2245f37828f383b89ed876cbfbcd4ad30972447cdbf57c06922348e5fbc" ;;
    "prometheus-adapter.yaml") printf '%s\n' "1d6fab6e8f60c9b7eda6ed266d0b172159bada60a95396f44f63c22039afe509" ;;
    *) fail "no reviewed hash is recorded for $1" ;;
  esac
}

mkdir -p "${SOURCE_DIR}" "${CONFIG_DIR}/templates" "${PULLBACK_DIR}" "${WORK_DIR}/anonymous-docker"
printf '{"auths":{}}
' > "${WORK_DIR}/anonymous-docker/config.json"

say "Check the public AICR configuration digest"
actual_source_digest="$(DOCKER_CONFIG="${WORK_DIR}/anonymous-docker" oras manifest fetch --format go-template --template '{{ .digest }}' "${SOURCE_REF}")"
[ "${actual_source_digest}" = "${SOURCE_DIGEST}" ] || fail "source digest changed: ${actual_source_digest}"

say "Pull the public AICR configuration without registry credentials"
DOCKER_CONFIG="${WORK_DIR}/anonymous-docker" oras pull "${SOURCE_AT_DIGEST}" -o "${SOURCE_DIR}"
source_file_count="$(find "${SOURCE_DIR}/templates" -maxdepth 1 -type f -name '*.yaml' | wc -l | tr -d '[:space:]')"
[ "${source_file_count}" -eq 17 ] || fail "the source artifact contains ${source_file_count} Application files, not 17"

say "Select and verify the seven CPU-starter Applications"
for file in "${files[@]}"; do
  source_file="${SOURCE_DIR}/templates/${file}"
  [ -f "${source_file}" ] || fail "the source artifact is missing templates/${file}"
  actual_sha="$(hash_file "${source_file}")"
  [ "${actual_sha}" = "$(expected_hash "${file}")" ] || fail "templates/${file} does not match the reviewed file"
  cp "${source_file}" "${CONFIG_DIR}/templates/${file}"
done

curl -fsSL "https://raw.githubusercontent.com/confighub/helm-expt/main/examples/aicr/cpu-starter/derivation-receipt.yaml" -o "${WORK_DIR}/source-and-intent.yaml"
[ "$(hash_file "${WORK_DIR}/source-and-intent.yaml")" = "667ffcbbb3d763225897af54790f14e49581528f69e198ea555f65756056567c" ] || fail "the source-and-intent record changed"

say "Write the selected configuration as a local OCI"
(
  cd "${CONFIG_DIR}"
  layers=()
  for file in "${files[@]}"; do
    layers+=("templates/${file}:application/yaml")
  done
  oras push --oci-layout "${OCI_LAYOUT}:0.14.0"     --image-spec v1.1     --artifact-type "${ARTIFACT_TYPE}"     --annotation 'org.opencontainers.image.created=1970-01-01T00:00:00Z'     "${layers[@]}"
)

say "Pull the local OCI back and compare every file"
oras pull --oci-layout "${OCI_LAYOUT}:0.14.0" -o "${PULLBACK_DIR}"
diff -ru "${CONFIG_DIR}/templates" "${PULLBACK_DIR}/templates"
output_digest="$(oras manifest fetch --oci-layout --format go-template --template '{{ .digest }}' "${OCI_LAYOUT}:0.14.0")"
[ "${output_digest}" = "sha256:62eaf39703ca0e5e968fcd4a667cbccbb5b3ff16403471c4b3441b3681b2b225" ] || fail "local OCI digest changed: ${output_digest}"

say "Finished"
printf 'Source OCI: oci://%s@%s
' "${SOURCE_REPO}" "${SOURCE_DIGEST}"
printf 'Selected Applications: %s
' "${#files[@]}"
printf 'Files: %s/config/templates
' "${WORK_DIR}"
printf 'Source and intent: %s/source-and-intent.yaml
' "${WORK_DIR}"
printf 'Local configuration OCI: %s:%s
' "${OCI_LAYOUT}" "0.14.0"
printf 'Local OCI digest: %s
' "${output_digest}"
printf 'Nothing was applied to Kubernetes or sent to ConfigHub.
'
printf 'Next: https://confighub.github.io/helm-expt/site/try-aicr.html
'
