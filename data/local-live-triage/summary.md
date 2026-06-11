# Local Live Non-Pass Triage

This generated report explains the local Kubernetes rows that did not pass.
It starts from [base-outcomes.csv](../outcome-coverage/base-outcomes.csv) and
the committed observation receipts. The purpose is to make the next action
clear without turning every non-pass row into a product defect.

## Snapshot

~~~text
chart/base rows:          189
local live observed rows: 189
local live pass rows:     121
local live non-pass rows: 68
classified non-pass rows: 68
needs manual inspection:  0
~~~

## Route Classes

| Route class | Rows | Meaning | Next action |
| --- | ---: | --- | --- |
| `runtime-readiness` | 26 | The objects applied, but a controller or workload did not become healthy in the observation budget. | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. |
| `target-prerequisite` | 20 | The workload reached Kubernetes but one or more pods were waiting for target-provided config, mounts, certificates, or setup. | Turn the missing target condition into a target fact, preflight, lifecycle route, or better base variant. |
| `test-environment-cleanup` | 8 | The receipt shows stale namespace or cleanup interference, so the next useful step is a clean rerun. | Delete the stale namespace or rerun on a fresh cluster with an isolated namespace. |
| `image-dependency` | 6 | The target could not pull at least one rendered image, so the row is testing image availability rather than ConfigHub parity. | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. |
| `admission-or-rbac` | 3 | Kubernetes rejected an object because of permissions, admission, immutability, or API validation. | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. |
| `missing-crds` | 3 | The rendered objects refer to custom resource types that were not present on the target. | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. |
| `cloud-or-provider-prerequisite` | 2 | The chart expects provider credentials, cloud APIs, buckets, DNS, volumes, or another external system. | Model the provider dependency as target facts or an external managed prerequisite before rerun. |

## First Rows To Inspect

| Chart | Base | Result | Route class | Next action | Receipt |
| --- | --- | --- | --- | --- | --- |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | default | fail | `admission-or-rbac` | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. | [receipt](../../runs/next80-local-kind/nfs-subdir-external-provisioner-nfs-subdir-external-provisioner-4.0.18-default/observation-receipt.yaml) |
| `velero/velero@12.0.1` | default | blocked | `admission-or-rbac` | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. | [receipt](../../runs/next80-local-kind/velero-velero-12.0.1-default/observation-receipt.yaml) |
| `velero/velero@12.0.1` | no-crds | blocked | `admission-or-rbac` | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. | [receipt](../../runs/next80-local-kind/velero-velero-12.0.1-no-crds/observation-receipt.yaml) |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | default | fail | `cloud-or-provider-prerequisite` | Model the provider dependency as target facts or an external managed prerequisite before rerun. | [receipt](../../runs/next80-local-kind/aws-ebs-csi-driver-aws-ebs-csi-driver-2.60.1-default/observation-receipt.yaml) |
| `grafana/tempo@1.24.4` | s3-query-observability | blocked | `cloud-or-provider-prerequisite` | Model the provider dependency as target facts or an external managed prerequisite before rerun. | [receipt](../../runs/next80-local-kind/grafana-tempo-1.24.4-s3-query-observability/observation-receipt.yaml) |
| `bitnami/spark@10.0.3` | default | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-spark-10.0.3-default/observation-receipt.yaml) |
| `bitnami/spark@10.0.3` | ha | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-spark-10.0.3-ha/observation-receipt.yaml) |
| `bitnami/zookeeper@13.8.7` | default | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-zookeeper-13.8.7-default/observation-receipt.yaml) |
| `bitnami/zookeeper@13.8.7` | ha | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-zookeeper-13.8.7-ha/observation-receipt.yaml) |
| `istio/gateway@1.30.0` | controller-default-reviewed | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/istio-gateway-1.30.0-controller-default-reviewed/observation-receipt.yaml) |
| `istio/gateway@1.30.0` | default | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/istio-gateway-1.30.0-default/observation-receipt.yaml) |
| `projectcalico/tigera-operator@v3.32.0` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/projectcalico-tigera-operator-v3.32.0-default/observation-receipt.yaml) |
| `prometheus-community/prometheus-adapter@5.3.0` | cluster-metrics-readonly | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/prometheus-community-prometheus-adapter-5.3.0-cluster-metrics-readonly/observation-receipt.yaml) |
| `prometheus-community/prometheus-adapter@5.3.0` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/prometheus-community-prometheus-adapter-5.3.0-default/observation-receipt.yaml) |
| `argo-cd/argo-cd@9.5.15` | no-crds | blocked | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/argo-cd-argo-cd-9.5.15-no-crds/observation-receipt.yaml) |
| `argo-cd/argo-workflows@1.0.14` | controller-default-reviewed | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/argo-cd-argo-workflows-1.0.14-controller-default-reviewed/observation-receipt.yaml) |
| `argo-cd/argo-workflows@1.0.14` | default | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/argo-cd-argo-workflows-1.0.14-default/observation-receipt.yaml) |
| `bitnami/contour@21.1.4` | no-crds | blocked | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/bitnami-contour-21.1.4-no-crds/observation-receipt.yaml) |
| `bitnami/elasticsearch@22.1.6` | default | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/bitnami-elasticsearch-22.1.6-default/observation-receipt.yaml) |
| `bitnami/elasticsearch@22.1.6` | ha | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/bitnami-elasticsearch-22.1.6-ha/observation-receipt.yaml) |
| `bitnami/opensearch@2.0.10` | default | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/bitnami-opensearch-2.0.10-default/observation-receipt.yaml) |
| `bitnami/opensearch@2.0.10` | ha | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/bitnami-opensearch-2.0.10-ha/observation-receipt.yaml) |
| `cloudnative-pg/cloudnative-pg@0.28.2` | no-crds | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/cloudnative-pg-cloudnative-pg-0.28.2-no-crds/observation-receipt.yaml) |
| `dex/dex@0.24.0` | default | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/dex-dex-0.24.0-default/observation-receipt.yaml) |
| `elastic/logstash@8.5.1` | ha | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/elastic-logstash-8.5.1-ha/observation-receipt.yaml) |
| `external-secrets/external-secrets@2.5.0` | no-crds | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/external-secrets-external-secrets-2.5.0-no-crds/observation-receipt.yaml) |
| `gatekeeper/gatekeeper@3.22.2` | no-crds | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/gatekeeper-gatekeeper-3.22.2-no-crds/observation-receipt.yaml) |
| `gitlab/gitlab-runner@0.89.0` | default | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/gitlab-gitlab-runner-0.89.0-default/observation-receipt.yaml) |
| `grafana/pyroscope@2.0.2` | ha | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/grafana-pyroscope-2.0.2-ha/observation-receipt.yaml) |
| `grafana/rollout-operator@0.49.0` | no-crds | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/grafana-rollout-operator-0.49.0-no-crds/observation-receipt.yaml) |

## How To Use This

These rows are live evidence, not shame stickers. A non-pass row can be a
useful result: it may prove that a base needs a target fact, a CRD policy, an
image mirror, a larger target profile, a provider prerequisite, or a clean
rerun. The route class tells the next useful action before making stronger
support claims.

Machine-readable files:

~~~text
data/local-live-triage/triage.csv
data/local-live-triage/classes.csv
~~~

Regenerate and verify:

~~~sh
npm run local-live:triage
npm run local-live:triage:verify
~~~
