# Serverless mode

**UNOFFICIAL/EXPERIMENTAL.**

You can use the public Helm Ops Catalog without creating a ConfigHub account. Pull a
catalog package, choose a preset configuration, and write the Kubernetes objects to
local files. You can stop there, apply the files yourself, or package the reviewed
files as OCI for an existing GitOps controller.

ConfigHub is not involved until you choose to save the configuration and use shared
history, variants, approvals, promotions, releases, or fleet rollout.

## Start with files

This NGINX example needs no server, account, or cluster:

```sh
cub installer setup \
  --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2 \
  --base http-clusterip \
  --work-dir ./nginx \
  --non-interactive \
  --namespace nginx
```

The command writes six objects under `./nginx/out/manifests`: a Namespace,
ServiceAccount, NetworkPolicy, PodDisruptionBudget, Service, and Deployment. Read or
scan those files before deciding how to deliver them.

The public package is an **installer OCI**. It contains the chart-specific preset
configurations and the files `cub installer` needs. It is not yet the single
configuration that Flux or Argo CD will apply.

## Apply the files yourself

For a quick development test:

```sh
kubectl apply -f ./nginx/out/manifests
kubectl -n nginx rollout status deployment/nginx
```

The separate
[render and install parity proof](../../data/serverless-install-parity-proof/summary.md)
compares Helm and the no-account cub path on Redis. It checks both the rendered
objects and a running workload.

## Package the reviewed files for Flux

If Flux already owns delivery, package the rendered files instead of applying them
with `kubectl`:

```sh
(cd ./nginx/out/manifests && kustomize create --autodetect)

flux push artifact oci://REGISTRY/reviewed-nginx:24.0.2 \
  --path=./nginx/out/manifests \
  --source=oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2 \
  --revision=catalog@sha1:SOURCE_REVISION \
  --reproducible

flux create source oci reviewed-nginx \
  --url=oci://REGISTRY/reviewed-nginx \
  --digest=sha256:OUTPUT_MANIFEST_DIGEST

flux create kustomization reviewed-nginx \
  --source=OCIRepository/reviewed-nginx \
  --path=./ \
  --prune=true
```

The [live public OCI to Flux proof](../../data/serverless-oci-gitops-proof/summary.md)
runs this pattern on a throwaway cluster. It uses an empty registry credential file
and an isolated cub home with no ConfigHub token. It pulls the public NGINX installer
OCI, renders six objects, pushes a second OCI, pulls those files back for comparison,
and confirms that Flux reconciles the same output manifest digest. NGINX reaches one
ready replica.

The proof uses a temporary local registry for the output artifact. It proves the
package and controller mechanics, not a permanently hosted public workbench.

## Keep the OCI roles separate

| OCI artifact | Contents | Consumer |
| --- | --- | --- |
| Installer package | Chart-specific preset configurations and rendering files | `cub installer` |
| Literal configuration | Exact Kubernetes objects ready for ConfigHub upload | `cub variant upload` |
| Portable deployment bundle | Reviewed Kubernetes objects in a controller-compatible layout | Flux, Argo CD, or another external consumer |
| ConfigHub release | A reviewed ConfigHub Space release | ConfigHub delivery through Flux or Argo CD |

An OCI reference is not enough by itself. Check what the artifact contains and which
consumer its receipt covers.

## Limits

- The NGINX proof is a straightforward chart with no hooks or CRDs. A chart with
  setup Jobs, CRDs, webhooks, or certificates also needs its recorded lifecycle
  routes. See [known gaps](./known-gaps-we-surface.md).
- A rendered Secret placed in a portable OCI will live in that registry. Use an
  existing Secret or another approved secret-delivery method for production. See
  [per-chart caveats](../../data/cub-adoption-caveats/summary.md).
- `cub installer push` publishes an installer package. It does not turn rendered
  manifests into a Flux deployment artifact.

The longer-term no-account design is recorded in the
[serverless install plan](../planning/serverless-verified-install-plan.md).
