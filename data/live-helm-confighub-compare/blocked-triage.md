# Live Helm-vs-ConfigHub Parity — Non-Pass Triage

This file explains the non-pass rows in
`data/live-helm-confighub-compare/summary.csv`.

Current status:

```text
pass:    83
watch:    1
blocked:  0
```

There are no current blocked rows in the selected live Helm-vs-ConfigHub parity
lane. The remaining non-pass row is a `watch` row: the lane reached semantic
comparison and parity passed, but a controller-health condition still needs
review.

## Current Blocked Rows

| Rank | Chart | Base | Current reading | Next action |
| ---: | --- | --- | --- | --- |
| — | — | — | No current blocked rows. | — |

A `watch` row means the live comparison ran far enough to compare regular Helm
with ConfigHub delivery, and semantic object parity passed. The remaining issue
is a target, runtime, controller-health, storage, initialization, or operating
policy condition.

## Current Watch Rows

| Rank | Chart | Base | Current reading | Next action |
| ---: | --- | --- | --- | --- |
| 20 | hashicorp/consul | secure-mesh-existing-secrets | Regular Helm and ConfigHub kubectl-apply became ready. ConfigHub OCI/Argo synced, workloads converged, and semantic parity passed. Argo aggregate health remained `Progressing`. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |

## Recently Resolved Rows

Several rows that were previously blocked by local rig or semantic-normalization
issues now pass:

- Ingress NGINX now passes after the live rig gained a LoadBalancer target path
  that does not depend on host-level privilege.
- External Secrets reached full comparison and now passes after lifecycle
  observation work clarified webhook/cert-controller behavior.
- Loki now passes after the live comparator applies the same ConfigMap
  serialization normalization recorded in the chart proof.
- Longhorn now passes after rerun on the hardened live rig.
- Consul default control plane now passes after namespace-reference, StatefulSet
  defaulting, UDP protocol, and embedded JSON ConfigMap comparisons were
  normalized.

## Rerun Standard

Treat a rerun result as product evidence only when it reaches at least one
ConfigHub delivery leg and records semantic comparison. Rows that fail before
that point should be classified as local rig residue, not chart evidence.
