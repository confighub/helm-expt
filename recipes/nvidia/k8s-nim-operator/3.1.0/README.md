# nvidia/k8s-nim-operator 3.1.0 Proof

This is the exact-artifact ConfigHub component package for k8s-nim-operator@3.1.0. The NVIDIA NIM Operator manages NVIDIA NIM and NeMo microservices through nine custom resources. With chart defaults it installs the operator, its RBAC, a metrics Service and those nine CRDs, and deploys no model.

Variants:

- `default`: chart defaults; 17 Helm objects, 18 cub installer objects including Namespace.
- `aicr-eks-inference`: the values the AICR v0.14.0 NIM inference recipes supply inline (examples/aicr/eks-h100-inference-nim/argocd-rendered/templates/k8s-nim-operator.yaml): the admission controller on with a cert-manager self-signed issuer, the operator tolerating every taint with no node affinity, Dynamo off; 21 Helm objects, 22 cub installer objects including Namespace.

What this proves:

- the version-specific upstream artifact and SHA are locked, and a moved tag fails the check instead of changing the entry;
- every base renders deterministically and the installer package preserves the rendered object set;
- retention here does not imply publication, live convergence, or production support.

Useful commands:

```sh
npm run nvidia-gpu-stack-coverage:generate -- --only k8s-nim-operator@3.1.0
npm run nvidia-gpu-stack-coverage:verify -- --only k8s-nim-operator@3.1.0
```
