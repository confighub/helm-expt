# Your First App To Live

**UNOFFICIAL/EXPERIMENTAL.** This walkthrough takes one small, self-contained
application through the current ConfigHub deployment path:

```text
four plain-YAML objects
  -> Base in ConfigHub
  -> target-bound dev variant
  -> immutable Release
  -> Argo CD Application
  -> ready Kubernetes workload
```

It is intentionally narrower than the promotion and app-of-apps Guides. Finish
one deployment with every checkpoint visible, then continue to those Guides.

## What you need

- `cub` installed and authenticated with `cub auth login`;
- Docker, kind, and kubectl; and
- a ConfigHub organization you can write to.

The example is
[`examples/plain-yaml/acme-web`](../../examples/plain-yaml/acme-web/README.md):
one Namespace, one ConfigMap, one Deployment, and one Service. The Namespace is
part of the input, so the first run does not depend on an undeclared namespace.

## 1. Inspect the source before writing anything

From this repository checkout:

```sh
for file in namespace.yaml configmap.yaml deployment.yaml service.yaml; do
  printf '%s\n' '---'
  cat "examples/plain-yaml/acme-web/$file"
done > acme-web.yaml

cub plugin install confighub/cub-workshop@v0.6.56
cub config check ./acme-web.yaml
```

The check reads four Kubernetes objects. It does not write ConfigHub data or
touch a cluster. The retained
[plain-YAML import receipt](../../runs/literal-yaml-upload-proof/receipt.yaml)
records this four-object import boundary, but explicitly does not claim a live
deployment.

## 2. Create one local cluster and target

```sh
cub cluster up --name demo
source ~/.confighub/clusters/demo.env
cub target get demo/target
```

`cub cluster up` creates a kind cluster, installs Argo CD and the live-status
helper, and creates two ConfigHub Spaces: `demo` for the target and worker, and
`demo-argo-apps` for the root Application and its children. The target used by
deployments is `demo/target`.

Sourcing the generated environment file selects this cluster for the kubectl
checks later in the Guide.

## 3. Import the Base

```sh
cub variant upload \
  --component acme-web \
  --variant base \
  ./acme-web.yaml

cub component open acme-web
```

Checkpoint: the Component view shows `acme-web-base` and the same four objects.
Nothing has deployed. The input YAML is the source; the Base is the reusable
configuration ConfigHub now manages.

## 4. Create the dev deployment

```sh
cub variant create dev acme-web-base \
  --target demo/target \
  --namespace acme-web
```

Checkpoint: the Component view now shows `acme-web-dev` beneath the Base and
attached to `demo/target`. Current `cub variant create --target` also creates
the child Argo CD Application in `demo-argo-apps`; there is no manual
Application-Unit step.

Creating the variant chooses the destination. It still does not prove that the
application is running.

## 5. Publish and prove each boundary

```sh
cub release publish acme-web-dev

# Controller checkpoint
kubectl get application -n argocd acme-web-dev

# Workload checkpoint
kubectl wait -n acme-web \
  --for=condition=Available deployment/acme-web \
  --timeout=180s

# Delivered objects
kubectl get deployment,service,pods -n acme-web
```

Do not collapse these into one green check:

| Checkpoint | What it establishes |
| --- | --- |
| `cub release publish` | ConfigHub accepted an immutable desired release. |
| Argo CD Application | The controller observed and reconciled that delivery request. |
| Deployment Available | Kubernetes reports the workload ready. |
| Service and Pods | The expected live objects exist in the chosen namespace. |

The maintained product deployment E2E additionally checks the exact observed
revision, ready replica count, ConfigHub origin metadata, and the live-status
feedback reported by argobot. This exact four-object fixture has retained
import evidence; a fresh joined live receipt for it is still a separate test,
so this document does not present the old 2026-07-02 run as current proof.

## 6. Continue from a working result

- To change the Base and promote the reviewed result, follow
  [variants after upload](./variants-after-upload.md) and the
  [official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/).
- To bring an existing Argo CD app or app-of-apps estate, use
  [Bring your Argo CD apps into ConfigHub](https://confighub.github.io/helm-expt/site/bring-argo-into-confighub.html).
  It begins read-only and preserves Argo CD as the delivery controller.
- To check an application together with platform dependencies, continue to
  [Put an app on a platform](https://confighub.github.io/helm-expt/site/put-an-app-on-a-platform.html).

## Teardown

Only remove the resources created by this walkthrough:

```sh
cub cluster down --name demo
cub space delete acme-web-dev --recursive
cub space delete acme-web-base --recursive
```

If deletion is refused, read the named dependency or gate instead of forcing a
broad cleanup.
