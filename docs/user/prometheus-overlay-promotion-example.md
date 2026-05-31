# Prometheus Promotion Example

**UNOFFICIAL/EXPERIMENTAL**

This example shows how to promote a reviewed Prometheus base into a production
variant without rerendering Helm.

## Example

```text
Component: Prometheus
Source chart: prometheus-community/prometheus@29.8.0
Base variant: server-only-ephemeral
Promotion variant: prod-us-east
Target: monitoring-targets/prod-us-east
```

## Base Variant

The base variant is:

```text
Prometheus/server-only-ephemeral
```

It is produced by `cub installer`.

It changes the rendered Kubernetes objects by disabling bundled components and
persistence:

```yaml
alertmanager:
  enabled: false
kube-state-metrics:
  enabled: false
prometheus-node-exporter:
  enabled: false
prometheus-pushgateway:
  enabled: false
server:
  persistentVolume:
    enabled: false
```

Those values remove Alertmanager, kube-state-metrics, node-exporter,
pushgateway, and the server PVC from the rendered output. Because the YAML
changes, this is a base variant.

Run it:

```sh
cub installer setup \
  --pull packages/prometheus-community/prometheus/29.8.0 \
  --base server-only-ephemeral \
  --work-dir .tmp/prometheus-server-only \
  --non-interactive \
  --namespace monitoring
```

Upload the reviewed base when ConfigHub is available:

```sh
cub installer upload \
  --work-dir .tmp/prometheus-server-only \
  --space helm-prometheus-server-only
```

The checked catalog proof records:

```text
regular Helm objects: 6
cub installer objects: 7, including Namespace
semantic object match: 6/6
```

## Promotion Variant

The promotion variant is:

```text
Prometheus/prod-us-east
```

It is created from:

```text
Prometheus/server-only-ephemeral
```

It changes only the operating context:

```yaml
environment: Prod
region: us-east
target: monitoring-targets/prod-us-east
approvalGate: production-review
observationFreshness: PT15M
```

It does not rerender Helm. It does not change Prometheus components,
persistence, scrape config, RBAC, ingress, or object count.

The current command shape is:

```sh
cub variant create prod-us-east helm-prometheus-server-only \
  --environment Prod \
  --region us-east \
  --target monitoring-targets/prod-us-east \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

## User UX

The user should see something like this:

```text
Create variant
From: Prometheus/server-only-ephemeral
For: prod-us-east
Change: target, environment, region, production gates, observation policy
Review: same Prometheus object set, new production operating context
Status: ready to create
Create
```

That is the whole user story.

The detailed checks can stay in the review details, CI, receipts, or audit
views:

```text
same rendered object digest
same Unit count
upstream links preserved
scan warning carried forward
production gate applied
```

## Delivery

For production delivery, use the reviewed production variant:

```text
Prometheus/server-only-ephemeral
  -> Prometheus/prod-us-east
  -> publish or apply prod-us-east
```

Do not publish the generic base and rely on an untracked GitOps patch to turn
it into production.

## When To Go Back To The Base

If the request changes any of these, create or update a base variant:

```text
Prometheus components
persistence
scrape config
remote write/read
RBAC
ingress
network policy
object count
```

If the request changes any of these, create a derived ConfigHub variant:

```text
target
environment
region
labels
annotations
approval gates
observation policy
promotion relationship
```

## Bulk Promotion Shape

The same pattern can be repeated for several production targets:

```yaml
from:
  component: Prometheus
  variant: server-only-ephemeral
rows:
  - variant: prod-us-east
    environment: Prod
    region: us-east
    target: monitoring-targets/prod-us-east
  - variant: prod-eu-west
    environment: Prod
    region: eu-west
    target: monitoring-targets/prod-eu-west
checks:
  - rendered object set is unchanged
  - each row has a target
  - each row has production gates
```

## Checked Files

The checked Prometheus catalog page is:

```text
recipes/prometheus-community/prometheus/29.8.0/CATALOG.md
```
