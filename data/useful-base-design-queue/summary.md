# Useful Base Design Queue

Generated. Do not edit by hand.

This queue expands the top-100 "needs better base variant" gap into concrete,
reviewable base-design work. Rows are proposals, not supported catalog entries.
They are derived from the current chart-use guide, top-100 readiness data,
chart facts, and strict coverage work queue.

The purpose is to answer:

~~~text
Which proof-grade charts are still too default-shaped for users?
What kind of base would make each one useful?
What must be proven before that base becomes a catalog offer?
~~~

## Summary

~~~text
charts needing useful bases: 46
families: 7
proposal statuses: proposal-not-built=35, realized-alias-base=10, realized-values-profile-base=1
~~~

## Design Families

| Family | Charts | Proposed base shape | First charts |
| --- | ---: | --- | --- |
| platform-controller | 12 | controller-default-reviewed | projectcalico/tigera-operator@v3.32.0; stakater/reloader@2.2.12; coredns/coredns@1.45.2; argo-cd/argocd-image-updater@1.2.2; kyverno/kyverno-policies@3.8.0; argo-cd/argo-workflows@1.0.14 |
| monitoring-metrics | 9 | cluster-metrics-readonly | prometheus-community/kube-state-metrics@7.4.0; fairwinds-stable/goldilocks@10.3.0; descheduler/descheduler@0.36.0; prometheus-community/prometheus-blackbox-exporter@11.10.0; prometheus-community/prometheus-operator-crds@29.0.0; prometheus-community/prometheus-node-exporter@4.55.0 |
| logging-telemetry-agent | 8 | node-or-cluster-collector | fluent/fluent-bit@0.57.6; falcosecurity/falco@9.0.0; jaegertracing/jaeger@4.8.0; elastic/filebeat@8.5.1; fluent/fluentd@0.5.3; elastic/metricbeat@8.5.1 |
| storage-platform | 8 | storage-default-reviewed | nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18; bitnami/memcached@8.5.5; minio-operator/operator@7.1.1; aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1; rook-release/rook-ceph@v1.19.5; jetstack/cert-manager-csi-driver@v0.14.0 |
| web-admin-ui | 5 | web-ui-existing-secret | runix/pgadmin4@1.62.0; elastic/kibana@8.5.1; dex/dex@0.24.0; bitnami/phpmyadmin@20.0.0; bitnami/apache@11.4.29 |
| application-or-addon | 3 | default-reviewed | nats/surveyor@0.20.9; vm/victoria-logs-single@0.12.5; vm/victoria-metrics-single@0.39.0 |
| ci-runner | 1 | runner-existing-secret | gitlab/gitlab-runner@0.89.0 |

## First Twenty Rows

| Priority | Chart | Proposed base | Status | User job | Target inputs | Proof required |
| ---: | --- | --- | --- | --- | --- | --- |
| 6 | fluent/fluent-bit@0.57.6 | node-or-cluster-collector | proposal-not-built | run an observability collector or security agent with explicit output destinations | namespace and target only | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; hook lifecycle receipt or explicit blocker |
| 22 | runix/pgadmin4@1.62.0 | web-ui-existing-secret | proposal-not-built | deploy a reviewable web UI using existing credentials or external identity | Secret reference; StorageClass or persistence choice; required chart values | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy; storage and rollback note |
| 23 | gitlab/gitlab-runner@0.89.0 | runner-existing-secret | proposal-not-built | run CI runners with explicit registration Secret and RBAC boundaries | Secret reference; target facts | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy |
| 23 | nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18 | storage-default-reviewed | proposal-not-built | install storage or cache infrastructure with explicit storage and lifecycle choices | StorageClass or persistence choice | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; storage and rollback note |
| 25 | prometheus-community/kube-state-metrics@7.4.0 | cluster-metrics-readonly | realized-alias-base | collect or expose cluster metrics without changing application workloads | Secret reference; StorageClass or persistence choice; target facts | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy; storage and rollback note |
| 26 | fairwinds-stable/goldilocks@10.3.0 | cluster-metrics-readonly | proposal-not-built | collect or expose cluster metrics without changing application workloads | Secret reference; CRD ownership choice; webhook readiness observation; target facts | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; CRD lifecycle route; webhook/runtime observation; Secret/target-fact policy |
| 27 | projectcalico/tigera-operator@v3.32.0 | controller-default-reviewed | proposal-not-built | install a cluster controller with explicit CRD, RBAC, and lifecycle boundaries | target facts; required chart values | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; hook lifecycle receipt or explicit blocker |
| 32 | elastic/kibana@8.5.1 | web-ui-existing-secret | proposal-not-built | deploy a reviewable web UI using existing credentials or external identity | namespace and target only | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition |
| 33 | descheduler/descheduler@0.36.0 | cluster-metrics-readonly | proposal-not-built | collect or expose cluster metrics without changing application workloads | required chart values | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition |
| 34 | prometheus-community/prometheus-blackbox-exporter@11.10.0 | cluster-metrics-readonly | realized-alias-base | collect or expose cluster metrics without changing application workloads | namespace and target only | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition |
| 36 | stakater/reloader@2.2.12 | controller-default-reviewed | realized-alias-base | install a cluster controller with explicit CRD, RBAC, and lifecycle boundaries | namespace and target only | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition |
| 37 | falcosecurity/falco@9.0.0 | node-or-cluster-collector | proposal-not-built | run an observability collector or security agent with explicit output destinations | Secret reference; StorageClass or persistence choice; target facts; required chart values | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy; storage and rollback note |
| 37 | jaegertracing/jaeger@4.8.0 | node-or-cluster-collector | proposal-not-built | run an observability collector or security agent with explicit output destinations | Secret reference; target facts | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy |
| 37 | prometheus-community/prometheus-operator-crds@29.0.0 | cluster-metrics-readonly | proposal-not-built | collect or expose cluster metrics without changing application workloads | Secret reference; CRD ownership choice; target facts | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; CRD lifecycle route; Secret/target-fact policy |
| 40 | dex/dex@0.24.0 | web-ui-existing-secret | proposal-not-built | deploy a reviewable web UI using existing credentials or external identity | Secret reference | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy |
| 43 | prometheus-community/prometheus-node-exporter@4.55.0 | cluster-metrics-readonly | realized-values-profile-base | collect or expose cluster metrics without changing application workloads | Secret reference; target facts; required chart values | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy |
| 46 | prometheus-community/prometheus-adapter@5.3.0 | cluster-metrics-readonly | realized-alias-base | collect or expose cluster metrics without changing application workloads | namespace and target only | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition |
| 50 | bitnami/phpmyadmin@20.0.0 | web-ui-existing-secret | proposal-not-built | deploy a reviewable web UI using existing credentials or external identity | Secret reference; StorageClass or persistence choice; target facts; required chart values | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy; storage and rollback note |
| 51 | elastic/filebeat@8.5.1 | node-or-cluster-collector | realized-alias-base | run an observability collector or security agent with explicit output destinations | namespace and target only | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition |
| 51 | prometheus-community/prometheus-pushgateway@3.6.0 | cluster-metrics-readonly | proposal-not-built | collect or expose cluster metrics without changing application workloads | StorageClass or persistence choice; required chart values | recipe/package base; render parity; helm pain report update; scan or gate receipt; production disposition; Secret/target-fact policy; storage and rollback note |

## Reading Rule

- `proposal-not-built` means the row is a product/design candidate only.
- `realized-alias-base` means the recipe variant and package base exist, but
  the base still needs ConfigHub proof, selected live evidence, production
  disposition, and a catalog decision.
- If the choice changes rendered Kubernetes objects, build it as a recipe/package
  base and rerun render parity.
- If the choice only changes target, labels, approvals, links, observations, or
  environment/customer metadata, make it a derived ConfigHub variant after
  upload.
- A proposed base becomes public-catalog ready only after the proof listed in
  `proof_required_before_catalog` exists.

Machine-readable forms:

- [queue.csv](./queue.csv)
- [families.csv](./families.csv)

Regenerate:

~~~sh
npm run top100:useful-base-queue
npm run top100:useful-base-queue:verify
~~~
