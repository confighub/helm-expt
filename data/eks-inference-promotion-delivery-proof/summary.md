# EKS inference promotion and Argo delivery proof

This example changes one field in a checked inference configuration, promotes the reviewed result, publishes it as OCI, and verifies what Argo CD and Kubernetes received.

## Result

| Step | Checked result |
| --- | --- |
| Change | `apps/v1 Deployment inference/chat` changed from 1 replica to 2. No other Unit changed. |
| Promote | Staging has the same five Unit hashes as the reviewed dev configuration. |
| Publish | ConfigHub published delivery Release #1 with manifest `sha256:117fd918c6293966a8fb2571414cfdc29f091d29d18ff46445f5c9eefc07a30b`. |
| Deliver | Argo CD reported `Synced` and `Healthy` at that same manifest digest. |
| Run | Kubernetes reported 2/2 chat replicas available; cub-scout found 0 runtime issues. |

The GPU check and vLLM configuration travelled through the same Release but stayed at zero replicas. That makes this a useful promotion and delivery test on a laptop, not a claim that a model ran.

## What this does not prove

- This proof used one local kind cluster and Argo CD. It does not prove Flux delivery or a multi-cluster rollout.
- The CPU check, GPU check, and vLLM deployments remained at zero replicas. This proof does not claim AWS provisioning, GPU readiness, model download, or an inference response.
- The change was intentionally small: one replica field in one Unit. Larger promotions still need source-aware classification and lifecycle checks.

Source receipt: [runs/eks-inference-promotion-delivery-proof/receipt.yaml](https://github.com/confighub/helm-expt/blob/main/runs/eks-inference-promotion-delivery-proof/receipt.yaml)
