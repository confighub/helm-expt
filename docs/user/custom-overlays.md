# Custom Overlay Example

**UNOFFICIAL/EXPERIMENTAL**

This is the custom overlay case in its simplest form.

## Product Lane

ExternalDNS customer overlays sit across three product lanes:

```text
1. Free/out-of-box catalog configs:
   reviewed ExternalDNS base shapes that are common enough to publish.

2. ConfigHub customization:
   customer, environment, region, target, gates, facts, and observation policy
   as derived variants over a reviewed base.

3. Managed or potentially paid complexity:
   private wrapper charts, private values, GitOps import, fleet variants, full
   stacks, production receipts, support SLAs, and old-version patch work.
```

The example below is a classification golden for that boundary. It is not a
claim that every customer overlay is free catalog material, and it is not a
live production import receipt.

## Example

```text
Component: ExternalDNS
Customer: Acme
Environment: production
Region: us-east
Target: prod-us-east
Domain: acme.example.com
```

## Base Variant

The base variant is the reviewed ExternalDNS install shape.

```text
ExternalDNS/managed-aws-acme
```

It is produced by `cub installer`.

It includes the choices that change rendered Kubernetes objects:

```yaml
chart: external-dns/external-dns@1.21.1
provider: aws
sources:
  - service
  - ingress
registry: txt
txtPrefix: kubara-
domainFilters:
  - acme.example.com
txtOwnerId: acme-prod-us-east
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/external-dns-acme-prod
rbac:
  create: true
```

These values change controller args, ServiceAccount metadata, RBAC, or object
behavior. They belong in the base because Kubernetes will receive different
YAML.

## Overlay Variant

The overlay variant is the customer production ConfigHub variant.

```text
ExternalDNS/customer-acme-prod
```

It is created from:

```text
ExternalDNS/managed-aws-acme
```

It applies customer production refinements after the reviewed base has been
uploaded:

```yaml
customer: acme
environment: prod
region: us-east
target: prod-us-east
observationFreshness: PT15M
targetFacts:
  requiredHostedZones:
    - name: acme.example.com
      provider: aws
      visibility: public
  requiredSecrets:
    - namespace: external-dns
      name: external-dns-aws
      keys:
        - credentials
```

It does not rerender Helm. It does not change the ExternalDNS Deployment,
ServiceAccount, RBAC, or CRD shape. It can still bind target facts and fill
approved existing fields when the Creator contract allows those changes and
records checks and mutation receipts.

## User UX

A future/polished [Creator flow](../reference/variant-creation-artifact.md#creator-status)
should present this as:

```text
Create variant
From: ExternalDNS/managed-aws-acme
For: customer-acme-prod
Change: customer, environment, region, target, observation policy
Require: hosted zone acme.example.com, Secret external-dns/external-dns-aws
Review: same ExternalDNS install shape, approved customer production refinements
Status: ready when target facts are confirmed
Create
```

That is the whole user story.

## When To Go Back To The Base

If Acme changes any of these, create or update a base variant:

```text
provider
sources
registry
domainFilters
txtOwnerId
IAM role annotation
RBAC
CRDs
controller args or env
```

Those values affect rendered Kubernetes objects.

If Acme changes any of these, use a derived ConfigHub variant:

```text
customer
environment
region
target
approval gates
observation freshness
required hosted zone
required external Secret reference
approved placeholder or TransformPaths fills
```

Those values refine the reviewed object set after upload without rerendering
Helm.

## Checked Example Files

The checked example data is here:

```text
data/managed-overlay-goldens/external-dns-customer-acme-prod/
```

The main files are:

```text
wrapper-chart/Chart.yaml
values/platform-values.yaml
values/customer-acme-prod-values.yaml
overlay-classification.yaml
preview.yaml
receipts/*.yaml
```
