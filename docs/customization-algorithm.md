# Customization Algorithm

This document defines how a Helm-user customization becomes a ConfigHub
variant, and where each piece of new information belongs.

For the full chart-to-recipe harness, including the canonical "where pieces go"
table, see [Introduction To The Harness](introduction-to-the-harness.md).

The product rule is:

```text
Do not ask users to abandon Helm chart behavior.
Capture the behavior, classify the customization, render exact objects, then
promote only digest-bound variants with receipts.
```

## Inputs

A customization request can arrive from:

- a Helm values file;
- `--set` values;
- an umbrella chart dependency choice;
- a Kustomize overlay or patch;
- an existing Secret, ConfigMap, StorageClass, IngressClass, CRD, or API;
- a cloud/provider-specific setting;
- an operator lifecycle requirement;
- a user-submitted use case not already in the catalog.

## Supported Overlay Modes

This project must support all common Helm customization inputs, but not by
flattening them into one vague "variant" bucket.

| Input style | Supported route | Proof requirement |
| --- | --- | --- |
| Helm values file or `--set` | Recipe/base variant when it changes rendered objects; ConfigHub variant only when it fills an already-rendered field | effective values digest, render diff, Helm equivalence receipt when expected |
| Umbrella chart or wrapper chart | Recipe import unit | source/dependency locks for wrapper and subcharts |
| Platform values | Managed default in the recipe/base | effective values digest and field provenance |
| Customer overlay values | Recipe/base if rendered into objects; Creator contract if binding already-rendered placeholders/fields | overlay digest, target-fact binding, or mutation receipt |
| Kustomize overlay/patch | Recipe/base overlay when it changes install shape; post-render ConfigHub mutation only for narrow editable fields | overlay digest, object diff, MutationSources |
| Post-renderer/script | Pinned function stage or reject | tool digest, function-chain receipt, diff |
| Live cluster input | target fact, preflight, or observation receipt | fact snapshot/digest and freshness |

## Algorithm

1. Start from the chart recipe.

   The recipe owns chart identity, source lock, dependency lock, value model,
   known control points, fact requirements, lifecycle policy, and allowed
   extension slots.

2. Classify the requested customization.

   ```text
   values-only
   target fact
   generated fact
   capability profile
   lifecycle / hook / CRD policy
   extension slot
   Kustomize overlay / patch
   post-renderer or script
   operate / observation requirement
   ```

3. Decide whether it belongs in the recipe or the variant.

   Recipe-level:

   ```text
   chart source
   dependency closure
   value schema and known value paths
   fact requirements
   allowed extension slots
   lifecycle policy
   forbidden or review-only mechanisms
   ```

   Variant-level:

   ```text
   chosen values
   selected components
   target fact bindings
   capability profile
   generated fact bindings
   explicit overlays
   namespace and release name
   ```

4. Render a candidate variant revision.

   The revision binds:

   ```text
   recipe digest
   effective values digest
   capability profile digest
   target/generated fact binding digest
   renderer/version/flags digest
   rendered object set digest
   ```

5. Compare against regular Helm when Helm equivalence is expected.

   Passing means:

   ```text
   regular helm template output
     == cub installer setup output
     plus allowed installer support objects
   ```

6. Scan the exact rendered objects.

   Scans run on the rendered object set, not on a guess about values.

7. Gate the revision.

   Gate decisions are:

   ```text
   allow
   warn
   block
   ```

   A warning can be acceptable for local proof but still blocked for production
   until review or observation requirements are satisfied.

8. Promote or reject the variant.

   If broadly useful, the variant can become catalog-supported. If
   organization-specific, it remains a private/local variant. If unsafe or
   ambiguous, it is blocked with a reason.

## Where Common Customizations Go

| Customization | ConfigHub Location | Notes |
| --- | --- | --- |
| Change replica count | Variant values | Re-render and diff exact workloads. |
| Use existing Secret | Variant target facts | Secret name and keys are recorded; secret material is not stored in the public proof. |
| Generate password/cert once | Generated fact binding | Generation happens before approval, then the rendered revision is immutable. |
| Enable ingress/TLS | Variant values plus target facts | TLS Secret and ingress class become explicit facts. |
| Disable CRDs | Variant lifecycle policy | Common for GitOps/controller-owned CRD installs. |
| Enable CRDs | Variant plus CRD review gate | CRD lifecycle and upgrade risk must be visible. |
| Add raw manifests | Extension slot | Allowed only when the recipe declares the slot and scan/gate checks run. |
| Use `tpl` content | Extension slot | Treated as code-like input and reviewed before promotion. |
| Add Kustomize patch | Variant overlay | Patch must be explicit, digest-bound, and included in the diff. |
| Helm hook behavior | Lifecycle policy plus hook/lifecycle receipt | Hook templates can be inventoried deterministically, but hook execution depends on the target cluster. Map to tests, preflight, lifecycle action, observation, explicit skip, or blocker. |
| Cluster lookup | Recipe fact requirement plus variant fact binding | Cluster-sourced data must not silently change the approved render. |

## Product Tier Routing

The same algorithm applies across product tiers, but the required product
surface changes.

| Scenario | Product tier | Why |
| --- | --- | --- |
| Public chart with supported base variants | Public catalog proof | The repo can publish recipe/package artifacts, receipts, and local live proof. |
| Environment or region clone from a reviewed uploaded base | ConfigHub managed variants | Needs ConfigHub Spaces, Units, upstream links, gates, and receipts. |
| Wrapper chart plus platform values plus customer overlay values | Managed overlay import | Needs private/customer inputs, render context capture, ConfigHub Server, and usually managed/commercial workflows. |
| Fleet of many customer/environment variants | Enterprise fleet operations | Needs Creator contract over a matrix, promotion waves, checks, observations, and support disposition. |

See [Product Support Tiers For Helm Scenarios](product-support-tiers.md).

## Hook Customization Rule

A request to enable, disable, replace, or rely on Helm hook behavior is not a
normal values-only customization.

Treat it as:

```text
lifecycle / hook policy
target fact or preflight requirement
execution-or-skip decision
observation requirement
```

The rendered normal object set can still be deterministic. The hook action is
not proven until a lifecycle receipt records whether it ran, was skipped, was
converted into a test/check, or was blocked.

## Confidence Labels

Each variant should carry one of these statuses:

```text
proof-grade
catalog-candidate
catalog-supported
deprecated
blocked
```

Proof-grade means the variant is mechanically proven. Catalog-supported means
it is also the recommended, simple, safe experience for Helm users.
