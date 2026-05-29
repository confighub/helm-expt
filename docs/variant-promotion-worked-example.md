# Variant Promotion Worked Example

This document gives two worked examples for promoting ConfigHub variants from
Helm-derived bases. Each example should be expressible three ways:

```text
UX: foundational user-led creation
AX: agent-based creation
FX: function-based creation
```

This is about post-render ConfigHub variant promotion. It is not chart catalog
promotion, and it is not a hidden Helm rerender. Any `cub variant create`
syntax in this document is proposed porcelain; the local `cub` CLI does not
currently expose a top-level `cub variant` command.

For the canonical mapping into ConfigHub's component/space/unit/promotion
model, see [ConfigHub Promotion Mapping Doctrine](confighub-promotion-mapping.md).
For the Kubara-style overlay analysis behind the ExternalDNS example, see
[Kubara Customized Overlay Analysis](kubara-customized-overlays.md).

## Example 1 - Redis Production Region

We start with a reviewed Redis base:

```text
chart: bitnami/redis@25.5.3
base: default
source variant: redis/default
```

The source has already been rendered, scanned, uploaded, and tested. Now we
want production variants:

```text
redis/prod-us-east
redis/prod-eu-west
```

The promotion should keep the reviewed object set stable unless the user
explicitly chooses a different recipe/package base.

### Mapping Into ConfigHub

The roadmap records a Kubara org example with this shape:

| ConfigHub object | Base | Promoted variant |
| --- | --- | --- |
| Space | `helm-redis-mapping-default` | `helm-redis-mapping-prod-us-east` |
| Component label | `Redis` | `Redis` |
| Variant label on Space | `default` | `prod-us-east` |
| Unit count | 15 | 15 |
| Promotion edge | source Unit | cloned Unit with `UpstreamUnitID` |

Observed edge:

```text
statefulset-redis-redis-master default -> prod-us-east
```

That is the ConfigHub Promotion graph:

```text
Redis/default -> Redis/prod-us-east
```

The product question is whether cloned Units should also have their Unit-level
`Variant` labels patched from `default` to `prod-us-east`. Space labels already
identify the downstream node, while Unit labels may preserve source identity
unless clone-time relabeling is explicit.

## UX: Variant Creator Artifact

```text
Variant Creator
From: redis/default
Blueprint: Promote to production
Target: prod-us-east
Fill: namespace, Redis secret reference
Preview: 14 Units, 3 changed paths, 1 link changed
Checks: pass
Create
```

The artifact asks only for the values needed to make this production variant
real.

## What The Artifact Describes

The artifact tells ConfigHub how to use its existing primitives:

| Step | Primitive | Result |
| --- | --- | --- |
| Clone reviewed source | `variant create` / bulk clone | New prod space with copied Units, links, triggers, permissions, and metadata. |
| Set identity | labels and target metadata | `Variant=prod-us-east`, environment/region labels, target selection. |
| Fill required values | placeholders, parameter Unit, TransformPaths | Namespace and Redis secret reference land in the right paths. |
| Review relationships | links, NeedsProvides, outgoing link review | Cross-Unit bindings are preserved or deliberately changed. |
| Check safety | schema checks, function checks, target facts, gates | No unresolved placeholders, facts satisfied, diff reviewed. |
| Record proof | receipts, MutationSources, scan/apply/observe receipts | The promotion is explainable and repeatable. |

## AX: Agent Task

An agent should receive a structured task, not a loose prompt:

```yaml
task: create_variant
fromSpace: helm-redis-default
blueprint: promote-to-production
parameters:
  environment: prod
  region: us-east
  namespace: redis-prod
  redisSecretRef: redis-existing-secret
requiredChecks:
  - no-unresolved-placeholders
  - target-facts-satisfied
  - unit-diff-reviewed
  - scan-pass-or-approved-exception
expectedReceipts:
  - clone
  - transformPaths
  - functionMutations
  - checks
  - approval
```

The agent experience is deterministic because the task says what to create,
what to check, and which receipts prove the result.

## FX: Function-Based Fleet Promotion

The same artifact shape should also work over a matrix:

```yaml
blueprint: redis-promote-to-production
matrix:
  - environment: prod
    region: us-east
    namespace: redis-prod-use1
    redisSecretRef: redis-existing-secret
  - environment: prod
    region: eu-west
    namespace: redis-prod-euw1
    redisSecretRef: redis-existing-secret
```

Fleet execution:

```text
map the Variant Creator artifact over the matrix
verify each result
summarize fleet receipts
promote in waves
```

## Example 2 - ExternalDNS Managed Customer Overlay

This example uses the inspected `external-dns/external-dns@1.21.1` proof as a
Kubara-style stand-in for a managed platform app. It is not a full Kubara
golden yet because there is no checked-in wrapper chart plus customer overlay
render/comparison receipt.

Inspected inputs in this repo:

| Evidence | Value |
| --- | --- |
| Source lock | `recipes/external-dns/external-dns/1.21.1/source-lock.yaml` pins `https://kubernetes-sigs.github.io/external-dns/`, chart `external-dns`, version `1.21.1`, app version `0.21.0`, and package SHA. |
| Dependency lock | `recipes/external-dns/external-dns/1.21.1/dependency-lock.yaml` records no chart dependencies. |
| Effective values | `effective-values.yaml` records chart defaults and no captured merged overlay values. |
| Rendered controller args | `--source=service`, `--source=ingress`, `--policy=upsert-only`, `--registry=txt`, `--provider=aws`. |
| Rendered image | `registry.k8s.io/external-dns/external-dns:v0.21.0`. |
| Control points | generated facts, `tpl`, extension slots, one CRD, and cluster-scoped RBAC are recorded. |

A realistic managed import unit is not just the public chart:

```text
external-dns wrapper chart
  + platform values
  + customer overlay values
  + dependency closure
  + render context
```

Promotion shape:

```text
ExternalDNS/managed-aws -> ExternalDNS/customer-acme-prod
```

Mapping into ConfigHub:

| ConfigHub object | Managed base | Customer promoted variant |
| --- | --- | --- |
| Space | `helm-external-dns-managed-aws` | `helm-external-dns-customer-acme-prod` |
| Space label `Component` | `ExternalDNS` | `ExternalDNS` |
| Space label `Variant` | `managed-aws` | `customer-acme-prod` |
| Space labels | `Provider=aws`, `Environment=Catalog` | `Provider=aws`, `Customer=acme`, `Environment=Prod`, `Region=us-east` |
| Units | Rendered wrapper/platform object set | Cloned Units with `UpstreamUnitID` back to managed base Units |
| Target | none or catalog validation target | customer production target |
| Gates | CRD/RBAC/provider review | customer approval, target facts, observation freshness |

The key product lesson is the boundary:

| Customer choice | Classification | Route |
| --- | --- | --- |
| DNS provider, sources, registry mode, TXT owner ID, domain filters | customer overlay value / base variant selection | Recipe/base render path, because these usually change container args or rendered objects. |
| DNS credential Secret or ExternalSecret reference | target fact | Recipe/base when it changes rendered env/volume shape; Variant Creator artifact when it only binds an existing rendered placeholder/reference. |
| Namespace, target, approval gates, region/customer labels | post-render ConfigHub variant field | Variant Creator artifact / proposed `cub variant create` porcelain. |
| CRD ownership and RBAC review | lifecycle policy / CRD disposition | Recipe/base proof plus promotion gates. |
| Provider account ID, hosted zone ID, IAM role ARN | target fact | Bind/check during variant creation; rerender only if those facts become Helm-rendered args/env. |

Variant Creator artifact:

```text
Variant Creator
From: external-dns/managed-aws
Blueprint: Customer production overlay
Target: customer-acme-prod
Fill: customer, region, target, credential fact, hosted zone fact
Preview: cloned Units, target/label changes, fact bindings, gates
Checks: CRD/RBAC reviewed, credential fact satisfied, observation policy set
Create
```

AX task:

```yaml
task: create_variant
fromSpace: helm-external-dns-managed-aws
blueprint: customer-production-overlay
parameters:
  customer: acme
  environment: prod
  region: us-east
  target: acme-prod/cluster
  dnsCredentialFact: external-dns-aws-credentials
  hostedZoneFact: acme-prod-public-zone
requiredChecks:
  - target-facts-satisfied
  - crd-disposition-reviewed
  - cluster-rbac-reviewed
  - unit-diff-reviewed
```

If the user changes provider, domain filters, TXT ownership behavior, sources,
or credential wiring in a way that changes rendered Deployment args/env, the
Creator should stop and route back to a maintained `cub installer` recipe/base
render.

## Promotion Rules

Use the Variant Creator artifact when the change is post-render:

```text
target
namespace
labels
links
placeholders
secret references
policy gates
approval state
observation requirements
```

Go back to the recipe/package base path when the change affects rendered
objects:

```text
CRDs on/off
generated Secret vs existing Secret
HA/storage mode
ingress/TLS shape that changes rendered objects
cloud-specific Helm values
anything requiring a new Helm render
```

The rule is simple:

```text
Promote reviewed ConfigHub variants without rerendering.
Rerender only when the install shape changes.
```

## Expected Proof

A completed promotion should leave enough evidence to answer:

```text
What did we clone?
What changed?
Which target facts were used or checked?
Which scans and gates passed?
Who approved it?
What was applied or published?
How fresh is the observation?
```

Minimum proof objects:

```text
clone receipt
unit diff / MutationSources
target-fact or preflight receipt
scan/check receipt
approval receipt
apply/publish receipt
observation receipt when live proof is required
```
