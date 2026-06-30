EXPERIMENTAL

# First-run walkthrough — a real serverless try-out, captured

This is a transcript of the [journey](../../site/index.html) Stage 1
("serverless try-out") run end-to-end as a new user would, on a throwaway
local kind cluster, with **no ConfigHub account**. It is the tested-UX
companion to [try-now.md](./try-now.md): try-now is the instructions; this
page is the proof they work, with the real output and the honest rough
edges.

Chart: `sealed-secrets/sealed-secrets@2.18.6`, base `default` — a small,
single-deployment controller (chosen because it is light and its images are
pullable, so a first run is fast and green).

## 1. Render locally — no cluster, no account

```sh
cub installer setup \
  --pull oci://ghcr.io/confighub/helm-expt/sealed-secrets-sealed-secrets:2.18.6 \
  --base default \
  --work-dir .tmp/firstrun \
  --non-interactive \
  --namespace sealed-secrets
```

```text
Wizard wrote .tmp/firstrun/out/spec/selection.yaml and inputs.yaml
Base: default; components: []
Namespace: sealed-secrets
Rendered 12 manifest(s) to .tmp/firstrun/out/manifests
```

The 12 rendered objects are plain Kubernetes YAML you can read before
applying anything:

```text
1 ClusterRole   1 ClusterRoleBinding   1 CustomResourceDefinition
1 Deployment    1 Namespace            2 Role   2 RoleBinding
2 Service       1 ServiceAccount
```

## 2. Apply with plain kubectl — your cluster, your call

The `out/manifests/` directory is already transformed, so a new user applies
it with ordinary `kubectl` (no ConfigHub plugin needed):

```sh
kind create cluster --name firstrun
kubectl apply -f .tmp/firstrun/out/manifests
```

```text
clusterrole.rbac.authorization.k8s.io/secrets-unsealer created
customresourcedefinition.apiextensions.k8s.io/sealedsecrets.bitnami.com created
deployment.apps/sealed-secrets created
namespace/sealed-secrets created
... (12 objects created)
```

## 3. Observe it converge

```sh
kubectl -n default rollout status deploy/sealed-secrets
kubectl -n default get pods
```

```text
deployment "sealed-secrets" successfully rolled out
NAME                              READY   STATUS    RESTARTS   AGE
sealed-secrets-657974dfb4-fq8fb   1/1     Running   0          16s
```

## 4. Verify it is *working*, not just *created* — with cub-scout

`kubectl get pods` shows the objects were created. To prove the release is
actually *working* — the desired objects are present with matching fields, its
prerequisites are met, and its workloads converged — use
[cub-scout](https://github.com/confighub/cub-scout) (v2.4.0+), the standalone
live witness. No ConfigHub account is needed:

```sh
cub-scout receipt verify \
  --file .tmp/firstrun/out/manifests \
  --scope namespace/default \
  --predicate object-set-matches \
  --ttl 1h \
  --out .tmp/firstrun/object-set.receipt.json

cub-scout receipt verify --file .tmp/firstrun/out/manifests \
  --scope namespace/default --predicate workloads-converged \
  --ttl 1h --out .tmp/firstrun/workloads.receipt.json
```

| Predicate | Answers |
| --- | --- |
| `object-set-matches` | Are the desired objects present, and do authored fields match? |
| `prerequisites-met` | Are required target facts (Secrets, CRDs) present? |
| `workloads-converged` | Did the workloads reach the expected live state? |

This closes the "created vs working" gap with evidence: a receipt you can
re-check later (`cub-scout receipt validate <receipt.json>`) and that expires
via `--ttl`, instead of eyeballing pod status.

That is the whole serverless try-out: a reviewed package became running
Kubernetes objects on your own cluster, verified against the catalog's
committed receipts, with nothing uploaded and no login. The two-cluster
parity and ConfigHub-proof lanes on the [status matrix](../../site/matrix.html)
are the same flow exercised further; this is the minimum a user does first.

## Honest rough edge: `--namespace` and object placement

Notice the workload landed in `default`, not the `sealed-secrets` namespace
passed on the command line. The `default` base for this chart declares
`namespace: "default"`, so every rendered object carries
`metadata.namespace: default`; `--namespace sealed-secrets` created a
`Namespace/sealed-secrets` object but did **not** relocate the objects into
it. This is the [#96](https://github.com/confighub/helm-expt/issues/96)
set-namespace limitation, surfaced on the first-run path.

Practical guidance until that closes: either omit `--namespace` and let the
base place objects where it renders them, or pass a value that matches the
base's declared namespace. A future installer change will rewrite object
namespaces so the flag does what a new user expects.

## Clean up

```sh
kind delete cluster --name firstrun
```

## Next

Stage 2 of the [journey](../../site/index.html) turns these rendered
objects into ConfigHub Units (first sign-up); Stage 3 adds derived variants
and OCI/GitOps delivery.
