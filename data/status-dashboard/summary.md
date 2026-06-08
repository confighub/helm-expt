# Status Dashboard

This generated dashboard is the short front door for current project status. It
joins the top100 readiness, proof lane, quirk, hook, GitOps, and live-parity
tables without replacing them.

Use this page to answer:

~~~text
What is working now?
Which claims are only partial?
Where are the main residues?
Which detailed CSV should I open next?
~~~

## Current State

| Section | Metric | Value | Status | Source |
| --- | --- | ---: | --- | --- |
| top100 | charts with model support | 100/100 | good | [data/outcome-coverage/chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) |
| top100 | catalog-supported charts | 20/100 | partial | [data/top100-readiness/readiness.csv](../../data/top100-readiness/readiness.csv) |
| top100 | proof-grade non-catalog charts | 80/100 | partial | [data/top100-readiness/readiness.csv](../../data/top100-readiness/readiness.csv) |
| top100 | variant-rich charts | 54/100 | partial | [data/outcome-coverage/chart-outcomes.csv](../../data/outcome-coverage/chart-outcomes.csv) |
| proof lanes | render parity rows | 156/156 | good | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | in-ConfigHub proof rows | 18/156 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | local live rows | 21/156 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | GitOps/OCI live pass rows | 17/156 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | live Helm-vs-ConfigHub parity pass rows | 15/156 | partial | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| proof lanes | two-cluster kind parity pass rows | 25/40 | partial | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| proof lanes | complete core lane rows | 11/156 | gap | [data/outcome-coverage/base-outcomes.csv](../../data/outcome-coverage/base-outcomes.csv) |
| derived variants | derived variant golden rows | 10/10 | good | [data/variant-goldens/derived-expansion-wave/work-orders.csv](../../data/variant-goldens/derived-expansion-wave/work-orders.csv) |
| derived variants | derived variant live create receipts | 10/10 | good | [runs/derived-variant-execution](../../runs/derived-variant-execution) |
| derived variants | target-bound derived variant receipts | 6/10 | partial | [runs/derived-variant-target-bound](../../runs/derived-variant-target-bound) |
| live evidence | runtime/GitOps wave rows | 10/10 | partial | [data/runtime-gitops/wave1.csv](../../data/runtime-gitops/wave1.csv) |
| live evidence | live Helm-vs-ConfigHub receipts | 20/20 | partial | [data/live-helm-confighub-compare/summary.csv](../../data/live-helm-confighub-compare/summary.csv) |
| live evidence | two-cluster kind parity receipts | 40/40 | partial | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| live evidence | ConfigHub/OCI semantic parity defect receipts | 0/20 | good | [data/live-helm-confighub-compare/summary.csv](../../data/live-helm-confighub-compare/summary.csv) |
| live evidence | two-cluster semantic parity defect receipts | 0/40 | good | [data/live-kind-parity/summary.csv](../../data/live-kind-parity/summary.csv) |
| quirks | tracked-and-surfaced axes | 8/25 | good | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| quirks | partly tracked axes | 3/25 | partial | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| quirks | source-scanned but not surfaced axes | 5/25 | gap | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| quirks | not-scanned axes | 6/25 | gap | [data/quirk-coverage/coverage.csv](../../data/quirk-coverage/coverage.csv) |
| hooks | top100 maintained hook charts | 5/5 | partial | [data/hook-lifecycle/top100-hooks.csv](../../data/hook-lifecycle/top100-hooks.csv) |
| hooks | hook lifecycle receipts present | 0/5 | gap | [data/hook-lifecycle/top100-hooks.csv](../../data/hook-lifecycle/top100-hooks.csv) |
| hooks | related lifecycle observation receipts passing | 4/4 | good | [data/lifecycle-observations/cert-manager-eso/summary.csv](../../data/lifecycle-observations/cert-manager-eso/summary.csv) |

## Top100 Readiness

| Adoption bucket | Charts |
| --- | ---: |
| needs-useful-variant | 46 |
| promote-after-review | 27 |
| try-from-public-catalog | 20 |
| limitation-decision-first | 7 |

| Strongest evidence | Charts |
| --- | ---: |
| render-parity | 80 |
| live-helm-vs-confighub-parity | 15 |
| local-kubernetes-live | 5 |

The top100 is model-supported, but not uniformly live-proven. Use
[top100-readiness/readiness.csv](../top100-readiness/readiness.csv) for one row
per chart, and [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv)
for exact chart/base lane status.

## Top20 Catalog Status

This is the compact chart-by-chart view for the public catalog. It shows the
supported base variants, current evidence strength, and lane counts. The CSV
also includes each chart's feature summary for hooks, CRDs, generated Secrets,
webhooks, values schemas, and other tracked quirks. Use
[top20-status.csv](top20-status.csv) when you want the same data in a
spreadsheet.

| Chart | Variants | Strongest evidence | Render | ConfigHub | Local live | GitOps live | Live parity | Hard gap |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| argo-cd/argo-cd@9.5.15 | default;no-crds | local-kubernetes-live | 2/2 | 1/2 | 1/2 | 0/2 | 0/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/mongodb@19.0.7 | generated-passwords;existing-secret-replicaset | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| bitnami/mysql@14.0.3 | generated-passwords;existing-secret | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/nginx@24.0.2 | http-clusterip;existing-tls-ingress | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | existing-secret (chart ships no Secret toggle - #113) |
| bitnami/postgresql@18.6.7 | generated-passwords;existing-secret | live-helm-vs-confighub-parity | 2/2 | 0/2 | 1/2 | 2/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/rabbitmq@16.0.14 | generated-passwords;existing-secret | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| bitnami/redis@25.5.3 | default;reuse-existing-secret | live-helm-vs-confighub-parity | 2/2 | 1/2 | 2/2 | 2/2 | 1/2 | - |
| external-secrets/external-secrets@2.5.0 | default;no-crds | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| grafana/grafana@10.5.15 | generated-passwords;existing-secret-ingress | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| grafana/loki@7.0.0 | single-binary-filesystem;simple-scalable-minio | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| grafana/tempo@1.24.4 | local-persistent;s3-query-observability | local-kubernetes-live | 2/2 | 1/2 | 1/2 | 0/2 | 0/2 | ha (tempo single-binary chart; HA is the separate tempo-distributed chart) |
| hashicorp/consul@2.0.0 | default-control-plane;secure-mesh-existing-secrets | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| hashicorp/vault@0.32.0 | default;ha-raft-ui | local-kubernetes-live | 2/2 | 1/2 | 1/2 | 0/2 | 0/2 | - |
| ingress-nginx/ingress-nginx@4.15.1 | default;admission-disabled | local-kubernetes-live | 2/2 | 1/2 | 1/2 | 0/2 | 0/2 | - |
| jetstack/cert-manager@v1.20.2 | default;crds-enabled | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| longhorn/longhorn@1.11.2 | default;ui-ingress | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |
| metrics-server/metrics-server@3.13.0 | default;external-tls-ca | live-helm-vs-confighub-parity | 2/2 | 0/2 | 1/2 | 1/2 | 1/2 | existing-secret (chart ships no Secret toggle - #113) |
| prometheus-community/kube-prometheus-stack@85.3.3 | default;no-crds | local-kubernetes-live | 2/2 | 1/2 | 1/2 | 0/2 | 0/2 | existing-secret (chart ships no Secret toggle - #113) |
| prometheus-community/prometheus@29.8.0 | default;server-only-ephemeral | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | ha (curated proof lane - bespoke teaching needed) |
| secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 | default;sync-secret-rotation | live-helm-vs-confighub-parity | 2/2 | 1/2 | 1/2 | 1/2 | 1/2 | - |

The table is deliberately lane-specific. A chart can be useful today without
every lane passing for every base variant. The exact per-base rows are in
[outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv).

## Live And Parity Residue

| Lane | Pass | Non-pass | Missing | Total |
| --- | ---: | ---: | ---: | ---: |
| in-ConfigHub | 18 | 0 | 138 | 156 |
| local live | 21 | 0 | 135 | 156 |
| GitOps/OCI live | 17 | 9 | 130 | 156 |
| live Helm-vs-ConfigHub parity | 15 | 5 | 136 | 156 |
| two-cluster kind parity | 25 | 15 | 0 | 40 |

Non-pass live receipts are useful evidence. They usually identify a target
prerequisite, runtime behavior, or provisioning boundary rather than a render
parity failure.

Current semantic parity defect receipts:

~~~text
ConfigHub/OCI live comparison: 0/20
two-cluster kind parity:       0/40
~~~

The two-cluster kind parity lane is the cleanest live comparison for chart/base
rows: regular Helm is applied to one vanilla kind cluster and the `cub installer`
rendered objects are applied to another vanilla kind cluster. The receipts then
compare the live outcomes. Use
[live-kind-parity/summary.csv](../live-kind-parity/summary.csv) for those rows.

Current ConfigHub/OCI live parity non-pass receipts:

| Chart | Variant | Result | Reason |
| --- | --- | --- | --- |
| ingress-nginx/ingress-nginx@4.15.1 | admission-disabled | watch | - |
| argo-cd/argo-cd@9.5.15 | default | watch | - |
| prometheus-community/kube-prometheus-stack@85.3.3 | default | watch | - |
| hashicorp/vault@0.32.0 | default | watch | - |
| grafana/tempo@1.24.4 | local-persistent | watch | - |


Current two-cluster kind parity non-pass receipts:

| Chart | Base | Result | Reason |
| --- | --- | --- | --- |
| argo-cd/argo-cd@9.5.15 | default | watch | helm-runtime: upstream not ready (parity passed) |
| argo-cd/argo-cd@9.5.15 | no-crds | blocked | target-prerequisite: CRDs disabled or missing (parity passed) |
| bitnami/mongodb@19.0.7 | existing-secret-replicaset | blocked | target-runtime: pod crash loop (parity passed) |
| external-secrets/external-secrets@2.5.0 | no-crds | blocked | target-prerequisite: CRDs disabled or missing (parity passed) |
| grafana/loki@7.0.0 | simple-scalable-minio | blocked | target-runtime: pods pending (parity passed) |
| grafana/tempo@1.24.4 | local-persistent | blocked | target-runtime: pods pending (parity passed) |
| grafana/tempo@1.24.4 | s3-query-observability | blocked | target-prerequisite: CRDs missing |
| hashicorp/consul@2.0.0 | secure-mesh-existing-secrets | blocked | target-runtime: pod crash loop (parity passed) |
| hashicorp/vault@0.32.0 | default | blocked | helm-runtime: upstream not ready (parity passed) |
| hashicorp/vault@0.32.0 | ha-raft-ui | blocked | target-runtime: pods pending (parity passed) |
| ingress-nginx/ingress-nginx@4.15.1 | default | watch | helm-runtime: upstream not ready (parity passed) |
| jetstack/cert-manager@v1.20.2 | default | blocked | helm-hook: post-install hook failed (parity passed) |
| metrics-server/metrics-server@3.13.0 | external-tls-ca | blocked | helm-runtime: upstream not ready (parity passed) |
| prometheus-community/kube-prometheus-stack@85.3.3 | default | watch | helm-runtime: upstream not ready (parity passed) |
| prometheus-community/kube-prometheus-stack@85.3.3 | no-crds | blocked | target-prerequisite: CRDs missing |


## Derived Variant Evidence

Derived ConfigHub variants are the post-render half of the model. They start
from reviewed uploaded bases and use `cub variant create` plus ConfigHub
metadata, targets, gates, links, checks, and receipts. They do not rerender
Helm.

| Metric | Value |
| --- | ---: |
| derived variant golden rows | 10/10 |
| live cub variant create receipts | 10/10 |
| target-bound derived variant receipts | 6/10 |

The golden rows are in
[variant-goldens/derived-expansion-wave/work-orders.csv](../variant-goldens/derived-expansion-wave/work-orders.csv).
Live create receipts are in
[runs/derived-variant-execution](../../runs/derived-variant-execution), and
target-bound receipts are in
[runs/derived-variant-target-bound](../../runs/derived-variant-target-bound).

## Quirk And Hook Residue

| Quirk coverage tier | Axes |
| --- | ---: |
| tracked-and-surfaced | 8 |
| not-scanned | 6 |
| source-scanned-not-surfaced | 5 |
| partly-tracked | 3 |
| tracked-by-lock-not-front-door | 2 |
| disclosed-not-complete | 1 |

| Hook chart | Selected base | Current disposition | Next action |
| --- | --- | --- | --- |
| prometheus-community/kube-prometheus-stack@85.3.3 | default | requires-route-and-receipt | choose lifecycle route, run live path, commit lifecycle or observation receipt |
| kyverno/kyverno@3.8.1 | default | requires-route-and-receipt | choose lifecycle route, run live path, commit lifecycle or observation receipt |
| fluent/fluent-bit@0.57.6 | default | requires-route-and-receipt | choose lifecycle route, run live path, commit lifecycle or observation receipt |
| projectcalico/tigera-operator@v3.32.0 | default | requires-route-and-receipt | choose lifecycle route, run live path, commit lifecycle or observation receipt |
| gatekeeper/gatekeeper@3.22.2 | default | requires-route-and-receipt | choose lifecycle route, run live path, commit lifecycle or observation receipt |

Hook rows are not support claims. They are the queue for lifecycle route and
receipt work. The hook doctrine is
[Seven-Stage Helm Lifecycle](../../docs/reference/seven-stage-helm-lifecycle.md)
and [Hook Lifecycle Strategy](../../docs/user/hook-lifecycle-strategy.md).

## How To Use This

| Question | Open |
| --- | --- |
| Can I use this chart today? | [top100-readiness/readiness.csv](../top100-readiness/readiness.csv) |
| Which base variants have which proof lanes? | [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) |
| Which hooks, CRDs, generated facts, or target facts matter? | [outcome-coverage/feature-outcomes.csv](../outcome-coverage/feature-outcomes.csv) |
| Which Helm quirk axes are still blind spots? | [quirk-coverage/coverage.csv](../quirk-coverage/coverage.csv) |
| Which hook charts need lifecycle receipts? | [hook-lifecycle/top100-hooks.csv](../hook-lifecycle/top100-hooks.csv) |
| Which live comparisons passed or failed? | [live-helm-confighub-compare/summary.csv](../live-helm-confighub-compare/summary.csv) |
| Which live rows should be rerun next? | [live-parity-rerun-plan/summary.md](../live-parity-rerun-plan/summary.md) |
| Which derived variants are specified or executed? | [variant-goldens/derived-expansion-wave/work-orders.csv](../variant-goldens/derived-expansion-wave/work-orders.csv) |

Regenerate:

~~~sh
npm run status:dashboard
npm run status:dashboard:verify
~~~
