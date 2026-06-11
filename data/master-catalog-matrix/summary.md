# Master Catalog Matrix

ONE view of the whole catalog: one row per supported variant, grouped by chart
and version, with the translation attributes and per-lane status joined from
the committed sources below. This file invents no new truth — every cell comes
from a source the verifier checks this view against.

Three renderings of the same rows: this summary (GitHub),
[matrix.csv](matrix.csv) for spreadsheet import (CSV carries words, not
colors), and [matrix.html](matrix.html) — open it in a browser for the
literal red/green/grey colored cells.

## Legend

| Icon | Meaning |
| --- | --- |
| ✅ | yes / pass |
| ⚠️ | watch — passing with a recorded caution |
| ❌ | no / blocked |
| ⬜ | not yet run — absence of evidence, not a failure |
| — | not applicable |

Lane columns: **R** render parity (helm template vs installer setup) ·
**C** ConfigHub upload + scan + safe ops · **L** local kind apply ·
**G** ConfigHub OCI + Argo live · **P** live Helm-vs-ConfigHub dual parity ·
**K** two-cluster kind parity.
Hooks column: source hook count, disposition route, live-rehearsal status.
`unrouted ⚠️` marks a chart whose source scan flags hooks but that has no
hook-disposition row yet; `(from @x.y.z)` marks chart-family evidence taken
from a different chart version's disposition row.

## Current Status

| Metric | Value |
| --- | ---: |
| Chart versions | 110 |
| Variant rows | 189 |
| Lane cells ✅ / ⚠️ / ❌ / ⬜ | 423 / 7 / 52 / 626 |
| Variants with the complete core lane set | 20 |
| Variants with a SUPPORTED production decision | 17 |
| Recorded production decisions (supported / superseded / rejected) | 17 / 2 / 1 |
| Hook-flagged variants with no disposition row (unrouted) | 3 |

Chart versions in the lane matrix but not in top-100 readiness (retained candidates or version drift): `argo-cd/argo-cd@9.5.17`, `bitnami/mongodb@19.0.9`, `bitnami/mongodb@19.1.0`, `bitnami/nginx@24.0.4`, `bitnami/nginx@25.0.0`, `bitnami/postgresql@18.6.10`, `bitnami/postgresql@18.7.0`, `bitnami/redis@27.0.0`, `prometheus-community/kube-prometheus-stack@86.1.0`, `prometheus-community/prometheus@29.9.0`.

## Sources joined, and what this view compresses

The matrix is the variant-granularity overview, not a replacement for its
sources. Per source: what is carried here, and what deliberately stays
behind (follow the source link when you need it). Chart-granularity,
value-path-granularity, and claim-granularity views (status dashboard,
blast-radius accuracy, claims register) are different granularities, not
duplicates of this one.

| Source of truth | Carried into the matrix | Stays in the source |
| --- | --- | --- |
| [outcome-coverage/base-outcomes.csv](../outcome-coverage/base-outcomes.csv) | the spine: variants, the five proof lanes, two-cluster kind parity (K), outcome level, core-lane completeness, recipe path | two_cluster_kind_parity_reason, missing_or_non_pass_lanes, evidence_notes, package_path, variant_revision |
| [top100-readiness/readiness.csv](../top100-readiness/readiness.csv) | catalog tier, adoption bucket, quirk features, hard gap, strongest evidence, next action | workability, user_status, per-chart lane ratios, proof_surface_rank, top500_rank, next_action_source/receipt, file paths |
| [hook-disposition/top100-hook-dispositions.csv](../hook-disposition/top100-hook-dispositions.csv) | hook count, disposition, live status | hook_phases, selected_route detail, evidence_status text, next_action, evidence paths, rank |
| [production-support-decisions/decisions.csv](../production-support-decisions/decisions.csv) | decision, target scope | delivery_path, image/scan/lifecycle/target-fact/live-evidence sub-decisions, evidence_count, remaining_final_requirements, next_action |

The CSV additionally carries adoption bucket, hard gap, strongest evidence,
next action, and production target scope as columns; the table below omits
them for width.

## Matrix

| Chart | Variant | Tier | Quirks | Hooks | R | C | L | G | P | K | Outcome | Prod |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `aqua/trivy-operator@0.32.1` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ❌ | render-parity | ⬜ |
| `argo-cd/argo-cd@9.5.15` | default | top20 | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | no-crds | top20 | — | — | ✅ | ⬜ | ❌ | ❌ | ⬜ | ✅ | render-parity | ⬜ |
| `argo-cd/argo-cd@9.5.17` | default | — | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | — | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `argo-cd/argo-events@2.4.21` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
| `argo-cd/argo-rollouts@2.40.9` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
| `argo-cd/argo-workflows@1.0.14` | default | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | controller-default-reviewed | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `argo-cd/argocd-image-updater@1.2.2` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `autoscaler/cluster-autoscaler@9.57.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | controller-default-reviewed | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | default | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⚠️ | render-parity | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⚠️ | render-parity | ⬜ |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | default | next80 | `tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `bitnami/apache@11.4.29` | default | next80 | `lookup;generated-facts;tpl;capabilities` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `bitnami/contour@21.1.4` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `bitnami/elasticsearch@22.1.6` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `bitnami/memcached@8.5.5` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/mongodb@19.0.7` | existing-secret-replicaset | top20 | `lookup;generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `bitnami/mongodb@19.0.9` | existing-secret-replicaset | — | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | generated-passwords | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/mongodb@19.1.0` | existing-secret-replicaset | — | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | generated-passwords | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/mysql@14.0.3` | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `bitnami/nginx@24.0.2` | existing-tls-ingress | top20 | `lookup;generated-facts;tpl;capabilities` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | http-clusterip | top20 | `lookup;generated-facts;tpl;capabilities` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `bitnami/nginx@24.0.4` | existing-tls-ingress | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | http-clusterip | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/nginx@25.0.0` | existing-tls-ingress | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | http-clusterip | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/opensearch@2.0.10` | default | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | ha | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `bitnami/phpmyadmin@20.0.0` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `bitnami/postgresql@18.6.7` | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ❌ | ✅ | ⬜ | ✅ | gitops-live | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `bitnami/postgresql@18.6.10` | existing-secret | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | generated-passwords | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/postgresql@18.7.0` | existing-secret | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | generated-passwords | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/rabbitmq@16.0.14` | existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | generated-passwords | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `bitnami/redis@25.5.3` | default | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | reuse-existing-secret | top20 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | gitops-live | ⬜ |
| `bitnami/redis@27.0.0` | default | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | reuse-existing-secret | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `bitnami/spark@10.0.3` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `bitnami/zookeeper@13.8.7` | default | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `cloudnative-pg/cloudnative-pg@0.28.2` | default | next80 | `generated-facts;tpl;crds;cluster-rbac;webhooks` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | no-crds | next80 | `generated-facts;tpl;crds;cluster-rbac;webhooks` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `coredns/coredns@1.45.2` | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `crossplane-stable/crossplane@2.3.1` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `descheduler/descheduler@0.36.0` | default | next80 | `tpl;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⚠️ | local-live | ⬜ |
| `dex/dex@0.24.0` | default | next80 | `tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `elastic/eck-operator@3.4.0` | default | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | ha | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `elastic/filebeat@8.5.1` | default | next80 | `tpl;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | node-or-cluster-collector | next80 | `tpl;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `elastic/kibana@8.5.1` | default | next80 | `tpl` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `elastic/logstash@8.5.1` | default | next80 | `tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | ha | next80 | `tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `elastic/metricbeat@8.5.1` | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `external-dns/external-dns@1.21.1` | default | next80 | `tpl;crds;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | dry-run-txt-registry | next80 | `tpl;crds;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | no-crds | next80 | `tpl;crds;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `external-secrets/external-secrets@2.5.0` | default | top20 | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | no-crds | top20 | — | — | ✅ | ⬜ | fail | ❌ | ⬜ | ✅ | render-parity | ⬜ |
| `fairwinds-stable/goldilocks@10.3.0` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `fairwinds-stable/vpa@4.11.0` | default | next80 | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | `lookup;tpl;capabilities;crds;cluster-rbac;webhooks` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `falcosecurity/falco@9.0.0` | default | next80 | `lookup;tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `falcosecurity/falcosidekick@0.13.1` | default | next80 | `capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `fluent/fluent-bit@0.57.6` | default | next80 | `tpl;capabilities;hooks;cluster-rbac` | 1 observed ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `fluent/fluentd@0.5.3` | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `gatekeeper/gatekeeper@3.22.2` | default | next80 | `capabilities;hooks;crds;cluster-rbac;webhooks` | unrouted ⚠️ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | `capabilities;hooks;crds;cluster-rbac;webhooks` | unrouted ⚠️ | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `gitlab/gitlab-runner@0.89.0` | default | next80 | `generated-facts;tpl;capabilities` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `grafana/alloy@1.8.2` | default | next80 | `tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `grafana/grafana@10.5.15` | existing-secret-ingress | top20 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | generated-passwords | top20 | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | superseded |
| `grafana/loki@7.0.0` | simple-scalable-minio | top20 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | single-binary-filesystem | top20 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `grafana/promtail@6.17.1` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `grafana/pyroscope@2.0.2` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | ha | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `grafana/rollout-operator@0.49.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `grafana/tempo@1.24.4` | local-persistent | top20 | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | superseded |
|  | s3-query-observability | top20 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ✅ | render-parity | ⬜ |
| `haproxytech/kubernetes-ingress@1.52.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `hashicorp/consul@2.0.0` | default-control-plane | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | secure-mesh-existing-secrets | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | fail | ❌ | ⬜ | ✅ | render-parity | ⬜ |
| `hashicorp/terraform@1.1.2` | default | next80 | `crds` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | `crds` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `hashicorp/vault@0.32.0` | default | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ✅ | ⚠️ | ⚠️ | ✅ | local-live | ⬜ |
|  | dev-mode | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ❌ |
|  | ha-raft-ui | top20 | `tpl;capabilities;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ✅ | render-parity | ⬜ |
| `ingress-nginx/ingress-nginx@4.15.1` | default | top20 | `tpl;capabilities;cluster-rbac;webhooks` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ✅ | render-parity | ⬜ |
|  | admission-disabled | top20 | `tpl;capabilities;cluster-rbac;webhooks` | — | ✅ | ⬜ | ✅ | ⚠️ | ⚠️ | ✅ | local-live | ⬜ |
|  | internal-clusterip | top20 | `tpl;capabilities;cluster-rbac;webhooks` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `istio/gateway@1.30.0` | default | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | controller-default-reviewed | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `istio/istiod@1.30.0` | default | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `jaegertracing/jaeger@4.8.0` | default | next80 | `lookup;generated-facts;tpl;capabilities` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `jaegertracing/jaeger-operator@2.57.0` | default | next80 | `crds;webhooks` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | `crds;webhooks` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `jetstack/cert-manager@v1.20.2` | default | top20 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ❌ | local-live | ⬜ |
|  | crds-enabled | top20 | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `jetstack/cert-manager-csi-driver@v0.14.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `jetstack/trust-manager@v0.22.1` | default | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `kedacore/keda@2.19.0` | default | next80 | `tpl;capabilities;crds;cluster-rbac;webhooks` | — | ✅ | ⬜ | ✅ | ✅ | ⬜ | ✅ | gitops-live | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac;webhooks` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `kyverno/kyverno@3.8.1` | default | next80 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | 8 observed ✅ | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;stateful-storage` | 8 observed ✅ | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `kyverno/kyverno-policies@3.8.0` | default | next80 | `lookup;tpl` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `linkerd/linkerd-crds@1.8.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `longhorn/longhorn@1.11.2` | default | top20 | `generated-facts;tpl;cluster-rbac` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | ui-ingress | top20 | `generated-facts;tpl;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
| `metrics-server/metrics-server@3.13.0` | default | top20 | `lookup;generated-facts;capabilities;cluster-rbac` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | external-tls-ca | top20 | `lookup;generated-facts;capabilities;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
| `minio-operator/operator@7.1.1` | default | next80 | `cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `minio-operator/tenant@7.1.1` | default | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `nats/nack@0.34.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `nats/nats@2.14.0` | default | next80 | `tpl` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | ha | next80 | `tpl` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `nats/surveyor@0.20.9` | default | next80 | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | default-reviewed | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | default | next80 | `capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `open-telemetry/opentelemetry-operator@0.114.0` | default | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `opencost/opencost@2.5.21` | default | next80 | `tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `percona/pg-operator@3.0.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `percona/psmdb-operator@1.22.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `percona/pxc-operator@1.19.1` | default | next80 | `lookup;crds;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | `lookup;crds;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `projectcalico/tigera-operator@v3.32.0` | default | next80 | `lookup;hooks;cluster-rbac` | unrouted ⚠️ | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `prometheus-community/alertmanager@1.37.0` | default | next80 | `tpl;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | ha | next80 | `tpl;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `prometheus-community/kube-prometheus-stack@85.3.3` | default | top20 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;webhooks;stateful-storage` | 2 observed ✅ (from @85.3.0) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | no-crds | top20 | `lookup;generated-facts;tpl;capabilities;hooks;crds;cluster-rbac;webhooks;stateful-storage` | 2 observed ✅ (from @85.3.0) | ✅ | ⬜ | ❌ | ❌ | ⬜ | ✅ | render-parity | ⬜ |
| `prometheus-community/kube-prometheus-stack@86.1.0` | default | — | — | 2 observed ✅ (from @85.3.0) | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | — | — | 2 observed ✅ (from @85.3.0) | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `prometheus-community/kube-state-metrics@7.4.0` | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | cluster-metrics-readonly | next80 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `prometheus-community/prometheus@29.8.0` | default | top20 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
|  | server-only-ephemeral | top20 | `generated-facts;tpl;capabilities;cluster-rbac;stateful-storage` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
| `prometheus-community/prometheus@29.9.0` | default | — | — | — | ✅ | ⬜ | fail | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | server-only-ephemeral | — | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `prometheus-community/prometheus-adapter@5.3.0` | default | next80 | `tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | cluster-metrics-readonly | next80 | `tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | default | next80 | `tpl;capabilities` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | cluster-metrics-readonly | next80 | `tpl;capabilities` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `prometheus-community/prometheus-node-exporter@4.55.0` | default | next80 | `generated-facts;tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `prometheus-community/prometheus-operator-crds@29.0.0` | default | next80 | `generated-facts;crds` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `prometheus-community/prometheus-pushgateway@3.6.0` | default | next80 | `tpl;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `rook-release/rook-ceph@v1.19.5` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `rook-release/rook-ceph-cluster@v1.19.5` | default | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `runix/pgadmin4@1.62.0` | default | next80 | `tpl;capabilities;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `sealed-secrets/sealed-secrets@2.18.6` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | default | top20 | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | live-parity | ✅ |
|  | sync-secret-rotation | top20 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ✅ | local-live | ⬜ |
| `stakater/reloader@2.2.12` | default | next80 | `tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | controller-default-reviewed | next80 | `tpl;capabilities;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `strimzi/strimzi-kafka-operator@1.0.0` | default | next80 | `tpl;capabilities;crds;cluster-rbac` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | `tpl;capabilities;crds;cluster-rbac` | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `traefik/traefik@40.2.0` | default | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | no-crds | next80 | `lookup;generated-facts;tpl;capabilities;crds;cluster-rbac;webhooks;stateful-storage` | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `velero/velero@12.0.1` | default | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
|  | no-crds | next80 | — | — | ✅ | ⬜ | ❌ | ⬜ | ⬜ | ⬜ | render-parity | ⬜ |
| `vm/victoria-logs-single@0.12.5` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
| `vm/victoria-metrics-single@0.39.0` | default | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |
|  | default-reviewed | next80 | — | — | ✅ | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | local-live | ⬜ |

## Regenerate

~~~sh
npm run master-matrix
npm run master-matrix:verify
~~~
