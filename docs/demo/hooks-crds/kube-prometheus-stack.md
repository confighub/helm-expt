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

For the `no-crds` preset, the platform owns the CRDs. The install must check that compatible CRDs are already present before applying the chart's custom resources.

## Run the direct example

This command creates a temporary kind cluster, runs the complete fresh-install sequence, writes a receipt, and deletes the cluster:

```bash
HELM_EXPT_ALLOW_LIVE_KPS_LIFECYCLE_PROOF=1 \
  npm run kps:lifecycle-route:run
```

The script pulls the chart archive recorded in `source-lock.yaml` and checks its SHA-256 digest before running anything. It renders 124 ordinary objects and seven Helm hook objects. The 124 ordinary objects must match the committed catalog render exactly.

It then runs the chart's own certificate creation and webhook patch Jobs. It does not replace them with a generic example. The final checks cover ten established CRDs, the `ca`, `cert`, and `key` Secret, three matching webhook CA bundles, a ready operator endpoint, a server-side dry run, six workloads, and the chart's hook cleanup policy.

Read the [plain result](../../../data/kps-lifecycle-route-proof/summary.md) or the [full receipt](../../../runs/kps-lifecycle-route-proof/receipt.yaml).

## What happens to Helm hooks

People can keep using setup jobs and other hook-like work. The important change is that the work is no longer hidden inside one Helm command.

For this chart, we record the pre-install and upgrade work as named routes. A route says what must happen, when it happens, who runs it, and which receipt supports the decision.

| Work | Argo CD | Flux | Direct apply |
| --- | --- | --- | --- |
| Install CRDs first | Planned: put CRDs in an earlier sync wave. | Planned: use an earlier Kustomization and `dependsOn`. | Proved: apply ten CRDs and wait for `Established`. |
| Prepare the webhook | Planned: use a `PreSync` Job or stage the Secret before sync. | Planned: use a prerequisite Kustomization or a follow-on Job. | Proved: run the chart's admission-create Job and wait. |
| Patch and check the webhook | Planned: use `PostSync` and health checks. | Planned: use a follow-on Kustomization and health checks. | Proved: run the chart's admission-patch Job, compare CA bundles, and check readiness. |

These are sensible alternatives to Helm's built-in hook runner. They preserve the required behavior while making the steps visible and testable.

## What ConfigHub stores

The Kube Prometheus Stack example in the live `helm-catalog` organization stores eight `LifecycleRoute` Units. Seven come from the chart's render intent. The eighth states the CRD-first rule explicitly.

Each Unit records:

- chart, version, and preset;
- the install or upgrade stage;
- the action and its executor;
- whether ConfigHub may call it automatic;
- evidence and the next evidence required;
- the equivalent Argo CD and Flux approach where one is known.

The `hook-probe-base` Space contains a smaller proof fixture. Its setup Job ran from the same OCI bundle through Argo CD, Flux, and direct apply. That one route is marked automatic because those runs produced receipts.

Kube Prometheus Stack now has a narrower direct result. Seven fresh-install route implementations are automatic inside the recorded direct script. The chart-level routes remain `automatic: false` because ConfigHub does not yet select and execute them across all delivery paths. The upgrade route, Argo CD implementation, and Flux implementation remain `not-run`.

## The apply check

The demo organization has a blocking `lifecycle-route-evidence` check. It adds an ApplyGate when a `LifecycleRoute` omits its chart, version, preset, executor, disposition, or evidence. It also blocks an automatic route unless an observed receipt supports it.

This check does not decide what a chart needs. The chart-specific preset and route records make that decision. The check prevents the recorded decision from becoming incomplete or overstated.

## What has been proved

- A direct first apply fails when a custom resource arrives before its CRD.
- Applying the CRD and waiting for it fixes that ordering problem.
- The locked chart's own admission-create and admission-patch Jobs complete in the recorded order.
- The resulting Secret, webhook CA bundles, operator endpoint, server dry-run, six workloads, and hook cleanup all pass on a fresh kind cluster.
- One OCI hook fixture ran through Argo CD, Flux, and direct apply.
- The Kube Prometheus Stack lifecycle receipt observed the CRDs, webhook support Secret, workloads, and GitOps delivery for the recorded chart version.

The evidence is in:

- [CRD ordering receipt](../../../runs/crd-ordering-gap/receipt.yaml)
- [Hook execution receipt](../../../runs/hook-execution-proof/receipt.yaml)
- [OCI delivery receipt](../../../runs/oci-hook-delivery-proof/receipt.yaml)
- [Kube Prometheus Stack direct lifecycle route receipt](../../../runs/kps-lifecycle-route-proof/receipt.yaml)
- [Kube Prometheus Stack lifecycle receipt](../../../data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml)
- [Generated route records](../../../data/hooks-crds-app/summary.md)

## What is still manual

ConfigHub does not yet select and execute every Kube Prometheus Stack route. A team still chooses the delivery mechanism and confirms that the chart version, target Kubernetes version, CRDs, and webhook behavior match the recorded plan. The direct fresh-install path is proved; the chart-specific Argo CD, Flux, and upgrade paths are not.

That is intentional. Most real Helm cases can be handled with chart-specific preset configurations and tested patterns. ConfigHub keeps those choices, evidence, and updates manageable. It does not claim that one universal hook translation is correct for every chart.

## Open the live examples

In [hub.confighub.com](https://hub.confighub.com), choose the `helm-catalog` organization:

- `route-sketch-kube-prometheus-stack` contains the chart-specific route plan.
- `hook-probe-base` contains the smaller route that has run through all three delivery paths.

Start with the single `readme` Unit in either Space, then inspect the route Units and their revision history.

The public [Kube Prometheus Stack catalog page](https://confighub.github.io/helm-expt/site/charts/prometheus-community-kube-prometheus-stack-85-3-3.html) links the ready-made configurations, package OCI, render inputs, routes, and receipts for this exact chart version.
