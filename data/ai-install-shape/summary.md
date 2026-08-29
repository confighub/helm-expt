# What will this install, and what must already exist?

A Helm newcomer asks the most common question in the demand sample. The assistant
answers it from the committed render of metrics-server/metrics-server 3.13.0,
and this proof gates the answer against that render. The assistant does the easy
part, the reading and the plain answer; the gate does the safe part, refusing any
object or prerequisite the render does not support, and refusing to omit one.

## What it installs

9 objects, taken exactly from the render. The answer may not add
or drop one.

## What must already exist

- The kube-system namespace is used by the objects but is not created by the render, so
  it must already exist.
- The render registers an aggregated API (v1beta1.metrics.k8s.io), so the API aggregation layer
  must be available.
- The bindings reference roles the render does not create (ClusterRole/system:auth-delegator, Role/extension-apiserver-authentication-reader), so those
  must already exist.
- The render installs cluster-scoped RBAC, so the installer needs permission to
  create it.

## What it does not require

Secrets, CustomResourceDefinitions, persistent storage, Helm hooks, and setup Jobs
are all absent from the render, so the answer states plainly that none are needed.
The gate checks each of these is genuinely absent, so the reassurance cannot be a
guess.

## The gate

- The listed objects match the rendered set exactly, with no invented or missing
  object.
- Every prerequisite the answer asserts is supported by the render.
- Every prerequisite the render implies is covered by the answer.
- Every "does not require" line is true in the render.

The self-test mutates the answer three ways, an invented object, an invented Secret
prerequisite, and a dropped namespace prerequisite, and confirms the gate rejects
each. So the answer is the assistant, and the render is the authority.

## Open the evidence

- [The assistant's answer](./answer.yaml)
- [The render facts the gate derived](./render-facts.yaml)
- [Receipt](./receipt.yaml)
- [The scenario](../../config-catalog/demonstrations/ai-install-shape.yaml)
- [The render](../../data/adversarial10/charts/metrics-server-metrics-server-3.13.0/rendered/default.yaml)

Run:

```bash
npm run ai-install-shape:verify
npm run ai-install-shape:self-test
```
