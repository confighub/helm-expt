# Why Contour needs more than rendered YAML

Contour is a useful example of work Helm performs around a chart render. The
ordinary objects mount `contourcert` and `envoycert`, but those Secrets are not
in the rendered object set. Helm creates them by running a certificate Job
before the main install.

The catalog records that dependency instead of leaving two Pods waiting for
missing Secrets. The installer package contains the chart's ServiceAccount,
RBAC, and certgen Job as an explicit setup action. It runs before the ordinary
objects, checks both Secrets, records what happened, and removes the temporary
resources.

## Configurations

- `default` preserves the original chart and its now-unavailable Bitnami images.
- `no-crds` is for platforms that already own the five Contour CRDs.
- `legacy` records Helm values for the frozen `bitnamilegacy` images and exists
  so the install and certificate route can still be tested.

## What has been tested

On two fresh kind clusters, regular Helm ran its own certgen hook while the
`cub installer` lane ran the packaged action. Both created the expected
certificate material, both workloads became ready, all five CRDs were
established, and the ordinary Kubernetes objects had no semantic field
differences.

The larger ConfigHub comparison also proved direct apply, OCI publication,
healthy workloads, and object parity. It remains `watch` because Argo CD sees
the five CRDs left by an earlier lane and reports them OutOfSync.

## What remains

The frozen image is not suitable for production. A production route needs a
maintained image mirror and a certificate-rotation owner. Argo CD and Flux must
also prove how they execute the certgen step in their own ordering models; this
repository does not claim those controller-native routes yet.

Start with `lifecycle-route.yaml`, then follow its links to the exact receipts
and packaged action.
