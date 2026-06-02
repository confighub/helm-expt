# Helm Mission — Wave 1 Runbook (reproducible on any machine)

Status: **PASS** first run 2026-06-01 (rig `pilot-helm-w1`, org Cubby AI Inc).

Wave 1 = a newcomer installs a **vanilla public chart at its default base**,
entirely via `cub installer` (never the helm CLI), onto a BYO cluster whose Argo
pulls from `oci.hub.confighub.com`. This runbook is the exact, parameterized
procedure so the same job runs identically on another machine.

Lives here (test harness) per the repo split; the core flow it exercises lives
in `confighub/helm-expt`. See `pilot/HELM_STRESS_TEST_MISSION.md`.

## Prerequisites (verify, don't assume)

- `cub auth login` complete (real API check: `cub organization list` or
  `./scripts/pilot-org-check --json` — NOT `cub info`).
- `kind`, `kubectl`, `docker` (daemon running), `cub` on PATH.
- cub-lk plugin: `cub plugin install jesperfj/cub-lk` (verify `cub lk version`).
- `helm-expt` checked out as a **sibling** of this repo (path is machine-specific
  — resolve it, don't hardcode):
  ```bash
  HELM_EXPT="$(cd "$(git rev-parse --show-toplevel)/../helm-expt" 2>/dev/null && pwd)"
  # fallbacks if not a sibling: /Users/<you>/Public/github-repos/helm-expt
  #                             /Users/<you>/code/helm-expt
  ```
- Resource budget: ≤2 kind clusters; this run creates 1, torn down at the end.

## Parameters

```bash
CLUSTER=pilot-helm-w1                 # cub-lk cluster + name prefix
SPACE_CLUSTER=${CLUSTER}-cluster      # cub-lk creates this (root app + oci target live here)
WORKLOAD_SPACE=${CLUSTER}-nginx       # we create this for the workload units
TARGET=${SPACE_CLUSTER}/oci           # the Noop OCI target cub-lk made
PKG=$HELM_EXPT/packages/bitnami/nginx/24.0.2
BASE=http-clusterip                   # nginx default base (default:true), no Secret
NS=nginx                              # MUST match the base's frozen namespace — see "Known defect"
WORKDIR=/tmp/${CLUSTER}-nginx
KUBECONFIG_FILE=$HOME/.confighub/lk/${CLUSTER}.kubeconfig
KCTX=kind-${CLUSTER}
```

## Steps

```bash
# 1. Stand up the BYO-cluster simulation (kind + Argo + ConfigHub space/target/root-app).
#    Long step (kind create + Argo install + rollout wait). Dedicated kubeconfig;
#    never merged into ~/.kube/config.
cub lk up --name "$CLUSTER"

# 2. Render the vanilla chart at its default base via cub installer (NO helm CLI).
#    ⚠ NS must equal the base's frozen namespace (see "Known defect"). For nginx that is "nginx".
rm -rf "$WORKDIR"
cub installer setup --pull "$PKG" --base "$BASE" --work-dir "$WORKDIR" \
  --non-interactive --namespace "$NS"
# Coherence guard (catches the known defect before anything is applied):
test "$(grep -rhE '^\s*namespace:' "$WORKDIR"/out/manifests | sort -u | wc -l)" -eq 1 \
  || { echo "ABORT: incoherent namespaces in render"; exit 1; }

# 3. Upload the rendered manifests as units, targeted at the cluster's OCI target.
cub installer upload --work-dir "$WORKDIR" --space "$WORKLOAD_SPACE" --target "$TARGET"

# 4. Apply the workload units (Noop → populates the OCI bundle at path ./$WORKLOAD_SPACE).
#    Exclude the untargeted installer-record unit.
cub unit apply --space "$WORKLOAD_SPACE" \
  --unit deployment-nginx-nginx,namespace-nginx,networkpolicy-nginx-nginx,poddisruptionbudget-nginx-nginx,service-nginx-nginx,serviceaccount-nginx-nginx

# 5. Author + apply the Argo Application (the app-of-apps child the root picks up).
cat > /tmp/app-nginx.yaml <<YAML
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata: {name: nginx, namespace: argocd}
spec:
  project: default
  source:
    repoURL: oci://oci.hub.confighub.com:443/target/${SPACE_CLUSTER}/oci
    targetRevision: latest
    path: ./${WORKLOAD_SPACE}
  destination: {server: https://kubernetes.default.svc, namespace: ${NS}}
  syncPolicy:
    automated: {selfHeal: true, prune: true}
    syncOptions: [ServerSideApply=true, CreateNamespace=true]
YAML
cub unit create --space "$SPACE_CLUSTER" nginx-app /tmp/app-nginx.yaml --target "$TARGET"
cub unit apply  --space "$SPACE_CLUSTER" --unit nginx-app

# 6. Verify (dedicated kubeconfig + explicit --context; never `kubectl config use-context`).
export KUBECONFIG="$KUBECONFIG_FILE"
kubectl --context "$KCTX" get applications -n argocd \
  -o custom-columns='NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status,REV:.status.sync.revision'
kubectl --context "$KCTX" rollout status deploy/nginx -n "$NS" --timeout=150s
kubectl --context "$KCTX" get deploy,pods -n "$NS" -o wide

# 7. Tear down (kind cluster + ConfigHub space, recursive).
cub lk down --name "$CLUSTER"
```

## Expected proof (reference values from the 2026-06-01 PASS run)

| Layer | Expected |
|---|---|
| Render | 6 manifests; single namespace `nginx` across all |
| ConfigHub | 6 workload units + installer-record in `$WORKLOAD_SPACE`; all applied (Noop) |
| OCI | served at `oci://oci.hub.confighub.com:443/target/$SPACE_CLUSTER/oci` |
| Argo | `root` (`$SPACE_CLUSTER`) + child `nginx` both `Synced/Healthy`, same revision (e.g. `sha256:90a8a441…`) |
| Runtime | `deploy/nginx 1/1` Available; pod Running 1/1; image `registry-1.docker.io/bitnami/nginx:latest` |
| Teardown | `cub lk down` deletes kind cluster + space; `kind get clusters` → none |

## Known defect (MUST fix before users see it) — see "Wave 1 findings"

`cub installer setup --namespace X` is coherent **only when X equals the base's
frozen namespace** (`nginx` for this package, `redis` for redis, …). For any
other X the install is silently split (Namespace object = X, workloads = frozen
ns). Root cause + fix in `pilot/HELM_WAVE1_FINDINGS.md`. Until fixed, this
runbook pins `NS` to the frozen value and step 2 includes a coherence guard.
