# Product Support Tiers For Helm Scenarios

This document explains which Helm scenarios this project is trying to support
at which product tier. Names may change; the boundary matters more than the
labels.

## Tier 0 - Low-Friction Standalone Try

This is the desired first user experience: closer to `helm install redis` than
to "sign up for a platform."

Supported shape:

```text
public chart catalog
public signed OCI artifact or package
lightweight authenticated or rate-limited public pull
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

Low-friction does **not** mean an unauthenticated public firehose. If ConfigHub
provides the OCI gateway, it should protect the service from spam, scraping,
and DDoS:

```text
read-only public tokens or lightweight login
rate limits and abuse controls
short-lived credentials where practical
artifact digests pinned in the public catalog
signatures on published artifacts
client-side signature verification
no private repo, org, or production-state upload required
```

The user should not need to create an org, upload private data, or onboard to
ConfigHub to try Redis. The gateway can still require authenticated
pulls, quotas, and signatures.

Practical access model:

| Step | UX | Control |
| --- | --- | --- |
| Browse catalog | anonymous web access | CDN/WAF/IP rate limits, crawler controls |
| Copy first command | anonymous session cookie is OK for web UX | cookie only protects the website, not OCI clients |
| Pull public OCI artifact | read-only public pull token, device-code login, or email one-time-link token | registry auth, quotas, revocation, abuse detection |
| Verify artifact | client checks digest/signature from public catalog | signature and digest proof, no trust in transport alone |
| Use Argo CD / Flux | user creates a Kubernetes pull Secret from the read-only token | controller can authenticate to OCI without a browser cookie |
| Create private variants or production records | full ConfigHub account/org | managed variants, approvals, receipts, scans, audit, support |

Why not only a browser cookie? It helps the web flow, but OCI clients and
GitOps controllers usually need registry credentials or a Kubernetes pull
Secret. So the low-friction path can start anonymously in the browser, but the
actual artifact pull should use a scoped, read-only credential when ConfigHub is
paying for the gateway.

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

Full product signup begins to make sense when the user wants ConfigHub to store
and govern private variants, receipts, target assignments, approvals, scans,
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

Hook boundary:

```text
public catalog can inventory hooks and record disposition
public catalog can support test-only hooks as explicit checks
public catalog must block or defer unsafe lifecycle hooks until there is a
hook/lifecycle receipt and observation strategy
```

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
guided variant creation for fill values, review, checks, and receipts
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

This tier is where guided variant creation belongs:

```text
Human: guided create flow
AI assistant: structured create_variant task
Bulk job: one creation pattern over many rows
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

This is also the likely home for managed hook and lifecycle work:

```text
private hook inventory
install/upgrade/delete side-effect classification
safe Argo/GitOps lifecycle translation where possible
preflight and target-fact requirements
upgrade/rollback receipts
fresh observations after lifecycle execution
```

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
guided variant creation for preview/checks/receipts
ConfigHub functions and gates for policy
observation receipts for runtime truth
```

Commercial lifecycle intelligence can sit here as a higher-level offer over the
same artifacts:

```text
chart/version inventory
known-risk and breaking-change analysis
annotated rendered-object diffs
upgrade project templates
agent-ready remediation tasks
policy and misconfiguration findings
freshness-aware runtime observations
audit-ready receipts
```

The key ConfigHub distinction is that the intelligence attaches to exact
rendered variants and receipts, not only to abstract chart names or release
notes.

## Decision Rule

```text
If it changes rendered Kubernetes objects, it is an installer recipe/base input.
If it refines already-rendered ConfigHub Units, it is a ConfigHub variant input.
If it depends on live cluster state, it needs target facts, preflight, or
observation receipts.
If it is private/customer-specific, it belongs in ConfigHub managed tiers, not
the public catalog proof alone.
```
