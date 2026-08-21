# Try AICR: anonymous CPU-starter result

This test ran the same public script linked from the Config Workshop. It used an
empty registry credential store and no ConfigHub account or Kubernetes cluster.

## Result

**pass.** With no ConfigHub account, registry login, or Kubernetes cluster, the public script anonymously pulled the retained 17-Application AICR configuration, selected and hash-verified the seven CPU-starter Applications, wrote them as a local OCI, pulled that OCI back, and compared every file.

| Step | Result |
| --- | --- |
| Pull the public NVIDIA AICR configuration at `sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010` | pass |
| Confirm all 17 source Applications are present | pass |
| Select the seven Applications named by the CPU-starter derivation record | pass |
| Verify every selected file against its reviewed SHA-256 | pass |
| Write a local configuration OCI at `sha256:62eaf39703ca0e5e968fcd4a667cbccbb5b3ff16403471c4b3441b3681b2b225` | pass |
| Pull the local OCI back and compare all seven files | pass |
| Contact ConfigHub Server | not run |
| Apply to Kubernetes or run a model | not run |

## Selected Applications

| Application | Argo CD sync wave | File SHA-256 |
| --- | ---: | --- |
| cert-manager | 2 | `9429064306e0efcca02e29edafa202330de0d3cbab8b8d47d52f69a2e56b6453` |
| nfd | 3 | `ef2cfedf5ff066f0255ed0d910daacec6f78225f117a3bf95f8c448d1e8b0df6` |
| prometheus-operator-crds | 6 | `0a277cf4d9f6b6fed5f2b890a94a366fba0a49859c9ae852999094ee79b34292` |
| kube-prometheus-stack | 7 | `83f58c797a925802b31ea5874676ad7ee51b2c3439e9a86d06bbcf52a87a7656` |
| k8s-ephemeral-storage-metrics | 9 | `069c54ea067bee6e041f6356b6f72e1a00ce41294217fb5edaed085bbaeb1b2f` |
| kai-scheduler | 10 | `740ea2245f37828f383b89ed876cbfbcd4ad30972447cdbf57c06922348e5fbc` |
| prometheus-adapter | 15 | `1d6fab6e8f60c9b7eda6ed266d0b172159bada60a95396f44f63c22039afe509` |

## What This Means

The public AICR artifact is readable without a registry login. The seven-file
CPU starter can be reproduced from it, checked byte for byte, and kept as a
local OCI. The source-and-intent record explains why those seven Applications
were selected and identifies the retained `gp3` storage-class setting.

This is a configuration exercise. It does not install the seven components or
run an inference workload. For the live CPU inference example, see
[the vLLM runtime proof](../vllm-cpu-starter-proof/summary.md).

## Evidence

- Script: [`site/sh/aicr-cpu-starter/try.sh`](../../site/sh/aicr-cpu-starter/try.sh)
- Source publication: [public OCI receipt](../../examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml)
- Selection: [CPU-starter derivation receipt](../../examples/aicr/cpu-starter/derivation-receipt.yaml)
- Full receipt: [`runs/aicr-cpu-starter-public-proof/receipt.yaml`](../../runs/aicr-cpu-starter-public-proof/receipt.yaml)
