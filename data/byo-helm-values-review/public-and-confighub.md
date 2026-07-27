# Public OCI and ConfigHub upload

The reviewed NGINX configuration from the bring-your-own values example is
available as a public OCI package:

`oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/byo-nginx-ai-values:24.0.2-r001@sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683`

The package contains the same five Kubernetes objects as
[`reviewed-render.yaml`](./reviewed-render.yaml). An anonymous pull reproduced
the recorded object-set hash,
`ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345`.

ConfigHub imported that OCI into the `byo-nginx-ai-values-24-0-2-reviewed` Space in the
`helm-catalog` organization. One configuration Unit holds the five
Kubernetes objects, a separate README Unit explains the example, and the shared
catalog checks are attached. The source OCI reference and digest are recorded
on the Space.

## Current status

- Public OCI push: **pass**
- Anonymous pull: **pass**
- ConfigHub base upload: **pass**
- Kubernetes apply: **not-run**
- Promotion: **not-run**
- Controller delivery: **not-run**

## Records

- [Local render and review](./summary.md)
- [Public OCI receipt](../../runs/byo-helm-values-proof/public-oci-receipt.yaml)
- [ConfigHub upload receipt](../../runs/byo-helm-values-proof/confighub-upload-receipt.yaml)
- [README used inside Hub](../../data/helm-catalog-readmes/spaces/byo-nginx-ai-values-24-0-2-reviewed/README.md)

The reviewed Deployment still requires the
`nginx/ai-provider-credentials` Secret. No target was assigned, so this
example does not claim a Kubernetes result.
