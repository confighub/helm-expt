# Next80 Action Queues

This generated file is the compact operating view for the 80 proof-grade charts
that are not yet public catalog-supported entries.

Read it as a work queue, not as a support claim:

~~~text
next80 charts: 80
promotion-review: 37
limitation-review: 7
user-shaped-variant: 36
~~~

## Queues

| Queue | What it means | First step |
| --- | --- | --- |
| `promotion-review` | The chart already has more than one base variant and no named hard gap blocking review. | Run catalog promotion review, choose one supported base, then add selected live evidence. |
| `limitation-review` | A named gap affects the next promotion path. | Decide whether the named gap is supported, disclosed, deferred, or blocked before promotion. |
| `user-shaped-variant` | The chart has proof-grade render/package evidence, but the current base is not yet a compelling catalog offer. | Add one realistic base variant a Helm user would actually choose, then rerun proof and review. |

## First Rows By Queue

| Queue | First charts |
| --- | --- |
| `promotion-review` | `external-dns/external-dns@1.21.1`<br>`cloudnative-pg/cloudnative-pg@0.28.2`<br>`kedacore/keda@2.19.0`<br>`prometheus-community/kube-state-metrics@7.4.0`<br>`elastic/eck-operator@3.4.0`<br>`prometheus-community/prometheus-blackbox-exporter@11.10.0`<br>`stakater/reloader@2.2.12`<br>`grafana/alloy@1.8.2` |
| `limitation-review` | `traefik/traefik@40.2.0`<br>`kyverno/kyverno@3.8.1`<br>`bitnami/elasticsearch@22.1.6`<br>`bitnami/spark@10.0.3`<br>`bitnami/zookeeper@13.8.7`<br>`bitnami/contour@21.1.4`<br>`grafana/pyroscope@2.0.2` |
| `user-shaped-variant` | `gitlab/gitlab-runner@0.89.0`<br>`fluent/fluent-bit@0.57.6`<br>`runix/pgadmin4@1.62.0`<br>`nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18`<br>`elastic/kibana@8.5.1`<br>`descheduler/descheduler@0.36.0`<br>`jaegertracing/jaeger@4.8.0`<br>`dex/dex@0.24.0` |

## First Action Rows

These tables show the first rows a maintainer should open in each queue. They
do not replace the CSV; they make the first review path visible without a
spreadsheet.

## Proof-Focus Rows

These rows have a focused evidence or decision path for a hard Helm feature.
They should not disappear into a generic promotion-review queue.

| Chart | Focus | Status | Receipt | Next action |
| --- | --- | --- | --- | --- |
| `kedacore/keda@2.19.0` | `api-service-aggregation-promotion` | APIService aggregation is observed; promotion needs a target-scoped decision | `data/runtime-gitops/receipts/kedacore-keda/default/latest.yaml` | run APIService promotion review: choose supported base, target scope, CRD ownership path, and evidence refresh rule using the committed aggregation receipt |
| `fairwinds-stable/vpa@4.11.0` | `api-service-render-path-recorded` | source APIService signal exists, but current maintained bases render no APIService objects | `data/apiservice-coverage/render-path-notes.md` | review APIService render-path notes: current maintained bases do not render APIService objects; create a separate APIService-enabled base only if product chooses that path |
| `prometheus-community/prometheus-adapter@5.3.0` | `api-service-compatible-base-standard-lanes` | compatible APIService base exists; standard proof lanes still need to run | `data/apiservice-coverage/capability-profile-candidates/prometheus-community-prometheus-adapter-5.3.0-apiservice-v1.yaml` | Run ConfigHub proof, local live, live Helm-vs-ConfigHub parity, and the APIService runtime contract for the maintained apiservice-v1-capability base before catalog promotion. |
| `fairwinds-stable/goldilocks@10.3.0` | `api-service-render-path-recorded` | source APIService signal exists, but current maintained bases render no APIService objects | `data/apiservice-coverage/render-path-notes.md` | add at least one user-shaped variant before catalog promotion |

### Promotion Review

| Chart | Candidate bases | Evidence | Proof focus | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| `external-dns/external-dns@1.21.1` | `default`<br>`no-crds`<br>`dry-run-txt-registry` | `live-helm-vs-confighub-parity` | - | - | run catalog promotion review |
| `cloudnative-pg/cloudnative-pg@0.28.2` | `default`<br>`no-crds` | `live-helm-vs-confighub-parity` | - | - | run catalog promotion review |
| `kedacore/keda@2.19.0` | `default`<br>`no-crds` | `live-helm-vs-confighub-parity` | api-service-aggregation-promotion | - | run APIService promotion review: choose supported base, target scope, CRD ownership path, and evidence refresh rule using the committed aggregation receipt |
| `prometheus-community/kube-state-metrics@7.4.0` | `default`<br>`cluster-metrics-readonly` | `live-helm-vs-confighub-parity` | - | - | run catalog promotion review |
| `elastic/eck-operator@3.4.0` | `default`<br>`ha`<br>`no-crds` | `live-helm-vs-confighub-parity` | - | - | run catalog promotion review |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | `default`<br>`cluster-metrics-readonly` | `live-helm-vs-confighub-parity` | - | - | run catalog promotion review |
| `stakater/reloader@2.2.12` | `default`<br>`controller-default-reviewed` | `live-helm-vs-confighub-parity` | - | - | run catalog promotion review |
| `grafana/alloy@1.8.2` | `default`<br>`no-crds` | `live-helm-vs-confighub-parity` | - | - | run catalog promotion review |

### Limitation Review

| Chart | Candidate bases | Evidence | Proof focus | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| `traefik/traefik@40.2.0` | `default`<br>`no-crds` | `live-helm-vs-confighub-parity` | - | existing-secret (chart ships no Secret toggle) | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| `kyverno/kyverno@3.8.1` | `default`<br>`no-crds` | `live-helm-vs-confighub-parity` | - | existing-secret (chart ships no Secret toggle) | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| `bitnami/elasticsearch@22.1.6` | `default`<br>`ha` | `render-parity` | - | existing-secret (chart ships no Secret toggle) | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| `bitnami/spark@10.0.3` | `default`<br>`ha` | `render-parity` | - | existing-secret (chart ships no Secret toggle) | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| `bitnami/zookeeper@13.8.7` | `default`<br>`ha` | `render-parity` | - | existing-secret (chart ships no Secret toggle) | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| `bitnami/contour@21.1.4` | `default`<br>`no-crds` | `render-parity` | - | existing-secret (chart ships no Secret toggle) | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| `grafana/pyroscope@2.0.2` | `default`<br>`ha`<br>`no-crds` | `local-kubernetes-live` | - | existing-secret (chart ships no Secret toggle) | review limitation before promotion: existing-secret (chart ships no Secret toggle) |

### User-Shaped Variant Work

| Chart | Candidate bases | Evidence | Proof focus | Gap | Next action |
| --- | --- | --- | --- | --- | --- |
| `gitlab/gitlab-runner@0.89.0` | `default` | `in-confighub-proof` | - | - | add at least one user-shaped variant before catalog promotion |
| `fluent/fluent-bit@0.57.6` | `default` | `live-helm-vs-confighub-parity` | - | - | add at least one user-shaped variant before catalog promotion |
| `runix/pgadmin4@1.62.0` | `default` | `local-kubernetes-live` | - | - | add at least one user-shaped variant before catalog promotion |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | `default` | `in-confighub-proof` | - | - | add at least one user-shaped variant before catalog promotion |
| `elastic/kibana@8.5.1` | `default` | `render-parity` | - | - | add at least one user-shaped variant before catalog promotion |
| `descheduler/descheduler@0.36.0` | `default` | `live-helm-vs-confighub-parity` | - | - | add at least one user-shaped variant before catalog promotion |
| `jaegertracing/jaeger@4.8.0` | `default` | `local-kubernetes-live` | - | existing-secret (chart ships no Secret toggle) | add at least one user-shaped variant before catalog promotion |
| `dex/dex@0.24.0` | `default` | `in-confighub-proof` | - | - | add at least one user-shaped variant before catalog promotion |

## How This Relates To Top100

- Every row here already has a maintained recipe/package proof path.
- Most rows still have render parity as their strongest evidence. 4 row(s)
  now have two-cluster kind parity, meaning regular Helm and `cub installer`
  reached equivalent live outcomes in separate vanilla kind clusters.
- Promotion needs useful variants, selected live evidence, and any target facts,
  lifecycle routes, or named limitations made explicit.
- The top-20 catalog remains the public try-now path. This queue is the next
  expansion path.

## Files

| File | Use |
| --- | --- |
| `data/top100-readiness/next80-queues.csv` | Spreadsheet-ready next80 action queue, including source features, package path, and per-chart pain report. |
| `data/top100-readiness/readiness.csv` | Full top100 row data. |
| `data/top100-readiness/summary.md` | Aggregate top100 readiness view. |
| `data/outcome-coverage/base-outcomes.csv` | Per-base proof lane details. |

Regenerate:

~~~sh
npm run top100:readiness
npm run top100:readiness:verify
~~~
