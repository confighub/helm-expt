# external-secrets/external-secrets Production-Readiness Packet

Generated. Do not edit by hand. This packet answers the reviewer questions
in one place and links the generated evidence; it makes no new claims.
Companion navigation packet: [hard-chart packet](../../../data/hard-chart-production-packets/packets/external-secrets-external-secrets.md).

## Why this chart matters

CRDs plus webhooks plus an external-system dependency by design: the chart's whole job is reconciling secrets from providers the cluster cannot prove locally.

## What should a serious user try first?

Base `default` - support decision `supported`, disposition `production-review-ready`, bounded to target scope: cub-lk-kind-vanilla; namespace=external-secrets; delivery=confighub-oci; controller=argo.

## Quirks

crds;existing-secret;extension-slots

You provide: an existing Secret for some bases (buildable — not yet run); a CRD ownership choice (crds vs no-crds base). Absorbed for you: exact rendered objects with render parity and receipts; CRD handling split into explicit bases; extension slots routed to reviewed bases.

## What is at render parity?

Lane summary: local:1/2 gitops:1/2 live-parity:1/2 two-cluster:2/2. Authoritative per-lane rows: [lane test matrix](../../../data/lane-test-matrix/summary.md).

## What is at live parity?

- two-cluster kind parity, base `default`: pass ([receipt](../../../runs/live-kind-parity/external-secrets-external-secrets-default/receipt.yaml))
- two-cluster kind parity, base `no-crds`: pass ([receipt](../../../runs/live-kind-parity/external-secrets-external-secrets-no-crds/receipt.yaml))
- local kind live e2e: pass, strict witness `-` (-)
- CRD/webhook/controller runtime lifecycle observations ([evidence](../../../data/lifecycle-observations/cert-manager-eso/summary.md))
- ConfigHub OCI default-base rehearsal: Argo synced, runtime blocked on separated webhook Secret delivery ([evidence](../../../data/runtime-gitops/receipts/external-secrets-external-secrets/default/latest.yaml))

## What is only watch, per-target, or manual?

- WATCH/BLOCK (routed): Rendered ExternalSecret CRD contains selectableFields but the live Kubernetes 1.30 API omitted the field after apply - route: capability-profile plus CRD lifecycle review ([watchlist](../../../data/live-e2e/cub-scout-watchlist.md))
- every supported claim is per-target: the decision above covers `cub-lk-kind-vanilla; namespace=external-secrets; delivery=confighub-oci; controller=argo` and nothing broader

## What production decision is still open, and why?

Keep the target-scoped evidence fresh before using this supported scope as a production-support example; create separate provider-specific bases for SecretStore and ExternalSecret use cases.

Current work item: supported-scope-evidence - [work items](../../../data/production-support-decisions/work-items.csv).

## Claims we must not make yet

- "strict rendered-object/live parity holds on Kubernetes 1.30" - same selectableFields watchlist row as cert-manager; not claimed for that profile
- "external-secrets/default is live-ready through workload-only OCI" - the 2026-06-11 rehearsal blocks because the rendered external-secrets-webhook Secret is staged under out/secrets and is not delivered through the workload OCI path
- "secrets reconcile end to end" - no receipt exercises a real external provider; live evidence covers the controller, not a provider round-trip
- "production-supported beyond the named target scope" - support is a per-scope decision
- "works on any Kubernetes" - live claims are bounded to the tested capability profile

## The exact next test

model the generated external-secrets-webhook Secret as a deliverable unit or explicit secret prerequisite, re-run the default-base Argo OCI rehearsal, then run a provider round-trip rehearsal against a disposable secrets backend plus the 1.31+ capability-profile witness.
