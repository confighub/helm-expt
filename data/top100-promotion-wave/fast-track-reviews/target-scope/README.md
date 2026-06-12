# Fast-Track Target-Scope Decision Drafts

These generated files turn the remaining product decision into a concrete
review input: what exact target shape could this selected base support, and
what evidence bounds that claim?

They are drafts. They do not make any chart production-supported.

| Chart | Draft | Selected base | Proposed scope | Decision state |
| --- | --- | --- | --- | --- |
| `elastic/logstash@8.5.1` | [elastic-logstash.yaml](./elastic-logstash.yaml) | `default` | vanilla Kubernetes target with OCI-capable GitOps controller; ConfigHub OCI/Argo live parity path used by the committed receipt; namespace selected by installer target context | draft |
| `prometheus-community/alertmanager@1.37.0` | [prometheus-community-alertmanager.yaml](./prometheus-community-alertmanager.yaml) | `default` | vanilla Kubernetes target with OCI-capable GitOps controller; ConfigHub OCI/Argo live parity path used by the committed receipt; rendered namespace default must match the target assignment | draft |
| `prometheus-community/prometheus-blackbox-exporter@11.10.0` | [prometheus-community-prometheus-blackbox-exporter.yaml](./prometheus-community-prometheus-blackbox-exporter.yaml) | `cluster-metrics-readonly` | vanilla Kubernetes target with OCI-capable GitOps controller; ConfigHub OCI/Argo live parity path used by the committed receipt; rendered namespace default must match the target assignment | draft |

## Shared Rule

A green render, scan, or live parity result is not a catalog-support decision.
Support is scoped to a chart version, base, target class, delivery path,
namespace policy, storage boundary, extension-slot policy, and evidence
freshness window.
