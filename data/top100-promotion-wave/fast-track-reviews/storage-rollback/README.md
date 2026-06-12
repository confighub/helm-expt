# Fast-Track Storage And Rollback Reviews

These generated files inspect the rendered selected base for each fast-track
candidate and record the storage and rollback boundary that still needs human
review before any catalog-support claim.

They are review inputs. They do not prove backup, restore, retention,
application-level data safety, or production support.

| Chart | Review | Selected base | Storage shape | Rollback boundary |
| --- | --- | --- | --- | --- |
| `elastic/logstash@8.5.1` | [elastic-logstash.yaml](./elastic-logstash.yaml) | `default` | StatefulSet rendered with no volumeClaimTemplates in selected base | manifest rollback only; no PVC-backed data durability claim in selected base |
| `prometheus-community/alertmanager@1.37.0` | [prometheus-community-alertmanager.yaml](./prometheus-community-alertmanager.yaml) | `default` | 1 volumeClaimTemplate(s) rendered | manifest rollback can preserve PVC identity, but backup/restore and data retention are target-scoped |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | [prometheus-community-prometheus-blackbox-exporter.yaml](./prometheus-community-prometheus-blackbox-exporter.yaml) | `cluster-metrics-readonly` | no StatefulSet or volumeClaimTemplates in selected base | manifest rollback only; no PVC-backed data durability claim in selected base |

## Shared Rule

Render parity can prove the object set under pinned inputs. It does not prove
that stored data can be backed up, restored, retained, or rolled back for a
specific target. Those are target-scoped operating decisions.
