import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { readYaml, repoRoot } from "./proof-common.mjs";

export const AICR_CPU_STARTER_VERSION = "0.14.0";
export const AICR_CPU_STARTER_SOURCE_REF =
  "europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.14.0";
export const AICR_CPU_STARTER_SOURCE_OCI_REF =
  `oci://${AICR_CPU_STARTER_SOURCE_REF}`;
export const AICR_CPU_STARTER_SOURCE_DIGEST =
  "sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010";
export const AICR_CPU_STARTER_ARTIFACT_TYPE =
  "application/vnd.confighub.kubernetes.config.v1";
export const AICR_CPU_STARTER_LOCAL_OCI_DIGEST =
  "sha256:62eaf39703ca0e5e968fcd4a667cbccbb5b3ff16403471c4b3441b3681b2b225";
export const AICR_CPU_STARTER_INTENT_URL =
  "https://raw.githubusercontent.com/confighub/helm-expt/main/examples/aicr/cpu-starter/derivation-receipt.yaml";

const renderedRoot = join(
  repoRoot,
  "examples",
  "aicr",
  "cpu-starter",
  "argocd-rendered",
  "templates",
);
const derivationReceiptPath = join(
  repoRoot,
  "examples",
  "aicr",
  "cpu-starter",
  "derivation-receipt.yaml",
);

export const AICR_CPU_STARTER_COMPONENTS = [
  "cert-manager",
  "nfd",
  "prometheus-operator-crds",
  "kube-prometheus-stack",
  "k8s-ephemeral-storage-metrics",
  "kai-scheduler",
  "prometheus-adapter",
];

export function aicrCpuStarterRecords() {
  return AICR_CPU_STARTER_COMPONENTS.map((name) => {
    const path = join(renderedRoot, `${name}.yaml`);
    const object = readYaml(path);
    return {
      name,
      file: `${name}.yaml`,
      sha256: hash(readFileSync(path)),
      syncWave: Number(object.metadata?.annotations?.["argocd.argoproj.io/sync-wave"]),
    };
  });
}

export function aicrCpuStarterIntentSha256() {
  return hash(readFileSync(derivationReceiptPath));
}

export function aicrCpuStarterTryScript(siteBaseUrl) {
  const records = aicrCpuStarterRecords();
  const files = records.map((record) => `  "${record.file}"`).join("\n");
  const hashes = records
    .map((record) => `    "${record.file}") printf '%s\\n' "${record.sha256}" ;;`)
    .join("\n");
  return `#!/usr/bin/env bash
# Pull the retained NVIDIA AICR configuration, select the seven-component
# CPU starter, verify every file, and write a local OCI. This script does not
# contact ConfigHub Server or Kubernetes.
set -euo pipefail

SOURCE_REF="${AICR_CPU_STARTER_SOURCE_REF}"
SOURCE_DIGEST="${AICR_CPU_STARTER_SOURCE_DIGEST}"
SOURCE_REPO="\${SOURCE_REF%:*}"
SOURCE_AT_DIGEST="\${SOURCE_REPO}@\${SOURCE_DIGEST}"
ARTIFACT_TYPE="${AICR_CPU_STARTER_ARTIFACT_TYPE}"
WORK_DIR="\${1:-./aicr-cpu-starter}"

say() { printf '\n>> %s\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

if ! command -v oras >/dev/null 2>&1; then
  fail "oras is required. Install it from https://oras.land/docs/installation/ and run this command again."
fi
if ! command -v curl >/dev/null 2>&1; then
  fail "curl is required to fetch the source-and-intent record."
fi
if [ -e "\${WORK_DIR}" ]; then
  fail "\${WORK_DIR} already exists. Choose another path: bash try.sh ./another-path"
fi
case "\${WORK_DIR}" in
  /*) ;;
  *) WORK_DIR="$(pwd -P)/\${WORK_DIR#./}" ;;
esac
SOURCE_DIR="\${WORK_DIR}/source"
CONFIG_DIR="\${WORK_DIR}/config"
PULLBACK_DIR="\${WORK_DIR}/pulled-back"
OCI_LAYOUT="\${WORK_DIR}/aicr-cpu-starter.oci"

files=(
${files}
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
${hashes}
    *) fail "no reviewed hash is recorded for $1" ;;
  esac
}

mkdir -p "\${SOURCE_DIR}" "\${CONFIG_DIR}/templates" "\${PULLBACK_DIR}" "\${WORK_DIR}/anonymous-docker"
printf '{"auths":{}}\n' > "\${WORK_DIR}/anonymous-docker/config.json"

say "Check the public AICR configuration digest"
actual_source_digest="$(DOCKER_CONFIG="\${WORK_DIR}/anonymous-docker" oras manifest fetch --format go-template --template '{{ .digest }}' "\${SOURCE_REF}")"
[ "\${actual_source_digest}" = "\${SOURCE_DIGEST}" ] || fail "source digest changed: \${actual_source_digest}"

say "Pull the public AICR configuration without registry credentials"
DOCKER_CONFIG="\${WORK_DIR}/anonymous-docker" oras pull "\${SOURCE_AT_DIGEST}" -o "\${SOURCE_DIR}"
source_file_count="$(find "\${SOURCE_DIR}/templates" -maxdepth 1 -type f -name '*.yaml' | wc -l | tr -d '[:space:]')"
[ "\${source_file_count}" -eq 17 ] || fail "the source artifact contains \${source_file_count} Application files, not 17"

say "Select and verify the seven CPU-starter Applications"
for file in "\${files[@]}"; do
  source_file="\${SOURCE_DIR}/templates/\${file}"
  [ -f "\${source_file}" ] || fail "the source artifact is missing templates/\${file}"
  actual_sha="$(hash_file "\${source_file}")"
  [ "\${actual_sha}" = "$(expected_hash "\${file}")" ] || fail "templates/\${file} does not match the reviewed file"
  cp "\${source_file}" "\${CONFIG_DIR}/templates/\${file}"
done

curl -fsSL "${AICR_CPU_STARTER_INTENT_URL}" -o "\${WORK_DIR}/source-and-intent.yaml"
[ "$(hash_file "\${WORK_DIR}/source-and-intent.yaml")" = "${aicrCpuStarterIntentSha256()}" ] || fail "the source-and-intent record changed"

say "Write the selected configuration as a local OCI"
(
  cd "\${CONFIG_DIR}"
  layers=()
  for file in "\${files[@]}"; do
    layers+=("templates/\${file}:application/yaml")
  done
  oras push --oci-layout "\${OCI_LAYOUT}:${AICR_CPU_STARTER_VERSION}" \
    --image-spec v1.1 \
    --artifact-type "\${ARTIFACT_TYPE}" \
    --annotation 'org.opencontainers.image.created=1970-01-01T00:00:00Z' \
    "\${layers[@]}"
)

say "Pull the local OCI back and compare every file"
oras pull --oci-layout "\${OCI_LAYOUT}:${AICR_CPU_STARTER_VERSION}" -o "\${PULLBACK_DIR}"
diff -ru "\${CONFIG_DIR}/templates" "\${PULLBACK_DIR}/templates"
output_digest="$(oras manifest fetch --oci-layout --format go-template --template '{{ .digest }}' "\${OCI_LAYOUT}:${AICR_CPU_STARTER_VERSION}")"
[ "\${output_digest}" = "${AICR_CPU_STARTER_LOCAL_OCI_DIGEST}" ] || fail "local OCI digest changed: \${output_digest}"

say "Finished"
printf 'Source OCI: oci://%s@%s\n' "\${SOURCE_REPO}" "\${SOURCE_DIGEST}"
printf 'Selected Applications: %s\n' "\${#files[@]}"
printf 'Files: %s/config/templates\n' "\${WORK_DIR}"
printf 'Source and intent: %s/source-and-intent.yaml\n' "\${WORK_DIR}"
printf 'Local configuration OCI: %s:%s\n' "\${OCI_LAYOUT}" "${AICR_CPU_STARTER_VERSION}"
printf 'Local OCI digest: %s\n' "\${output_digest}"
printf 'Nothing was applied to Kubernetes or sent to ConfigHub.\n'
printf 'Next: ${siteBaseUrl}try-aicr.html\n'
`;
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}
