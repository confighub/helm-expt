# Variant Promotion Model

**UNOFFICIAL/EXPERIMENTAL**

This document brings together the promotion work in this repo: ConfigHub
variant creation, server-side promotion, the proposed Creator UX, agent tasks,
and fleet execution.

The short model is:

```text
cub installer creates reviewed base Spaces.
cub variant create creates downstream ConfigHub variants from those Spaces.
cub variant promote carries later reviewed base changes into those downstream variants.
ConfigHub changesets, approvals, apply/publish, GitOps, and observations control rollout.
```

Promotion is not a helm-expt-only feature. It is ConfigHub server value that
becomes available once a Helm-derived base has been uploaded as ConfigHub Units
with stable component, variant, and upstream-link metadata.

## Three Different Promotions

The word promotion is used in three places. Keep them separate.

| Promotion kind | Meaning | Example |
| --- | --- | --- |
| Catalog promotion | Decide a chart/base belongs in the supported catalog. | Redis becomes catalog-supported after review. |
| Server-side variant promotion | Move reviewed upstream Unit changes into downstream ConfigHub variant Spaces. | `Prometheus/server-only-ephemeral` changes, then `prod-us-east` catches up. |
| Rollout promotion | Apply or publish the approved downstream desired state to a target. | Prod Argo CD/Flux reconciles the approved OCI artifact. |

This doc is about the second kind: server-side ConfigHub variant promotion. It
depends on the first kind and feeds the third.

## The Flow

```text
1. Render and review a base with cub installer.
2. Upload the reviewed base to ConfigHub as the upstream Space.
3. Create downstream Spaces with cub variant create.
4. Refresh the base later by rerendering and reviewing the upstream Space.
5. Preview downstream catch-up with cub variant promote --dry-run.
6. Promote through a changeset and approval path.
7. Apply or publish the approved downstream variant.
8. Observe the target and record freshness.
```

This is not a hidden Helm upgrade. If the requested change requires Helm to
rerender objects, it belongs in step 1 as a new or refreshed base. Server-side
promotion only moves reviewed ConfigHub Unit changes through the downstream
variant graph.

## Boundary Rule

Use the `cub installer` base path when the change affects Helm rendering:

- component enablement or disablement;
- CRDs on/off;
- HA, storage, ingress, TLS, RBAC, webhook, or topology shape;
- generated Secret versus existing Secret when references differ;
- values files, wrapper charts, platform overlays, or customer overlays that
  change rendered Kubernetes objects;
- any hook, lifecycle, dependency, or capability choice that changes the
  rendered object set.

Use derived ConfigHub variants and promotion when the reviewed object set can
be refined after render:

- environment, region, customer, target, and namespace fields exposed by the
  base;
- labels, annotations, links, views, gates, and ownership;
- approved TransformPaths or function mutations;
- target fact bindings over existing placeholders or references;
- observation policy and freshness expectations;
- promotion of later reviewed upstream Unit changes.

If a derived variant request crosses the boundary, route back to `cub
installer`. Do not hide a Helm rerender inside a post-render promotion.

## Current Evidence

The generated promotion status is the authoritative current surface:

```text
data/variant-promotion/summary.md
data/variant-promotion/status.csv
data/master-catalog-matrix/matrix.html
```

Current state as of this document:

```text
top-20 primary rows with server-side promotion receipts: 20
matrix status for those rows: watch
tracking issue: #682
```

The receipts show useful mechanics across all primary top-20 chart families:

- upstream Unit update is detected;
- upstream proof-only Unit add is detected;
- downstream Space exists from `cub variant create`;
- `cub variant promote --dry-run -o mutations` previews changes;
- fallback `cub variant promote --change-desc ...` catches downstream Units up;
- changed downstream Units catch up;
- added upstream Units clone into the downstream variant.

They remain `watch`, not full `proven`, because the changeset-bound form still
fails and requires a no-changeset fallback. That is tracked in
[#682](https://github.com/confighub/helm-expt/issues/682). A row should become
full `proven` only after the changeset-bound path passes for that chart/base.

## UX Surface

The user should see a short workflow, not the internal proof ladder:

```text
Promote reviewed base change
From: Prometheus/server-only-ephemeral
To: prod-us-east
Preview: changed Units, added Units, protected local fields
Checks: install shape preserved, upstream links intact, gates pass
Approve
Promote
Apply or publish
Observe
```

The UI should make three decisions visible:

- what changed upstream;
- what the downstream variant owns locally and should not receive from
  upstream;
- whether the promotion is ready to approve, blocked, or only watch-grade.

Receipts remain available in details and audit views. They should not be the
first thing the user has to understand.

## AX Surface

An assistant should receive a structured task with clear checks:

```yaml
task: promote_variant
component: Prometheus
baseVariant: server-only-ephemeral
sourceSpace: helm-prometheus-server-only
downstreamSpace: Prometheus-prod-us-east
requiredChecks:
  - no-hidden-helm-rerender
  - upstream-links-intact
  - changed-units-previewed
  - added-units-previewed
  - local-field-ownership-preserved
  - changeset-created
  - approval-required
  - observation-required-after-apply
expectedReceipts:
  - promotion-preview
  - changeset
  - promotion-apply
  - observation
```

If the assistant needs a different object set, it must create or refresh a base
with `cub installer` first. If it needs only a downstream environment, target,
or policy refinement, it uses `cub variant create` and ConfigHub primitives.

## Fleet Surface

Fleet promotion is the same operation mapped over many downstream variants:

```yaml
source:
  component: Prometheus
  variant: server-only-ephemeral
waves:
  - name: staging
    variants: [staging-us-east, staging-eu-west]
  - name: production-wave-1
    variants: [prod-us-east]
  - name: production-wave-2
    variants: [prod-eu-west]
checks:
  - preview-each-variant
  - preserve-local-ownership
  - approve-each-wave
  - observe-after-apply
```

This is the functional or fleet surface of the same model. It should not invent
a second mechanism for batch operations.

## Product Gaps

The current repo has enough evidence to show the model is working, but not
enough to claim production-complete promotion for every row.

| Gap | Why it matters | Tracking |
| --- | --- | --- |
| Changeset-bound promotion fails and falls back | Production promotion should flow through changesets and approvals. | [#682](https://github.com/confighub/helm-expt/issues/682) |
| Local field ownership needs broader exercise | Downstream variants may intentionally own fields differently from upstream. | Use `cub unit set-predicates` and managed-field work in future receipts. |
| Deletion semantics need explicit examples | Removing upstream Units must be safe and reviewable. | Add deletion promotion receipts before claiming broad deletion support. |
| UX/AX/fleet surfaces are still partly proposals | Users should not have to assemble commands from reference docs. | Creator and promotion UI/CLI work. |
| Top-100 rows need promotion receipts | Top-20 primary rows are covered; most top-100 rows are still `todo`. | `data/variant-promotion/summary.md` |

The likely fix for #682 is in ConfigHub, not in each Helm recipe: make Unit
bulk-create changeset-aware, then have `cub variant promote` pass the same
changeset into the add-new-units phase that it already passes into the
upgrade-existing-units phase. The regression test should promote a downstream
variant with one changed upstream Unit and one newly added upstream Unit under
the same changeset.

## Related Material

- [Creating Variants](../user/creating-variants.md)
- [Prometheus Promotion Example](../user/prometheus-overlay-promotion-example.md)
- [ConfigHub Promotion Mapping Doctrine](./confighub-promotion-mapping.md)
- [Variant Promotion Worked Example](./variant-promotion-worked-example.md)
- [Variant Creator Reference](./variant-creation-artifact.md)
- [Variant Creator Verification](./variant-creator-verification.md)
- [Current promotion status](../../data/variant-promotion/summary.md)
