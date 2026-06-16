# Target Prerequisites Before Rerun

**UNOFFICIAL/EXPERIMENTAL**

When a matrix row is `watch` or `blocked` because a **target prerequisite** is
missing — not because the catalog model is wrong — this is the bridge from "the
matrix says watch/blocked" to "what should I do before retrying?".

The per-row plan is generated in
[target-prerequisite-actions](../../data/target-prerequisite-actions/summary.md):
one **action packet** per row, each with what to stage, the inputs it needs, the
evidence to look for afterwards, and the exact rerun command. The underlying
classification is in
[target-prerequisite-workdown](../../data/target-prerequisite-workdown/summary.md);
catalog-model gaps (a different problem) are in
[model-gap-workdown](../../data/model-gap-workdown/summary.md).

## The action kinds

| Action | What you do | Who owns it |
| --- | --- | --- |
| `create-namespace` | Create the named Namespace on the target before apply. | you (user-stage) |
| `stage-secret` | Create the named Secret(s) in the target namespace before apply. | you (user-stage) |
| `install-crds` | Install the required CRDs (or use the CRD-rendering base) before apply. | you / operator (cert-manager CRDs need the cert-manager operator) |
| `provide-external-service` | Provide the upstream service/endpoint the workload connects to (e.g. a NATS endpoint), as a stack dependency or target fact. | operator |
| `provide-storage-or-topology` | Run on a target with the required storage or platform identity (e.g. AWS/EKS metadata), or use a target-scoped base. | target-policy |
| `operator-review` | A runtime/operational residue (crash loop, init/unseal, not-ready) that needs an operator decision before it can be called supported. | operator |
| `unknown-preflight` | A required Helm input value is missing; supply it, then re-render. | you (user-stage) |

## How to read a packet

1. Find your chart/base row. The `prerequisite_name` is the concrete object when
   it was extractable from the committed receipt (e.g. `Secret
   elasticsearch-master-certs`, `Namespace istio-system`), or `unknown` when it
   was not — we do not guess.
2. Do the `action_kind` using the `required_inputs`.
3. Confirm the `evidence_required` exists (the named object is present, the CRDs
   are Established, the endpoint is reachable…).
4. Run the `rerun_command`. A row whose semantic parity already passed only needs
   the prerequisite staged — the rerun should then move it to `pass`.

## What this is not

Every packet is `automatic: false`. This is a **preflight plan**, not automated
execution and not evidence that the row is fixed — the row stays `watch`/`blocked`
until a fresh receipt proves it after you stage the prerequisite. And nothing here
claims a target prerequisite is the catalog's job to supply; where it is, the
[model-gap-workdown](../../data/model-gap-workdown/summary.md) carries it instead.
