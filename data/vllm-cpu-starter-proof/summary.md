# vLLM CPU starter proof

This example starts with the checked EKS inference workload package, replaces its GPU model server with a small CPU profile, and runs one real request.

## Result

| Step | Checked result |
| --- | --- |
| Keep the source | ConfigHub retained the exact source OCI digest and changed only `chat` and `vllm-qwen`. |
| Publish | ConfigHub published Release #2 with manifest `sha256:9833e6459ffee6317c7c47d3d26efdf02e9690c5c5c046f87c0c8188cda71c96`. |
| Deliver | Argo CD reported `Synced` and `Healthy` at that same manifest digest. |
| Start the runtime | Kubernetes ran one ready vLLM pod on arm64 with image digest `sha256:e6745d7ba6610f637c6f22fc06cd730342e50245b6c46767235600483adfbbde`. |
| Ask the model | `Qwen/Qwen2.5-0.5B-Instruct` returned `4` and used 43 tokens. |
| Check the target | cub-scout found 0 runtime issues. |

The Kubernetes files in the example match the two changed ConfigHub Units. The source-and-intent record names the original package, image, model revision, request, lifecycle order, and limits.

## Run the accessible example

Read [the starter README](../../examples/inference/vllm-cpu-starter/README.md) for the direct Kubernetes path. It needs an ARM64 cluster with enough CPU and memory, but no GPU, cloud account, ConfigHub account, or model credential.

## What this does not prove

- This proof used one local ARM64 kind cluster and Argo CD. It does not prove EKS, Flux, or a multi-cluster rollout.
- This is a functional CPU test of one small public model. It does not prove NVIDIA GPU readiness, the 7B AWQ model, production capacity, latency, response quality, or model accuracy.
- The model and image were public and needed no credentials. This proof does not exercise private model access, Secret delivery, or credential rotation.

Source receipt: [runs/vllm-cpu-starter-proof/receipt.yaml](https://github.com/confighub/helm-expt/blob/main/runs/vllm-cpu-starter-proof/receipt.yaml)
