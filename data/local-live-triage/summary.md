# Local Live Non-Pass Triage

This generated report explains the local Kubernetes rows that did not pass.
It starts from [base-outcomes.csv](../outcome-coverage/base-outcomes.csv) and
the committed observation receipts. The purpose is to make the next action
clear without turning every non-pass row into a product defect.

## Snapshot

~~~text
chart/base rows:          189
local live observed rows: 189
local live pass rows:     106
local live non-pass rows: 83
classified non-pass rows: 83
needs manual inspection:  0
~~~

## Route Classes

| Route class | Rows | Meaning | Next action |
| --- | ---: | --- | --- |
| `target-prerequisite` | 25 | The workload reached Kubernetes but one or more pods were waiting for target-provided config, mounts, certificates, or setup. | Turn the missing target condition into a target fact, preflight, lifecycle route, or better base variant. |
| `missing-crds` | 17 | The rendered objects refer to custom resource types that were not present on the target. | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. |
| `runtime-readiness` | 14 | The objects applied, but a controller or workload did not become healthy in the observation budget. | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. |
| `target-secret` | 12 | The base deliberately expects a Secret or TLS material that was not staged on the target. | Stage the declared Secret or TLS material as a target fact, then rerun the local live and parity lanes. |
| `image-dependency` | 6 | The target could not pull at least one rendered image, so the row is testing image availability rather than ConfigHub parity. | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. |
| `test-environment-cleanup` | 6 | The receipt shows stale namespace or cleanup interference, so the next useful step is a clean rerun. | Delete the stale namespace or rerun on a fresh cluster with an isolated namespace. |
| `admission-or-rbac` | 2 | Kubernetes rejected an object because of permissions, admission, immutability, or API validation. | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. |
| `cloud-or-provider-prerequisite` | 1 | The chart expects provider credentials, cloud APIs, buckets, DNS, volumes, or another external system. | Model the provider dependency as target facts or an external managed prerequisite before rerun. |

## First Rows To Inspect

| Chart | Base | Result | Route class | Next action | Receipt |
| --- | --- | --- | --- | --- | --- |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | default | fail | `admission-or-rbac` | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. | [receipt](../../runs/next80-local-kind/nfs-subdir-external-provisioner-nfs-subdir-external-provisioner-4.0.18-default/observation-receipt.yaml) |
| `velero/velero@12.0.1` | default | blocked | `admission-or-rbac` | Decide whether the base needs a permission/admission preflight, a different target scope, or a rejected support boundary. | [receipt](../../runs/next80-local-kind/velero-velero-12.0.1-default/observation-receipt.yaml) |
| `aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1` | default | fail | `cloud-or-provider-prerequisite` | Model the provider dependency as target facts or an external managed prerequisite before rerun. | [receipt](../../runs/next80-local-kind/aws-ebs-csi-driver-aws-ebs-csi-driver-2.60.1-default/observation-receipt.yaml) |
| `bitnami/spark@10.0.3` | default | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-spark-10.0.3-default/observation-receipt.yaml) |
| `bitnami/spark@10.0.3` | ha | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-spark-10.0.3-ha/observation-receipt.yaml) |
| `bitnami/zookeeper@13.8.7` | default | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-zookeeper-13.8.7-default/observation-receipt.yaml) |
| `bitnami/zookeeper@13.8.7` | ha | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/bitnami-zookeeper-13.8.7-ha/observation-receipt.yaml) |
| `istio/gateway@1.30.0` | controller-default-reviewed | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/istio-gateway-1.30.0-controller-default-reviewed/observation-receipt.yaml) |
| `istio/gateway@1.30.0` | default | blocked | `image-dependency` | Pin, mirror, override, or document the image dependency, then rerun against a target that can pull it. | [receipt](../../runs/next80-local-kind/istio-gateway-1.30.0-default/observation-receipt.yaml) |
| `aqua/trivy-operator@0.32.1` | no-crds | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/aqua-trivy-operator-0.32.1-no-crds/observation-receipt.yaml) |
| `grafana/tempo@1.24.4` | s3-query-observability | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/grafana-tempo-1.24.4-s3-query-observability/observation-receipt.yaml) |
| `jaegertracing/jaeger-operator@2.57.0` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/jaegertracing-jaeger-operator-2.57.0-default/observation-receipt.yaml) |
| `jaegertracing/jaeger-operator@2.57.0` | no-crds | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/jaegertracing-jaeger-operator-2.57.0-no-crds/observation-receipt.yaml) |
| `jetstack/trust-manager@v0.22.1` | default | fail | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/jetstack-trust-manager-v0.22.1-default/observation-receipt.yaml) |
| `jetstack/trust-manager@v0.22.1` | no-crds | fail | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/jetstack-trust-manager-v0.22.1-no-crds/observation-receipt.yaml) |
| `kyverno/kyverno-policies@3.8.0` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/kyverno-kyverno-policies-3.8.0-default/observation-receipt.yaml) |
| `minio-operator/tenant@7.1.1` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/minio-operator-tenant-7.1.1-default/observation-receipt.yaml) |
| `open-telemetry/opentelemetry-operator@0.114.0` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/open-telemetry-opentelemetry-operator-0.114.0-default/observation-receipt.yaml) |
| `open-telemetry/opentelemetry-operator@0.114.0` | no-crds | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/open-telemetry-opentelemetry-operator-0.114.0-no-crds/observation-receipt.yaml) |
| `projectcalico/tigera-operator@v3.32.0` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/projectcalico-tigera-operator-v3.32.0-default/observation-receipt.yaml) |
| `prometheus-community/kube-prometheus-stack@85.3.3` | no-crds | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/prometheus-community-kube-prometheus-stack-85.3.3-no-crds/observation-receipt.yaml) |
| `prometheus-community/kube-prometheus-stack@86.1.0` | no-crds | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/prometheus-community-kube-prometheus-stack-86.1.0-no-crds/observation-receipt.yaml) |
| `prometheus-community/prometheus-adapter@5.3.0` | cluster-metrics-readonly | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/prometheus-community-prometheus-adapter-5.3.0-cluster-metrics-readonly/observation-receipt.yaml) |
| `prometheus-community/prometheus-adapter@5.3.0` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/prometheus-community-prometheus-adapter-5.3.0-default/observation-receipt.yaml) |
| `rook-release/rook-ceph-cluster@v1.19.5` | default | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/rook-release-rook-ceph-cluster-v1.19.5-default/observation-receipt.yaml) |
| `velero/velero@12.0.1` | no-crds | blocked | `missing-crds` | Use a CRD-owning base, preinstall the CRDs, or record an explicit no-CRDs support boundary before rerun. | [receipt](../../runs/next80-local-kind/velero-velero-12.0.1-no-crds/observation-receipt.yaml) |
| `argo-cd/argo-workflows@1.0.14` | controller-default-reviewed | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/argo-cd-argo-workflows-1.0.14-controller-default-reviewed/observation-receipt.yaml) |
| `argo-cd/argo-workflows@1.0.14` | default | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/argo-cd-argo-workflows-1.0.14-default/observation-receipt.yaml) |
| `cloudnative-pg/cloudnative-pg@0.28.2` | no-crds | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/cloudnative-pg-cloudnative-pg-0.28.2-no-crds/observation-receipt.yaml) |
| `dex/dex@0.24.0` | default | fail | `runtime-readiness` | Inspect pod logs/events, decide whether the issue is target policy, lifecycle, chart configuration, or a better base, then rerun. | [receipt](../../runs/next80-local-kind/dex-dex-0.24.0-default/observation-receipt.yaml) |

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
