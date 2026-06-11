# Top-100 Promotion Review Packets

Generated. Do not edit by hand.

These packets turn the first strict top-100 promotion wave into one file per
chart. Each packet is a review input. It is not a catalog support claim.

## Current Packets

| Chart | Selected base | Evidence | Scan/gate | Work orders | Packet |
| --- | --- | --- | --- | ---: | --- |
| `cloudnative-pg/cloudnative-pg@0.28.2` | default | `two-cluster-kind-parity` | high=0, medium=16, gates=allow;warn | 9 | [cloudnative-pg-cloudnative-pg-0-28-2.yaml](./cloudnative-pg-cloudnative-pg-0-28-2.yaml) |
| `elastic/eck-operator@3.4.0` | default | `two-cluster-kind-parity` | high=0, medium=18, gates=allow;warn | 8 | [elastic-eck-operator-3-4-0.yaml](./elastic-eck-operator-3-4-0.yaml) |
| `elastic/logstash@8.5.1` | default | `two-cluster-kind-parity` | high=0, medium=0, gates=allow | 6 | [elastic-logstash-8-5-1.yaml](./elastic-logstash-8-5-1.yaml) |
| `external-dns/external-dns@1.21.1` | dry-run-txt-registry | `two-cluster-kind-parity` | high=0, medium=3, gates=allow;warn | 7 | [external-dns-external-dns-1-21-1.yaml](./external-dns-external-dns-1-21-1.yaml) |
| `grafana/alloy@1.8.2` | default | `two-cluster-kind-parity` | high=0, medium=3, gates=allow;warn | 8 | [grafana-alloy-1-8-2.yaml](./grafana-alloy-1-8-2.yaml) |
| `kedacore/keda@2.19.0` | default | `two-cluster-kind-parity` | high=0, medium=17, gates=allow;warn | 8 | [kedacore-keda-2-19-0.yaml](./kedacore-keda-2-19-0.yaml) |
| `nats/nats@2.14.0` | default | `two-cluster-kind-parity` | high=0, medium=1, gates=allow;warn | 5 | [nats-nats-2-14-0.yaml](./nats-nats-2-14-0.yaml) |
| `prometheus-community/alertmanager@1.37.0` | default | `two-cluster-kind-parity` | high=0, medium=0, gates=allow | 6 | [prometheus-community-alertmanager-1-37-0.yaml](./prometheus-community-alertmanager-1-37-0.yaml) |

## Rule

Use a packet to decide whether the selected base is a real catalog path. Before
catalog status changes, the listed review decisions need explicit outcomes and
the selected target scope needs live evidence or a routed deferral.

Regenerate:

~~~sh
npm run top100:promotion-wave
npm run top100:promotion-wave:verify
~~~
