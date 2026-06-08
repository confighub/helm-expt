# Live Helm-vs-ConfigHub Parity — Blocked Row Triage

This file explains the `blocked` rows in
`data/live-helm-confighub-compare/summary.csv`.

The first triage pass, from receipts observed on 2026-06-05, showed that the
blocked rows were mostly local provisioning failures. Most did not reach Helm
install, ConfigHub apply, OCI delivery, or semantic comparison.

After the hardened live rig was added, the 2026-06-08 rerun of External Secrets
did reach the full comparison. It changed that row from an infrastructure
failure into a real live-parity finding. The current summary therefore contains
both kinds of blocked row:

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
| 7 | prometheus-community/kube-prometheus-stack | `infra: rig bootstrap (argocd) not ready` | The previous run failed while bootstrapping the local Argo CD rig. |
| 10 | grafana/loki | `infra: kind create failed` | The previous run failed during local kind cluster creation. |
| 11 | longhorn/longhorn | `infra: kind create failed` | The previous run failed during local kind cluster creation. |
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

## Rerun Order

Rerun the remaining infrastructure-blocked rows one at a time on a clean host:

1. `loki`
2. `longhorn`
3. `kube-prometheus-stack`
4. `vault`
5. `consul`
6. `argo-cd`

Treat a rerun result as product evidence only if it reaches at least one
ConfigHub delivery leg and records a semantic comparison. Until then, keep the
row classified as local rig residue.
