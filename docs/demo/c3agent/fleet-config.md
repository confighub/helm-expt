# Configure an AI agent fleet without starting it

An AI agent service needs ordinary operating controls before it needs autonomy.
Teams must choose the model, runtime images, budget, task concurrency, schedule,
credential references, storage, and access. This example makes those choices
reviewable before any agent process starts.

The c3agent source and runtime images are private. This is therefore an advanced
configuration example, not a public package to run anonymously.

## Start with three short files

The source is under
[`examples/c3agent/fleet-config`](../../../examples/c3agent/fleet-config/).

| File | What it controls |
| --- | --- |
| `c3agent.yaml` | Development model, image digests, budget, concurrency, schedule, namespace, and Secret reference. |
| `c3agent-staging.yaml` | The reviewed staging increase in budget and concurrent tasks. |
| `c3agent-prod.yaml` | The reviewed production increase and polling schedule. |

The generator turns each environment into ten Kubernetes objects: a Namespace,
two ConfigMaps, a ServiceAccount, a Role and RoleBinding, two Services, and two
Deployments. Both Deployments have zero replicas.

No credential value is present. The Deployments refer to
`c3agent/c3agent-runtime-secrets`, which an operator must create through the
team's secret manager before enabling the service.

## Keep the source information with the objects

The development result is stored as a local OCI artifact. Its single portable
content layer contains:

- the exact Kubernetes objects under `manifests/`;
- a source-and-intent record naming the source commit, images, model, Secret
  boundary, and object-set hash;
- a lifecycle record listing the work required before activation.

The companion records are data files, not Kubernetes resources. ConfigHub reads
the manifest files into Units without sending the companion records to a
cluster. Pulling the OCI back must reproduce the same object-set hash.

## Promote only the settings you reviewed

The live proof used a ConfigHub base followed by development, staging, and
production variants.

| Step | Accepted change |
| --- | --- |
| Development to staging | Budget `5` to `8`; concurrent tasks `2` to `3`. |
| Staging to production | Budget `8` to `12.5`; concurrent tasks `3` to `5`; schedule `5s` to `10s`. |

Only the fleet ConfigMap changed. The image selections, RBAC, Services, Secret
reference, and disabled Deployments remained the same.

ConfigHub published the production variant as a release OCI. Argo CD reconciled
that exact digest on a throwaway Kubernetes cluster. The final checks found two
Deployments with zero desired replicas, no Pods, and no Secret.

## What passed

- deterministic source-to-object generation;
- local OCI package and pull-back comparison;
- ConfigHub base import with the source OCI digest retained;
- development-to-staging-to-production promotion;
- ConfigHub release OCI publication;
- Argo CD sync at the release digest;
- exact Kubernetes object reconciliation.

The machine receipt is
[`runs/c3agent-configuration-proof/receipt.yaml`](../../../runs/c3agent-configuration-proof/receipt.yaml).
The shorter result is
[`data/c3agent-configuration-proof/summary.md`](../../../data/c3agent-configuration-proof/summary.md).

## What did not run

The test did not pull the private images, create credentials, start c3agent, or
run an agent task. PostgreSQL, persistent storage, image-pull credentials, and
task-level RBAC still need an activation design and their own evidence.

That boundary is deliberate. A successful configuration and delivery test does
not prove that a private application is ready to serve work.

## Rebuild the public evidence

```bash
npm run c3agent-config:generate
npm run c3agent-config:verify
npm run c3agent-config:self-test
```

Maintainers with access to the `helm-catalog` ConfigHub organization can repeat
the isolated live proof:

```bash
CUB_CONTEXT=<helm-catalog-context> npm run c3agent-config:proof:run
npm run c3agent-config:proof:verify
npm run c3agent-config:proof:self-test
```

The live runner deletes its temporary ConfigHub Spaces, local registry, and kind
cluster after recording the result.
