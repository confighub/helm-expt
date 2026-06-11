# jetstack/cert-manager Production-Readiness Packet

Generated. Do not edit by hand. This packet answers the reviewer questions
in one place and links the generated evidence; it makes no new claims.
Companion navigation packet: [hard-chart packet](../../../data/hard-chart-production-packets/packets/jetstack-cert-manager.md).

## Why this chart matters

CRD-heavy controller with webhooks, CA injection, and controller-owned runtime state; the canonical case where 'synced' and 'working' diverge.

## What should a serious user try first?

Base `crds-enabled` - support decision `supported`, disposition `production-review-ready`, bounded to target scope: cub-lk-kind-vanilla; namespace=cert-manager; delivery=confighub-oci; controller=argo.

Support decision evidence: `fresh-target-evidence-passed` ([decision](../../../data/production-support-decisions/jetstack-cert-manager/support-decision.yaml)).

## Quirks

extension-slots

You provide: nothing beyond a cluster and namespace. Absorbed for you: exact rendered objects with render parity and receipts; extension slots routed to reviewed bases.

## What is at render parity?

Lane summary: local:1/2 gitops:1/2 live-parity:1/2 two-cluster:1/2. Authoritative per-lane rows: [outcome coverage](../../../data/outcome-coverage/summary.md).

## What is at live parity?

- two-cluster kind parity, base `crds-enabled`: pass ([receipt](../../../runs/live-kind-parity/jetstack-cert-manager-crds-enabled/receipt.yaml))
- two-cluster kind parity, base `default`: blocked ([receipt](../../../runs/live-kind-parity/jetstack-cert-manager-default/receipt.yaml))
- local kind live e2e: pass, strict witness `-` (-)
- CRD/webhook/controller runtime lifecycle observations ([evidence](../../../data/lifecycle-observations/cert-manager-eso/summary.md))
- SelectableFields capability-profile witness on kind Kubernetes 1.35 ([evidence](../../../data/capability-profile-witnesses/selectablefields/receipts/jetstack-cert-manager-crds-enabled-kind-1.35.yaml))

## What is only watch, per-target, or manual?

- WATCH/BLOCK (routed): Rendered CRDs contain selectableFields but the live Kubernetes 1.30 API omitted the field after apply - route: capability-profile plus CRD lifecycle review ([watchlist](../../../data/live-e2e/cub-scout-watchlist.md))
- every supported claim is per-target: the decision above covers `cub-lk-kind-vanilla; namespace=cert-manager; delivery=confighub-oci; controller=argo` and nothing broader

## What production support work remains?

The target-scoped support decision is `supported`. Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate issuer, certificate, provider, or hardened resource bases for real customer certificate workloads.

Current work item: supported-scope-evidence - [work items](../../../data/production-support-decisions/work-items.csv).

## Claims we must not make yet

- "strict rendered-object/live parity holds on Kubernetes 1.30" - the strict witness BLOCKs: rendered CRDs author selectableFields, which the 1.30 API drops; routed on the watchlist, parity for that profile is deliberately not claimed
- "production-supported beyond the named target scope" - support is a per-scope decision
- "works on any Kubernetes" - live claims are bounded to the tested capability profile

## The exact next test

keep the target-scoped evidence fresh; create separate issuer, certificate, provider, or hardened resource bases before claiming real customer certificate workflows.
