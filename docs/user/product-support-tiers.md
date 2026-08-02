# Product Support Tiers For Helm Scenarios

**UNOFFICIAL/EXPERIMENTAL**

This document explains which Helm scenarios this project is trying to support
at which product tier. Names may change; the boundary matters more than the
labels.

## Three Product Questions

Keep these questions separate when explaining the project:

| Question | Product lane | What users should expect |
| --- | --- | --- |
| How many useful configs are free or out of the box? | public catalog bases | a curated set of reviewed, Helm-equivalent install shapes for common chart needs |
| What can users customize in ConfigHub after choosing a reviewed base? | derived ConfigHub variants | environment, region, customer, target, gates, facts, links, observations, and approved post-render field fills |
| How do users adopt apps they already run? | existing app adoption | Argo CD, Flux, KRM YAML, rendered manifests, and live resources are discovered/imported before any recipe rewrite. |
| Which cases are more complex and potentially commercial? | managed import, GitOps import, private overlays, and stacks | private values, wrapper charts, fleet variants, full stacks, old-version support, production receipts, and patch SLAs |

The catalog should be generous enough that users can try useful non-default
cases without starting from scratch. ConfigHub customization should then make
those reviewed bases fit real environments. Managed import and stack workflows
are the higher-complexity lane for private or production-specific cases.

## Claim Boundary

The public catalog proves public chart behavior for declared chart versions,
base variants, inputs, and test lanes. It does not automatically prove a
customer's private chart, private values file, wrapper chart, cluster policy,
GitOps controller, secret system, or production target.

Use these claims separately:

| Claim | Meaning |
| --- | --- |
| Public catalog claim | The declared public chart/base has recorded render parity, scans, receipts, and any committed live evidence. |
| User install claim | The user ran the same package/base and produced matching receipts in their work directory, ConfigHub space, or cluster. |
| Managed import claim | A private chart, wrapper chart, overlay, or customer values set was imported, checked, and receipted as its own artifact. |
| Production claim | The selected variant was approved, delivered, observed, and kept fresh under the user's production policy. |

This boundary matters commercially. The free/public lane builds trust and
reduces first-use friction. Private values, wrapper charts, fleet variants,
production approvals, live observations, old-version patches, and support SLAs
belong in managed or commercial lanes.

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

The user does not need to create an org, upload private data, or onboard to
ConfigHub to try Redis. Public catalog package pulls are anonymous today.
Private catalogs, managed support, or higher-abuse-risk gateways can still add
authentication, quotas, and signatures.

Practical access model:

| Step | UX | Control |
| --- | --- | --- |
| Browse catalog | anonymous web access | CDN/WAF/IP rate limits, crawler controls |
| Copy first command | anonymous session cookie is OK for web UX | cookie only protects the website, not OCI clients |
| Pull public OCI artifact | anonymous `cub installer setup --pull oci://...` | Artifact Registry grants public read; writes remain private |
| Verify artifact | client checks digest/signature from public catalog | signature and digest proof, no trust in transport alone |
| Use Argo CD / Flux | public catalog bundles can be pulled without a registry Secret; private bundles still need one | public-read for catalog, explicit credentials for private delivery |
| Create private variants or production records | full ConfigHub account/org | managed variants, approvals, receipts, scans, audit, support |

Why not only a browser cookie? It helps the web flow, but OCI clients and
GitOps controllers do not use the browser session. For the public catalog, the
registry itself is public-read. For private packages, use a scoped registry
credential or Kubernetes pull Secret.

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

The open question for this tier is coverage: how many free out-of-box bases are
enough to feel useful without turning the public catalog into an unmanaged
matrix. The target is not every possible values combination. It is the smallest
reviewed set that covers common defaults, high-value non-defaults, and routes
remaining changes cleanly into derived variants or managed import.

This tier should be easy to try without a private customer repository. It can
prove the catalog recipe, package, rendered objects, and local live checks.

Production OCI support also needs image digest evidence. A public or local
proof can record mutable image tags, but a production-supported base should use
digest-resolved images or carry an explicit image override/proof receipt. The
current review queue is:

[Image Digest Workdown](../../data/image-digest-workdown/summary.md)

Extension slots are also a support boundary. A public catalog base can leave
raw manifest, `tpl`, sidecar, config block, or add-on slots empty or explicitly
reviewed. When a user populates one of those slots, the result is a new install
shape and should be reviewed as a new `cub installer` base or managed import,
with render parity, scans, gates, and receipts.

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

This is the lane for "take this base and extend it with x and y." It should
cover many real customer and environment differences without requiring a new
Helm render, as long as the source base exposes the allowed paths and the
checks can prove that the install shape stayed reviewed.

## Tier 2A - Existing App Adoption

This tier covers teams that already run apps through Argo CD, Flux, KRM YAML,
Kustomize output, rendered manifests, or live Kubernetes resources.

Supported shape:

```text
existing app source
-> discover/import into ConfigHub
-> preserve source, target, labels, links, and controller ownership
-> scan, diff, observe, and classify
-> decide whether to keep imported, create a derived variant, or graduate to a recipe
```

Good examples:

```text
Argo CD Application already syncing a Helm chart
Flux HelmRelease with customer values
Flux Kustomization over KRM YAML
rendered manifests in Git
live resources imported for review
```

Current entry points:

| Existing source | Entry point |
| --- | --- |
| Argo CD Application | Read the Application and rendered objects, then use `cub variant upload`. |
| Flux HelmRelease | Read the HelmRelease and rendered objects, then use `cub variant upload`. |
| Flux Kustomization | Read the Kustomization and rendered objects, then use `cub variant upload`. |
| KRM YAML or rendered Kubernetes resources | `cub variant upload <files-or-oci-ref>` |

The first promise is visibility without disruption:

```text
Show me the app.
Preserve where it came from.
Do not change delivery until I choose to.
Tell me what ConfigHub can prove.
```

If the app should become a reusable catalog entry, graduate it into the
`cub installer` recipe/package path. If the app only needs target, labels,
gates, links, observations, or safe post-render fills, use derived ConfigHub
variants after import.

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
the reviewed base is uploaded, derived ConfigHub variants can refine targets,
labels, links, gates, facts, placeholders, TransformPaths, function-selected
fields, and already-rendered editable fields.

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
If it changes Helm render inputs, object shape, object count, or lifecycle
semantics, it is an installer recipe/base input.
If it refines already-rendered ConfigHub Units through approved post-render
fields, facts, links, targets, gates, functions, or checks, it is a derived
ConfigHub variant input.
If it depends on live cluster state, it needs target facts, preflight, or
observation receipts.
If it is private/customer-specific, it belongs in ConfigHub managed tiers, not
the public catalog proof alone.
```
