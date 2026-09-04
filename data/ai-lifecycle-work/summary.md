# How should Argo CD or Flux handle this chart's hooks and CRDs?

A GitOps operator asks a spine question about prometheus-community/kube-prometheus-stack 85.3.3. The
assistant does the easy part, naming the lifecycle work; the gate does the safe part,
refusing to invent lifecycle work or miss it, by checking every claim against the
render.

## The lifecycle work

- **CRDs, applied first:** 10. They must be applied and become
  Established before any custom resource, or the custom resources fail to apply. In
  Argo CD this is an early sync wave with server-side apply and a wait; in Flux it is
  a dependency on the CRD Kustomization.
- **Custom resources, applied after:** 50 (1 Alertmanager, 1 Prometheus, 35 PrometheusRule, 13 ServiceMonitor). Each uses one of
  the CRDs above, which is why the ordering matters.
- **Admission webhooks needing a caBundle:** 2.
  They ship with an empty caBundle, so the controller reconciler must fill it before
  the webhook can admit anything, from the operator's self-signed certificate or
  cert-manager.
- **Helm hooks:** none in this render, so the admission caBundle is not filled by a Helm hook here.

## The gate

- The listed CRDs match the render's CRDs exactly.
- The custom resources match the render by kind and count.
- The CRD-before-custom-resource ordering claim matches whether the render actually
  contains custom resources of those CRDs.
- The admission webhooks needing a caBundle match the render's webhooks with an empty
  caBundle.
- The Helm hooks match the render's hook objects.

The self-test mutates the answer three ways, an invented CRD, a wrong custom-resource
count, and an invented Helm hook, and confirms the gate rejects each. So the answer
is the assistant, and the render is the authority.

## The limit

This reads one committed render. It reports the lifecycle work present in the objects,
not the runtime behavior of applying them, which the live hook and CRD lifecycle
proofs cover separately.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The lifecycle facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-lifecycle-work.yaml)
- [The render](../../data/adversarial10/charts/prometheus-community-kube-prometheus-stack-85.3.3/rendered/default.yaml)

Run:

```bash
npm run ai-lifecycle-work:verify
npm run ai-lifecycle-work:self-test
```
