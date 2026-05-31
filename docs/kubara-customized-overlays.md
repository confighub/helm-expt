# Kubara Customized Overlay Analysis

This note records the first Kubara-style managed app analysis requested by the
roadmap. It uses the checked-in `external-dns/external-dns@1.21.1` proof as the
smallest useful stand-in for a managed platform app with customer overlay
values.

It is not a full Kubara golden yet. A full golden still needs an inspected
wrapper chart, platform values, customer overlay values, render comparison, and
verification receipts.

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

That is enough to classify the missing managed-overlay work. It is not enough
to claim Kubara import support.

## Real Import Unit

For a managed Kubara app, the import unit should be:

```text
managed wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + render context
```

`cub helm install` can be the quick one-shot render path. A maintained `cub
installer` recipe/package must capture the durable import unit above.

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
