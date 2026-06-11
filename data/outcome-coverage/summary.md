# Outcome Coverage

This generated report joins the main proof surfaces into one reader-facing map:
what outcomes the project claims, which tests prove them, and where to inspect
the status per chart, base variant, derived variant, and Helm feature.

## Aggregate Status

```text
charts with model support:           108/110
variant-rich charts:                 64/110
chart/base rows:                     189
complete core lane rows:             20/189
render parity rows:                  189/189
in-ConfigHub proof rows:             20/189
local live rows:                     23/189
GitOps/OCI live pass rows:           22/189
GitOps/OCI non-pass receipts:        6
live Helm-vs-ConfigHub pass rows:    20/189
live Helm-vs-ConfigHub non-pass receipts: 2
selected live parity receipts:       20 pass, 0 watch, 0 blocked
two-cluster kind parity receipts:    49 pass, 0 watch, 1 blocked
derived intended-state pass rows:    10
target-bound derived pass rows:      5
target-bound derived blocked rows:   1
maintained hook queue rows:          5
hook route receipts present:         5/5
hook lifecycle observations present: 5/5
hook partial lifecycle observations: 0/5
hook routes awaiting observation:    0/5
hook rows still needing route:       0/5
related lifecycle observations:      4/4
```

## Outcome Promises And Proving Tests

| Outcome users care about | Test / evidence | Command |
| --- | --- | --- |
| The chart model is understandable and honestly scoped. | model-completeness report, chart facts, pain reports, weirdness notes | `npm run completeness:verify` |
| A base variant renders the same object set as Helm under recorded inputs. | `helm_template_vs_installer_setup` lane | `npm run lane-tests:verify` |
| The rendered objects can be uploaded and operated in ConfigHub. | `confighub_upload_variant_scan_safe_ops` lane | `npm run top20:verify-confighub-proof` |
| The rendered objects work in Kubernetes for tested rows. | `local_kind_kubectl_apply` lane | `npm run top20:verify-local-e2e` |
| ConfigHub OCI can be reconciled by GitOps for tested rows. | `confighub_oci_argo_live` lane | `npm run runtime-gitops:wave:verify` |
| Plain Helm and ConfigHub delivery reach equivalent live outcomes for tested rows. | `live_helm_vs_confighub_dual_compare`, two-cluster parity receipts | `npm run live-parity:verify && npm run kind-parity:verify` |
| Derived ConfigHub variants preserve reviewed bases and expose post-render changes. | derived variant execution and target-bound receipts | `npm run derived-variants:verify && npm run derived-variants:target-bound:verify` |
| Hooks and hook-like lifecycle behavior are not hidden in render proof. | hook route receipts, hook lifecycle queue, and lifecycle observations | `npm run hooks:lifecycle:verify && npm run lifecycle:boundary:verify && npm run lifecycle:cert-manager-eso:verify` |
| Images, Secrets, CRDs, webhooks, target facts, and other chart-specific features are visible. | chart facts, attack-plan workdown, image-digest workdown | `npm run chart-facts:verify && npm run attack-plan:verify && npm run image-digests:workdown:verify` |

## Files

| File | What it shows |
| --- | --- |
| `chart-outcomes.csv` | One row per chart: model support, production readiness, variant count, lane counts, feature summary, hard gaps. |
| `base-outcomes.csv` | One row per chart/base variant: render parity, in-ConfigHub proof, local live, GitOps/OCI live, live parity, and two-cluster kind parity. |
| `derived-variant-outcomes.csv` | One row per executed derived ConfigHub variant: intended-state proof and target-bound live status. |
| `feature-outcomes.csv` | One row per chart/feature: hooks, generated secrets, CRDs, webhooks, required values, schemas, extension slots, gaps. |

## Catalog-Supported Chart Snapshot

| Chart | Variants | Model | In-ConfigHub | Local live | GitOps live | Live parity | Two-cluster parity | Hard gap |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| `argo-cd/argo-cd@9.5.15` | default;no-crds | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| `bitnami/mongodb@19.0.7` | generated-passwords;existing-secret-replicaset | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | - |
| `bitnami/mysql@14.0.3` | generated-passwords;existing-secret | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| `bitnami/nginx@24.0.2` | http-clusterip;existing-tls-ingress | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | existing-secret (chart ships no Secret toggle) |
| `bitnami/postgresql@18.6.7` | generated-passwords;existing-secret | yes | 1/2 | 1/2 | 2/2 | 1/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| `bitnami/rabbitmq@16.0.14` | generated-passwords;existing-secret | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| `bitnami/redis@25.5.3` | default;reuse-existing-secret | yes | 1/2 | 2/2 | 2/2 | 1/2 | 2/2 | - |
| `external-secrets/external-secrets@2.5.0` | default;no-crds | no | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | - |
| `grafana/grafana@10.5.15` | generated-passwords;existing-secret-ingress | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | - |
| `grafana/loki@7.0.0` | single-binary-filesystem;simple-scalable-minio | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | - |
| `grafana/tempo@1.24.4` | local-persistent;s3-query-observability | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | ha (tempo single-binary chart; HA is the separate tempo-distributed chart) |
| `hashicorp/consul@2.0.0` | default-control-plane;secure-mesh-existing-secrets | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| `hashicorp/vault@0.32.0` | dev-mode;default;ha-raft-ui | yes | 1/3 | 2/3 | 1/3 | 1/3 | 3/3 | - |
| `ingress-nginx/ingress-nginx@4.15.1` | default;admission-disabled;internal-clusterip | yes | 1/3 | 2/3 | 1/3 | 1/3 | 3/3 | - |
| `jetstack/cert-manager@v1.20.2` | default;crds-enabled | no | 1/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| `longhorn/longhorn@1.11.2` | default;ui-ingress | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | - |
| `metrics-server/metrics-server@3.13.0` | default;external-tls-ca | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | existing-secret (chart ships no Secret toggle) |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default;no-crds | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | existing-secret (chart ships no Secret toggle) |
| `prometheus-community/prometheus@29.8.0` | default;server-only-ephemeral | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | ha (curated proof lane - bespoke teaching needed) |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default;sync-secret-rotation | yes | 1/2 | 1/2 | 1/2 | 1/2 | 2/2 | - |

## How To Read This

`pass` means a committed receipt exists and the verifier checks it. `missing`
means the lane has not been proven for that exact chart/base row. `fail`,
`watch`, or `blocked` means the repo has evidence that the row did not pass
as-is on the tested target.

Use the narrowest true claim: model-supported, render parity, in-ConfigHub,
local live, GitOps live, live parity, hook route selected, lifecycle observed,
or production-ready.
