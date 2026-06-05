# Lane Test Matrix

Generated from recipe variants, proof receipts, ConfigHub proof receipts, local-kind
observation receipts, and live-test receipt locations.

This is a corpus control surface. A lane can be `missing` without making this
generated report stale; the missing state is the backlog.

A lane marked `fail` means a committed receipt exists and the lane did not
pass. For live lanes, this can be a useful target-fit finding such as missing
CRDs, separated Secret delivery, or a LoadBalancer requirement on a local kind
cluster.

## Headline

```text
chart-recipe-variant rows: 156
complete core lane set: 0
incomplete core lane set: 156
```

## Core Lane Counts

| Lane | Pass | Missing | Fail |
| --- | ---: | ---: | ---: |
| helm_template_vs_installer_setup | 156 | 0 | 0 |
| confighub_upload_variant_scan_safe_ops | 18 | 138 | 0 |
| local_kind_kubectl_apply | 21 | 135 | 0 |
| confighub_oci_argo_live | 2 | 152 | 2 |
| live_helm_vs_confighub_dual_compare | 0 | 156 | 0 |

## Lane Definitions

| Lane | Evidence |
| --- | --- |
| `helm_template_vs_installer_setup` | `revisions/<variant>/r001/receipts/helm-equivalence-receipt.yaml` plus matching `publication/installer-package-receipt.yaml.spec.setupChecks[]`. |
| `confighub_upload_variant_scan_safe_ops` | `runs/<slug>-confighub-proof/latest/confighub-proof-receipt.yaml`, function scan receipt, and safe-ops receipt. |
| `local_kind_kubectl_apply` | `runs/top20-local-kind/<chart>-<variant>/observation-receipt.json` or equivalent Redis local-kind receipt. |
| `confighub_oci_argo_live` | `data/runtime-gitops/receipts/**/latest.yaml` or `tests/chart-install-test` / `tests/chart-install-sweep` receipt proving ConfigHub Units were applied to OCI and reconciled by Argo. |
| `live_helm_vs_confighub_dual_compare` | Future receipt comparing a live `helm install` deployment against two live ConfigHub deployments: Argo/OCI or Flux, and kubectl/apply. |

## Current Gaps

The live Helm-vs-ConfigHub dual comparison lane is intentionally all backlog
until the receipt-producing harness exists. The ConfigHub OCI/Argo live lane has
a harness, but this repo currently has no committed PASS receipts for every
chart-recipe-variant row.

### First Missing ConfigHub Proof Rows

- aqua/trivy-operator@0.32.1 / default
- aqua/trivy-operator@0.32.1 / no-crds
- argo-cd/argo-cd@9.5.15 / no-crds
- argo-cd/argo-events@2.4.21 / default
- argo-cd/argo-events@2.4.21 / no-crds
- argo-cd/argo-rollouts@2.40.9 / default
- argo-cd/argo-rollouts@2.40.9 / no-crds
- argo-cd/argo-workflows@1.0.14 / default
- argo-cd/argocd-image-updater@1.2.2 / default
- autoscaler/cluster-autoscaler@9.57.0 / default
- autoscaler/vertical-pod-autoscaler@0.9.0 / default
- autoscaler/vertical-pod-autoscaler@0.9.0 / no-crds
- aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1 / default
- bitnami/apache@11.4.29 / default
- bitnami/contour@21.1.4 / default
- bitnami/contour@21.1.4 / no-crds
- bitnami/elasticsearch@22.1.6 / default
- bitnami/elasticsearch@22.1.6 / ha
- bitnami/memcached@8.5.5 / default
- bitnami/mongodb@19.0.7 / existing-secret-replicaset
- bitnami/mysql@14.0.3 / existing-secret
- bitnami/nginx@24.0.2 / existing-tls-ingress
- bitnami/opensearch@2.0.10 / default
- bitnami/opensearch@2.0.10 / ha
- bitnami/phpmyadmin@20.0.0 / default


### First Missing Local Kind Rows

- aqua/trivy-operator@0.32.1 / default
- aqua/trivy-operator@0.32.1 / no-crds
- argo-cd/argo-cd@9.5.15 / no-crds
- argo-cd/argo-events@2.4.21 / default
- argo-cd/argo-events@2.4.21 / no-crds
- argo-cd/argo-rollouts@2.40.9 / default
- argo-cd/argo-rollouts@2.40.9 / no-crds
- argo-cd/argo-workflows@1.0.14 / default
- argo-cd/argocd-image-updater@1.2.2 / default
- autoscaler/cluster-autoscaler@9.57.0 / default
- autoscaler/vertical-pod-autoscaler@0.9.0 / default
- autoscaler/vertical-pod-autoscaler@0.9.0 / no-crds
- aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1 / default
- bitnami/apache@11.4.29 / default
- bitnami/contour@21.1.4 / default
- bitnami/contour@21.1.4 / no-crds
- bitnami/elasticsearch@22.1.6 / default
- bitnami/elasticsearch@22.1.6 / ha
- bitnami/memcached@8.5.5 / default
- bitnami/mongodb@19.0.7 / existing-secret-replicaset
- bitnami/mysql@14.0.3 / existing-secret
- bitnami/nginx@24.0.2 / existing-tls-ingress
- bitnami/opensearch@2.0.10 / default
- bitnami/opensearch@2.0.10 / ha
- bitnami/phpmyadmin@20.0.0 / default


### First Missing Live Helm Vs ConfigHub Rows

- aqua/trivy-operator@0.32.1 / default
- aqua/trivy-operator@0.32.1 / no-crds
- argo-cd/argo-cd@9.5.15 / default
- argo-cd/argo-cd@9.5.15 / no-crds
- argo-cd/argo-events@2.4.21 / default
- argo-cd/argo-events@2.4.21 / no-crds
- argo-cd/argo-rollouts@2.40.9 / default
- argo-cd/argo-rollouts@2.40.9 / no-crds
- argo-cd/argo-workflows@1.0.14 / default
- argo-cd/argocd-image-updater@1.2.2 / default
- autoscaler/cluster-autoscaler@9.57.0 / default
- autoscaler/vertical-pod-autoscaler@0.9.0 / default
- autoscaler/vertical-pod-autoscaler@0.9.0 / no-crds
- aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1 / default
- bitnami/apache@11.4.29 / default
- bitnami/contour@21.1.4 / default
- bitnami/contour@21.1.4 / no-crds
- bitnami/elasticsearch@22.1.6 / default
- bitnami/elasticsearch@22.1.6 / ha
- bitnami/memcached@8.5.5 / default
- bitnami/mongodb@19.0.7 / existing-secret-replicaset
- bitnami/mongodb@19.0.7 / generated-passwords
- bitnami/mysql@14.0.3 / existing-secret
- bitnami/mysql@14.0.3 / generated-passwords
- bitnami/nginx@24.0.2 / existing-tls-ingress

