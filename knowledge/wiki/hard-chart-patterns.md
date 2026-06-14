---
title: Hard Chart Patterns
status: current
last_reviewed: 2026-06-14
---

# Hard Chart Patterns

The hard charts are where the model earns trust.

Common patterns include:

- CRDs that need lifecycle decisions and upgrade review.
- Webhooks that need certificates, readiness, and post-apply observation.
- Hooks that need routing rather than silent YAML treatment.
- Target facts such as existing Secrets, storage classes, APIs, and node shape.
- Generated runtime state that must be observed, not pre-rendered.
- Large applications where sync, apply, workload readiness, and controller
  aggregate health can diverge.

Kube-prometheus-stack is the serious-chart exemplar. Consul demonstrates target
shape and controller-health residue. Cert-manager and External Secrets
demonstrate CRDs, webhooks, and controller-populated fields.

These examples should stay visible because skeptical Helm users will test the
model on exactly these cases.

## Authoritative Sources

- [Serious charts](../../docs/user/serious-charts.md)
- [Kube-prometheus-stack serious chart review](../../docs/reference/kube-prometheus-stack-serious-chart-review.md)
- [GitOps health residue](../../data/gitops-health-residue/summary.md)
- [Target prerequisites](../../docs/user/target-prerequisites.md)
- [Why synced is not working](../../docs/user/why-synced-is-not-working.md)

