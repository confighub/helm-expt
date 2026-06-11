# Serious Charts

**UNOFFICIAL/EXPERIMENTAL**

Redis proves the model is simple to use. These charts prove it survives real
complexity. Each has a production-readiness packet that answers, on one page:
what to try first, which quirks exist, what is at render and live parity,
what is only watch or per-target, what decision is still open, the claims we
must not make yet, and the exact next test.

| Chart | Why it is the hard case | Packet |
| --- | --- | --- |
| kube-prometheus-stack | CRDs, webhooks with hook-driven cert patching, RBAC, generated facts, large fanout, image/security surface — in one install. The exemplar. | [packet](../../data/production-readiness-packets/kube-prometheus-stack/packet.md) |
| cert-manager | CRD-heavy controller with webhooks and controller-owned runtime state; the canonical "synced is not working" case. | [packet](../../data/production-readiness-packets/cert-manager/packet.md) |
| external-secrets | CRDs and webhooks plus an external system by design — the cluster alone cannot prove a provider round-trip. | [packet](../../data/production-readiness-packets/external-secrets/packet.md) |

## How to read a packet

- **Supported means scoped.** Every "supported" decision names one target
  scope; nothing broader is claimed.
- **The live-parity section is the spine.** Each line links a committed
  receipt. No receipt, no claim.
- **Watch and blocked rows are routed findings, not failures.** cert-manager
  and external-secrets carry a deliberate refusal: their rendered CRDs author
  a field Kubernetes 1.30 drops, while the same rendered CRDs preserve that
  field on the recorded Kubernetes 1.35 capability witness.
- **"Claims we must not make yet" is the most load-bearing section.** If a
  claim you need is on that list, the packet's "exact next test" says what
  would move it.

The navigation companion for each chart — bases, commands, evidence links —
is the generated [hard-chart packet set](../../data/hard-chart-production-packets/summary.md).
