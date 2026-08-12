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

## One exact handoff

The three checks below use the same five Kubernetes objects. The object-set
hash is calculated from the objects, so matching hashes show that the handoff
did not silently rerender or replace them.

| Checkpoint | Object-set SHA-256 | OCI source digest |
| --- | --- | --- |
| Reviewed locally and pulled back from local OCI | `ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345` | `sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683` |
| Pulled anonymously from the public registry | `ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345` | `sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683` |
| Read back from the saved ConfigHub base | `ded2b7c2624c74ae1dce2a947ad9d99a32a62f5114361970af61c9ca51449345` | `sha256:34af6a50b952d1a168a5cad614ef47f652cf44b11806a93bf6cc7a79c6e9c683` |

This is the boundary between the public workshop and ConfigHub: review a
result locally, then save those exact objects when the team needs variants,
approvals, promotion, or release history.

After the base is saved, continue with the
[official ConfigHub tutorial](https://docs.confighub.com/get-started/tutorial/).
It shows the next steps: create a development deployment, make a change, add a
production deployment, and flow the reviewed change from base to development
to production.

## Current status

- Public OCI push: **pass**
- Anonymous pull: **pass**
- ConfigHub base upload: **pass**
- Reviewed result through Argo CD: **pass**
- Development-to-staging promotion: **pass**
- Promoted staging result through Argo CD: **pass**

## Records

- [Local render and review](./summary.md)
- [Public OCI receipt](../../runs/byo-helm-values-proof/public-oci-receipt.yaml)
- [ConfigHub upload receipt](../../runs/byo-helm-values-proof/confighub-upload-receipt.yaml)
- [First deployment result](../../data/byo-helm-values-deploy-proof/summary.md)
- [Development-to-staging promotion](../../data/byo-helm-values-promotion-proof/summary.md)
- [Promoted staging deployment](../../data/byo-helm-values-staging-deploy-proof/summary.md)
- [README used inside Hub](../../data/helm-catalog-readmes/spaces/byo-nginx-ai-values-24-0-2-reviewed/README.md)

The reviewed Deployment still requires the
`nginx/ai-provider-credentials` Secret. The live runs supplied a fake value
separately and did not record it. The reviewed result reached three ready
replicas, and the promoted staging result reached four ready replicas, through
Argo CD on throwaway kind clusters.
