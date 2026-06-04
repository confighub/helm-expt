# UX Proposal: ExternalDNS Custom Overlay Tutorial

**UNOFFICIAL/EXPERIMENTAL**

Companion to [Tutorial Sequence](./tutorial-sequence.md).

This is a UX proposal, not a shipped GUI. It shows how a managed/customer
overlay can be split into render-time base choices and post-render Creator
choices without making the user learn that split from raw CLI steps.

## Current CLI Friction

The current explanation asks the user to classify many details:

```text
wrapper chart
platform values
customer overlay values
provider
sources
registry
domain filters
IAM role
target facts
observation freshness
variant golden verification
```

That classification matters, but it is too much vocabulary before the user
understands the desired outcome.

## Simpler Human Intent

A Creator-style flow can present:

```text
Create customer variant
From: ExternalDNS/managed-aws-acme
For: customer-acme-prod
Extend with:
  customer: acme
  environment: prod
  region: us-east
  target: prod-us-east
  observation freshness: PT15M
Require:
  hosted zone: acme.example.com
  Secret: external-dns/external-dns-aws
Review:
  same ExternalDNS install shape
  customer production context only
Status: ready when target facts are confirmed
Create
```

The base creation can be shown separately:

```text
Create managed base
From: ExternalDNS wrapper chart
Values: provider, sources, registry, domain filters, IAM role
Review: Kubernetes Deployment, RBAC, ServiceAccount, and args change
Route: installer base variant
```

## Guardrail

The important guardrail is:

```text
Values that affect Kubernetes YAML become a reviewed installer base.
Customer operating context becomes a derived ConfigHub variant.
Secret material and cloud facts stay outside the public proof.
```

For ExternalDNS, provider, sources, registry, domain filters, TXT owner ID, and
IAM role usually affect rendered args, env, annotations, or RBAC. Customer,
region, target, observation policy, and confirmed target facts can be
post-render operating context when the base allows it.

## Formal Shape

The customer variant can map to:

```yaml
kind: VariantCreatorContract
from:
  component: ExternalDNS
  variant: managed-aws-acme
create:
  variant: customer-acme-prod
extends:
  customer: acme
  environment: prod
  region: us-east
  target: prod-us-east
  observationFreshness: PT15M
requires:
  targetFacts:
    hostedZones:
      - acme.example.com
    secrets:
      - namespace: external-dns
        name: external-dns-aws
review:
  installShape: same ExternalDNS managed AWS object set
  route: derivedConfigHubVariant
checks:
  - sameRenderedObjectSet
  - allowedMutationPathsOnly
  - targetFactsAvailable
  - secretMaterialNotPublished
receipts:
  - routeClassificationReceipt
  - cloneReceipt
  - targetFactReceipt
  - observationPolicyReceipt
```

## Mapping Back To Current Primitives

```text
Creator-style intent = create customer operating context from a managed base.
Variant Creator contract = allowed customer fields, facts, checks, receipts.
cub installer = render-time overlay substrate.
cub variant create = post-render customer variant substrate.
AX/FX = same route classification and creation contract over one or many customers.
```

The product narrative should help the user say "make this managed ExternalDNS
base work for Acme production" while the system decides which pieces are base
inputs and which pieces are Creator inputs.
