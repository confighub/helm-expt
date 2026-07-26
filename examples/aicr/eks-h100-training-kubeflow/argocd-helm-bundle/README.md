# Argo CD Helm Chart Deployment Bundle

This bundle is a Helm chart whose templates generate one Argo CD
Application per component plus a parent Application that manages
the chart deployment as a whole. The bundle is **URL-portable**:
the publish location is supplied at install time via `--set
repoURL=...`, not baked into the chart bytes.

## Deploy

`<your-registry>/<path>` below is the **parent namespace** you
publish into. The chart name (`aicr-eks-h100-training-kubeflow-argocd`) is appended by Helm at
push time and by the parent Application at sync time — do NOT
include the chart name in `--set repoURL` or it will be appended
twice and the parent Application will fail to resolve.

```bash
# 1. Publish to your chart registry (any HTTPS OCI / Helm chart repo).
helm package . --destination /tmp/
helm push /tmp/aicr-eks-h100-training-kubeflow-argocd-*.tgz oci://<your-registry>/<path>

# 2. Install from the published chart — supply repoURL (the
#    parent namespace, NOT including the chart name) and
#    targetRevision so the parent Application and path-based child
#    Applications can pull from the registry you pushed to.
helm install aicr-eks-h100-training-kubeflow-argocd oci://<your-registry>/<path>/aicr-eks-h100-training-kubeflow-argocd \
  --version <chart-version> -n argocd \
  --set repoURL=oci://<your-registry>/<path> \
  --set targetRevision=<chart-version>
```

`helm install` against this local directory works only when the
recipe contains pure-Helm components — child Applications whose
source is path-based (manifest-only, mixed `-post`) need Argo's
repo-server to fetch from a remote, so the chart must be published
first for those cases.

```bash
# Local install (pure-Helm-only recipes)
helm install aicr-eks-h100-training-kubeflow-argocd . -n argocd \
  --set repoURL=oci://<your-registry>/<path> \
  --set targetRevision=<chart-version>
```
