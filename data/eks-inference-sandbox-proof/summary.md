# EKS inference ConfigHub sandbox proof

This receipt checks the configuration-only path for the eight-component EKS inference example.

On 2026-08-20T19:26:07.326Z, the live ConfigHub organization held all eight public OCI bundle sources at their recorded digests, a linked `workshop-proof` variant for each component, 27 configured destination fields filled from the shared profile, and seven published OCI Releases.

## What was checked

| Component | Plane | Units | Profile links | Linked paths | Release | Exact source |
| --- | --- | ---: | ---: | ---: | --- | --- |
| platform-profile | confighub | 1 | 0 | 0 | not deployable | [receipt](../certified-bundles/receipts/eks-inference/platform-profile/receipt.yaml) |
| ack-controllers | management | 7 | 3 | 3 | #1 `sha256:c43344326e1e3e3cf0610470b98a4893826d502050bcaa428f1129aa4b8dbbf1` | [receipt](../certified-bundles/receipts/eks-inference/ack-controllers/receipt.yaml) |
| aws-network | management | 2 | 1 | 14 | #1 `sha256:1a493e58f886ebfb91b9e02c8196a0f629a2915bb7b277040449618d5678df9a` | [receipt](../certified-bundles/receipts/eks-inference/aws-network/receipt.yaml) |
| eks-cluster | management | 4 | 2 | 2 | #1 `sha256:f78e8e9b6a80a8dcd3d8363d3509bd90450affe457ad2189dc24b5c1f7497750` | [receipt](../certified-bundles/receipts/eks-inference/eks-cluster/receipt.yaml) |
| karpenter-aws | management | 1 | 0 | 0 | #1 `sha256:e9eafcf0439a6d0f9c703fb19bbadcd97b3f9c7a345b8c590baa9ab05b10483d` | [receipt](../certified-bundles/receipts/eks-inference/karpenter-aws/receipt.yaml) |
| karpenter | workload | 4 | 2 | 8 | #1 `sha256:39618ae6d942c5ad596d118000cee44239168f82121ec09eeabd73bda1fa4f70` | [receipt](../certified-bundles/receipts/eks-inference/karpenter/receipt.yaml) |
| gpu-runtime | workload | 2 | 0 | 0 | #1 `sha256:2d9ddc3dc4b78070fd5740a252909213ee42b1fd2c32dc9f93b6fccfc2d700c1` | [receipt](../certified-bundles/receipts/eks-inference/gpu-runtime/receipt.yaml) |
| inference-workloads | workload | 5 | 0 | 0 | #1 `sha256:c4949592439263837a6d40c7f97d0580f456e96675eb575b77a14b3a6ac7a3f4` | [receipt](../certified-bundles/receipts/eks-inference/inference-workloads/receipt.yaml) |

The management and workload targets are OCI targets. Each has a blocking `vet-placeholders` check, and the two Argo CD record Spaces name the 7 component Releases a controller would consume.

## What this does not prove

- This run created and inspected configuration records in ConfigHub; it did not create an AWS account, VPC, EKS cluster, Kubernetes workload, GPU node, or model endpoint.
- The OCI targets published Releases for later consumption. No Argo CD or Flux controller pulled them in this proof.
- The no-placeholders gate was attached and its configuration was inspected. This receipt does not claim a rejected mutation was exercised.

The next proof must take one of these exact Releases through a real Argo CD or Flux controller. AWS provisioning, GPU readiness, and a model response remain separate later results.

Source receipt: [runs/eks-inference-sandbox-proof/receipt.yaml](https://github.com/confighub/helm-expt/blob/main/runs/eks-inference-sandbox-proof/receipt.yaml)
