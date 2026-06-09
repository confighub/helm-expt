# Live Helm-vs-ConfigHub Parity — Non-Pass Triage

This file explains the non-pass rows in
`data/live-helm-confighub-compare/summary.csv`.

Current status:

```text
pass:    15
watch:    5
blocked:  0
```

There are no current blocked rows.

A `watch` row means the live comparison ran far enough to compare regular Helm
with ConfigHub delivery, and semantic object parity passed. The remaining issue
is a target, runtime, controller-health, storage, initialization, or operating
policy condition.

## Current Watch Rows

| Rank | Chart | Base | Current reading | Next action |
| ---: | --- | --- | --- | --- |
| 3 | ingress-nginx/ingress-nginx | admission-disabled | Regular Helm and ConfigHub kubectl-apply became ready. ConfigHub OCI/Argo synced and the controller Deployment became ready, but the LoadBalancer Service has no external IP on kind, so Argo health remains `Progressing`. Semantic parity passed. | Use a target with LoadBalancer behavior, or create a separate base that uses an exposure mode suited to kind or internal-only targets. |
| 12 | hashicorp/vault | default | All paths install the same object set, but the default Vault server remains sealed and uninitialized. Semantic parity passed. | Treat initialization and unseal as an operating policy, not a recipe parity fix. |

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
