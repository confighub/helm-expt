# Serverless mode

**UNOFFICIAL/EXPERIMENTAL.**

Serverless and anonymous are separate choices. **Serverless** means this work does
not depend on ConfigHub Server. **Anonymous** means it uses no ConfigHub account.
The example on this page is both: it runs locally, pulls a public package, and keeps
the files and output under your control.

You can use the public Configuration Catalog without creating a ConfigHub account. Pull a
catalog package, choose a preset configuration, and write the Kubernetes objects to
local files. You can stop there, apply the files yourself, or package the reviewed
files as OCI for an existing GitOps controller.

ConfigHub is not involved until you choose to save the configuration and use shared
history, variants, approvals, promotions, releases, or fleet rollout.

## Where this work can fit

The no-account tools do not require one fixed workflow:

| Path | What you can do |
| --- | --- |
| `work -> OCI` | Start with a chart, recipe, installer package, or Kubernetes files. Inspect and test the result, then build an OCI package. |
| `OCI -> work` | Pull a public OCI package to inspect its objects, run checks, or compare it with another version. |
| `OCI -> work -> OCI` | Pull a package, test or edit the exact objects, then publish a new package for Argo CD, Flux, or another consumer. |

Here, work means inspect, explain, test, scan, compare, or edit. It can run as a
local command or in CI today. A public hosted service that can do this work without
sign-in is planned, but not yet shipped.

## Inspect an OCI package you already have

Use the [OCI inspection command](./inspect-oci-package.md) when the starting point is
an OCI reference rather than a chart or local files:

```sh
npm run oci:inspect -- oci://REGISTRY/REPOSITORY:TAG
```

It resolves the digest, identifies whether the package is a Helm source, cub
installer source, or literal Kubernetes configuration, and reports the objects and
obvious lifecycle work it can read. It does not apply anything.

## Change a literal configuration OCI

Use the [OCI transformation command](./transform-oci-package.md) when the
package already contains exact Kubernetes objects and you want a checked
replacement:

```sh
npm run oci:transform -- oci://REGISTRY/REPOSITORY@sha256:DIGEST \
  --object Deployment/example \
  --namespace example \
  --field spec.replicas \
  --value 4 \
  --output oci-layout:./changed-example:reviewed
```

The command records the input digest, exact field change, and check results in
the output OCI, then pulls it back for comparison. Existing companion records
are retained. The output remains local until someone deliberately publishes or
uploads it.

The [public NGINX proof](../../data/anonymous-oci-transform-proof/summary.md)
does this with an empty registry credential file and no ConfigHub account.

## Start with files

This NGINX example needs no server, account, or cluster:

```sh
cub installer setup \
  --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2 \
  --base http-clusterip \
  --work-dir ./nginx \
  --non-interactive \
  --namespace nginx \
  --output-oci ./reviewed-nginx.oci
```

The command writes six objects under `./nginx/out/manifests`: a Namespace,
ServiceAccount, NetworkPolicy, PodDisruptionBudget, Service, and Deployment. Read or
scan those files before deciding how to deliver them. It also writes a local OCI
image layout containing the same non-secret objects and a root
`kustomization.yaml`, then reads the artifact back and checks its object-set digest.

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
compares Helm and the no-account cub path on the recommended Redis
`reuse-existing-secret` configuration. It compares all 13 chart objects
field-for-field, verifies the local rendered OCI, starts both deployments, and
records `PONG` from each.

## Write the reviewed files to a registry

If Argo CD or Flux already owns delivery, give `--output-oci` a registry reference
instead of a local path:

```sh
cub installer setup \
  --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bitnami-nginx:24.0.2 \
  --base http-clusterip \
  --work-dir ./nginx \
  --non-interactive \
  --namespace nginx \
  --output-oci oci://REGISTRY/reviewed-nginx:24.0.2

flux create source oci reviewed-nginx \
  --url=oci://REGISTRY/reviewed-nginx \
  --digest=sha256:OUTPUT_MANIFEST_DIGEST

flux create kustomization reviewed-nginx \
  --source=OCIRepository/reviewed-nginx \
  --path=./ \
  --prune=true
```

The [live public OCI to Flux proof](../../data/serverless-oci-gitops-proof/summary.md)
runs this exact installer output path on a throwaway cluster. It uses an empty source
registry credential file and an isolated cub home with no ConfigHub token. It pulls
the public NGINX installer OCI, renders six objects, writes a second OCI with
`--output-oci`, verifies the output by reading it back, and confirms that Flux
reconciles the same output manifest digest. NGINX reaches one ready replica.

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
- `--output-oci` excludes files under `out/secrets`, but a Secret rendered as an
  ordinary manifest would still be part of the object set. Prefer an existing Secret
  or another approved secret-delivery method for production. See [per-chart
  caveats](../../data/cub-adoption-caveats/summary.md).
- `cub installer push` publishes the multi-preset installer package that users pull.
  `cub installer setup --output-oci` writes one selected preset's rendered objects
  for a controller or another OCI consumer.

The longer-term no-account design is recorded in the
[serverless install plan](../planning/serverless-verified-install-plan.md).
