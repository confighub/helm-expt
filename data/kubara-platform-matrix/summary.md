# Kubara Component × Cluster Matrix — primary current

This is the primary matrix for Kubara v0.13.0 with official
catalogs 1.1.0. It is generated from the four-cluster
current config, committed effective renders, and two digest-pinned app fixtures.
Historical v0.12.0 adapted
evidence is retained separately under [historical-v0.12.0](historical-v0.12.0/summary.md).

Colored, accessible view: [matrix.html](matrix.html). Machine-readable forms:
[matrix.csv](matrix.csv) and [matrix.json](matrix.json).

## Matrix

| Component / selected version | hx-app-dev<br>dev / hub | hx-app-staging<br>staging / spoke | hx-app-prod-a<br>prod / spoke | hx-app-prod-b<br>prod / spoke |
| --- | --- | --- | --- | --- |
| argo-cd<br>argo-cd/argo-cd@10.2.1 | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🔁 **centralized**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🔁 **centralized**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🔁 **centralized**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown |
| cert-manager<br>jetstack/cert-manager@v1.21.0 | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown |
| external-secrets<br>external-secrets/external-secrets@2.8.0 | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown |
| homer-dashboard<br>kubara/homer-dashboard@0.1.0 | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown |
| kube-prometheus-stack<br>prometheus-community/kube-prometheus-stack@87.19.2 + prometheus-community/prometheus-blackbox-exporter@11.15.1 | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown |
| metrics-server<br>metrics-server/metrics-server@3.13.1 | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown | ➖ **disabled**<br>sync: Unknown<br>health/ready: NotApplicable / not-applicable<br>observed: Unknown |
| traefik<br>traefik/traefik@41.0.2 | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown |
| hx-web<br>nginx@sha256:6784fb0834aa7dbbe12e3d7471e69c290df3e6ba810dc38b34ae33d3c1c05f7d | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown |
| cubbychat<br>commit e9e76a076924d95897c3ede7a0f21cec523c4f6f; 3 digest-pinned images | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown | 🟣 **rendered-only**<br>sync: Unknown<br>health/ready: Unknown / unknown<br>observed: Unknown |

Status counts: rendered-only=21, centralized=3, disabled=12.
Purple `rendered-only` means desired state is committed and mechanically
rendered but sync/workload state is unknown. Blue `centralized` records that
spokes are managed by hub Argo CD rather than pretending an Argo instance is
installed on each spoke.

Live overlay receipt: `runs/kubara-mini-idp-reconcile/receipt.yaml` (validation:
`not-present`; accepted as live:
`false`; source digests verified:
0; parsed cells:
0). Validation notes:
- runs/kubara-mini-idp-reconcile/receipt.yaml is absent; all live fields remain Unknown.

The non-live [desired-matrix.json](desired-matrix.json) is generated first and
digest-pinned by the reconciliation receipt. The final matrix overlays that
base only after the receipt proves Kubara v0.13.0, all current source digests,
and all 36 component/application cells. The faithful-lane receipt remains
separate topology evidence (status: `pass`).

## Explicit unknowns

| Component | Cluster | Observed version | ConfigHub sync | Health | Readiness | Why Unknown |
| --- | --- | --- | --- | --- | --- | --- |
| argo-cd | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| argo-cd | hx-app-staging | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| argo-cd | hx-app-prod-a | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| argo-cd | hx-app-prod-b | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cert-manager | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cert-manager | hx-app-staging | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cert-manager | hx-app-prod-a | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cert-manager | hx-app-prod-b | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| external-secrets | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| homer-dashboard | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| kube-prometheus-stack | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| metrics-server | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| traefik | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| traefik | hx-app-staging | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| traefik | hx-app-prod-a | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| traefik | hx-app-prod-b | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| hx-web | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| hx-web | hx-app-staging | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| hx-web | hx-app-prod-a | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| hx-web | hx-app-prod-b | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cubbychat | hx-app-dev | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cubbychat | hx-app-staging | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cubbychat | hx-app-prod-a | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |
| cubbychat | hx-app-prod-b | Unknown | Unknown | Unknown | unknown | No accepted source-current mini-IDP live observation exists for this cell. |

## Declared values overrides

These are normal Kubara input overlays, not silently reclassified as live
departures.

| Cluster | Component | Override file(s) |
| --- | --- | --- |
| hx-app-dev | argo-cd | `examples/kubara/current-platform/source/overrides/hx-app-dev/helm/argo-cd/values-repository-paths.yaml` |
| hx-app-dev | cert-manager | `examples/kubara/current-platform/source/overrides/hx-app-dev/helm/cert-manager/values-kind.yaml` |
| hx-app-staging | cert-manager | `examples/kubara/current-platform/source/overrides/hx-app-staging/helm/cert-manager/values-kind.yaml` |
| hx-app-prod-a | cert-manager | `examples/kubara/current-platform/source/overrides/hx-app-prod-a/helm/cert-manager/values-kind.yaml` |
| hx-app-prod-b | cert-manager | `examples/kubara/current-platform/source/overrides/hx-app-prod-b/helm/cert-manager/values-kind.yaml` |
| hx-app-dev | homer-dashboard | `examples/kubara/current-platform/source/overrides/hx-app-dev/helm/homer-dashboard/values-project-links.yaml` |
| hx-app-dev | metrics-server | `examples/kubara/current-platform/source/overrides/hx-app-dev/helm/metrics-server/values-kind.yaml` |

## Commands

~~~sh
node scripts/generate-kubara-effective-renders.mjs --verify --profile current
node scripts/generate-kubara-platform-matrix.mjs --generate --profile current
node scripts/generate-kubara-platform-matrix.mjs --verify --profile current
node scripts/generate-kubara-platform-matrix.mjs --self-test
~~~
