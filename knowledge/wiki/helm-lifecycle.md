---
title: Helm Lifecycle
status: current
last_reviewed: 2026-06-14
---

# Helm Lifecycle

helm-expt breaks a Helm install into visible stages. The point is not only to
render YAML. The point is to show where each decision belongs and where evidence
is collected.

The current model is:

1. Identify the chart source, version, dependencies, and capability assumptions.
2. Create a `cub installer` recipe/package with reviewed base variants.
3. Render deterministically and compare the object set with regular Helm.
4. Upload or apply the rendered objects through ConfigHub.
5. Route lifecycle behavior such as hooks, CRDs, target facts, generated values,
   and webhooks.
6. Observe live Kubernetes and GitOps outcomes where a live claim is made.
7. Operate the result with variants, diffs, scans, changesets, approvals, and
   promotion.

Render parity is the baseline. It says the installer path preserved Helm's
intended object set for recorded inputs. It does not prove that every target
cluster is suitable or that every controller is healthy.

## Authoritative Sources

- [Seven-stage Helm lifecycle](../../docs/reference/seven-stage-helm-lifecycle.md)
- [How the harness works](../../docs/user/how-the-harness-works.md)
- [Introduction to the harness](../../docs/user/introduction-to-the-harness.md)
- [Master catalog matrix](../../data/master-catalog-matrix/matrix.html)
- [Verification lanes](../../docs/user/verification-lanes.md)

