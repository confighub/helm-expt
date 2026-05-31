# Prometheus Overlay And Promotion Example

This example shows how a Helm user can turn a standard Prometheus chart into
reviewable variants.

The chart is already in the catalog:

```text
prometheus-community/prometheus@29.8.0
```

Catalog page:

```text
recipes/prometheus-community/prometheus/29.8.0/CATALOG.md
```

The supported variants are:

| Variant | Use |
| --- | --- |
| `default` | Full default Prometheus chart shape. |
| `server-only-ephemeral` | Prometheus server only, with bundled components and persistence disabled. |

## Overlay That Changes Rendered Objects

The `server-only-ephemeral` variant is created from Helm-style values:

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

Those values change the rendered Kubernetes object set. Alertmanager,
kube-state-metrics, node-exporter, pushgateway, and the server PVC disappear
from the rendered output.

That means this is a `cub installer` base variant, not a post-render ConfigHub
clone.

Run it:

```sh
cub installer setup \
  --pull packages/prometheus-community/prometheus/29.8.0 \
  --base server-only-ephemeral \
  --work-dir .tmp/prometheus-server-only \
  --non-interactive \
  --namespace monitoring
```

Inspect the exact objects:

```sh
ls .tmp/prometheus-server-only
kubectl apply -f .tmp/prometheus-server-only/release/release-objects.yaml
```

When ConfigHub is available, upload the reviewed base:

```sh
cub installer upload \
  --work-dir .tmp/prometheus-server-only \
  --space helm-prometheus-server-only
```

The catalog proof records:

```text
regular Helm objects: 6
cub installer objects: 7, including Namespace
semantic object match: 6/6
```

The important rule is:

```text
Helm values overlay changes rendered objects
-> make or reuse a cub installer base variant
```

Examples for Prometheus:

| Change | Route |
| --- | --- |
| Disable bundled components | `cub installer` base variant |
| Disable persistence | `cub installer` base variant |
| Add remote write | usually `cub installer` base variant |
| Change scrape config | usually `cub installer` base variant |
| Change RBAC or ingress shape | `cub installer` base variant |

## ConfigHub-Only Promotion Variant

After the reviewed Prometheus base is uploaded, a user may need a production
region variant without changing the rendered Kubernetes objects.

Example:

```text
From: prometheus/server-only-ephemeral
Create: prometheus/prod-us-east
Change only:
  target = monitoring-targets/prod-us-east
  environment label = prod
  region label = us-east
  approval gate = production-review
  observation freshness = 15m
Do not change:
  Prometheus components
  persistence
  scrape config
  RBAC
  rendered Kubernetes objects
```

The current real primitive is `cub variant create`.

The thing being varied is the uploaded ConfigHub Space:

```text
upstream space: helm-prometheus-server-only
source variant: prometheus/server-only-ephemeral
```

If the target is not in the current space, use the explicit
`<space-slug>/<target-slug>` form for `--target`.

```sh
cub variant create prod-us-east helm-prometheus-server-only \
  --environment Prod \
  --region us-east \
  --target monitoring-targets/prod-us-east \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

This clones the upstream Space and Units into a downstream Space. The new Space
gets `Variant=prod-us-east`, the cloned Units keep upstream links back to the
source Units, and ConfigHub can show the relationship as a promotion graph:

```text
Prometheus/server-only-ephemeral -> Prometheus/prod-us-east
```

The exact presentation below is a proposed UX shape for ConfigHub's component
and promotion views. It is not a claim that the product already displays this
table.

| ConfigHub object | Source base | Production variant |
| --- | --- | --- |
| Space | `helm-prometheus-server-only` | derived from `Component` and `Variant` labels, for example `prometheus-prod-us-east` |
| Component label | `Prometheus` | `Prometheus` |
| Variant label | `server-only-ephemeral` | `prod-us-east` |
| Units | same rendered object set | cloned Units |
| Promotion edge | source Unit | cloned Unit with `UpstreamUnitID` |
| Target | none or validation target | `prod-us-east` |
| Gates | source gates | production delete/destroy gates |

The proposed higher-level Creator UX should sit on top of the real
`cub variant create` primitive:

```text
Create variant
From: prometheus/server-only-ephemeral
Blueprint: Environment clone
Target variant: prod-us-east
Fill: region, environment, target, approval policy, observation freshness
Preview: same Units, same rendered object digest, labels/target/gates changed
Checks: no Helm rerender, upstream links preserved, scan warning carried forward
Create
```

The primitive exists today. The guided preview/check/receipt experience is
product porcelain that still needs implementation.

## Proposed AX Shape

An agent should receive the same scenario as structured work, not as a loose
prompt. This is a proposal for the agent-facing contract over the same
primitive:

```yaml
task: create_config_only_variant
from:
  component: Prometheus
  variant: server-only-ephemeral
  space: helm-prometheus-server-only
blueprint: environment-clone
parameters:
  variant: prod-us-east
  environment: Prod
  region: us-east
  target: monitoring-targets/prod-us-east
  approvalGate: production-review
  observationFreshness: PT15M
allowedChanges:
  - space labels
  - target assignment
  - unit delete gates
  - unit destroy gates
  - observation policy metadata
requiredChecks:
  - no-helm-rerender
  - rendered-object-digest-unchanged
  - upstream-links-preserved
  - unit-count-preserved
  - scan-warning-carried-forward
expectedReceipts:
  - clone
  - mutation
  - checks
```

The agent must route the request back to `cub installer` if the requested
change touches Prometheus components, persistence, scrape config, RBAC, ingress,
or any other rendered object field.

## Proposed FX Shape

The same Creator contract should also work as a function over one row or many
rows. This is a proposal for a fleet-oriented form:

```yaml
function: ConfigHubVariantCreator(parameters) -> ConfigHubVariant + receipts
from:
  component: Prometheus
  variant: server-only-ephemeral
  space: helm-prometheus-server-only
matrix:
  - variant: prod-us-east
    environment: Prod
    region: us-east
    target: monitoring-targets/prod-us-east
    approvalGate: production-review
    observationFreshness: PT15M
  - variant: prod-eu-west
    environment: Prod
    region: eu-west
    target: monitoring-targets/prod-eu-west
    approvalGate: production-review
    observationFreshness: PT15M
invariants:
  - rendered object digest is unchanged for every row
  - each downstream Space keeps Component=Prometheus
  - each downstream Space gets its own Variant label
  - cloned Units keep upstream links to source Units
  - failed rows do not create trusted variants
summary:
  output: fleet receipt with one result per row
```

This keeps UX, AX, and FX aligned:

```text
Human: guided Creator flow
Agent: structured task with required checks
Function: same contract mapped over a matrix
```

## Promotion After The Base Changes

Later, the source base may change. For example, a new reviewed Prometheus base
revision may update a Deployment image, ConfigMap, RBAC rule, or scan
disposition.

ConfigHub can then show:

```text
prod-us-east is behind server-only-ephemeral
upstream Unit revisions are available
local production differences are visible
production-review gate is required
```

The user reviews exact Unit diffs and promotes approved upstream revisions into
`prod-us-east`. This is different from running Helm again in production.

## Boundary

Use `cub installer` when the requested change affects the rendered object set:

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

Use ConfigHub variants when the requested change refines already-rendered
Units:

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

This keeps Helm-style customization available while making each overlay
explicit, reviewable, scannable, and provable.
