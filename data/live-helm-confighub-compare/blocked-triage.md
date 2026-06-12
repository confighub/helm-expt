# Live Helm-vs-ConfigHub Parity — Non-Pass Triage

This file explains the non-pass rows in
`data/live-helm-confighub-compare/summary.csv`.

Current status:

```text
pass:    36
watch:    1
blocked:  1
```

The current blocked row is an infrastructure prerequisite for the
`kind-loadbalancer` target profile. It is not evidence of a Helm-vs-ConfigHub
semantic parity defect.

## Current Blocked Rows

| Rank | Chart | Base | Current reading | Next action |
| ---: | --- | --- | --- | --- |
| 3 | ingress-nginx/ingress-nginx | admission-disabled | The rerun exited before deployment because the `kind-loadbalancer` target profile uses `cloud-provider-kind`, which requested host-level privilege. | Rerun with the host privilege required by `cloud-provider-kind`, or use a proof target that does not require LoadBalancer behavior. |

A `watch` row means the live comparison ran far enough to compare regular Helm
with ConfigHub delivery, and semantic object parity passed. The remaining issue
is a target, runtime, controller-health, storage, initialization, or operating
policy condition.

## Current Watch Rows

| Rank | Chart | Base | Current reading | Next action |
| ---: | --- | --- | --- | --- |
| 3 | ingress-nginx/ingress-nginx | default | Regular Helm and ConfigHub kubectl-apply became ready. ConfigHub OCI/Argo synced, but Argo health remained `Progressing`. Semantic parity passed. | Inspect the Argo application condition and target resources; keep the recipe stable unless semantic parity starts failing. |

## Recently Resolved Rows

Several rows that were previously blocked by local rig or semantic-normalization
issues now pass:

- External Secrets reached full comparison and now passes after lifecycle
  observation work clarified webhook/cert-controller behavior.
- Loki now passes after the live comparator applies the same ConfigMap
  serialization normalization recorded in the chart proof.
- Longhorn now passes after rerun on the hardened live rig.
- Consul now passes after namespace-reference, StatefulSet defaulting, UDP
  protocol, and embedded JSON ConfigMap comparisons were normalized.

## Rerun Standard

Treat a rerun result as product evidence only when it reaches at least one
ConfigHub delivery leg and records semantic comparison. Rows that fail before
that point should be classified as local rig residue, not chart evidence.
