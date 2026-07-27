# AICR OCI in, ConfigHub, OCI out

This live test starts with the 17 Argo CD Application objects generated from the
AICR EKS H100 training recipe. The objects are already stored in a literal
configuration OCI. The test imports that OCI into a temporary ConfigHub base,
publishes a ConfigHub release OCI, pulls the release back, and compares every
Kubernetes object with the input.

## Result

**pass.** ConfigHub imported the 17 exact Argo CD Applications from the AICR literal-configuration OCI and published a release OCI containing the same Kubernetes objects plus its origin annotation.

| Step | Result | What was checked |
| --- | --- | --- |
| Read the AICR input OCI | pass | 17 Applications at `sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010`; sync waves 0 through 15. |
| Import the base into ConfigHub | pass | ConfigHub recorded the source digest and stored the same 17 Applications. |
| Publish a ConfigHub release OCI | pass | `sha256:652f2427bfe9d798efa4521b518a3b18b0c5d0ccb6be6b937d136917c64b0915`. |
| Pull the release back | pass | The resolved digest matched the published digest. |
| Compare the objects | pass | All 17 Applications matched. ConfigHub added its origin annotation to each object. |
| Apply the Applications | not-run | Not attempted. |
| Check an EKS or GPU workload | not-run | Not attempted. |

## What this proves

- A literal configuration OCI produced from AICR can become a ConfigHub base.
- ConfigHub can publish that base as a release OCI.
- Pulling the ConfigHub release returns the same 17 Argo CD Applications, with
  ConfigHub's `confighub.com/origin` annotation added for provenance.
- The input and output OCI digests differ because they are separate artifacts.
  Object comparison, not digest equality, proves that the Kubernetes configuration
  stayed the same.

## What it does not prove

- The input AICR OCI used a temporary local registry. Public Google Artifact Registry publication remains a separate receipt.
- The throwaway cluster supplied a ConfigHub release target and scoped OCI pull credential. The 17 Argo CD Applications were not applied to that cluster.
- This run did not reconcile the AICR stack, create an EKS cluster, use H100 nodes, or check workload health.
- The proof compares the 17 Kubernetes Application objects and permits only ConfigHub's confighub.com/origin annotation as added metadata.
- The temporary ConfigHub Space, cluster Space, kind cluster, registry, and local files were removed.

## Evidence

- [Live receipt](../../runs/aicr-oci-roundtrip-proof/receipt.yaml)
- [AICR source and local OCI receipt](../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml)
- [AICR ConfigHub upload receipt](../../examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml)
- [AICR demonstration guide](../../docs/demo/aicr/eks-h100-training-kubeflow.md)
