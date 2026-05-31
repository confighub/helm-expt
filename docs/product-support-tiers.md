# Product Support Tiers For Helm Scenarios

This document explains which Helm scenarios this project is trying to support
at which product tier. Names may change; the boundary matters more than the
labels.

## Tier 0 - No-Signup Standalone Try

This is the desired first user experience: closer to `helm install redis` than
to "sign up for a platform."

Supported shape:

```text
public chart catalog
public signed OCI artifact or package
no ConfigHub account required
user-owned Kubernetes cluster
optional Argo CD or Flux OCI sync
local proof receipts
```

Good examples:

```text
try Redis from a public signed artifact
inspect the rendered objects before apply
sync through an in-cluster OCI-capable GitOps controller
run local verification against the user's cluster
```

This tier is for first contact and trust building. It should answer:

```text
Can I try this as easily as Helm?
Can I see exactly what it will install?
Can I verify it without giving ConfigHub my private repo or production state?
```

What it should not try to absorb:

```text
private charts
private values files
server-side variant creation
team approvals
production audit history
managed patch SLAs
fleet operations
```

Account signup begins to make sense when the user wants ConfigHub to store and
govern private variants, receipts, target assignments, approvals, scans,
production history, or team/fleet workflows.

## Tier 1 - Public Catalog Proof

This is the current public `helm-expt` proof.

Supported shape:

```text
public Helm chart
known chart version
named cub installer package bases
deterministic render
Helm-equivalence proof where expected
scans, gates, receipts, and local live proof
```

Good examples:

```text
redis/default
redis/reuse-existing-secret
nginx/http-clusterip
metrics-server/default
```

This tier should be easy to try without a private customer repository. It can
prove the catalog recipe, package, rendered objects, and local live checks.

What it does not try to absorb:

```text
private wrapper charts
customer-specific values files
private Kustomize overlays
fleet creation
customer production targets
long-term patch SLAs for old chart versions
```

## Tier 2 - ConfigHub Managed Variants

This tier uses ConfigHub Server as the operating system of record for variants.

Supported shape:

```text
reviewed cub installer base
uploaded ConfigHub Units
cub variant create downstream clone/link
Creator contract for fill values, preview, checks, and receipts
ConfigHub functions, gates, approvals, changesets, and observations
```

Use this tier when the customization is post-render:

```text
environment / region / customer clone
target binding
labels and annotations
namespace when represented as an editable Unit field
existing Secret reference when the field already exists
policy gates
approval and observation requirements
```

This tier is where the Creator UX/AX/FX belongs:

```text
Human: guided Creator flow
Agent: structured create_variant task
Fleet: blueprint over a parameter matrix
```

## Tier 3 - Managed Overlay Import

This tier covers complex platform and customer cases such as Kubara-style
managed apps.

Supported shape:

```text
wrapper chart
platform values
customer overlay values
dependency closure
capability profile
target/generated fact policy
render context
digest-bound package/base
ConfigHub managed variants
```

Use this tier when customer choices affect the rendered Kubernetes object set:

```text
provider-specific Helm values
domain filters rendered into args/env
credential wiring that changes env/volumes
CRDs/RBAC/webhooks
storage, HA, ingress, TLS, or topology choices
Kustomize overlays that add/remove/change resources materially
```

These choices go through the `cub installer` recipe/package path first. After
the reviewed base is uploaded, ConfigHub variants can refine targets, labels,
links, gates, facts, and already-rendered editable fields.

This is the likely home for commercial or managed features: private chart
analysis, customer overlay import, fleet variants, old-version patch support,
custom scans, production dispositions, and operational receipts.

## Tier 4 - Enterprise Fleet And Patch Operations

This tier is not the current public proof, but it is part of the longer-term
product story.

Supported shape:

```text
many components
many customers / environments / regions
matrix-driven Creator runs
promotion waves
upgrade conflict analysis
old chart version patches
policy exceptions
fresh observation receipts
support disposition and SLA
```

This tier should still use the same primitives:

```text
cub installer for render-time truth
cub variant create for clone/link
Creator contract for preview/checks/receipts
ConfigHub functions and gates for policy
observation receipts for runtime truth
```

## Decision Rule

```text
If it changes rendered Kubernetes objects, it is an installer recipe/base input.
If it refines already-rendered ConfigHub Units, it is a ConfigHub variant input.
If it depends on live cluster state, it needs target facts, preflight, or
observation receipts.
If it is private/customer-specific, it belongs in ConfigHub managed tiers, not
the public catalog proof alone.
```
