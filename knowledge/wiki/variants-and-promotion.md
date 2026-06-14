---
title: Variants And Promotion
status: current
last_reviewed: 2026-06-14
---

# Variants And Promotion

helm-expt uses two variant layers.

A base variant is a render-time install shape. If the choice changes Helm
values, object count, CRDs, generated Secrets, storage shape, HA mode, or
provider-specific manifests, it belongs in the recipe/package path and must be
rendered again.

A derived ConfigHub variant is a post-render refinement. It is created after
the base has been uploaded into ConfigHub. It is appropriate for target, region,
environment, customer labels, namespace routing, approvals, views, links,
placeholders, TransformPaths, functions, gates, and operational policy.

Promotion is ConfigHub value, not a helm-expt-only trick. Once a chart is
represented as ConfigHub Spaces and Units, server-side variant operations should
make staging, rollout, review, and promotion available for every suitable chart.

The current caution is that promotion must stay honest about object authority.
If a change needs a Helm re-render, it is not a derived-variant promotion.

## Authoritative Sources

- [Creating variants](../../docs/user/creating-variants.md)
- [Prometheus overlay and promotion example](../../docs/user/prometheus-overlay-promotion-example.md)
- [Variant promotion model](../../docs/reference/variant-promotion-model.md)
- [ConfigHub promotion mapping](../../docs/reference/confighub-promotion-mapping.md)
- [Variant promotion blocker issue #682](https://github.com/confighub/helm-expt/issues/682)
- [ConfigHub changeset blocker issue #4609](https://github.com/confighubai/confighub/issues/4609)

