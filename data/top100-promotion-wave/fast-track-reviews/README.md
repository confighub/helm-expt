# Fast-Track Promotion Review Packets

These generated packets bind the low-residue promotion candidates to the
evidence and decisions needed before catalog support can be considered.

They are review inputs. They do not promote a chart, accept production risk, or
claim runtime support.

| Chart | Packet | Storage review | Selected base | Decision state | Missing proof lanes |
| --- | --- | --- | --- | --- | --- |
| `elastic/logstash@8.5.1` | [elastic-logstash.yaml](./elastic-logstash.yaml) | [storage-rollback/elastic-logstash.yaml](./storage-rollback/elastic-logstash.yaml) | `default` | review-input-only | GitOps/OCI live observation<br>live Helm-vs-ConfigHub parity |
| `prometheus-community/alertmanager@1.37.0` | [prometheus-community-alertmanager.yaml](./prometheus-community-alertmanager.yaml) | [storage-rollback/prometheus-community-alertmanager.yaml](./storage-rollback/prometheus-community-alertmanager.yaml) | `default` | review-input-only | GitOps/OCI live observation<br>live Helm-vs-ConfigHub parity |

## Shared Review Rule

The selected base can move forward only after the storage and rollback policy,
the proof lanes listed in its packet, and a target-scoped support decision all
exist for that exact base.
