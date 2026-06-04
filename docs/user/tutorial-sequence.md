# Tutorial Sequence

**UNOFFICIAL/EXPERIMENTAL**

This page is a short show-and-tell path through the project. Each tutorial has
the same shape:

```text
what the tutorial proves
-> explanatory flow
-> commands
```

The first tutorials use Redis because it is small and familiar. The later
tutorials show promotion, custom overlays, and the GitOps/runtime proof lane.

## Tutorial 1: Redis Quick Start

This proves the basic path from a public Helm chart to ConfigHub Units.

```text
Helm chart
-> cub installer recipe/package
-> choose a base variant, e.g. redis/default
-> cub installer setup renders Kubernetes YAML
-> cub installer upload creates ConfigHub Units
```

Run it:

```sh
cub installer setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --non-interactive \
  --namespace redis

npm run verify-install:render -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --work-dir .tmp/demo/redis-default \
  --namespace redis

cub installer upload \
  --work-dir .tmp/demo/redis-default \
  --space helm-redis-default \
  --component Redis \
  --layer App \
  --environment Demo \
  --owner ConfigHubHelm \
  --variant default \
  --unit-label Component=Redis \
  --unit-label HelmChart=bitnami-redis \
  --unit-label HelmChartVersion=25.5.3 \
  --unit-label Variant=default \
  --unit-label Proof=redis-confighub-proof

npm run verify-install:confighub -- \
  --chart bitnami/redis/25.5.3 \
  --base default \
  --space helm-redis-default
```

Expected result:

```text
Redis/default renders the same Kubernetes objects as regular Helm.
ConfigHub stores the rendered objects as labeled Units.
The user can verify the render and the uploaded Units.
```

Full script: [docs/demo/redis/demo-script.md](../demo/redis/demo-script.md).

## Tutorial 2: Redis Secret Modes

This proves why some choices are base variants, not post-render edits.

```text
redis/default
  Helm renders Secret redis/redis.
  cub installer separates the Secret to out/secrets for local use.
  ConfigHub records references and proof, not hidden public secret material.

redis/reuse-existing-secret
  Helm renders no Redis Secret.
  Workloads reference redis/redis-existing-secret key redis-password.
  The existing Secret is a target fact and external requirement.
```

Run the existing-Secret path:

```sh
kubectl --context <your-context> create namespace redis \
  --dry-run=client -o yaml | kubectl --context <your-context> apply -f -

kubectl --context <your-context> -n redis create secret generic redis-existing-secret \
  --from-literal=redis-password=confighub-redis-password \
  --dry-run=client -o yaml | kubectl --context <your-context> apply -f -

cub installer setup \
  --pull packages/bitnami/redis/25.5.3 \
  --base reuse-existing-secret \
  --work-dir .tmp/demo/redis-reuse-existing-secret \
  --non-interactive \
  --namespace redis

npm run verify-install:render -- \
  --chart bitnami/redis/25.5.3 \
  --base reuse-existing-secret \
  --work-dir .tmp/demo/redis-reuse-existing-secret \
  --namespace redis
```

Optional local live check:

```sh
kubectl --context <your-context> apply -f .tmp/demo/redis-reuse-existing-secret/out/manifests

npm run verify-install:cluster -- \
  --chart bitnami/redis/25.5.3 \
  --base reuse-existing-secret \
  --context <your-context> \
  --namespace redis
```

Expected result:

```text
default and reuse-existing-secret are different base variants because Helm
renders different Kubernetes object references.
```

## Tutorial 3: Prometheus Base Variant

This proves how a values choice becomes a reviewed base variant when it changes
the rendered object set.

```text
prometheus/default
-> full chart shape

prometheus/server-only-ephemeral
-> disables bundled components and persistence
-> renders fewer Kubernetes objects
-> gets its own package base, revision, receipts, scans, and gate
```

Run the server-only base:

```sh
cub installer setup \
  --pull packages/prometheus-community/prometheus/29.8.0 \
  --base server-only-ephemeral \
  --work-dir .tmp/demo/prometheus-server-only \
  --non-interactive \
  --namespace monitoring
```

Inspect the catalog proof:

```sh
npm run prometheus:verify-proof
npm run prometheus:verify-package
```

Expected result:

```text
server-only-ephemeral is not a ConfigHub-only tweak.
It changes the rendered YAML, so it belongs in the cub installer base path.
```

Catalog page:
[recipes/prometheus-community/prometheus/29.8.0/CATALOG.md](../../recipes/prometheus-community/prometheus/29.8.0/CATALOG.md).

## Tutorial 4: Prometheus Promotion Variant

This shows the proposed product flow for creating a derived ConfigHub variant
after the reviewed base has been uploaded.

```text
Prometheus/server-only-ephemeral
-> uploaded reviewed ConfigHub Space
-> cub variant create clones that Space and its Units
-> Prometheus/prod-us-east adds target, environment, region, gates, and links
-> no Helm rerender
```

Current CLI primitive:

```sh
cub variant create prod-us-east helm-prometheus-server-only \
  --environment Prod \
  --region us-east \
  --target monitoring-targets/prod-us-east \
  --space-name-pattern 'template:{{.Labels.Component}}-{{.Labels.Variant}}' \
  --unit-delete-gate production-review \
  --unit-destroy-gate production-review
```

The user-facing Creator should make that look like:

```text
Create variant
From: Prometheus/server-only-ephemeral
For: prod-us-east
Change: target, environment, region, production gates, observation policy
Review: same Prometheus install shape
Status: ready to create
Create
```

Expected result:

```text
Promotion uses ConfigHub clone/link/label/target primitives.
It does not create a new Helm render unless the requested change alters the
Kubernetes object set.
```

Worked example:
[Prometheus Promotion Example](./prometheus-overlay-promotion-example.md).

## Tutorial 5: ExternalDNS Custom Overlay

This shows how a managed or customer overlay is routed.

```text
wrapper chart + platform values + customer overlay values
-> classify each value before render
-> render-time values go through cub installer
-> post-render operating choices go through derived ConfigHub variants
```

Example base:

```text
ExternalDNS/managed-aws-acme
```

Render-time overlay values:

```yaml
provider: aws
sources:
  - service
  - ingress
registry: txt
domainFilters:
  - acme.example.com
txtOwnerId: acme-prod-us-east
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/external-dns-acme-prod
rbac:
  create: true
```

Derived customer variant:

```text
ExternalDNS/managed-aws-acme
-> ExternalDNS/customer-acme-prod
```

Post-render operating choices:

```yaml
customer: acme
environment: prod
region: us-east
target: prod-us-east
observationFreshness: PT15M
targetFacts:
  requiredHostedZones:
    - acme.example.com
  requiredSecrets:
    - external-dns/external-dns-aws
```

Checked golden:

```sh
npm run variant-goldens:verify
```

Expected result:

```text
Customer values that affect Kubernetes YAML become a reviewed installer base.
Customer operating context becomes a derived ConfigHub variant.
Secret material stays outside the public proof.
```

Plain example:
[Custom Overlays](./custom-overlays.md).

Golden data:
[data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md](../../data/managed-overlay-goldens/external-dns-customer-acme-prod/README.md).

## Tutorial 6: GitOps And Runtime Proof

This shows the next live proof lane after local render and ConfigHub upload
proof.

```text
ConfigHub OCI artifact
-> Argo CD or Flux pulls the artifact
-> controller syncs the cluster
-> runtime observation receipt records digest, sync result, checks, and freshness
```

The current generated first wave is:

```sh
npm run runtime-gitops:wave:verify
```

Inspect it:

```text
data/runtime-gitops/summary.md
data/runtime-gitops/wave1.csv
data/runtime-gitops/receipt-index.csv
```

Expected result today:

```text
The repo identifies the first ten chart/base/controller pairs and required
receipt paths. A row is not GitOps-proven until the receipt exists.
```

## Tutorial 7: Hook Lifecycle Proof

This shows how the project treats Helm hooks.

```text
Helm hook in source chart
-> hook resources are made explicit by render/proof
-> choose a lifecycle route
-> run that route with a controller or operator action
-> commit lifecycle or observation receipt
```

Run the current hook lifecycle index:

```sh
npm run hooks:lifecycle:verify
```

Inspect it:

```text
data/hook-lifecycle/summary.md
data/hook-lifecycle/top100-hooks.csv
data/hook-lifecycle/receipt-index.csv
```

Expected result today:

```text
54 top-500 charts use Helm hooks.
5 maintained top-100 charts use Helm hooks.
0 hook lifecycle receipts are claimed yet.
```

The rule is simple: render equivalence does not prove hook execution.
Production support needs a chosen route and a lifecycle or observation receipt.

## Tutorial 8: Top-100 Status

This shows the current catalog readiness picture.

```text
top-100 recipe/package proofs
-> catalog-supported top-20
-> proof-grade next-80
-> variant richness and hard gaps
```

Run it:

```sh
npm run top100:catalog:verify
```

Read it:

```text
data/top100-catalog-analysis/summary.md
```

Current status:

```text
100/100 have recipe/package proof artifacts.
20/100 are catalog-supported for local-test.
80/100 are proof-grade but not catalog-supported.
54/100 have multiple base variants.
46/100 are default-only.
25/100 have at least one named hard gap for a recommended capability.
```

This is the clean status line for a colleague: the catalog proof machinery is
real, but production support still depends on promotion review, image digest
work, GitOps/runtime receipts, hook receipts, and per-chart gaps.
