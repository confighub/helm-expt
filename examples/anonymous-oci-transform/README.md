# NGINX OCI change example

This example shows one small change to an existing Kubernetes configuration
OCI. The public input contains five reviewed NGINX objects. The transformation
changes only `Deployment/nginx spec.replicas`, from three to four.

No ConfigHub account, ConfigHub Server, or cluster is used.

## Files

| Path | What it is |
| --- | --- |
| `reviewed-output/manifests/release-objects.yaml` | The five Kubernetes objects after the replica change. |
| `reviewed-output/records/source.json` | The public input reference, digest, and source context. |
| `reviewed-output/records/change.json` | The exact field change and before/after object hashes. |
| `reviewed-output/records/checks.json` | The checks that passed and the external Secret warning. |
| `output-layout/` | The same files stored as an OCI image layout at tag `replicas-4`. |

The output warns that `nginx/ai-provider-credentials` must exist before
deployment. It does not invent or store that Secret.

Read the [user guide](../../docs/user/transform-oci-package.md) for the command
and next steps. Read the
[proof summary](../../data/anonymous-oci-transform-proof/summary.md) for the
recorded digests and pull-back comparison.
