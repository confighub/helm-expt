# What We Refuse To Claim

**UNOFFICIAL/EXPERIMENTAL**

This project is useful only if its claims stay narrow.

The catalog does not turn every Helm chart into a production-supported install
by rendering it once. It records what was rendered, what was compared, what was
applied, what was observed, and what still needs a decision.

## The Rule

Every strict live witness `BLOCK` needs a public route:

```text
strict witness BLOCK
-> watchlist row
or
-> named normalization rule with justification
```

If the route is not clear, the row stays on the watchlist.

## Current Watchlist Examples

The current watchlist is:

[cub-scout Live Witness Watchlist](../../data/live-e2e/cub-scout-watchlist.md)

The current normalization log is:

[Live Witness Normalization Rules](../../data/live-e2e/normalization-rules.md)

### cert-manager

The `crds-enabled` base rendered CRDs with
`spec.versions[0].selectableFields`. On kind Kubernetes 1.30, the live CRDs did
not preserve that field after apply.

The workloads converged. That is useful evidence. It is not strict rendered/live
parity for that target profile.

Route:

```text
capability profile and CRD lifecycle review
```

### External Secrets

The default base hit the same Kubernetes 1.30 CRD selectable-field behavior.

The controller and webhook workloads converged. The strict witness still
blocked the rendered/live parity claim for that target profile.

Route:

```text
capability profile and CRD lifecycle review
```

### Grafana

The `static-passwords` base rendered RBAC objects with empty `rules: []`
arrays. The live RBAC objects did not preserve the authored empty-list shape in
the same way.

The Grafana workload converged. The strict witness remains blocked until this
is either accepted as a Kubernetes normalization rule or kept as a target-profile
watch item.

Route:

```text
server-normalization review for empty RBAC rules
```

## Why This Matters

A normal install command can look successful while hiding important target
behavior. This catalog should not do that.

The useful claim is:

```text
This chart, version, base, values profile, and target profile passed this lane.
```

The unacceptable claim is:

```text
This chart is verified.
```

Use [Current Proof Status](./current-proof-status.md) for the latest aggregate
view and [Live Parity](./live-parity.md) for the live lane meanings.
