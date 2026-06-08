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
| 3 | ingress-nginx/ingress-nginx | admission-disabled | Regular Helm and ConfigHub kubectl-apply became ready. ConfigHub OCI/Argo synced, but Argo still reported `Progressing` inside the test budget. Semantic parity passed. | Inspect Argo health and ingress-controller conditions before changing the recipe. |
| 6 | argo-cd/argo-cd | default | The chart now reaches semantic comparison. ConfigHub paths still show pod readiness failures around generated/runtime Secrets and controller bootstrap conditions. Semantic parity passed. | Use a fixture that separates the test controller from the chart-installed Argo CD instance, then decide the generated-Secret policy. |
| 7 | prometheus-community/kube-prometheus-stack | default | Regular Helm became ready. ConfigHub paths installed semantically equivalent objects, but one operator pod remained `ContainerCreating` and Argo reported `Degraded`. | Inspect local capacity, CRD/webhook readiness, and operator startup before changing the recipe. |
| 12 | hashicorp/vault | default | All paths install the same object set, but the default Vault server remains sealed and uninitialized. Semantic parity passed. | Treat initialization and unseal as an operating policy, not a recipe parity fix. |
| 19 | grafana/tempo | local-persistent | All paths install the same object set, but the local persistent-volume fixture leaves the Tempo pod pending. Semantic parity passed. | Choose a storage fixture or production StorageClass policy. |

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
