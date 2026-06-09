# kube-prometheus-stack Operation Preview

This generated preview shows the current high-fanout inputs that can be
explained before a change is shipped. It is not a live operation receipt. It is
a pre-ship review aid built from:

~~~text
recipes/prometheus-community/kube-prometheus-stack/85.3.3/value-source-map.yaml
recipes/prometheus-community/kube-prometheus-stack/85.3.3/inheritance-graph.yaml
data/high-fanout-demo/prometheus-kps.csv
~~~

## Preview

| Input | Example operation | Correct route | Known reach | Guardrail | Next proof |
| --- | --- | --- | --- | --- | --- |
| `grafana.adminPassword` | change or externalize the Grafana admin credential | generated fact or target secret policy | 2 objects / 4 fields | do not hide generated credentials in ConfigHub Units; bind or externalize them deliberately | generated-fact or target-fact receipt, scan/gate, live observation |
| `crds.enabled` | choose whether this release owns Prometheus Operator CRDs | `cub installer` base variant | 10 objects / 10 fields | do not promote `no-crds` unless target CRDs are staged and observed | render parity, target facts, GitOps/live receipt |

## Details

### `grafana.adminPassword`

Impact: changes-grafana-admin-secret-and-dependent-grafana-pods

Immutable-field risk: no

Related policies: `generated-fact-policy`, `secret-delivery-policy`

| Object | Field |
| --- | --- |
| `v1|Secret|monitoring|kube-prometheus-stack-grafana` | `data.admin-password` |
| `apps/v1|Deployment|monitoring|kube-prometheus-stack-grafana` | `spec.template.spec.containers[grafana-sc-dashboard].env.REQ_PASSWORD.valueFrom.secretKeyRef` |
| `apps/v1|Deployment|monitoring|kube-prometheus-stack-grafana` | `spec.template.spec.containers[grafana-sc-datasources].env.REQ_PASSWORD.valueFrom.secretKeyRef` |
| `apps/v1|Deployment|monitoring|kube-prometheus-stack-grafana` | `spec.template.spec.containers[grafana].env.GF_SECURITY_ADMIN_PASSWORD.valueFrom.secretKeyRef` |

### `crds.enabled`

Impact: changes-prometheus-operator-crd-object-set

Immutable-field risk: yes

Related policies: `crd-lifecycle-policy`, `no-crds-base-policy`

| Object | Field |
| --- | --- |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||alertmanagerconfigs.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||alertmanagers.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||podmonitors.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||probes.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||prometheusagents.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||prometheuses.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||prometheusrules.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||scrapeconfigs.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||servicemonitors.monitoring.coreos.com` | `metadata.name` |
| `apiextensions.k8s.io/v1|CustomResourceDefinition||thanosrulers.monitoring.coreos.com` | `metadata.name` |

## Rule

Use this preview before deciding how to make a change:

~~~text
changes rendered object shape or lifecycle
-> make or update a cub installer base and rerun render parity

refines already-rendered ConfigHub Units
-> use a derived ConfigHub variant, preview the Unit diff, then check and approve

requires target state
-> record target facts, preflight, delivery receipt, and fresh observation
~~~

Regenerate:

~~~sh
npm run high-fanout:generate
npm run high-fanout:verify
~~~
