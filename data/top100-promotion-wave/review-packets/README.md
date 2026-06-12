# Top-100 Promotion Review Packets

Generated. Do not edit by hand.

These packets turn the first strict top-100 promotion wave into one file per
chart. Each packet is a review input. It is not a catalog support claim.

## Current Packets

| Chart | Selected base | Evidence | Scan/gate | Work orders | Packet |
| --- | --- | --- | --- | ---: | --- |
| `aqua/trivy-operator@0.32.1` | default | `two-cluster-kind-parity` | high=0, medium=19, gates=allow;warn | 4 | [aqua-trivy-operator-0-32-1.yaml](./aqua-trivy-operator-0-32-1.yaml) |
| `argo-cd/argo-events@2.4.21` | default | `two-cluster-kind-parity` | high=0, medium=5, gates=allow;warn | 4 | [argo-cd-argo-events-2-4-21.yaml](./argo-cd-argo-events-2-4-21.yaml) |
| `argo-cd/argo-rollouts@2.40.9` | default | `two-cluster-kind-parity` | high=0, medium=10, gates=allow;warn | 4 | [argo-cd-argo-rollouts-2-40-9.yaml](./argo-cd-argo-rollouts-2-40-9.yaml) |
| `autoscaler/vertical-pod-autoscaler@0.9.0` | default | `two-cluster-kind-parity` | high=0, medium=25, gates=allow;warn | 4 | [autoscaler-vertical-pod-autoscaler-0-9-0.yaml](./autoscaler-vertical-pod-autoscaler-0-9-0.yaml) |
| `cloudnative-pg/cloudnative-pg@0.28.2` | default | `two-cluster-kind-parity` | high=0, medium=16, gates=allow;warn | 9 | [cloudnative-pg-cloudnative-pg-0-28-2.yaml](./cloudnative-pg-cloudnative-pg-0-28-2.yaml) |
| `elastic/eck-operator@3.4.0` | default | `two-cluster-kind-parity` | high=0, medium=18, gates=allow;warn | 8 | [elastic-eck-operator-3-4-0.yaml](./elastic-eck-operator-3-4-0.yaml) |
| `elastic/logstash@8.5.1` | default | `two-cluster-kind-parity` | high=0, medium=0, gates=allow | 6 | [elastic-logstash-8-5-1.yaml](./elastic-logstash-8-5-1.yaml) |
| `external-dns/external-dns@1.21.1` | dry-run-txt-registry | `two-cluster-kind-parity` | high=0, medium=3, gates=allow;warn | 7 | [external-dns-external-dns-1-21-1.yaml](./external-dns-external-dns-1-21-1.yaml) |
| `gatekeeper/gatekeeper@3.22.2` | default | `two-cluster-kind-parity` | high=0, medium=22, gates=allow;warn | 8 | [gatekeeper-gatekeeper-3-22-2.yaml](./gatekeeper-gatekeeper-3-22-2.yaml) |
| `grafana/alloy@1.8.2` | default | `two-cluster-kind-parity` | high=0, medium=3, gates=allow;warn | 8 | [grafana-alloy-1-8-2.yaml](./grafana-alloy-1-8-2.yaml) |
| `nats/nats@2.14.0` | default | `two-cluster-kind-parity` | high=0, medium=1, gates=allow;warn | 5 | [nats-nats-2-14-0.yaml](./nats-nats-2-14-0.yaml) |
| `open-telemetry/opentelemetry-operator@0.114.0` | default | `two-cluster-kind-parity` | high=0, medium=9, gates=allow;warn | 4 | [open-telemetry-opentelemetry-operator-0-114-0.yaml](./open-telemetry-opentelemetry-operator-0-114-0.yaml) |
| `percona/pg-operator@3.0.0` | default | `two-cluster-kind-parity` | high=0, medium=8, gates=allow;warn | 4 | [percona-pg-operator-3-0-0.yaml](./percona-pg-operator-3-0-0.yaml) |
| `percona/psmdb-operator@1.22.0` | default | `two-cluster-kind-parity` | high=0, medium=3, gates=allow;warn | 4 | [percona-psmdb-operator-1-22-0.yaml](./percona-psmdb-operator-1-22-0.yaml) |
| `percona/pxc-operator@1.19.1` | default | `two-cluster-kind-parity` | high=0, medium=3, gates=allow;warn | 6 | [percona-pxc-operator-1-19-1.yaml](./percona-pxc-operator-1-19-1.yaml) |
| `prometheus-community/alertmanager@1.37.0` | default | `two-cluster-kind-parity` | high=0, medium=0, gates=allow | 6 | [prometheus-community-alertmanager-1-37-0.yaml](./prometheus-community-alertmanager-1-37-0.yaml) |
| `prometheus-community/kube-state-metrics@7.4.0` | cluster-metrics-readonly | `two-cluster-kind-parity` | high=0, medium=2, gates=warn | 8 | [prometheus-community-kube-state-metrics-7-4-0.yaml](./prometheus-community-kube-state-metrics-7-4-0.yaml) |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | cluster-metrics-readonly | `two-cluster-kind-parity` | high=0, medium=0, gates=allow | 5 | [prometheus-community-prometheus-blackbox-exporter-11-10-0.yaml](./prometheus-community-prometheus-blackbox-exporter-11-10-0.yaml) |
| `prometheus-community/prometheus-node-exporter@4.55.0` | cluster-metrics-readonly | `two-cluster-kind-parity` | high=0, medium=1, gates=warn | 7 | [prometheus-community-prometheus-node-exporter-4-55-0.yaml](./prometheus-community-prometheus-node-exporter-4-55-0.yaml) |
| `sealed-secrets/sealed-secrets@2.18.6` | default | `two-cluster-kind-parity` | high=0, medium=3, gates=allow;warn | 4 | [sealed-secrets-sealed-secrets-2-18-6.yaml](./sealed-secrets-sealed-secrets-2-18-6.yaml) |
| `strimzi/strimzi-kafka-operator@1.0.0` | default | `two-cluster-kind-parity` | high=0, medium=20, gates=allow;warn | 7 | [strimzi-strimzi-kafka-operator-1-0-0.yaml](./strimzi-strimzi-kafka-operator-1-0-0.yaml) |

## Rule

Use a packet to decide whether the selected base is a real catalog path. Before
catalog status changes, the listed review decisions need explicit outcomes and
the selected target scope needs live evidence or a routed deferral.

Regenerate:

~~~sh
npm run top100:promotion-wave
npm run top100:promotion-wave:verify
~~~
