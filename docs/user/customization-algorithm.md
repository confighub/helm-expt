# Customization Algorithm

**UNOFFICIAL/EXPERIMENTAL**

This document defines how a Helm-user customization becomes a ConfigHub
variant, and where each piece of new information belongs.

For the full chart-to-recipe workflow, including the main "where pieces go"
table, see [Introduction To The Harness](./introduction-to-the-harness.md).
For the short guide to variant creation through human, AI assistant, and bulk
flows, see
[Creating Variants](./creating-variants.md).
For a concrete chart walkthrough, see
[Prometheus Overlay And Promotion Example](./prometheus-overlay-promotion-example.md).
For wrapper charts, platform values, and customer values, see
[Custom Overlays](./custom-overlays.md).
For the delivery boundary, see
[Choosing Base Variants, Derived Variants, And Delivery Changes](./change-routing-before-oci.md).

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

| Input style | Supported route | What gets checked |
| --- | --- | --- |
| Helm values file or `--set` | Recipe/base variant when it changes rendered objects; ConfigHub variant only when it fills an already-rendered field | effective values digest, render diff, Helm equivalence receipt when expected |
| Umbrella chart or wrapper chart | Recipe import unit | source/dependency locks for wrapper and subcharts |
| Platform values | Managed default in the recipe/base | effective values digest and field provenance |
| Customer overlay values | Recipe/base if rendered into objects; ConfigHub variant if binding already-rendered placeholders/fields | overlay digest, target-fact binding, or mutation receipt |
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

   The user-facing decision should be phrased simply:

   ```text
   This changes the Kubernetes objects, so it needs a cub installer base.
   This only changes how an uploaded base is operated, so it can be a
   ConfigHub variant.
   ```

   The supporting proof can record the exact digests, paths, facts, checks, and
   receipts behind that decision.

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

9. Settle delivery prerequisites before OCI handoff.

   OCI delivery should publish the reviewed object set that Kubernetes or
   GitOps will consume. Before that handoff, the route must be explicit:

   ```text
   base variant selected
   derived ConfigHub variant selected, if needed
   target facts bound or deferred with a receipt
   generated facts bound
   scans and gates complete
   hook/CRD/lifecycle decision recorded
   approval state known
   OCI digest, signature, and access method recorded
   ```

   If a late change would mutate Kubernetes objects, it routes back to the
   `cub installer` base path. If it only changes operating context, it can be a
   derived ConfigHub variant before publication or apply.

## Where Common Customizations Go

| Customization | ConfigHub Location | Notes |
| --- | --- | --- |
| Change replica count | `cub installer` base variant | Re-render and diff exact workloads. |
| Use existing Secret | Base variant if object shape changes; derived ConfigHub variant only if the base already exposes the reference | Secret name and keys are recorded; secret material is not stored in the public proof. |
| Generate password/cert once | Generated fact binding before render | Generation happens before approval, then the rendered revision is immutable. |
| Enable ingress/TLS | Base variant plus target facts | TLS Secret and ingress class become explicit facts. |
| Disable CRDs | Base variant lifecycle policy | Common for GitOps/controller-owned CRD installs. |
| Enable CRDs | Base variant plus CRD review gate | CRD lifecycle and upgrade risk must be visible. |
| Add raw manifests | Recipe/base extension slot | Allowed only when the recipe declares the slot and scan/gate checks run. |
| Use `tpl` content | Recipe/base extension slot | Treated as code-like input and reviewed before promotion. |
| Add Kustomize patch | Base overlay when it mutates objects; ConfigHub function only for narrow approved post-render edits | Patch must be explicit, digest-bound, and included in the diff. |
| Set target/environment/region/customer | Derived ConfigHub variant | Clone reviewed Units, preserve upstream links, set operating context. |
| Set approval gates or observation policy | Derived ConfigHub variant | Must be set before the reviewed object set is delivered or applied for that target. |
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
| Fleet of many customer/environment variants | Enterprise fleet operations | Needs bulk creation, promotion waves, checks, observations, and support disposition. |

See [Product Support Tiers For Helm Scenarios](./product-support-tiers.md).

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
