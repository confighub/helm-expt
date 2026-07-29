#!/usr/bin/env bash
set -euo pipefail

namespace="${1:-${CONTOUR_NAMESPACE:-default}}"
route_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
receipt_path="${HELM_EXPT_LIFECYCLE_RECEIPT:-${CONTOUR_CERTGEN_RECEIPT:-}}"
action="generated"

if [[ ! "$namespace" =~ ^[a-z0-9]([-a-z0-9]*[a-z0-9])?$ ]]; then
  printf 'Invalid Kubernetes namespace: %s\n' "$namespace" >&2
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  printf 'kubectl is required to run the Contour certificate setup.\n' >&2
  exit 1
fi

secret_ready() {
  local name="$1"
  kubectl -n "$namespace" get "secret/$name" >/dev/null 2>&1 &&
    test -n "$(kubectl -n "$namespace" get "secret/$name" -o jsonpath='{.data.ca\.crt}')" &&
    test -n "$(kubectl -n "$namespace" get "secret/$name" -o jsonpath='{.data.tls\.crt}')" &&
    test -n "$(kubectl -n "$namespace" get "secret/$name" -o jsonpath='{.data.tls\.key}')"
}

kubectl create namespace "$namespace" --dry-run=client -o yaml | kubectl apply -f -

if [[ "${CONTOUR_CERTGEN_FORCE:-0}" != "1" ]] &&
  secret_ready contourcert &&
  secret_ready envoycert; then
  action="kept-existing"
  printf 'Contour certificate Secrets already exist in %s; leaving them under their current owner.\n' "$namespace"
else
  kubectl -n "$namespace" delete job/contour-contour-certgen --ignore-not-found --wait=true
  kubectl -n "$namespace" apply -f "$route_dir/route.yaml"
  kubectl -n "$namespace" wait --for=condition=complete --timeout=300s job/contour-contour-certgen

  if ! secret_ready contourcert || ! secret_ready envoycert; then
    printf 'The Contour certgen Job completed without producing both expected TLS Secrets.\n' >&2
    exit 1
  fi

  kubectl -n "$namespace" delete \
    job/contour-contour-certgen \
    rolebinding/contour-contour-certgen \
    role/contour-contour-certgen \
    serviceaccount/contour-contour-certgen \
    --ignore-not-found \
    --wait=true
fi

printf 'Contour certificate setup passed in namespace %s (%s).\n' "$namespace" "$action"

if [[ -n "$receipt_path" ]]; then
  cat >"$receipt_path" <<EOF_RECEIPT
apiVersion: helm-expt.confighub.com/v1alpha1
kind: LifecycleActionReceipt
metadata:
  name: bitnami-contour-21.1.4-certgen
spec:
  result: pass
  chart: bitnami/contour
  version: 21.1.4
  namespace: ${namespace}
  action: ${action}
  sourceHook: contour-contour-certgen
  image: docker.io/bitnamilegacy/contour@sha256:ab0665888c91c754030d46e7bbaf9a661bd1f16bbbbafcef59ce0fafdba871f1
  outputs:
    - Secret/${namespace}/contourcert
    - Secret/${namespace}/envoycert
  temporaryResourcesRemoved: true
EOF_RECEIPT
fi
