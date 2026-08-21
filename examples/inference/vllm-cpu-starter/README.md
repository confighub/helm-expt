# Run one real model request without a GPU

This example runs a small public Qwen model through vLLM's OpenAI-compatible API.
It is the inexpensive runtime check for the larger EKS inference configuration.
The EKS configuration uses a quantized 7B model on an NVIDIA L4; this starter uses
the same service and client shape with a 0.5B model on an ARM64 CPU.

The choices are pinned:

- vLLM CPU image: `vllm/vllm-openai-cpu:v0.27.1-arm64@sha256:e6745d7ba6610f637c6f22fc06cd730342e50245b6c46767235600483adfbbde`
- model: `Qwen/Qwen2.5-0.5B-Instruct`
- model revision: `7ae557604adf67be50417f59c2c2f167def9a775`
- maximum context: 512 tokens
- vLLM memory reservation: 20% of the node memory, which stays below this example's 10 GiB container limit

## Run it on Kubernetes

Use an ARM64 cluster with at least 4 CPU cores and 10 GiB available memory. The
first run downloads the vLLM image and model.

```sh
kubectl apply -f namespace.yaml
kubectl apply -f vllm-qwen.yaml
kubectl apply -f chat.yaml
kubectl rollout status -n inference deployment/vllm-qwen --timeout=10m
./request.sh
```

The request asks the model what two plus two is. A successful result must include
a non-empty answer from `Qwen/Qwen2.5-0.5B-Instruct`; Deployment readiness alone is
not counted as inference.

## Keep it in ConfigHub

The live proof starts from the checked `inference-workloads` OCI base, creates a
derived CPU variant, and replaces only the `chat` and `vllm-qwen` Units with the
files here. ConfigHub publishes the result as release OCI, Argo CD pulls that exact
manifest digest, and the proof runs the model request from the `chat` pod.

Read [source-and-intent.yaml](./source-and-intent.yaml) for the exact source,
selection, runtime choices, and proof boundary.

## Limits

This is a functional CPU test, not a performance test. It does not prove NVIDIA
GPU readiness, the 7B AWQ model, EKS, Karpenter, production capacity, or response
quality.
