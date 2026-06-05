#!/bin/sh
set -eu

base="${INSTALLER_BASE:-default}"
secret_namespace="${REDIS_EXISTING_SECRET_NAMESPACE:-redis}"
secret_name="${REDIS_EXISTING_SECRET_NAME:-redis-existing-secret}"
secret_key="${REDIS_EXISTING_SECRET_KEY:-redis-password}"
check_mode="${TARGET_FACT_CHECK_MODE:-record}"

if [ "$base" != "reuse-existing-secret" ]; then
  cat <<YAML
targetFacts:
  requiredSecrets: []
targetFactChecks:
  base: "$base"
  mode: not-required
  result: pass
YAML
  exit 0
fi

if [ "$check_mode" = "live" ]; then
  if ! command -v kubectl >/dev/null 2>&1; then
    echo "kubectl is required for TARGET_FACT_CHECK_MODE=live" >&2
    exit 1
  fi
  if ! kubectl -n "$secret_namespace" get secret "$secret_name" >/dev/null 2>&1; then
    echo "required Redis Secret $secret_namespace/$secret_name was not found" >&2
    exit 1
  fi
  if ! kubectl -n "$secret_namespace" get secret "$secret_name" -o yaml | awk -v key="$secret_key" '$1 == key ":" { found=1 } END { exit found ? 0 : 1 }'; then
    echo "required Redis Secret $secret_namespace/$secret_name is missing key $secret_key" >&2
    exit 1
  fi
  result="pass"
else
  result="recorded"
fi

cat <<YAML
targetFacts:
  requiredSecrets:
    - namespace: "$secret_namespace"
      name: "$secret_name"
      keys:
        - "$secret_key"
      purpose: "Redis authentication password"
targetFactChecks:
  base: "$base"
  mode: "$check_mode"
  result: "$result"
  liveCheck:
    command: "TARGET_FACT_CHECK_MODE=live cub installer setup --pull packages/bitnami/redis/25.5.3 --base reuse-existing-secret --work-dir <tmp> --non-interactive --namespace redis"
YAML
