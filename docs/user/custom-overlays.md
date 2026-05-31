# Custom Overlay Example

This is the custom overlay case in its simplest form.

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

The overlay variant is the customer production operating context.

```text
ExternalDNS/customer-acme-prod
```

It is created from:

```text
ExternalDNS/managed-aws-acme
```

It changes only ConfigHub operating information:

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
ServiceAccount, RBAC, or CRD shape.

## User UX

The user should see something like this:

```text
Create variant
From: ExternalDNS/managed-aws-acme
For: customer-acme-prod
Change: customer, environment, region, target, observation policy
Require: hosted zone acme.example.com, Secret external-dns/external-dns-aws
Review: same ExternalDNS object set, new customer production context
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
```

Those values affect where and how the reviewed objects are operated.

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

