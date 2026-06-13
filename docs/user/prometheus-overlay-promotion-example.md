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
Optional target: monitoring-targets/prod-us-east
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
  --space helm-prometheus-server-only \
  --component Prometheus \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant server-only-ephemeral \
  --unit-label Component=Prometheus \
  --unit-label HelmChart=prometheus-community-prometheus \
  --unit-label HelmChartVersion=29.8.0 \
  --unit-label Variant=server-only-ephemeral
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

It applies production refinements after the reviewed base has been uploaded:

```yaml
environment: Prod
region: us-east
target: monitoring-targets/prod-us-east # optional; requires an existing target
namespace: monitoring-prod
approvalGate: production-review
observationFreshness: PT15M
```

It does not rerender Helm. It does not change Prometheus components,
persistence, scrape config, RBAC, ingress, or object count. Any namespace or
target-specific field fill must be allowed by the Creator contract and recorded
with mutation receipts.

The current command shape is:

```sh
cub variant create prod-us-east helm-prometheus-server-only \
  --environment Prod \
  --region us-east \
  --space-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

Add `--target monitoring-targets/prod-us-east` only after that target exists.
The command sets the downstream Space labels and gates the cloned Units. The
cloned Units keep their source base labels unless a post-clone trigger or a
later bulk update changes them.

## User UX

A future/polished [Creator flow](../reference/variant-creation-artifact.md#creator-status)
should present this as:

```text
Create variant
From: Prometheus/server-only-ephemeral
For: prod-us-east
Change: target, environment, region, production gates, observation policy
Review: same Prometheus install shape, approved post-render production refinements
Status: ready to create
Create
```

That is the whole user story.

The detailed checks can stay in the review details, CI, receipts, or audit
views:

```text
no Helm rerender
approved mutation paths only
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
namespace fields when exposed by the base
target facts
allowed TransformPaths or function fills
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
  - no Helm rerender
  - install shape is unchanged
  - mutation paths are allowed
  - each row has a target
  - each row has production gates
```

## Checked Files

The checked Prometheus catalog page is:

```text
recipes/prometheus-community/prometheus/29.8.0/CATALOG.md
```
