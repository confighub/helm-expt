# external-secrets/external-secrets Production-Readiness Packet

Generated. Do not edit by hand. This packet answers the reviewer questions
in one place and links the generated evidence; it makes no new claims.
Companion navigation packet: [hard-chart packet](../../../data/hard-chart-production-packets/packets/external-secrets-external-secrets.md).

## Why this chart matters

CRDs plus webhooks plus an external-system dependency by design: the chart's whole job is reconciling secrets from providers the cluster cannot prove locally.

## What should a serious user try first?

Base `default` - support decision `draft`, disposition `production-review-ready`, bounded to target scope: cub-lk-kind-vanilla; namespace=external-secrets; delivery=confighub-oci; controller=argo.

Support decision evidence: `fresh-target-evidence-passed-with-prestaged-secret-prerequisite` ([decision](../../../data/production-support-decisions/external-secrets-external-secrets/support-decision.yaml)).

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
- ConfigHub OCI default-base rehearsal with separated webhook Secret pre-staged: Argo synced and runtime became healthy ([evidence](../../../data/runtime-gitops/receipts/external-secrets-external-secrets/default-prestaged-secret/latest.yaml))
- ConfigHub OCI default-base rehearsal with fake-provider SecretStore and ExternalSecret round trip ([evidence](../../../data/runtime-gitops/receipts/external-secrets-external-secrets/default-fake-provider-roundtrip/latest.yaml))

## What is only watch, per-target, or manual?

- WATCH/BLOCK (routed): Rendered ExternalSecret CRD contains selectableFields but the live Kubernetes 1.30 API omitted the field after apply - route: capability-profile plus CRD lifecycle review ([watchlist](../../../data/live-e2e/cub-scout-watchlist.md))
- no final production support is claimed yet: the draft scope is `cub-lk-kind-vanilla; namespace=external-secrets; delivery=confighub-oci; controller=argo` and must be closed before support is claimed

## What production decision is still open, and why?

The support decision is `draft`; live evidence is `fresh-target-evidence-passed-with-prestaged-secret-prerequisite`.

Required before final support:

- Run a Kubernetes 1.31+ capability-profile witness, or create a profile-specific base, before claiming selectableFields compatibility.

Next action: Run a Kubernetes 1.31+ capability-profile witness, or create a profile-specific base, before final production support.

## Claims we must not make yet

- "strict rendered-object/live parity holds on Kubernetes 1.30" - same selectableFields watchlist row as cert-manager; not claimed for that profile
- "external-secrets/default is live-ready through workload-only OCI" - the workload-only rehearsal blocks; the passing rehearsal requires the separated external-secrets-webhook Secret to be staged as an explicit prerequisite
- "production providers are proven" - the provider round-trip receipt uses the disposable fake provider; AWS, Vault, Kubernetes, GCP, Azure, and provider credential behavior still need separate evidence
- "production-supported beyond the named target scope" - support is a per-scope decision
- "works on any Kubernetes" - live claims are bounded to the tested capability profile

## The exact next test

run the 1.31+ capability-profile witness, or commit a profile-specific base that does not claim selectableFields compatibility on targets that drop it.
