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

It then runs the chart's own certificate creation and webhook patch Jobs. It does not replace them with a generic example. The final checks cover ten established CRDs, the `ca`, `cert`, and `key` Secret, three matching webhook CA bundles, a ready operator endpoint, a server-side dry run, six workloads, and the chart's hook cleanup policy.

Read the [plain result](../../../data/kps-lifecycle-route-proof/summary.md), the [default receipt](../../../runs/kps-lifecycle-route-proof/receipt.yaml), or the [no-crds receipt](../../../runs/kps-lifecycle-route-proof/no-crds-receipt.yaml). The [anonymous package proof](../../../data/kps-public-package-proof/summary.md) separately checks that the published package can be pulled without a ConfigHub or registry login and matches the committed package files.

## What happens to Helm hooks

People can keep using setup jobs and other hook-like work. The important change is that the work is no longer hidden inside one Helm command.

For this chart, we record the pre-install and upgrade work as named routes. A route says what must happen, when it happens, who runs it, and which receipt supports the decision.

| Work | Argo CD | Flux | Direct apply |
| --- | --- | --- | --- |
| Install CRDs first | Proved for `no-crds`: an earlier OCI stage uses Argo CD sync waves. | Proved for `no-crds`: the CRD Kustomization runs first and the next stage uses `dependsOn`. | Proved: apply ten CRDs and wait for `Established`. |
| Prepare the webhook | Proved for `no-crds`: the certificate Job runs before the workload stage. | Proved for `no-crds`: the certificate Kustomization completes before the workload Kustomization. | Proved: run the chart's admission-create Job and wait. |
| Patch and check the webhook | Proved for `no-crds`: the patch Job runs after the workload stage, followed by runtime checks. | Proved for `no-crds`: the final Kustomization runs after the workload, followed by runtime checks. | Proved: run the chart's admission-patch Job, compare CA bundles, and check readiness. |

These are sensible alternatives to Helm's built-in hook runner. They preserve the required behavior while making the steps visible and testable.

## What ConfigHub stores

The repository generates eight route records for each Kube Prometheus Stack base. Seven fresh-install steps have live direct receipts. The eighth is the untested upgrade step, which remains `not-run`.

Each Unit records:

- chart, version, and preset;
- the install or upgrade stage;
- the action and its executor;
- whether ConfigHub may call it automatic;
- evidence and the next evidence required;
- the equivalent Argo CD and Flux approach where one is known.

The live `helm-catalog` organization also contains a smaller `hook-probe-base` proof fixture. Its setup Job ran from the same OCI bundle through Argo CD, Flux, and direct apply.

Kube Prometheus Stack now has both a direct result and a controller result. Seven fresh-install steps are automatic inside the recorded direct script. For the `no-crds` base, one staged OCI then ran through Argo CD and Flux on separate clusters. Six route behaviors have controller evidence: CRD ordering, certificate preparation, workload ordering, webhook patching, target setup, and runtime checks. Helm's hook cleanup policy did not run through either controller, and the upgrade route remains `not-run`.

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
- The controller receipt does not claim Helm hook cleanup or chart-upgrade execution.

The evidence is in:

- [CRD ordering receipt](../../../runs/crd-ordering-gap/receipt.yaml)
- [Hook execution receipt](../../../runs/hook-execution-proof/receipt.yaml)
- [OCI delivery receipt](../../../runs/oci-hook-delivery-proof/receipt.yaml)
- [Kube Prometheus Stack direct lifecycle route receipt](../../../runs/kps-lifecycle-route-proof/receipt.yaml)
- [Kube Prometheus Stack no-crds lifecycle route receipt](../../../runs/kps-lifecycle-route-proof/no-crds-receipt.yaml)
- [Kube Prometheus Stack Argo CD and Flux lifecycle receipt](../../../runs/kps-gitops-lifecycle-proof/receipt.yaml)
- [Anonymous public package proof](../../../data/kps-public-package-proof/summary.md)
- [Kube Prometheus Stack lifecycle receipt](../../../data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml)
- [Generated route records](../../../data/hooks-crds-app/summary.md)

## What is still manual

ConfigHub does not yet select every Kube Prometheus Stack route. A team still chooses the delivery mechanism and confirms that the chart version, target Kubernetes version, CRDs, and webhook behavior match the recorded plan. Direct apply, Argo CD, and Flux have fresh-install evidence for the recorded paths. Hook cleanup through the controllers and the 85.3.3 to 86.1.0 upgrade do not.

That is intentional. Most real Helm cases can be handled with chart-specific preset configurations and tested patterns. ConfigHub keeps those choices, evidence, and updates manageable. It does not claim that one universal hook translation is correct for every chart.

## Open the live examples

In [hub.confighub.com](https://hub.confighub.com), choose the `helm-catalog` organization:

- `route-sketch-kube-prometheus-stack` contains the chart-specific route plan.
- `hook-probe-base` contains the smaller route that has run through all three delivery paths.

Start with the single `readme` Unit in either Space, then inspect the route Units and their revision history.

The public [Kube Prometheus Stack catalog page](https://confighub.github.io/helm-expt/site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html) links the ready-made configurations, package OCI, render inputs, routes, and receipts for this exact chart version.
