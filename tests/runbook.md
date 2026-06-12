# Helm Catalog Live Test Runbook

This runbook records the reproducible per-chart path for delivering a catalog
package through ConfigHub OCI into a live Kubernetes cluster. It is parameterized
so the same job can run on another machine or rig.

Reference runs:

- 2026-06-01: first NGINX `http-clusterip` pass.
- 2026-06-04: rig `helm-expt-oci-0604`, NGINX `http-clusterip`,
Argo CD OCI revision
`sha256:98ec5a4bfccb925381b1ec304dcb4a9e884bbe06ac1bb5d69d34076a791a7f72`.
- 2026-06-05: rig `helm-expt-oci-0605`, NGINX `http-clusterip`,
Argo CD OCI revision
`sha256:0dc30c7049393a17fa7575bd45bad0918f5162d4014f80228010b8e914b49bf5`.
- The same retained rig was then used for three more first-wave rows:
Metrics Server `default` passed after follow-up observation
(`sha256:34716a4697a7f05c4ebde2587d1666fe0e0b47978c7fdbc2b3efb1ab42de1465`);
External Secrets `no-crds` blocked on missing CRDs and separated webhook Secret
delivery
(`sha256:9d6050df91f6c7be4549a7a32daa0c924c0f5a855050e87fd880e28701df13e6`);
ingress-nginx `admission-disabled` synced and reached Deployment readiness but
remained Argo `Progressing` because the kind target has no LoadBalancer external
IP
(`sha256:9672fd1b2da39cffada83cfa7b4cc8610ff65c7bbc2e2ba68dd3a20a1dc10960`).
Redis `reuse-existing-secret` was also delivered through Flux OCI on the same
rig after staging the required `redis/redis-existing-secret`; Flux applied
revision
`sha256:800fa47d22c99a250a8f3f4bed3004c334c2c1818cb6f1805e1cb892d490c1e2` and
Redis returned PONG.
Prometheus `server-only-ephemeral` and PostgreSQL `existing-secret` were then
delivered through the same Flux controller. Prometheus reached Deployment
readiness at
`sha256:5002930116cef5be34ec07de6445b29956d73627ae1d02b17446187d9a58810b`.
PostgreSQL reached StatefulSet readiness after staging
`postgresql/postgresql-auth`, and a `select 1` probe passed at
`sha256:d820d9bde5bbeeeee6bbd3f3e8ba90da43ce0dd1aefcbaa098920b75e1ea1f3b`.
kube-prometheus-stack `no-crds` was then attempted through Flux. Flux pulled
revision
`sha256:ca3114731bde626fc078765e4b1f8cb12858b6f31e9af8c083175662bbe2eecd`,
but reconciliation blocked because `Alertmanager.monitoring.coreos.com/v1` and
related Prometheus Operator CRDs were absent; the run also recorded two
separated Secrets that were not delivered through the workload OCI path.

This lane installs a **vanilla public chart at its default base**, entirely via
`cub installer` (not the helm CLI), onto a BYO cluster whose
GitOps controller pulls from `oci.hub.confighub.com`. This runbook is the exact,
parameterized procedure so the same job runs identically on another machine.

The test harness lives in `tests/`; the core flow it exercises lives in
`confighub/helm-expt`. See [strategy.md](strategy.md).

## Prerequisites (verify, don't assume)

- `cub auth login` complete. Verify with `cub organization list`, not `cub info`.
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

## Target Profiles

Some rows need a target capability that vanilla kind does not provide. The live
parity harness calls those capabilities target profiles.

| Profile | Purpose | Command shape |
| --- | --- | --- |
| `kind-ingress-nginx` | Proves Ingress behavior on kind by installing the target ingress controller. | `npm run live-parity:top20 -- --chart nginx --base existing-tls-ingress --target-profile kind-ingress-nginx` |
| `kind-loadbalancer` | Proves `Service.type=LoadBalancer` behavior on kind by running `cloud-provider-kind`. | `npm run live-parity:top20 -- --chart ingress-nginx --base default --target-profile kind-loadbalancer` |

Before starting a guarded target-profile run, use preflight:

```bash
npm run live-parity:top20 -- --preflight --chart ingress-nginx --base default --target-profile kind-loadbalancer
```

`kind-loadbalancer` needs the `cloud-provider-kind` binary on `PATH`. It is
guarded because the provider observes kind clusters host-wide. The harness
refuses to start the profile if another kind cluster is present. Wait for other
agents' live lanes to finish before using it.

## Parameters

```bash
CLUSTER=helm-expt-demo                # cub-lk cluster + name prefix
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

## Namespace Coherence Guard

Earlier live runs found that packages without the namespace transformer could
render a `Namespace` object for one namespace while workloads retained the
recipe's frozen namespace. The top-20 packages now include the transformer where
it is supported, but complex charts can still contain namespace references in
embedded fields. Keep the step 2 coherence guard in place and read
[findings.md](findings.md) before using an arbitrary namespace for a complex
chart.
