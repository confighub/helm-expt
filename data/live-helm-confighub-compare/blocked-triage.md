# Live Helm-vs-ConfigHub Parity — Blocked Row Triage

This file explains the `blocked` rows in
`data/live-helm-confighub-compare/summary.csv`.

The first triage pass, from receipts observed on 2026-06-05, showed that the
blocked rows were mostly local provisioning failures. Most did not reach Helm
install, ConfigHub apply, OCI delivery, or semantic comparison.

After the hardened live rig was added, the 2026-06-08 rerun of External Secrets
did reach the full comparison. It changed that row from an infrastructure
failure into a real live-parity finding. The 2026-06-08 Loki rerun also reached
the full comparison and now passes after the live comparator applies the same
ConfigMap serialization normalization recorded in the chart's Helm equivalence
receipt. The 2026-06-08 Longhorn rerun also reached the full comparison and now
passes. The 2026-06-08 kube-prometheus-stack rerun reached the full comparison
and now records `watch`: semantic parity passed, but the ConfigHub paths did not
become fully runtime-ready inside the local test budget.

The current summary therefore contains these kinds of blocked row:

- `infra:` rows are local test-rig/provisioning failures that still need a clean
  rerun before product conclusions are drawn.
- `helm-runtime:` rows reached semantic parity, but the upstream Helm leg did not
  become runtime-ready inside the test budget.
- `parity:` rows reached the comparison and found a Helm-vs-ConfigHub difference
  that needs recipe or harness review.

## Current Blocked Rows

| Rank | Chart | Current reason | Current reading |
| ---: | --- | --- | --- |
| 5 | external-secrets/external-secrets | `parity: live semantic diff` | The hardened rerun reached Helm, ConfigHub apply, and ConfigHub OCI/Argo. The webhook Deployment is the reported semantic diff, and the ConfigHub apply/OCI legs left the cert-controller and webhook pods not ready. This aligns with the chart's documented webhook Secret/cert-controller control point and needs chart-specific review. |
| 6 | argo-cd/argo-cd | `infra: etcd/apiserver overload` | The previous run hit API-server/etcd pressure and CRD ownership friction before a clean parity conclusion. |
| 12 | hashicorp/vault | `infra: rig bootstrap (argocd) not ready` | The previous run failed while bootstrapping the local Argo CD rig. |
| 19 | grafana/tempo | `helm-runtime: upstream not ready (parity passed)` | Semantic parity passed; the upstream Helm release did not become ready inside the wait budget. |
| 20 | hashicorp/consul | `infra: provisioning timeout` | The previous run timed out while provisioning the local parity rig. |

## What The External Secrets Rerun Proved

The hardened rig improved the evidence quality. External Secrets no longer
fails at `kind create`; it now records:

- regular Helm installed and became ready;
- ConfigHub kubectl-apply rendered and applied the package, but runtime readiness
  remained `watch`;
- ConfigHub OCI/Argo synced, but runtime health remained `Progressing`;
- semantic comparison reported the `external-secrets-webhook` Deployment;
- cleanup completed cleanly.

This is useful product evidence. It shows that the live lane can now separate an
infrastructure failure from a chart-specific parity/runtime problem.

The chart already records the relevant control point: the rendered webhook Secret
contains metadata only, and the cert-controller populates certificate material
after apply. The next review should decide whether the ConfigHub path needs a
recipe fix, a stronger lifecycle/observation policy, or a comparator
normalization fix.

## What The Loki Rerun Proved

The Loki rerun reached all three delivery legs:

- regular Helm installed and became ready;
- ConfigHub kubectl-apply installed and became ready;
- ConfigHub OCI/Argo synced and became healthy;
- semantic comparison passed for both ConfigHub paths after applying the
  chart-declared `loki-configmap-leading-blank-line-pruned-by-kustomize`
  normalization.

The previous Loki `infra: kind create failed` row was local rig residue. The live
lane now records Loki as `pass`.

## What The Longhorn Rerun Proved

The Longhorn rerun reached all three delivery legs:

- regular Helm installed and became ready;
- ConfigHub kubectl-apply installed and became ready;
- ConfigHub OCI/Argo synced and became healthy;
- semantic comparison passed for both ConfigHub paths.

The previous Longhorn `infra: kind create failed` row was local rig residue. The
live lane now records Longhorn as `pass`.

## What The kube-prometheus-stack Rerun Proved

The kube-prometheus-stack rerun reached all three delivery legs:

- regular Helm installed and became ready;
- ConfigHub kubectl-apply installed, but one operator pod remained
  `ContainerCreating`;
- ConfigHub OCI/Argo synced, but Argo reported `Degraded`;
- semantic comparison passed for both ConfigHub paths.

The previous kube-prometheus-stack `infra: rig bootstrap (argocd) not ready` row
was local rig residue. The live lane now records kube-prometheus-stack as
`watch`, not `blocked`.

## Rerun Order

Rerun the remaining infrastructure-blocked rows one at a time on a clean host:

1. `vault`
2. `consul`
3. `argo-cd`

Treat a rerun result as product evidence only if it reaches at least one
ConfigHub delivery leg and records a semantic comparison. Until then, keep the
row classified as local rig residue.
