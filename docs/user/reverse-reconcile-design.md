# Reverse-Reconcile Design (move 2, frontier)

**UNOFFICIAL / EXPERIMENTAL: this is a design, not a shipped capability.**

This page makes the second Generative GitOps scenario concrete:

> *An authorized live change flows back into desired state instead of being
> clobbered as drift.*

Forward reconcile (desired → live) is what GitOps and ConfigHub already do.
The **reverse** direction is the frontier: when something changes the live
system, such as an operator minting a value, an SRE scaling to absorb load, or an agent
fixing an incident, that change is either (a) **unauthorized drift**, to be
reverted on the next apply, or (b) an **authorized change** that should be
accepted back into desired state so it *sticks*. Today helm-expt only
**witnesses** the live value (cub-scout). This design specifies what it takes
to *accept* it back, safely.

The point of writing it as a receipt + policy + checker (not prose) is the
same as the rest of the repo: a reverse-reconcile must be **provable, bounded,
and authorized**, or it is just drift with better marketing.

## The round-trip

```
desired (Unit)  --forward apply-->  live cluster
      ^                                  |
      |                          (1) live change happens
      |                                  v
      |                          (2) observe it (cub-scout)
      |                                  |
      |                          (3) authority gate: is this actor
      |                              allowed to accept this field here?
      |                                  |
      |                          (4) bounds: did ONLY authorized fields change?
      |                                  |
      +----(5) write-back as a new ------+
            attributed revision
                  |
            (6) round-trip witness: desired-after == observed,
                no residual drift, the fix stuck
```

Steps 2 and 6 use machinery that exists (cub-scout observation, object diff).
Steps 3 and 4 are policy plus a diff check, specified here and machine-checked.
**Step 5 is the missing product piece:** an authorized `cub` reverse-reconcile
command that writes the accepted field back into the Unit as a new revision.

## The receipt: `ReverseReconcileReceipt`

One receipt records a single reverse-reconcile of one or more fields on one
Unit. Its required properties (all enforced by
`scripts/verify-reverse-reconcile.mjs`):

| Property | Meaning | Failure if… |
| --- | --- | --- |
| `trigger.class` | `authorized-live-change` vs `unauthorized-drift` | missing or unsupported value |
| `authority.decision = allow` | the actor's role may accept these fields here, per the policy | a changed field is not in the role's `mayAccept` for this environment |
| `bounds.changedFields` ⊆ authorized | the reverse change touched **only** authorized fields | any unauthorized field changed (`bounds.unauthorizedFieldsChanged` non-empty) |
| `writeBack.desiredValueAfter` == `observation.liveValue` | desired was updated to the observed value | mismatch |
| `roundTrip.result = closed` | after write-back, desired matches observed; no residual drift | `residualDrift` non-empty |
| `writeBack.provenance` | who / when / operation / authority / intent | missing attribution |
| `notClaimed` | honest scope markers present | missing |

See [`data/reverse-reconcile/authority-policy.yaml`](../../data/reverse-reconcile/authority-policy.yaml)
and the worked example
[`data/reverse-reconcile/examples/redis-prod-us-east-replica-incident.yaml`](../../data/reverse-reconcile/examples/redis-prod-us-east-replica-incident.yaml).

## The authority model

A `ReverseReconcilePolicy` is **default-deny**: every observed live change is
unauthorized drift unless a rule explicitly permits that role to accept that
value path, on that object, in that environment. This is what separates
"accepting a fix" from "blindly trusting the cluster." Authority is per-field
and per-environment, not a global on/off. It applies the same bounded-authority
principle used for forward changes to the reverse direction.

## Worked example (redis replica incident)

The anchor reuses the redis fleet (the live `helm-redis-mapping-prod-us-east`
promotion). The scenario: under a load spike, an SRE scales
`redis-replicas` from 3 to 4 **live**. Without reverse-reconcile, the next
forward apply reverts it. With it:

1. cub-scout observes `spec.replicas = 4` (desired was 3).
2. The policy says `platform-sre` may accept `replica.replicaCount` on the
   redis replicas StatefulSet in prod → **allow**.
3. Bounds: only `spec.replicas` changed → within authorized scope.
4. Write-back: desired `replica.replicaCount` 3 → 4, new revision, attributed
   to the SRE with intent "incident-fix".
5. Round-trip: desired-after (4) == observed (4) → the fix stuck.

The receipt records all of this and is machine-checked for consistency. The
live observation is a **fixture** and the write-back is **manual** today; the
honest gap is step 5's automated, gated `cub` command.

## What Is Specified Today Vs The Frontier

| Piece | Status |
| --- | --- |
| Observe the live value | Existing cub-scout capability, represented here by a fixture |
| Authority policy (default-deny, per-field/per-env) | Specified and machine-checked in this design |
| Bounds check (only authorized fields changed) | Specified and machine-checked in this design |
| Round-trip witness (no residual drift) | Specified and machine-checked in this design |
| The receipt schema + honesty markers | Specified and verified for the example receipt |
| The gated write-back into the Unit (step 5) | Frontier: needs a `cub` reverse-reconcile command and authority enforcement in ConfigHub |

## Acceptance: When Move 2 Is Proven

- A real `cub` command performs the authorized write-back: observed live field
  → new desired revision, gated by the policy, refusing unauthorized fields.
- The example runs end-to-end on a live cluster (real cub-scout observation,
  real write-back), and a forward re-apply afterwards does **not** revert the
  accepted field (the fix demonstrably stuck).
- `status` flips from `design-example` to `proven`.

Tracked as move 2 in
[issue #974](https://github.com/confighub/helm-expt/issues/974).
