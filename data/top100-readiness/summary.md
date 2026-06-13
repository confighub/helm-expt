# Top-100 Readiness

This is the shortest chart-by-chart answer for the maintained top-100 corpus.
It joins the catalog analysis with the outcome evidence so readers can see what
works now, what works with help, and what still needs product or operator work.

## Summary

~~~text
charts: 100
top-20 catalog-supported: 20
next-80 proof-grade: 80
charts with live evidence on at least one variant: 76
charts with named hard gaps: 25
source top-100 charts with Helm hooks: 11
maintained hook lifecycle rows: 5
source-reviewed hook route candidate plans: 10
source-reviewed hook routes not yet maintained: 8
~~~

## Workability Lens

| User question | Count | Answer |
| --- | ---: | --- |
| What can a user try from the public catalog now? | 20 | Use the catalog entry, then check the exact base and proof lane before making a stronger claim. |
| What works as a proof but is not promoted yet? | 37 | The recipe/package proof exists and useful variants exist; run catalog review and selected live lanes. |
| What should not be shown as a real catalog offer yet? | 35 | The default render proves the mechanism, but a realistic user-shaped base variant is still needed. |
| What needs a decision before promotion? | 8 | A named limitation such as existing-secret, HA, or CRD routing must be supported, disclosed, or deferred. |

## Practical Buckets

| Question | Count | Read it as | Next move |
| --- | ---: | --- | --- |
| Which charts are already public catalog entries? | 20 | Use the catalog, then check exact base status before claiming a lane. | Open `CATALOG.md`, the per-chart catalog page, `base-outcomes.csv`, and the production next-action queue. |
| Which proof-grade charts are closest to promotion? | 37 | Recipe/package proof and multiple variants exist, but catalog review is not done. | Run catalog promotion review and add live lanes for selected bases. |
| Which charts need a useful user-shaped variant first? | 35 | The default render proves the mechanism, but it is not yet a good catalog offer. | Add one or more realistic base variants before promotion. |
| Which charts need a limitation or compatibility decision first? | 8 | A known gap or target compatibility issue affects the recommended path. | Decide whether to support, disclose, defer, or refuse that capability for the named scope. |

## Next Workstreams

| Workstream | Rows | Start with | Done when | First examples |
| --- | ---: | --- | --- | --- |
| Use the public catalog | 20 | Open `CATALOG.md` and `data/top20-base-readiness/start-here.md`. | The user chooses a base, checks its proof lane, and avoids production claims until a support decision exists. | `argo-cd/argo-cd@9.5.15`<br>`bitnami/mongodb@19.0.7`<br>`bitnami/mysql@14.0.3`<br>`bitnami/nginx@24.0.2`<br>`bitnami/postgresql@18.6.7` |
| Promote proof-grade charts | 37 | Run catalog review on the closest proof-grade rows. | A chart has reviewed variants, live evidence for selected bases, and an updated catalog status. | `external-dns/external-dns@1.21.1`<br>`cloudnative-pg/cloudnative-pg@0.28.2`<br>`kedacore/keda@2.19.0`<br>`prometheus-community/kube-state-metrics@7.4.0`<br>`elastic/eck-operator@3.4.0` |
| Design user-shaped variants | 35 | Add one realistic base variant that a Helm user would actually pick. | The chart stops being default-only and moves into promotion review or limitation review. | `gitlab/gitlab-runner@0.89.0`<br>`fluent/fluent-bit@0.57.6`<br>`runix/pgadmin4@1.62.0`<br>`nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18`<br>`elastic/kibana@8.5.1` |
| Resolve limitations and compatibility blockers | 8 | Decide whether to support, disclose, defer, or refuse the named gap for the target scope. | The catalog page, compatibility decision, or hard-gap row agrees on the supported path. | `traefik/traefik@40.2.0`<br>`kyverno/kyverno@3.8.1`<br>`bitnami/elasticsearch@22.1.6`<br>`bitnami/spark@10.0.3`<br>`prometheus-community/prometheus-adapter@5.3.0` |
| Expand live evidence | 24 | Select rows that only have render parity and add local, GitOps, or live Helm-vs-ConfigHub evidence. | The strongest evidence moves beyond render parity for the selected chart/base. | `elastic/kibana@8.5.1`<br>`bitnami/elasticsearch@22.1.6`<br>`bitnami/spark@10.0.3`<br>`bitnami/zookeeper@13.8.7`<br>`bitnami/phpmyadmin@20.0.0` |
| Promote reviewed hook routes | 8 | Open `data/hook-route-candidates/summary.md` and choose one candidate route. | The route has a maintained lifecycle receipt, runtime observation path, or explicit blocker. | `k8s-dashboard/kubernetes-dashboard@7.14.0`<br>`gitlab/gitlab@10.0.0`<br>`bitnami/kafka@32.4.3`<br>`bitnami/minio@17.0.21`<br>`datadog/datadog@3.214.0` |

## Proof-Focus Rows

Some rows carry a specific proof focus because a hard Helm feature needs more
than render parity. These rows point to the evidence or decision surface that
should drive promotion.

| Focus | Rows | First charts |
| --- | ---: | --- |
| `api-service-aggregation-promotion` | 1 | `kedacore/keda@2.19.0` |
| `api-service-keep-fresh` | 1 | `metrics-server/metrics-server@3.13.0` |
| `api-service-render-path-recorded` | 2 | `fairwinds-stable/goldilocks@10.3.0`<br>`fairwinds-stable/vpa@4.11.0` |
| `api-service-target-compatibility` | 1 | `prometheus-community/prometheus-adapter@5.3.0` |

### APIService Focus

| Chart | Focus | Status | Receipt | Next action |
| --- | --- | --- | --- | --- |
| `metrics-server/metrics-server@3.13.0` | `api-service-keep-fresh` | APIService aggregation is observed; keep the runtime receipt fresh | `data/runtime-gitops/receipts/metrics-server-metrics-server/default/latest.yaml` | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| `kedacore/keda@2.19.0` | `api-service-aggregation-promotion` | APIService aggregation is observed; promotion needs a target-scoped decision | `data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml` | run APIService promotion review: choose supported base, target scope, CRD ownership path, and evidence refresh rule using the committed aggregation receipt |
| `prometheus-community/prometheus-adapter@5.3.0` | `api-service-target-compatibility` | target compatibility decision records that this chart stays proof-grade for the tested target profile | `data/apiservice-coverage/target-compatibility-decisions/prometheus-community-prometheus-adapter-5.3.0.yaml` | Keep prometheus-community/prometheus-adapter@5.3.0 proof-grade for this target profile. Promote only after an upstream chart version or explicit compatibility base renders a target-supported APIService object and passes the APIService runtime contract. |
| `fairwinds-stable/goldilocks@10.3.0` | `api-service-render-path-recorded` | source APIService signal exists, but current maintained bases render no APIService objects | `data/apiservice-coverage/render-path-notes.md` | add at least one user-shaped variant before catalog promotion |
| `fairwinds-stable/vpa@4.11.0` | `api-service-render-path-recorded` | source APIService signal exists, but current maintained bases render no APIService objects | `data/apiservice-coverage/render-path-notes.md` | review APIService render-path notes: current maintained bases do not render APIService objects; create a separate APIService-enabled base only if product chooses that path |

## Hook And Lifecycle Work

Hooks are not hidden inside render parity. The source scan, maintained hook
queue, reviewed route candidates, and lifecycle observations are separate
surfaces:

| Surface | Rows | Use |
| --- | ---: | --- |
| Source top-100 hook rows | 11 | Find public top-100 charts whose retained source scan found Helm hooks. |
| Maintained hook lifecycle rows | 5 | Check current recipe/package rows with required lifecycle receipts. |
| Source-reviewed hook route candidate plans | 10 | Read candidate routes that are not receipts and do not claim runtime behavior. |
| Observed hook rows | 5 | Rows with runtime lifecycle observation or execution evidence. |
| Partially observed hook rows | 0 | Rows where one lifecycle phase remains, usually upgrade or delete. |
| Source-reviewed routes not yet maintained | 8 | Promote the candidate route into a maintained lifecycle receipt, runtime observation path, or blocker. |
| Related lifecycle observation rows | 4 | CRD/webhook/controller observations that rendered YAML alone cannot prove. |

Start with [hook-route-candidates/summary.md](../hook-route-candidates/summary.md)
for candidate route plans, [hook-lifecycle/summary.md](../hook-lifecycle/summary.md)
for the maintained queue, and [hook-lifecycle-review/summary.md](../hook-lifecycle-review/summary.md)
for the reviewed source-route inventory.

## Adoption Buckets

| Bucket | Count | What it means | Use this when |
| --- | ---: | --- | --- |
| `limitation-decision-first` | 8 | A named capability gap or target compatibility issue affects the recommended path. Decide whether to support, disclose, defer, or refuse it for the named scope. | You need an operator/product compatibility decision before presenting the chart as supported. |
| `needs-useful-variant` | 35 | The proof mechanism works, but the current default-only path is not yet a compelling catalog offer. | You are deciding which realistic base variants users would actually want. |
| `promote-after-review` | 37 | Recipe/package proof and multiple variants exist. It is a good candidate for catalog review and selected live lanes. | You are expanding the catalog or choosing the next charts for live evidence. |
| `try-from-public-catalog` | 20 | A public catalog entry exists and at least one base has live evidence. Check the exact base lane before making a broader claim. | You want a maintained public example and can choose a base with the needed proof lane. |

## Hard Gap Buckets

| Gap | Charts | What it means |
| --- | ---: | --- |
| existing-secret (chart ships no Secret toggle) | 15 | The chart does not expose a clean bring-your-own-secret render path. Do not invent one silently. |
| ha (curated proof lane - bespoke teaching needed) | 6 | The proof path does not yet teach a realistic HA variant for that chart. |
| ha (tempo single-binary chart; HA is the separate tempo-distributed chart) | 1 | The current chart path is single-binary; HA belongs to a separate supported topology decision. |
| no-crds (template-baked CRDs; no clean chart toggle yet) | 3 | The chart bakes CRDs into templates or lacks a clean CRDs-off switch. CRD ownership needs an explicit route. |

## Hard Gaps Versus Adoption Buckets

| Adoption bucket | Rows | Rows with named hard gaps | Meaning |
| --- | ---: | ---: | --- |
| `try-from-public-catalog` | 20 | 10 | The catalog has reviewed bases; the hard gap usually points to another path that still needs support or disclosure. |
| `promote-after-review` | 37 | 0 | No named hard gap currently blocks promotion review. |
| `needs-useful-variant` | 35 | 8 | Add realistic variants first; any named hard gap should shape those variants or be disclosed. |
| `limitation-decision-first` | 8 | 7 | The named gap blocks the next promotion decision until it is supported, disclosed, or deferred. |

A hard gap is a capability warning, not an automatic failure. A top-20 catalog
chart can have a hard gap for an additional path such as HA or existing-secret
support while still being usable for its reviewed base variants. A
`limitation-decision-first` row is different: the named gap affects the next
recommended promotion path, so it needs a support, disclosure, or deferral
decision before catalog promotion.

## User Status

| Status | Count | Meaning |
| --- | ---: | --- |
| `catalog-supported-with-live-evidence` | 20 | Top-20 catalog entry with at least one live proof lane. |
| `proof-grade-needs-user-shaped-variant` | 35 | Proof-grade chart whose current path is too default-only for catalog promotion. |
| `proof-grade-ready-for-promotion-review` | 37 | Recipe/package proof exists and variants exist; needs human catalog promotion review. |
| `proof-grade-with-named-limitation` | 8 | Proof-grade chart with a named capability gap, target compatibility issue, or operator decision. |

## Strongest Evidence Per Chart

| Evidence | Count | Meaning |
| --- | ---: | --- |
| `in-confighub-proof` | 16 | Rendered objects uploaded to ConfigHub and passed the ConfigHub proof lane. |
| `live-helm-vs-confighub-parity` | 44 | Plain Helm and ConfigHub delivery reached equivalent live outcomes for at least one variant. |
| `local-kubernetes-live` | 28 | Rendered objects were applied to Kubernetes and observed for at least one variant. |
| `render-parity` | 8 | Regular Helm and cub installer setup render-equivalent objects. |
| `two-cluster-kind-parity` | 4 | Plain Helm and cub installer output reached equivalent live outcomes in separate vanilla kind clusters. |

## How To Read This

- Every row in this file has a maintained recipe/package proof path.
- `render-parity` means regular Helm and `cub installer setup` produce the same
  Kubernetes object set under recorded inputs, apart from declared installer
  support objects.
- `two-cluster-kind-parity` means regular Helm and `cub installer setup`
  reached equivalent live outcomes in separate vanilla kind clusters.
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
| Promotion review | `external-dns/external-dns@1.21.1`<br>`cloudnative-pg/cloudnative-pg@0.28.2`<br>`kedacore/keda@2.19.0`<br>`prometheus-community/kube-state-metrics@7.4.0`<br>`elastic/eck-operator@3.4.0` |
| User-shaped variants | `gitlab/gitlab-runner@0.89.0`<br>`fluent/fluent-bit@0.57.6`<br>`runix/pgadmin4@1.62.0`<br>`nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18`<br>`elastic/kibana@8.5.1` |
| Named limitation review | `traefik/traefik@40.2.0`<br>`kyverno/kyverno@3.8.1`<br>`bitnami/elasticsearch@22.1.6`<br>`bitnami/spark@10.0.3`<br>`prometheus-community/prometheus-adapter@5.3.0` |

## First Rows

| Chart | Adoption bucket | Evidence | Variants | Next action | Next receipt | Source |
| --- | --- | --- | ---: | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes | - | `production-disposition` |
| `bitnami/mongodb@19.0.7` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope | - | `production-disposition` |
| `bitnami/mysql@14.0.3` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes | - | `production-disposition` |
| `bitnami/nginx@24.0.2` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | choose the supported production base and target scope, refresh live/e2e evidence, and record the final support decision | - | `production-disposition` |
| `bitnami/postgresql@18.6.7` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope | - | `production-disposition` |
| `bitnami/rabbitmq@16.0.14` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes | - | `production-disposition` |
| `bitnami/redis@25.5.3` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope | - | `production-disposition` |
| `external-secrets/external-secrets@2.5.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes | - | `production-disposition` |
| `grafana/grafana@10.5.15` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | resolve image digests for each affected variant before production OCI support | - | `production-disposition` |
| `grafana/loki@7.0.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes | - | `production-disposition` |
| `grafana/tempo@1.24.4` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | resolve image digests for each affected variant before production OCI support | - | `production-disposition` |
| `hashicorp/consul@2.0.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes | - | `production-disposition` |
| `hashicorp/vault@0.32.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 3 | resolve image digests for each affected variant before production OCI support | - | `production-disposition` |
| `ingress-nginx/ingress-nginx@4.15.1` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 3 | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope | - | `production-disposition` |
| `jetstack/cert-manager@v1.20.2` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | write or fix the receipt for target fact preflight | `data/production-disposition/receipts/jetstack-cert-manager/target-fact-preflight.yaml` | `production-disposition` |
| `longhorn/longhorn@1.11.2` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support | - | `production-disposition` |
| `metrics-server/metrics-server@3.13.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes | - | `production-disposition` |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support | - | `production-disposition` |
| `prometheus-community/prometheus@29.8.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support | - | `production-disposition` |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | `try-from-public-catalog` | `live-helm-vs-confighub-parity` | 2 | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support | - | `production-disposition` |
| `traefik/traefik@40.2.0` | `limitation-decision-first` | `live-helm-vs-confighub-parity` | 2 | review limitation before promotion: existing-secret (chart ships no Secret toggle) | - | `limitation-review` |
| `external-dns/external-dns@1.21.1` | `promote-after-review` | `live-helm-vs-confighub-parity` | 3 | run catalog promotion review | - | `catalog-promotion-review` |
| `gitlab/gitlab-runner@0.89.0` | `needs-useful-variant` | `in-confighub-proof` | 1 | add at least one user-shaped variant before catalog promotion | - | `user-shaped-variant-backlog` |
| `kyverno/kyverno@3.8.1` | `limitation-decision-first` | `live-helm-vs-confighub-parity` | 2 | review limitation before promotion: existing-secret (chart ships no Secret toggle) | - | `limitation-review` |
| `cloudnative-pg/cloudnative-pg@0.28.2` | `promote-after-review` | `live-helm-vs-confighub-parity` | 2 | run catalog promotion review | - | `catalog-promotion-review` |

## Files

| File | Use |
| --- | --- |
| `data/top100-readiness/readiness.csv` | One row per top-100 chart: workability, user status, strongest evidence, lane counts, gap, next action, next receipt path where available, and next-action source. |
| `data/top100-readiness/next80-queues.csv` | Compact next80 action queue: promotion review, user-shaped variant work, and limitation review. |
| `data/apiservice-coverage/summary.md` | APIService-specific evidence: rendered object status, aggregation receipts, target blockers, and render-path notes. |
| `data/top100-catalog-analysis/review.csv` | Catalog analysis and promotion surface. |
| `data/outcome-coverage/chart-outcomes.csv` | Detailed outcome counts per chart. |
| `data/outcome-coverage/base-outcomes.csv` | Per base-variant proof lane status. |
| `data/hook-lifecycle/summary.md` | Maintained hook lifecycle queue and receipt state. |
| `data/hook-route-candidates/summary.md` | Candidate hook route plans that are not maintained receipts. |
| `data/hook-lifecycle-review/summary.md` | Source-reviewed hook routes not yet maintained. |

Regenerate:

~~~sh
npm run top100:readiness
npm run top100:readiness:verify
~~~
