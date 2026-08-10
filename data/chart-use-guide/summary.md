# Chart Use Guide

This generated guide answers one user question:

~~~text
Can I use this chart, and what should I do next?
~~~

It is a routing surface over the maintained top-100 data. It does not replace
the detailed proof lanes, production decisions, or per-chart catalog pages.

## Summary

| Answer | Charts | Meaning |
| --- | ---: | --- |
| yes-public-catalog | 20 | Public catalog entry exists. Choose a base and check the lane you need. |
| not-yet-public-catalog-proof-ready | 39 | Proof exists and variants look useful, but catalog promotion review is not done. |
| not-yet-user-ready | 37 | The current proof is too default-shaped; design a useful base variant first. |
| decision-needed-first | 7 | A named gap must be supported, disclosed, deferred, or blocked before promotion. |

## How To Use This

1. Find the chart in [chart-use-guide.csv](./chart-use-guide.csv).
2. Read the `answer` and `first_action` columns.
3. Open the per-chart `catalog_path` for variants and receipts.
4. Open the `helm_pain_report` when the row has a hard gap or quirk.
5. Check production decisions before using any row as a production-support claim.

## Public Catalog Rows

These rows are the cleanest public starting points. They are still scoped by
base variant and proof lane.

| Chart | Recommended base | Evidence | First action |
| --- | --- | --- | --- |
| `argo-cd/argo-cd@9.5.15` | `default` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `bitnami/mongodb@19.0.7` | `existing-secret-replicaset (render-only)` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `bitnami/mysql@14.0.3` | `existing-secret` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `bitnami/nginx@24.0.2` | `http-clusterip (render-only)` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `bitnami/postgresql@18.6.7` | `existing-secret (render-only)` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `bitnami/rabbitmq@16.0.14` | `existing-secret` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `bitnami/redis@25.5.3` | `reuse-existing-secret (render-only)` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `external-secrets/external-secrets@2.5.0` | `default` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `grafana/grafana@10.5.15` | `existing-secret-ingress` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `grafana/loki@7.0.0` | `single-binary-filesystem` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `grafana/tempo@1.24.4` | `local-persistent` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `hashicorp/consul@2.0.0` | `default-control-plane` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `hashicorp/vault@0.32.0` | `default` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `ingress-nginx/ingress-nginx@4.15.1` | `internal-clusterip` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `jetstack/cert-manager@v1.20.2` | `crds-enabled` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `longhorn/longhorn@1.11.2` | `default` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `metrics-server/metrics-server@3.13.0` | `default` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `prometheus-community/kube-prometheus-stack@85.3.3` | `default (render-only)` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `prometheus-community/prometheus@29.8.0` | `server-only-ephemeral (render-only)` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |
| `secrets-store-csi-driver/secrets-store-csi-driver@1.6.0` | `default` | `live-helm-vs-confighub-parity` | Open the per-chart CATALOG.md, choose the recommended base, and run the cub installer setup command. |

## First Promotion Wave

These proof-ready rows are the first strict top-100 promotion-review packet.
They are good candidates for turning machine proof into a public catalog offer,
but they still need review, production disposition, and selected live evidence
before their catalog status changes.

| Chart | Recommended base | Evidence | First step |
| --- | --- | --- | --- |
| `traefik/traefik@40.2.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `external-dns/external-dns@1.21.1` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `kyverno/kyverno@3.8.1` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `cloudnative-pg/cloudnative-pg@0.28.2` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `kedacore/keda@2.19.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/kube-state-metrics@7.4.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `elastic/eck-operator@3.4.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `stakater/reloader@2.2.12` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `grafana/alloy@1.8.2` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `nats/nats@2.14.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/alertmanager@1.37.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `prometheus-community/prometheus-node-exporter@4.55.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `elastic/logstash@8.5.1` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `fairwinds-stable/vpa@4.11.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `jaegertracing/jaeger-operator@2.57.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `strimzi/strimzi-kafka-operator@1.0.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `gatekeeper/gatekeeper@3.22.2` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `percona/pxc-operator@1.19.1` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `aqua/trivy-operator@0.32.1` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `argo-cd/argo-events@2.4.21` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `argo-cd/argo-rollouts@2.40.9` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `argo-cd/argo-workflows@1.0.14` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `autoscaler/cluster-autoscaler@9.57.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `grafana/rollout-operator@0.49.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `jetstack/trust-manager@v0.22.1` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `nats/nack@0.34.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `open-telemetry/opentelemetry-operator@0.114.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `percona/pg-operator@3.0.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `percona/psmdb-operator@1.22.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `sealed-secrets/sealed-secrets@2.18.6` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |
| `vm/victoria-metrics-single@0.39.0` | `default` | `live-helm-vs-confighub-parity` | review the existing variants, then write production disposition or support-decision artifacts before changing catalog status |

Detailed gaps are in [../top100-promotion-wave/summary.md](../top100-promotion-wave/summary.md).

## Next Non-Catalog Rows

These rows have proof value but need promotion review, a better base variant,
or a limitation decision before they should be treated as catalog offers.

| Chart | Answer | Evidence | First action |
| --- | --- | --- | --- |
| `traefik/traefik@40.2.0` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `external-dns/external-dns@1.21.1` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `gitlab/gitlab-runner@0.89.0` | `not-yet-user-ready` | `in-confighub-proof` | Design at least one useful base variant before catalog promotion. |
| `kyverno/kyverno@3.8.1` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `cloudnative-pg/cloudnative-pg@0.28.2` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `fluent/fluent-bit@0.57.6` | `not-yet-user-ready` | `live-helm-vs-confighub-parity` | Design at least one useful base variant before catalog promotion. |
| `runix/pgadmin4@1.62.0` | `not-yet-user-ready` | `live-helm-vs-confighub-parity` | Design at least one useful base variant before catalog promotion. |
| `nfs-subdir-external-provisioner/nfs-subdir-external-provisioner@4.0.18` | `not-yet-user-ready` | `in-confighub-proof` | Design at least one useful base variant before catalog promotion. |
| `kedacore/keda@2.19.0` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `prometheus-community/kube-state-metrics@7.4.0` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `elastic/eck-operator@3.4.0` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `elastic/kibana@8.5.1` | `not-yet-user-ready` | `in-confighub-proof` | Design at least one useful base variant before catalog promotion. |
| `descheduler/descheduler@0.36.0` | `not-yet-user-ready` | `live-helm-vs-confighub-parity` | Design at least one useful base variant before catalog promotion. |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |
| `bitnami/elasticsearch@22.1.6` | `decision-needed-first` | `local-kubernetes-live` | Decide whether to support, disclose, defer, or block the hard gap before promotion. |
| `stakater/reloader@2.2.12` | `not-yet-public-catalog-proof-ready` | `live-helm-vs-confighub-parity` | Run catalog promotion review and add selected live lanes for the base a user would actually try. |

## Boundaries

- A public catalog row is not a blanket production-support claim.
- A render-parity row proves the installer path matches Helm under recorded
  inputs. It does not prove live runtime behavior by itself.
- A hard gap is a product or operator decision, not an automatic failure.
- Use [Top-100 Readiness](../top100-readiness/summary.md), [Outcome Coverage](../outcome-coverage/summary.md), and [Production Support Decisions](../production-support-decisions/summary.md) for drill-down.
