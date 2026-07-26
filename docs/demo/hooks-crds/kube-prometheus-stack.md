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

## What happens to Helm hooks

People can keep using setup jobs and other hook-like work. The important change is that the work is no longer hidden inside one Helm command.

For this chart, we record the pre-install and upgrade work as named routes. A route says what must happen, when it happens, who runs it, and which receipt supports the decision.

| Work | Argo CD | Flux | Direct apply |
| --- | --- | --- | --- |
| Install CRDs first | Put CRDs in an earlier sync wave. | Use an earlier Kustomization and `dependsOn`. | Apply CRDs, wait for `Established`, then continue. |
| Prepare the webhook | Use a `PreSync` job or stage the Secret before sync. | Use a prerequisite Kustomization or a follow-on Job. | Apply the job or Secret and wait for completion. |
| Check the result | Use `PostSync` or health checks. | Use health checks or a follow-on Kustomization. | Run the recorded checks after `kubectl apply`. |

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

The `hook-probe-base` Space contains a smaller proof fixture. Its setup Job ran from the same OCI bundle through Argo CD, Flux, and direct apply. That one route is marked automatic because those runs produced receipts. The Kube Prometheus Stack routes remain `automatic: false`; their individual execution paths are not yet automated by ConfigHub.

## The apply check

The demo organization has a blocking `lifecycle-route-evidence` check. It adds an ApplyGate when a `LifecycleRoute` omits its chart, version, preset, executor, disposition, or evidence. It also blocks an automatic route unless an observed receipt supports it.

This check does not decide what a chart needs. The chart-specific preset and route records make that decision. The check prevents the recorded decision from becoming incomplete or overstated.

## What has been proved

- A direct first apply fails when a custom resource arrives before its CRD.
- Applying the CRD and waiting for it fixes that ordering problem.
- A setup Job can be made explicit and receipted.
- One OCI hook fixture ran through Argo CD, Flux, and direct apply.
- The Kube Prometheus Stack lifecycle receipt observed the CRDs, webhook support Secret, workloads, and GitOps delivery for the recorded chart version.

The evidence is in:

- [CRD ordering receipt](../../../runs/crd-ordering-gap/receipt.yaml)
- [Hook execution receipt](../../../runs/hook-execution-proof/receipt.yaml)
- [OCI delivery receipt](../../../runs/oci-hook-delivery-proof/receipt.yaml)
- [Kube Prometheus Stack lifecycle receipt](../../../data/hook-lifecycle/receipts/prometheus-community-kube-prometheus-stack/default/latest.yaml)
- [Generated route records](../../../data/hooks-crds-app/summary.md)

## What is still manual

ConfigHub does not yet execute every Kube Prometheus Stack route automatically. A team still chooses the delivery mechanism and confirms that the chart version, target Kubernetes version, CRDs, and webhook behavior match the recorded plan.

That is intentional. Most real Helm cases can be handled with chart-specific preset configurations and tested patterns. ConfigHub keeps those choices, evidence, and updates manageable. It does not claim that one universal hook translation is correct for every chart.

## Open the live examples

In [hub.confighub.com](https://hub.confighub.com), choose the `helm-catalog` organization:

- `route-sketch-kube-prometheus-stack` contains the chart-specific route plan.
- `hook-probe-base` contains the smaller route that has run through all three delivery paths.

Start with the single `readme` Unit in either Space, then inspect the route Units and their revision history.
