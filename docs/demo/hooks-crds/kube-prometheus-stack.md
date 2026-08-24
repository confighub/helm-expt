# Hooks and CRDs: Kube Prometheus Stack

Kube Prometheus Stack is a useful example of why a Helm chart needs more than rendered YAML. The chart includes ten Prometheus Operator CRDs. It also uses setup jobs to prepare and check the admission webhook certificate. Those jobs and ordering rules are part of a correct install, even though they are not ordinary workload objects.

ConfigHub does not replace the chart or pretend that every chart needs the same answer. We keep the upstream Helm chart, record the choices for this chart, and keep those choices next to the rendered objects. A team can then review the whole install and repeat it without rediscovering the same steps.

## The install order

For the `default` preset, where the package owns the CRDs:

1. Apply the CRDs.
2. Wait until Kubernetes reports that every CRD is established.
3. Prepare the admission-webhook certificate Secret.
4. Apply the ordinary Kubernetes objects.
5. Check the webhook and workloads after the apply.
6. Record the result.

The order matters. Our live CRD test showed that applying a custom resource before its CRD is established fails on a new cluster. Applying the CRD first, waiting, and then applying the custom resource works.

The `no-crds` render leaves CRDs out of the chart object set. The installer package still carries the ten checked CRDs as a separate prerequisite. Its direct script keeps compatible CRDs that are already present, or applies the packaged copies on a new cluster, then waits before applying the workload.

## Run the direct example

These commands test both catalog bases. Each creates a temporary kind cluster, runs the complete fresh-install sequence, writes a receipt, and deletes the cluster:

```bash
HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF=1 \
  npm run kps:lifecycle-route:run -- --base default

HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF=1 \
  npm run kps:lifecycle-route:run -- --base no-crds
```

The script starts from the local `cub installer` package. That package was generated from the chart archive and digest recorded in `source-lock.yaml`. The default base produces 124 chart objects; the no-crds base produces 114. Each object set must match its committed catalog render exactly. The package also carries seven lifecycle objects taken from the locked chart hooks.

It then runs the chart's own certificate creation and webhook patch Jobs. It
does not replace them with a generic example. The final checks cover ten
established CRDs, the `ca`, `cert`, and `key` Secret, and three matching webhook
CA bundles. They also check a ready operator endpoint, a server-side dry run,
six workloads, and the chart's hook cleanup policy.

Read the [plain result](../../../data/kps-lifecycle-route-proof/summary.md), the [default receipt](../../../runs/kps-lifecycle-route-proof/receipt.yaml), or the [no-crds receipt](../../../runs/kps-lifecycle-route-proof/no-crds-receipt.yaml). The [anonymous package proof](../../../data/kps-public-package-proof/summary.md) separately checks that the published package can be pulled without a ConfigHub or registry login and matches the committed package files.

## What happens to Helm hooks

People can keep using setup jobs and other hook-like work. The important change is that the work is no longer hidden inside one Helm command.

For this chart, we record the pre-install and upgrade work as named routes. A route says what must happen, when it happens, who runs it, and which receipt supports the decision.

| Work | Argo CD | Flux | Direct apply |
| --- | --- | --- | --- |
| Install CRDs first | Proved for `no-crds`: an earlier OCI stage uses Argo CD sync waves. | Proved for `no-crds`: the CRD Kustomization runs first and the next stage uses `dependsOn`. | Proved: apply ten CRDs and wait for `Established`. |
| Prepare the webhook | Proved for `no-crds`: the certificate Job runs before the workload stage. | Proved for `no-crds`: the certificate Kustomization completes before the workload Kustomization. | Proved: run the chart's admission-create Job and wait. |
| Patch and check the webhook | Proved for `no-crds`: the patch Job runs after the workload stage, followed by runtime checks. | Proved for `no-crds`: the final Kustomization runs after the workload, followed by runtime checks. | Proved: run the chart's admission-patch Job, compare CA bundles, and check readiness. |
| Upgrade 85.3.3 to 86.1.0 | Proved for `no-crds`: switch to the second staged OCI digest and rerun all four stages. | Proved for `no-crds`: switch the OCI source to the second digest and rerun the ordered Kustomizations. | Not run by the direct proof. |
| Replace completed setup Jobs | Proved before upgrade: both old Jobs were removed and the 86.1.0 stages created new Jobs. | Proved before upgrade: both old Jobs were removed and the 86.1.0 stages created new Jobs. | Proved after the fresh install. |

These are sensible alternatives to Helm's built-in hook runner. They preserve the required behavior while making the steps visible and testable.

## What ConfigHub stores

The maintained ConfigHub example now retains `kps-no-crds-upgrade-base` and
`kps-no-crds-upgrade-staging`. The base contains the checked 85.3.3 objects.
The staging variant contains the checked 86.1.0 objects plus one README and one
non-deployable lifecycle route record. Approval gates protect the deployable
Units.

The live promotion proof published an exact release OCI for each version and
let Argo CD reconcile both releases. Before publication it checked that the
candidate still contained the intended `monitoring` and `kube-system`
namespaces, that the target-owned Secrets came from the checked chart render,
and that server-side apply was selected for the large CRDs. It then checked the
ten CRDs, two replacement setup Jobs, webhook certificate handoff, six
workloads, the operator endpoint, and Kubernetes admission.

Read the [ConfigHub promotion result](../../../data/kps-confighub-lifecycle-promotion/summary.md),
the [promotion review](../../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/promotion-review.yaml),
or the [destination route](../../../examples/promotions/kube-prometheus-stack-85-3-3-to-86-1-0-no-crds/lifecycle-route.yaml).

The repository generates eight route records for each Kube Prometheus Stack base. Seven fresh-install steps have live direct receipts. The `no-crds` route also records the 85.3.3 to 86.1.0 upgrade through Argo CD and Flux. Direct apply has not run that upgrade.

Each Unit records:

- chart, version, and preset;
- the install or upgrade stage;
- the action and its executor;
- whether ConfigHub may call it automatic;
- evidence and the next evidence required;
- the equivalent Argo CD and Flux approach where one is known.

The live `helm-catalog` organization also contains a smaller `hook-probe-base` proof fixture. Its setup Job ran from the same OCI bundle through Argo CD, Flux, and direct apply.

Kube Prometheus Stack now has both direct and controller results. Seven fresh-install steps run inside the recorded direct script. For the `no-crds` base, Argo CD and Flux each installed the 85.3.3 staged OCI, then moved to the 86.1.0 staged OCI on separate clusters. The receipt records the exact digests, the four ordered stages, the replacement of both completed setup Jobs, and the runtime checks after upgrade.

The chart-level routes remain `automatic: false` because ConfigHub does not yet select this chart-specific route for a user. Once selected, the recorded implementation is repeatable.

## The apply check

The demo organization has a blocking `lifecycle-route-evidence` check. It adds an ApplyGate when a `LifecycleRoute` omits its chart, version, preset, executor, disposition, or evidence. It also blocks an automatic route unless an observed receipt supports it.

This check does not decide what a chart needs. The chart-specific preset and route records make that decision. The check prevents the recorded decision from becoming incomplete or overstated.

## What has been proved

- A direct first apply fails when a custom resource arrives before its CRD.
- Applying the CRD and waiting for it fixes that ordering problem.
- The locked chart's own admission-create and admission-patch Jobs complete in the recorded order.
- The resulting Secret, webhook CA bundles, operator endpoint, server dry-run, six workloads, and hook cleanup all pass on a fresh kind cluster.
- One OCI hook fixture ran through Argo CD, Flux, and direct apply.
- Both Kube Prometheus Stack catalog bases completed the CRD, certificate, webhook patch, workload, and cleanup sequence through direct apply.
- The Kube Prometheus Stack `no-crds` base completed the CRD, certificate, workload, webhook patch, and runtime sequence through Argo CD and Flux from the same OCI digest.
- Argo CD and Flux upgraded `no-crds` from 85.3.3 to 86.1.0, replaced both completed setup Jobs, and passed the same runtime checks after the upgrade.
- ConfigHub retained the 85.3.3 base and 86.1.0 staging variant, approved the deployable Units, published both exact release OCI digests, and delivered both through Argo CD while preserving the source namespaces.
- The receipt does not claim rollback, long-running soak, automatic ConfigHub route selection, or automatic post-success removal of every temporary hook resource.

The evidence is in:

- [CRD ordering receipt](../../../runs/crd-ordering-gap/receipt.yaml)
- [Hook execution receipt](../../../runs/hook-execution-proof/receipt.yaml)
- [OCI delivery receipt](../../../runs/oci-hook-delivery-proof/receipt.yaml)
- [Kube Prometheus Stack direct lifecycle route receipt](../../../runs/kps-lifecycle-route-proof/receipt.yaml)
- [Kube Prometheus Stack no-crds lifecycle route receipt](../../../runs/kps-lifecycle-route-proof/no-crds-receipt.yaml)
- [Kube Prometheus Stack Argo CD and Flux lifecycle receipt](../../../runs/kps-gitops-lifecycle-proof/receipt.yaml)
- [Kube Prometheus Stack ConfigHub promotion receipt](../../../runs/kps-confighub-lifecycle-promotion/receipt.yaml)
- [Anonymous public package proof](../../../data/kps-public-package-proof/summary.md)
- [Kube Prometheus Stack lifecycle receipt](../../../data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml)
- [Generated route records](../../../data/hooks-crds-app/summary.md)

## What is still manual

ConfigHub does not yet select the Kube Prometheus Stack route automatically. A person or automation still chooses the delivery mechanism and confirms that the chart version, target Kubernetes version, CRDs, and webhook behavior match the recorded plan. Direct apply has fresh-install evidence. Argo CD and Flux have fresh-install and 85.3.3 to 86.1.0 upgrade evidence for `no-crds`. The ConfigHub proof covers the retained base, staging candidate, approval gates, release OCI, and Argo CD delivery for this exact pair.

The controller run removed completed setup Jobs before replacing them. It did not test rollback, a long soak, or automatic post-success removal of every temporary hook resource.

That is intentional. Most real Helm cases can be handled with chart-specific preset configurations and tested patterns. ConfigHub keeps those choices, evidence, and updates manageable. It does not claim that one universal hook translation is correct for every chart.

## Open the live examples

In [hub.confighub.com](https://hub.confighub.com), choose the `helm-catalog` organization:

- `route-sketch-kube-prometheus-stack` contains the chart-specific route plan.
- `hook-probe-base` contains the smaller route that has run through all three delivery paths.

Start with the single `readme` Unit in either Space, then inspect the route Units and their revision history.

The public [Kube Prometheus Stack catalog page](https://confighub.github.io/helm-expt/site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html) links the ready-made configurations, package OCI, render inputs, routes, and receipts for this exact chart version.
