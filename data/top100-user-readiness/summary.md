# Top-100 User Readiness

Generated. Do not edit by hand.

```sh
npm run top100:user-readiness          # regenerate
npm run top100:user-readiness:verify   # check
```

One row per top-100 chart, in Helm-user language: can I try it, what must I provide, what does ConfigHub/installer absorb, and what happens next. Buckets are deterministic projections of curated repo data; the mapping rules and limits are in [the reference doc](../../docs/reference/top100-user-readiness.md). Full detail per chart is in [readiness.csv](./readiness.csv).

| Bucket | Charts | Meaning |
| --- | --- | --- |
| ready-to-try | 20 | Catalog-supported with live evidence; the recommended first base passes its lanes. Pull it and inspect the exact objects. |
| works-with-target-prerequisites | 15 | Proof-grade and review-queued; the named gap is something your cluster or team must provide (existing Secret, storage, CRD ownership). |
| works-with-operator-review | 22 | Proof-grade; render parity holds, but an operator should review the catalog shape (hooks, lifecycle, HA teaching, variant naming) before relying on it. |
| needs-better-base-variant | 35 | The mechanism is proven, but the install shapes a real user wants are not built or reviewed yet. |
| not-ready-yet | 8 | A named limitation or target compatibility issue needs a support / disclose / defer / refuse decision before this chart can be promoted. |

## ready-to-try (20)

| Chart | First base | You provide | Next action |
| --- | --- | --- | --- |
| argo-cd/argo-cd@9.5.15 | default | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| bitnami/mongodb@19.0.7 | generated-passwords | a StorageClass / storage decision; target facts at variant time; mandatory chart inputs | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| bitnami/mysql@14.0.3 | generated-passwords | an existing Secret for some bases (built); a StorageClass / storage decision; target facts at variant time; mandatory chart inputs | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| bitnami/nginx@24.0.2 | http-clusterip | an existing Secret for some bases (NOT built - chart ships no Secret toggle); target facts at variant time | choose the supported production base and target scope, refresh live/e2e evidence, and record the final support decision |
| bitnami/postgresql@18.6.7 | generated-passwords | an existing Secret for some bases (built); a StorageClass / storage decision; target facts at variant time; mandatory chart inputs | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| bitnami/rabbitmq@16.0.14 | generated-passwords | an existing Secret for some bases (built); a StorageClass / storage decision; target facts at variant time; mandatory chart inputs | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| bitnami/redis@25.5.3 | default | a StorageClass / storage decision; target facts at variant time; mandatory chart inputs | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| external-secrets/external-secrets@2.5.0 | default | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| grafana/grafana@10.5.15 | generated-passwords | nothing beyond a cluster and namespace | resolve image digests for each affected variant before production OCI support |
| grafana/loki@7.0.0 | single-binary-filesystem | a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time; mandatory chart inputs | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| grafana/tempo@1.24.4 | local-persistent | nothing beyond a cluster and namespace | resolve image digests for each affected variant before production OCI support |
| hashicorp/consul@2.0.0 | default-control-plane | a StorageClass / storage decision; webhook/cert readiness at delivery time; mandatory chart inputs | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| hashicorp/vault@0.32.0 | dev-mode | a StorageClass / storage decision; webhook/cert readiness at delivery time; mandatory chart inputs | resolve image digests for each affected variant before production OCI support |
| ingress-nginx/ingress-nginx@4.15.1 | internal-clusterip | webhook/cert readiness at delivery time; mandatory chart inputs | record the target-scoped lifecycle support decision, then refresh live/e2e evidence for that scope |
| jetstack/cert-manager@v1.20.2 | crds-enabled | nothing beyond a cluster and namespace | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| longhorn/longhorn@1.11.2 | default | target facts at variant time; mandatory chart inputs | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| metrics-server/metrics-server@3.13.0 | default | an existing Secret for some bases (NOT built - chart ships no Secret toggle); target facts at variant time | image policy decision recorded for a target scope; create digest-pinned bases or overrides for stricter scopes |
| prometheus-community/kube-prometheus-stack@85.3.3 | default | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time; mandatory chart inputs | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| prometheus-community/prometheus@29.8.0 | server-only-ephemeral | a StorageClass / storage decision; target facts at variant time; mandatory chart inputs | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |
| secrets-store-csi-driver/secrets-store-csi-driver@1.6.0 | default | nothing beyond a cluster and namespace | choose the supported production base, then record explicit security acceptance or create a hardened base before claiming production support |

## works-with-target-prerequisites (15)

| Chart | First base | You provide | Next action |
| --- | --- | --- | --- |
| external-dns/external-dns@1.21.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base); mandatory chart inputs | run catalog promotion review |
| cloudnative-pg/cloudnative-pg@0.28.2 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time | run catalog promotion review |
| prometheus-community/kube-state-metrics@7.4.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a StorageClass / storage decision; target facts at variant time | run catalog promotion review |
| elastic/eck-operator@3.4.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; mandatory chart inputs | run catalog promotion review |
| nats/nats@2.14.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); mandatory chart inputs | run catalog promotion review |
| prometheus-community/prometheus-node-exporter@4.55.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); target facts at variant time; mandatory chart inputs | run catalog promotion review |
| gatekeeper/gatekeeper@3.22.2 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time | run catalog promotion review |
| aqua/trivy-operator@0.32.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| autoscaler/vertical-pod-autoscaler@0.9.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| bitnami/opensearch@2.0.10 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run) | run catalog promotion review |
| jetstack/trust-manager@v0.22.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| nats/nack@0.34.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| open-telemetry/opentelemetry-operator@0.114.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| sealed-secrets/sealed-secrets@2.18.6 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| velero/velero@12.0.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |

## works-with-operator-review (22)

| Chart | First base | You provide | Next action |
| --- | --- | --- | --- |
| kedacore/keda@2.19.0 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time | run APIService promotion review: choose supported base, target scope, CRD ownership path, and evidence refresh rule using the committed aggregation receipt |
| prometheus-community/prometheus-blackbox-exporter@11.10.0 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |
| stakater/reloader@2.2.12 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |
| grafana/alloy@1.8.2 | default (unreviewed first guess) | a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); mandatory chart inputs | run catalog promotion review |
| prometheus-community/alertmanager@1.37.0 | default (unreviewed first guess) | a StorageClass / storage decision | run catalog promotion review |
| elastic/logstash@8.5.1 | default (unreviewed first guess) | a StorageClass / storage decision | run catalog promotion review |
| elastic/filebeat@8.5.1 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |
| hashicorp/terraform@1.1.2 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base); mandatory chart inputs | run catalog promotion review |
| fairwinds-stable/vpa@4.11.0 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time | review APIService render-path notes: current maintained bases do not render APIService objects; create a separate APIService-enabled base only if product chooses that path |
| jaegertracing/jaeger-operator@2.57.0 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time | run catalog promotion review |
| strimzi/strimzi-kafka-operator@1.0.0 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| percona/pxc-operator@1.19.1 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base); target facts at variant time | run catalog promotion review |
| argo-cd/argo-events@2.4.21 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| argo-cd/argo-rollouts@2.40.9 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| argo-cd/argo-workflows@1.0.14 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |
| autoscaler/cluster-autoscaler@9.57.0 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |
| grafana/rollout-operator@0.49.0 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| istio/gateway@1.30.0 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |
| nats/surveyor@0.20.9 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |
| percona/pg-operator@3.0.0 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| percona/psmdb-operator@1.22.0 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base) | run catalog promotion review |
| vm/victoria-metrics-single@0.39.0 | default (unreviewed first guess) | nothing beyond a cluster and namespace | run catalog promotion review |

## needs-better-base-variant (35)

| Chart | First base | You provide | Next action |
| --- | --- | --- | --- |
| gitlab/gitlab-runner@0.89.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); target facts at variant time; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| fluent/fluent-bit@0.57.6 | default (unreviewed first guess) | your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| runix/pgadmin4@1.62.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a StorageClass / storage decision; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18 | default (unreviewed first guess) | a StorageClass / storage decision; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| elastic/kibana@8.5.1 | default (unreviewed first guess) | your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| descheduler/descheduler@0.36.0 | default (unreviewed first guess) | mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| jaegertracing/jaeger@4.8.0 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); target facts at variant time; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| dex/dex@0.24.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| falcosecurity/falco@9.0.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a StorageClass / storage decision; target facts at variant time; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| projectcalico/tigera-operator@v3.32.0 | default (unreviewed first guess) | target facts at variant time; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| fairwinds-stable/goldilocks@10.3.0 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| prometheus-community/prometheus-operator-crds@29.0.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base); target facts at variant time; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| coredns/coredns@1.45.2 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); target facts at variant time; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| bitnami/phpmyadmin@20.0.0 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; target facts at variant time; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| prometheus-community/prometheus-pushgateway@3.6.0 | default (unreviewed first guess) | a StorageClass / storage decision; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| fluent/fluentd@0.5.3 | default (unreviewed first guess) | a StorageClass / storage decision; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| bitnami/memcached@8.5.5 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; target facts at variant time; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| opencost/opencost@2.5.21 | default (unreviewed first guess) | a StorageClass / storage decision; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| kyverno/kyverno-policies@3.8.0 | default (unreviewed first guess) | target facts at variant time; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| elastic/metricbeat@8.5.1 | default (unreviewed first guess) | a StorageClass / storage decision; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| minio-operator/operator@7.1.1 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| bitnami/apache@11.4.29 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); target facts at variant time; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| aws-ebs-csi-driver/aws-ebs-csi-driver@2.60.1 | default (unreviewed first guess) | mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| falcosecurity/falcosidekick@0.13.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a StorageClass / storage decision; mandatory chart inputs; your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| argo-cd/argocd-image-updater@1.2.2 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| crossplane-stable/crossplane@2.3.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| grafana/promtail@6.17.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| haproxytech/kubernetes-ingress@1.52.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| istio/istiod@1.30.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| jetstack/cert-manager-csi-driver@v0.14.0 | default (unreviewed first guess) | your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| linkerd/linkerd-crds@1.8.0 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| minio-operator/tenant@7.1.1 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| rook-release/rook-ceph@v1.19.5 | default (unreviewed first guess) | a CRD ownership choice (crds vs no-crds base); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| rook-release/rook-ceph-cluster@v1.19.5 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |
| vm/victoria-logs-single@0.12.5 | default (unreviewed first guess) | an existing Secret for some bases (buildable — not yet run); your wanted install shape, until a reviewed base exists | add at least one user-shaped variant before catalog promotion |

## not-ready-yet (8)

| Chart | First base | You provide | Next action |
| --- | --- | --- | --- |
| traefik/traefik@40.2.0 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); webhook/cert readiness at delivery time; target facts at variant time; mandatory chart inputs; a decision on the named limitation before use | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| kyverno/kyverno@3.8.1 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); target facts at variant time; mandatory chart inputs; a decision on the named limitation before use | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| bitnami/elasticsearch@22.1.6 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; target facts at variant time; mandatory chart inputs; a decision on the named limitation before use | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| bitnami/spark@10.0.3 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; target facts at variant time; a decision on the named limitation before use | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| prometheus-community/prometheus-adapter@5.3.0 | default (unreviewed first guess) | a compatible Kubernetes target profile or a compatibility base | Keep prometheus-community/prometheus-adapter@5.3.0 proof-grade for this target profile. Promote only after an upstream chart version or explicit compatibility base renders a target-supported APIService object and passes the APIService runtime contract. |
| bitnami/zookeeper@13.8.7 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; target facts at variant time; a decision on the named limitation before use | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| bitnami/contour@21.1.4 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a CRD ownership choice (crds vs no-crds base); target facts at variant time; a decision on the named limitation before use | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
| grafana/pyroscope@2.0.2 | default (unreviewed first guess) | an existing Secret for some bases (NOT built - chart ships no Secret toggle); a StorageClass / storage decision; a CRD ownership choice (crds vs no-crds base); target facts at variant time; mandatory chart inputs; a decision on the named limitation before use | review limitation before promotion: existing-secret (chart ships no Secret toggle) |
