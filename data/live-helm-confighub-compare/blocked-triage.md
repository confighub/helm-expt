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
become fully runtime-ready inside the local test budget. The 2026-06-08 Vault
rerun also reached the full comparison and now records `watch`: semantic parity
passed, while the default Vault server remained sealed and uninitialized. The
2026-06-08 Tempo rerun reached the full comparison and now records `watch`:
semantic parity passed, while the local persistent-volume fixture left the Tempo
pod pending in all three paths. The 2026-06-08 Consul rerun reached the full
comparison and now records `watch`: regular Helm and ConfigHub kubectl-apply
became live-ready, semantic parity passed, and only the ConfigHub OCI/Argo leg
remained OutOfSync.
The 2026-06-08 External Secrets rerun now records `watch`: semantic parity
passed, while the cert-controller and webhook remained unready in the ConfigHub
paths inside the local test budget.

The current summary therefore contains these kinds of blocked row:

- `fixture:` rows reached enough of the lane to show that the test setup is not
  the right shape for the chart.

## Current Blocked Rows

| Rank | Chart | Current reason | Current reading |
| ---: | --- | --- | --- |
| 6 | argo-cd/argo-cd | `fixture: pre-existing CRDs owned by test controller` | The rerun reached the chart-specific conflict: the live rig installs Argo CD as the OCI controller, so regular Helm refuses to own the already-installed Argo CD CRDs. The ConfigHub paths render semantically equivalent objects, but the chart-installed Argo CD pods also need generated Secret handling. |

## What The External Secrets Rerun Proved

The hardened rig improved the evidence quality. External Secrets now records:

- regular Helm installed and became ready;
- ConfigHub kubectl-apply rendered and applied the package, but runtime readiness
  remained `watch`;
- ConfigHub OCI/Argo synced, but runtime health remained `Progressing`;
- semantic comparison passed for both ConfigHub paths;
- cleanup completed cleanly.

This is useful product evidence. It shows that the live lane can now separate an
infrastructure failure from a chart-specific runtime or lifecycle problem.

The chart already records the relevant control point: the rendered webhook Secret
contains metadata only, and the cert-controller populates certificate material
after apply. The next review should decide whether the ConfigHub path needs a
stronger lifecycle/observation policy or a chart-specific live fixture for
webhook certificate readiness. The current row is `watch`, not `blocked`.

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

## What The Vault Rerun Proved

The Vault rerun reached all three delivery legs:

- regular Helm installed and rendered a live manifest, but the Vault server
  remained unready because it was sealed and uninitialized;
- ConfigHub kubectl-apply installed the same object set and showed the same
  sealed-server runtime condition;
- ConfigHub OCI/Argo synced, but Argo reported `Progressing` for the same
  sealed-server condition;
- semantic comparison passed for both ConfigHub paths after normalizing
  namespace references in Kubernetes service DNS strings.

The previous Vault `infra: rig bootstrap (argocd) not ready` row was local rig
residue. The live lane now records Vault as `watch`, not `blocked`. The next
Vault work is an operating policy for initialization and unseal, not a recipe
parity fix.

## What The Tempo Rerun Proved

The Tempo rerun reached all three delivery legs:

- regular Helm rendered and installed the chart, but the Tempo StatefulSet pod
  remained pending because its PVC was not bound in the local kind fixture;
- ConfigHub kubectl-apply installed the same object set and showed the same
  pending PVC condition;
- ConfigHub OCI/Argo synced, but Argo reported `Progressing` for the same
  pending PVC condition;
- semantic comparison passed for both ConfigHub paths.

The previous Tempo `helm-runtime: upstream not ready (parity passed)` row is now
recorded more precisely as `watch`, not `blocked`. The next Tempo work is a
storage fixture or production storage-class decision, not a recipe parity fix.

## What The Consul Rerun Proved

The Consul rerun reached all three delivery legs:

- regular Helm installed and became ready;
- ConfigHub kubectl-apply installed and became ready;
- ConfigHub OCI/Argo created live-ready workloads, but Argo still reported
  `OutOfSync`;
- semantic comparison passed for both ConfigHub paths after applying the
  chart-declared command-block newline normalization.

The previous Consul `infra: provisioning timeout` row was local rig residue. The
live lane now records Consul as `watch`, not `blocked`. The next Consul work is
to inspect the OCI/Argo sync status, not to change the recipe.

## What The Argo CD Rerun Proved

The Argo CD rerun reached the chart-specific fixture problem:

- regular Helm could not install the Argo CD chart because the test rig already
  installs Argo CD CRDs for the OCI controller, and Helm refuses to import CRDs
  without its ownership metadata;
- ConfigHub kubectl-apply and ConfigHub OCI/Argo both rendered semantically
  equivalent object sets;
- the ConfigHub-applied Argo CD pods did not become ready because they referenced
  generated Secrets that were not present in the target namespace.

This is no longer an `etcd` or API-server overload row. The next Argo CD work is
a different live fixture, such as a two-cluster or phased controller setup, plus
an explicit generated-Secret policy for the chart-installed Argo CD instance.

## Rerun Order

There are no remaining rows whose current reason is only local infrastructure
provisioning.

Treat a rerun result as product evidence only if it reaches at least one
ConfigHub delivery leg and records a semantic comparison. Until then, keep the
row classified as local rig residue.
