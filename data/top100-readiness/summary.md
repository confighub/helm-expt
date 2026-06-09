# Top-100 Readiness

This is the shortest chart-by-chart answer for the maintained top-100 corpus.
It joins the catalog analysis with the outcome evidence so readers can see what
works now, what works with help, and what still needs product or operator work.

## Summary

~~~text
charts: 100
top-20 catalog-supported: 20
next-80 proof-grade: 80
charts with live evidence on at least one variant: 20
charts with named hard gaps: 25
~~~

## Practical Buckets

| Question | Count | Read it as | Next move |
| --- | ---: | --- | --- |
| Which charts are already public catalog entries? | 20 | Use the catalog, then check exact base status before claiming a lane. | Open `CATALOG.md`, the per-chart catalog page, `base-outcomes.csv`, and the production next-action queue. |
| Which proof-grade charts are closest to promotion? | 27 | Recipe/package proof and multiple variants exist, but catalog review is not done. | Run catalog promotion review and add live lanes for selected bases. |
| Which charts need a useful user-shaped variant first? | 46 | The default render proves the mechanism, but it is not yet a good catalog offer. | Add one or more realistic base variants before promotion. |
| Which charts need a limitation decision first? | 7 | A known gap affects the recommended path. | Decide whether to support, disclose, or defer that capability. |

## Adoption Buckets

| Bucket | Count | What it means | Use this when |
| --- | ---: | --- | --- |
| `limitation-decision-first` | 7 | A named capability gap affects the recommended path. Decide whether to support, disclose, or defer it. | You need an operator/product decision before presenting the chart as supported. |
| `needs-useful-variant` | 46 | The proof mechanism works, but the current default-only path is not yet a compelling catalog offer. | You are deciding which realistic base variants users would actually want. |
| `promote-after-review` | 27 | Recipe/package proof and multiple variants exist. It is a good candidate for catalog review and selected live lanes. | You are expanding the catalog or choosing the next charts for live evidence. |
| `try-from-public-catalog` | 20 | A public catalog entry exists and at least one base has live evidence. Check the exact base lane before making a broader claim. | You want a maintained public example and can choose a base with the needed proof lane. |

## Hard Gap Buckets

| Gap | Charts | What it means |
| --- | ---: | --- |
| existing-secret (chart ships no Secret toggle - #113) | 15 | The chart does not expose a clean bring-your-own-secret render path. Do not invent one silently. |
| ha (curated proof lane - bespoke teaching needed) | 6 | The proof path does not yet teach a realistic HA variant for that chart. |
| ha (tempo single-binary chart; HA is the separate tempo-distributed chart) | 1 | The current chart path is single-binary; HA belongs to a separate supported topology decision. |
| no-crds (template-baked CRDs, no toggle - #114) | 3 | The chart bakes CRDs into templates or lacks a clean CRDs-off switch. CRD ownership needs an explicit route. |

## User Status

| Status | Count | Meaning |
| --- | ---: | --- |
| `catalog-supported-with-live-evidence` | 20 | Top-20 catalog entry with at least one live proof lane. |
| `proof-grade-needs-user-shaped-variant` | 46 | Proof-grade chart whose current path is too default-only for catalog promotion. |
| `proof-grade-ready-for-promotion-review` | 27 | Recipe/package proof exists and variants exist; needs human catalog promotion review. |
| `proof-grade-with-named-limitation` | 7 | Proof-grade chart with a named capability gap or operator decision. |

## Strongest Evidence Per Chart

| Evidence | Count | Meaning |
| --- | ---: | --- |
| `live-helm-vs-confighub-parity` | 15 | Plain Helm and ConfigHub delivery reached equivalent live outcomes for at least one variant. |
| `local-kubernetes-live` | 5 | Rendered objects were applied to Kubernetes and observed for at least one variant. |
| `render-parity` | 80 | Regular Helm and cub installer setup render-equivalent objects. |

## How To Read This

- Every row in this file has a maintained recipe/package proof path.
- `render-parity` means regular Helm and `cub installer setup` produce the same
  Kubernetes object set under recorded inputs, apart from declared installer
  support objects.
- Live evidence is intentionally counted separately. A chart can be proof-grade
  without every base variant having live Kubernetes, GitOps, or live parity
  evidence yet.
- For top-20 public catalog rows, `next_action` comes from
  `data/production-disposition/next-actions.csv`. That keeps "can I try this?"
  separate from "can we call it production-supported?"
- `next_action_source` records which generated queue produced the advice.
- Hard gaps are capability gaps, not necessarily chart failure. They usually mean
  a useful path such as an existing-secret, HA, no-CRDs, or production lifecycle
  path still needs a supported variant or operator decision.

## First Backlog Rows

| Backlog | First rows |
| --- | --- |
| Promotion review | `external-dns/external-dns@1.21.1`<br>`cloudnative-pg/cloudnative-pg@0.28.2`<br>`kedacore/keda@2.19.0`<br>`elastic/eck-operator@3.4.0`<br>`grafana/alloy@1.8.2` |
| User-shaped variants | `gitlab/gitlab-runner@0.89.0`<br>`fluent/fluent-bit@0.57.6`<br>`runix/pgadmin4@1.62.0`<br>`nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18`<br>`prometheus-community/kube-state-metrics@7.4.0` |
| Named limitation review | `traefik/traefik@40.2.0`<br>`kyverno/kyverno@3.8.1`<br>`bitnami/elasticsearch@22.1.6`<br>`bitnami/spark@10.0.3`<br>`bitnami/zookeeper@13.8.7` |

## First Rows

| Chart | Adoption bucket | Evidence | Variants | Next action | Next receipt | Source |
| --- | --- | --- | ---: | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | `try-from-public-catalog` | `local-kubernetes-live` | 2 | write or fix the receipt for CRD lifecycle and upgrade policy | `data/production-disposition/receipts/argo-cd-argo-cd/crd-lifecycle-and-upgrade-policy.yaml` | `production-disposition` |
| `bitnami/mongodb@19.0.7` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `bitnami/mysql@14.0.3` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `bitnami/nginx@24.0.2` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `bitnami/postgresql@18.6.7` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `bitnami/rabbitmq@16.0.14` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `bitnami/redis@25.5.3` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `external-secrets/external-secrets@2.5.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | write or fix the receipt for CRD lifecycle and upgrade policy | `data/production-disposition/receipts/external-secrets-external-secrets/crd-lifecycle-and-upgrade-policy.yaml` | `production-disposition` |
| `grafana/grafana@10.5.15` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `grafana/loki@7.0.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | write or fix the receipt for cluster RBAC review | `data/production-disposition/receipts/grafana-loki/cluster-rbac-review.yaml` | `production-disposition` |
| `grafana/tempo@1.24.4` | `try-from-public-catalog` | `local-kubernetes-live` | 2 | write or fix the receipt for extension slot provenance and scan policy | `data/production-disposition/receipts/grafana-tempo/extension-slot-provenance-and-scan-policy.yaml` | `production-disposition` |
| `hashicorp/consul@2.0.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | write or fix the receipt for CRD lifecycle and upgrade policy | `data/production-disposition/receipts/hashicorp-consul/crd-lifecycle-and-upgrade-policy.yaml` | `production-disposition` |
| `hashicorp/vault@0.32.0` | `try-from-public-catalog` | `local-kubernetes-live` | 2 | write or fix the receipt for cluster RBAC review | `data/production-disposition/receipts/hashicorp-vault/cluster-rbac-review.yaml` | `production-disposition` |
| `ingress-nginx/ingress-nginx@4.15.1` | `try-from-public-catalog` | `local-kubernetes-live` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `jetstack/cert-manager@v1.20.2` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | write or fix the receipt for CRD lifecycle and upgrade policy | `data/production-disposition/receipts/jetstack-cert-manager/crd-lifecycle-and-upgrade-policy.yaml` | `production-disposition` |
| `longhorn/longhorn@1.11.2` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | write or fix the receipt for CRD lifecycle and upgrade policy | `data/production-disposition/receipts/longhorn-longhorn/crd-lifecycle-and-upgrade-policy.yaml` | `production-disposition` |
| `metrics-server/metrics-server@3.13.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `try-from-public-catalog` | `local-kubernetes-live` | 2 | write or fix the receipt for CRD lifecycle and upgrade policy | `data/production-disposition/receipts/prometheus-community-kube-prometheus-stack/crd-lifecycle-and-upgrade-policy.yaml` | `production-disposition` |
| `prometheus-community/prometheus@29.8.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | refresh live/e2e receipts for the accepted production scope | - | `production-disposition` |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | write or fix the receipt for CRD lifecycle and upgrade policy | `data/production-disposition/receipts/secrets-store-csi-driver-secrets-store-csi-driver/crd-lifecycle-and-upgrade-policy.yaml` | `production-disposition` |
| `traefik/traefik@40.2.0` | `limitation-decision-first` | `render-parity` | 2 | review limitation before promotion: existing-secret (chart ships no Secret toggle - #113) | - | `limitation-review` |
| `external-dns/external-dns@1.21.1` | `promote-after-review` | `render-parity` | 2 | run catalog promotion review | - | `catalog-promotion-review` |
| `gitlab/gitlab-runner@0.89.0` | `needs-useful-variant` | `render-parity` | 1 | add at least one user-shaped variant before catalog promotion | - | `user-shaped-variant-backlog` |
| `kyverno/kyverno@3.8.1` | `limitation-decision-first` | `render-parity` | 2 | review limitation before promotion: existing-secret (chart ships no Secret toggle - #113) | - | `limitation-review` |
| `cloudnative-pg/cloudnative-pg@0.28.2` | `promote-after-review` | `render-parity` | 2 | run catalog promotion review | - | `catalog-promotion-review` |

## Files

| File | Use |
| --- | --- |
| `data/top100-readiness/readiness.csv` | One row per top-100 chart: user status, strongest evidence, lane counts, gap, next action, next receipt path where available, and next-action source. |
| `data/top100-catalog-analysis/review.csv` | Catalog analysis and promotion surface. |
| `data/outcome-coverage/chart-outcomes.csv` | Detailed outcome counts per chart. |
| `data/outcome-coverage/base-outcomes.csv` | Per base-variant proof lane status. |

Regenerate:

~~~sh
npm run top100:readiness
npm run top100:readiness:verify
~~~
