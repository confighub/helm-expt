# NVIDIA fleet catalog requirements

This document records the fleet requirements supplied for the catalog work. It
is a requirements baseline, not a capability or support claim. A requirement is
accepted only when the repository has the corresponding receipt, verifier, and
reviewable implementation evidence.

The fleet-first desired/live and four-confidence scope is tracked in [#1582](https://github.com/confighub/helm-expt/issues/1582).
The AICR v0.21.0 delta is tracked in [#1860](https://github.com/confighub/helm-expt/issues/1860).
The retained v0.20.0 chain is tracked in [#1608](https://github.com/confighub/helm-expt/issues/1608),
and the separate real H100/NIM serving and rollback proof is tracked in [#1581](https://github.com/confighub/helm-expt/issues/1581).

## Six source requirements

### 1. Fleet-level placement

The value lands at fleet-view level, rather than per-workload. The fleet is
defined through CRDs. The first deliverable is a declarative source of record
reconciled against the live fleet. Obtain the representative fleet CRD layout
and reconcile desired release identity with observations, freshness and drift.

### 2. Provenance and the constrained package shape

Only vetted, signed-off packages may be installed. Everything applied comes
from releases with provenance, verified signatures and immutable OCI digests.
Harden approximately 99% of settings at package build time; expose the minimum
necessary nonzero settings at install time. Ship a separate restrictive schema
for that install-time surface, bound to the approved release. Reject unknown
inputs and changes to protected build-time settings, then validate the resolved
configuration and target prerequisites. The 99/1 split expresses the design
intent; it is not a literal field-count quota.

### 3. Lifecycle classification and authority

Every participating entry carries its class, owner, cadence and blast radius.
These determine who may promote it and how.

| Class | Owner | Cadence and deployment authority |
| --- | --- | --- |
| User workloads | App users | Approximately weekly; users deploy their authorized workloads. |
| System services, such as DNS and Prometheus | Cluster operator | Approximately weekly; operator controls advancement. |
| System configuration, such as GPU/network operators | Cluster system deployment | User explicitly opts in; cadence is unspecified. |

Record actual accountable roles and opt-in decisions; do not infer permission
from the presence of a package or a successful render.

### 4. Declarative upgrades

An imperative install-once bootstrap may be acceptable. Upgrades must reconcile
to desired state, with explicit prerequisites and interruption/retry behavior.
A scripted sequence that only works if it completes uninterrupted does not
satisfy the requirement. Record controller ownership, stop/hold behavior and
how partially converged targets resume.

### 5. Four separate confidence questions

| Confidence | Evidence needed |
| --- | --- |
| Safe to deploy | Provenance, well-formedness, policy scans, preflight against the target and relevant end-to-end checks; state the oracle's limits. |
| Deploys without disruption | Correct prerequisites and ordering, plus observed service/workload continuity against agreed tolerances. Ordering or successful apply alone is insufficient. |
| Rollback is safe | Identify stateful resources and irreversible migrations, gate destructive changes, and establish data preservation or the required restore procedure. |
| Rollback will succeed | Retain an accessible prior known-good revision, check reversal prerequisites, and execute the reversal with functional and data checks. |

Each confidence has its own target- and revision-bound outcome and receipt.
Static evidence, upstream tests and prior observations have explicit scopes;
none constitutes a universal rollback guarantee.

### 6. Confidence is the product

Promotion mechanics are commodity. Use existing delivery/promotion mechanisms
with configurable tolerances; differentiate through the evidence that makes
advancement acceptable. The required operating scale is one package rolled to
100–1,000 clusters, with gated, stoppable rollout and explicit rollback limits.
That is a scale requirement, not a measured capability in this repository.

## Acceptance map and current boundary

| Requirement | Concrete acceptance evidence | Current position and blocker |
| --- | --- | --- |
| CRD-defined desired-source/live reconciliation | The provided representative fleet CRD schema and desired-state example are bound by a generator and offline verifier to target identity and live observations; a retained fixture demonstrates the binding. | Existing receipts and lane records provide inputs, but no fleet CRD admission and reconciliation receipt has been accepted here. Requires the representative CRD input, implementation, and an interruption-aware observation run. |
| Vetted signed digest releases | A release is approved only with an immutable digest, verified signature, provenance, and a receipt binding those facts to the exact package and schema. | AICR v0.21 generation pins release assets and checksums. This is release evidence for those entries, not fleet-wide admission or a signed fleet rollout. Registry publication and signature policy still need explicit acceptance. |
| 99% build / 1% install and restrictive install schema | Build output contains the resolved contract; a separately shipped install schema and offline rejection tests prove install-time validation. | Existing generators separate rendering from install paths, but the fleet install-schema acceptance remains open. Define the allowed inputs and rejection cases; do not invent a numeric ratio measurement. |
| Three classes, owners, cadences, opt-in | Catalog data and schema contain all fields; admission and rollout receipts show each class is selected deliberately. | No accepted fleet class schema or decision receipt is present. Owner and cadence decisions remain a product or maintainer input. |
| Declarative interruption-safe upgrades | A desired-state upgrade fixture is interrupted and resumed; receipts show no ambiguous ownership, and rollback/data safety is evidenced separately. | Static generators can define desired state, but existing receipts do not establish interruption/resume or rollback for this requested fleet scenario. Requires a bounded implementation and a live or otherwise authoritative execution receipt. |
| Four separate confidences | Answer four separate questions with separate receipts: is it safe to deploy; will it deploy without disruption (ordering alone is insufficient); is rollback safe against data loss and migration hazards; and will rollback succeed with a prior good revision and an actual reversal? | Current catalog proofs do not establish these four fleet confidence questions. Define the measures and evidence contract. |
| 100–1,000 scale | A plan specifies the load model, acceptance thresholds, and evidence format for 100–1,000 clusters. | No scale measurement is claimed. A future benchmark must be separately scheduled and recorded. |

## Entry-path acceptance

Config Workshop and Catalog must be usable from cub and installed plugins on
the command line, and from AI making API calls during a live chat session. This
three-entry-path completion is tracked in [#1861](https://github.com/confighub/helm-expt/issues/1861). All
three paths must perform the same discovery, schema/config validation,
evidence lookup, approval pause, and refusal decisions against the same exact
digest. The live-chat path requires an actually callable integration with
machine-readable results and errors, an explicit authentication scope, and a
job ID with status retrieval, approval pauses, and safe cancellation or an explicit cannot-cancel state for long operations.
The repository must not claim that a plugin exists or that a REST AICR endpoint
is the Workshop API without an integration receipt.

Acceptance requires one end-to-end transcript per entry path, each demonstrating: exact-digest
discovery, an allowed change, and a refused protected change, each including a
desired/live query. This is an implementation and integration requirement; this
document adds no runtime implementation.

## AICR v0.21 delta and retained evidence

The [v0.21.0 annotated release](https://github.com/NVIDIA/aicr/releases/tag/v0.21.0) used for the current local AICR review resolves to
commit `36f52ec9346b8ce4b6dcdb08f1d82f92c963bebe`. Existing v0.21 generated
entries and receipts should be reused by any follow-on producer work; moving
source coverage should not be counted as wholly new coverage merely because the
upstream version changed. Relevant retained evidence includes:

- `scripts/generate-aicr-from-overlay.mjs`, which pins the release asset and
  verifies its checksum;
- `examples/aicr/h100-bcm-ubuntu-training/generation-receipt.yaml` and
  `examples/aicr/a100-eks-ubuntu-training/generation-receipt.yaml`, which retain
  v0.21 config-plane generation receipts;
- `examples/aicr/a100-eks-ubuntu-training/digest-index/`, which retains v0.21
  payload digests;
- `data/aicr-version-diff/summary.md` and `data/aicr-version-diff/diff.json`,
  which preserve the v0.19/v0.20 comparison; and
- `data/aicr-v0-20-0-chain/summary.md`,
  `runs/aicr-provenance-v0-20-0/receipt.yaml`, and
  `examples/aicr/eks-h100-training-kubeflow-v0-20-0/`, which preserve the v0.20
  chain evidence.

The v0.20 chain demonstrates retained rendering, public OCI/config promotion,
and provenance work already performed for that version. It does not establish
Argo, Flux, H100 runtime, fleet interruption safety, rollback/data safety, or
100–1,000 cluster scale. The v0.21 entries likewise remain bounded by their
receipts; reuse exact matching receipts and add only missing release-delta
evidence through the producer.

## Smallest next static work

The next independently reviewable backend implementation is a fleet admission
schema and offline verifier that binds one desired source, immutable digest,
target identity, class metadata, and the four confidence names to a receipt. It
can reuse the existing AICR producer and v0.20 chain receipt shapes while
leaving runtime interruption, rollback/data safety, and scale measurements as
explicitly unfulfilled acceptance items.
