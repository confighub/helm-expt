# Kubara Customized Overlay Analysis

This note records the first Kubara-style managed app analysis requested by the
roadmap. It uses the checked-in `external-dns/external-dns@1.21.1` proof as the
smallest useful stand-in for a managed platform app with customer overlay
values.

The first generated golden now lives at:

```text
data/managed-overlay-goldens/external-dns-customer-acme-prod/
```

It includes a wrapper chart, platform values, customer overlay values,
classification, preview, and receipts. It is a boundary and classification
golden, not a claim that all Kubara applications are imported or
production-ready.

This is intentionally beyond the public catalog proof. A Kubara-style case
needs ConfigHub Server because it has private/customer inputs, target facts,
approvals, gates, and downstream managed variants. It is a candidate for
managed or commercial product workflows, not just a free static catalog entry.

The current work order for this lane is recorded in:

```text
data/latest-top20-refresh/variant-work-orders.yaml
```

## Why ExternalDNS

`external-dns` is a good first case because provider configuration, DNS
credentials, TXT registry behavior, CRDs, and cluster RBAC are not incidental
details. They are the managed release recipe.

Public chart proof in this repo:

| Evidence | File |
| --- | --- |
| Source lock | `recipes/external-dns/external-dns/1.21.1/source-lock.yaml` |
| Dependency lock | `recipes/external-dns/external-dns/1.21.1/dependency-lock.yaml` |
| Effective values | `recipes/external-dns/external-dns/1.21.1/effective-values.yaml` |
| Value model | `recipes/external-dns/external-dns/1.21.1/value-model.yaml` |
| Control points | `recipes/external-dns/external-dns/1.21.1/control-points.yaml` |
| Rendered objects | `recipes/external-dns/external-dns/1.21.1/revisions/default/r001/rendered/release-objects.yaml` |
| Installer package | `packages/external-dns/external-dns/1.21.1` |

## Inspected Inputs

The checked-in public-chart proof records:

| Input | Observed value |
| --- | --- |
| Chart source | `https://kubernetes-sigs.github.io/external-dns/`, chart `external-dns`, version `1.21.1`, app version `0.21.0` |
| Dependency closure | no chart dependencies |
| Effective values | chart defaults; no captured merged customer overlay |
| Rendered image | `registry.k8s.io/external-dns/external-dns:v0.21.0` |
| Rendered args | `--source=service`, `--source=ingress`, `--policy=upsert-only`, `--registry=txt`, `--provider=aws` |
| Rendered support objects | ServiceAccount, ClusterRole, ClusterRoleBinding, Service, Deployment, and one CRD |
| Recorded control points | generated-facts, `tpl`, extension slots, CRDs, cluster RBAC |

That is enough to classify the managed-overlay work and generate the first
golden. It is not enough to claim broad Kubara import support.

## Real Import Unit

For a managed Kubara app, the import unit should be:

```text
managed wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + render context
```

`cub helm template` can be the quick local render path. `cub helm install` can
be the quick one-shot ConfigHub load path. A maintained `cub installer`
recipe/package must capture the durable import unit above.

## Overlay Decision Rule

Kubara customer choices must be split before rendering:

```text
render-time choice
  -> cub installer recipe/base

post-render choice
  -> cub variant create plus Creator contract
```

Render-time examples:

```text
provider mode
domain filters rendered into args/env
credential wiring that changes env/volumes
CRDs/RBAC/webhooks
storage/HA/topology
Kustomize overlays that add/remove/change resources materially
```

Post-render examples:

```text
target
environment/customer/region labels
approval gates
observation policy
existing Secret reference when the field already exists
namespace when represented as an editable Unit field
```

The Creator must not hide a Helm rerender. If the customer overlay changes
rendered objects, the workflow goes back to the maintained `cub installer`
recipe/base path.

## Value Classification

| Value or decision | Classification | Product route |
| --- | --- | --- |
| Public chart URL, chart version, package digest | source lock | `cub installer` recipe/package |
| Wrapper chart URL/version/digest | source lock | `cub installer` recipe/package |
| Chart dependencies and wrapper dependencies | dependency lock | `cub installer` recipe/package |
| Platform defaults such as sources, policy, registry mode, default provider | managed default | `cub installer` recipe/base |
| Customer domain filters, TXT owner ID, provider account, IAM role, hosted zone | customer overlay value / target fact | Recipe/base if rendered into args/env; Creator contract only if binding an existing placeholder or Unit field |
| DNS credential Secret or ExternalSecret reference | target fact | Recipe/base if it changes rendered env/volume shape; Creator contract if the rendered object already has a bindable reference |
| CRD ownership | lifecycle policy / CRD disposition | Recipe/base proof plus promotion gate |
| ClusterRole and ClusterRoleBinding acceptance | lifecycle policy / RBAC disposition | Scan/gate and approval receipt |
| Namespace, target, customer, environment, region labels | post-render ConfigHub variant field | `cub variant create` plus Creator contract over ConfigHub primitives |
| Observation freshness policy | post-render ConfigHub variant field | Variant Creator gate/receipt |

## Promotion Shape

A Kubara-style managed ExternalDNS app should appear in ConfigHub like this:

```text
ExternalDNS/managed-aws -> ExternalDNS/customer-acme-prod
```

| ConfigHub concept | Managed base | Customer variant |
| --- | --- | --- |
| Space | `helm-external-dns-managed-aws` | `helm-external-dns-customer-acme-prod` |
| `Component` label | `ExternalDNS` | `ExternalDNS` |
| `Variant` label | `managed-aws` | `customer-acme-prod` |
| Other labels | `Provider=aws`, `Environment=Catalog` | `Provider=aws`, `Customer=acme`, `Environment=Prod`, `Region=us-east` |
| Units | reviewed rendered wrapper/platform object set | cloned Units with `UpstreamUnitID` back to managed base |
| Target | none or validation target | customer production target |
| Gates | CRD/RBAC/provider review | customer approval, target facts, observation freshness |

Promotion should not rerender Helm. If a customer choice changes rendered
Deployment args, env, volumes, CRDs, RBAC, or object count, the workflow goes
back to the maintained `cub installer` recipe/base path.

## Product Suggestion

Observed pain:

```text
Real managed Helm apps are wrapper chart + platform defaults + customer
overlays, not a single public chart render.
```

Evidence in `helm-expt`:

```text
external-dns records source/dependency locks, rendered AWS provider args,
generated/tpl/extension-slot signals, one CRD, and cluster RBAC review needs.
```

Existing ConfigHub/cub primitive:

```text
source locks, dependency locks, installer bases, target facts, Unit labels,
Unit.UpstreamUnitID, gates, scans, functions, receipts
```

Smallest product gap:

```text
An import/recipe contract that names wrapper source, platform values, customer
overlay values, target facts, and render context before upload, then exposes a
safe post-render Creator contract for customer spaces.
```

Suggested UX:

```text
Import managed ExternalDNS.
Review wrapper chart, platform values, customer overlay values, and target facts.
Render and upload managed-aws base.
Create customer-acme-prod variant from managed-aws.
Preview ConfigHub diffs, fact bindings, CRD/RBAC gates, and target assignment.
```

Acceptance check:

```text
external-dns wrapper + overlay render produces a digest-bound package/base;
customer variant creation changes only allowed post-render fields; ConfigHub
Promotion shows ExternalDNS/managed-aws -> ExternalDNS/customer-acme-prod with
upstream links and receipts.
```

What not to build yet:

```text
Do not claim all Kubara apps are imported.
Do not invent cub installer import helm as an available command.
Do not create a batch of standalone per-chart promotion-map files.
Do not hide customer overlay rerenders inside post-render promotion.
```

## Planned Kubara Golden

The first useful golden proves the managed-overlay boundary for one app. It
does not prove every Kubara app.

Candidate:

```text
external-dns managed AWS
```

Current generated path:

```text
data/managed-overlay-goldens/external-dns-customer-acme-prod/
```

Required inputs:

```text
wrapper chart source and digest
public chart source and digest
dependency closure
platform values
one customer overlay values file
capability profile
target fact requirements for DNS credentials / hosted zone / IAM role
CRD and RBAC disposition
render context
```

Required artifacts:

```text
wrapper-chart/Chart.yaml
values/platform-values.yaml
values/customer-acme-prod-values.yaml
overlay-classification.yaml
creator-contract.yaml
preview.yaml
overlay classification receipt
render boundary receipt
check receipt
```

Acceptance:

```text
The managed import unit is explicit.
Every customer overlay value is classified as render-time, post-render, target
fact, generated fact, or lifecycle policy.
Render-time values route to cub installer.
Post-render operating values route to the Creator contract.
Receipts explain the boundary and required checks.
```

Later live proof should add a digest-bound managed-aws package base, ConfigHub
upload receipt, variant clone/mutation/check receipts, and observation
freshness evidence.

Product tier:

```text
Tier 3 - Managed Overlay Import
```

Rationale:

```text
This requires private inputs, customer facts, ConfigHub Server state, gates,
variant creation, and operational receipts. It is more complex than the public
catalog proof and should be treated as a managed/commercial product lane until
the experience is stable enough to package more broadly.
```
