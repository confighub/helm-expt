# Fast-Track Promotion Review Packets

These generated packets bind the low-residue promotion candidates to the
evidence and decisions needed before catalog support can be considered.

They are review inputs. They do not promote a chart, accept production risk, or
claim runtime support.

| Chart | Packet | Storage review | Target-scope draft | Selected base | Decision state | Missing proof lanes |
| --- | --- | --- | --- | --- | --- | --- |
| `elastic/logstash@8.5.1` | [elastic-logstash.yaml](./elastic-logstash.yaml) | [storage-rollback/elastic-logstash.yaml](./storage-rollback/elastic-logstash.yaml) | [target-scope/elastic-logstash.yaml](./target-scope/elastic-logstash.yaml) | `default` | review-input-only |  |
| `prometheus-community/alertmanager@1.37.0` | [prometheus-community-alertmanager.yaml](./prometheus-community-alertmanager.yaml) | [storage-rollback/prometheus-community-alertmanager.yaml](./storage-rollback/prometheus-community-alertmanager.yaml) | [target-scope/prometheus-community-alertmanager.yaml](./target-scope/prometheus-community-alertmanager.yaml) | `default` | review-input-only |  |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | [prometheus-community-prometheus-blackbox-exporter.yaml](./prometheus-community-prometheus-blackbox-exporter.yaml) | [storage-rollback/prometheus-community-prometheus-blackbox-exporter.yaml](./storage-rollback/prometheus-community-prometheus-blackbox-exporter.yaml) | [target-scope/prometheus-community-prometheus-blackbox-exporter.yaml](./target-scope/prometheus-community-prometheus-blackbox-exporter.yaml) | `cluster-metrics-readonly` | review-input-only |  |

## Shared Review Rule

The selected base can move forward only after the storage/rollback boundary is accepted or narrowed for the target and a target-scoped support decision exists for that exact base.
