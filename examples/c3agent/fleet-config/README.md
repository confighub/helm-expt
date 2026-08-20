# Keep an AI agent fleet configuration under control

This example starts with three short configuration files. They select the exact
c3agent images, model, task limit, budget, schedule, and Secret references for
development, staging, and production. A deterministic adapter turns each file
into the Kubernetes objects a team can review, store, compare, and deliver.

The example is deliberately disabled: both Deployments have zero replicas. The
private c3agent images and required credentials are real, but this public example
does not start an agent or send a model request. Its live test checks the
configuration path through ConfigHub, release OCI, Argo CD, and Kubernetes. It
does not claim that the c3agent workload ran.

## What to look at

1. `c3agent.yaml` contains the development settings and digest-pinned images.
2. `c3agent-staging.yaml` raises the task limit and budget.
3. `c3agent-prod.yaml` raises them again and slows the polling schedule.
4. `rendered/` contains the exact objects for each environment.
5. `records/` explains the source, field ownership, Secret boundary, and work
   that must happen before the fleet is enabled.
6. `oci-layout/` is the development configuration as a local OCI artifact.

No credential value is stored here. The Deployments refer to the
`c3agent-runtime-secrets` Secret. An operator must create that Secret through the
team's normal secret manager before changing the replica counts from zero.

## Rebuild and check it

```bash
npm run c3agent-config:generate
npm run c3agent-config:verify
```

The check fails if an image loses its digest, a credential value appears, an
environment changes an unexpected field, or the OCI no longer contains the same
development object set.

The related source-mapping implementation is in
[`confighub/cub-gen`](https://github.com/confighub/cub-gen/tree/main/examples/c3agent).
It traces compact c3agent fields to their Kubernetes targets. This Workshop
example adds the configuration OCI, ConfigHub variants, promotion, and delivery
evidence without presenting the private runtime as a public starter package.
