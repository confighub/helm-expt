# projectcalico/tigera-operator v3.32.0 Installer Package

This package keeps the rendered Tigera operator resources and the four custom
resources that use `operator.tigera.io/v1`.

On a fresh cluster, Kubernetes cannot accept those custom resources until the
operator has created their CRDs. The package therefore includes
`prerequisites/tigera-operator-bootstrap`: a Kustomize view of the same base
with the four custom resources removed. The generated `try.sh` applies that
small bootstrap first, waits for the CRDs, and then applies the complete
rendered output.

This is ordering, not a different Calico configuration. The bootstrap reuses
the exact operator and RBAC objects already present in the base.

```sh
cub installer setup \
  --pull oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/projectcalico-tigera-operator:v3.32.0 \
  --base default \
  --work-dir ./tigera-operator \
  --non-interactive
```
