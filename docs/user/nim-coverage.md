# NIM on this catalog: what is covered, and what is not

An engineer deploying NVIDIA NIM asked this catalog reasonable questions and
found the answers scattered or missing. This page puts them in one place, and
it is honest about the absences.

## What is retained

The [NIM on KServe entry](../demo/aicr/kserve-nim-inference.md) retains the
KServe subtree of NVIDIA/nim-deploy at an exact commit: the serving runtimes
and the model-by-GPU shapes, with a digest index over every file. The
deployment scaffolding is Apache-2.0; the
[license read](../planning/nim-ngc-license-read.md) verified that against the
actual terms before anything was built.

## One shape you can read, instead of a count

`examples/aicr/kserve-nim-inference/upstream/kserve/nim-models/llama-3.1-8b-instruct_1xgpu_1.1.0.yaml`
is a complete `InferenceService`: one `nvidia.com/gpu`, the named runtime
`nvidia-nim-llama-3.1-8b-instruct-1.1.0`, and model storage on
`pvc://nvidia-nim-pvc/`. Every other shape in the directory has the same
anatomy at different sizes, up to `llama3-70b-instruct_4xh100`.

## The licensing boundary

The runtime images and models behind these shapes are NGC-gated under NVIDIA
AI Enterprise licensing. The catalog retains the configuration shapes and
never redistributes the gated artifacts. NGC API keys enter a deployment only
as target facts you supply; a literal credential value anywhere in the
retained tree stops the compile.

## What is not covered, plainly

- Triton, vLLM, and Ray Serve are not retained here. Searching this catalog
  for them finds nothing, and that is the true answer today.
- GPU node provisioning (device plugins, node selectors, taints) is covered
  for the charts that carry it — see karpenter and nvidia-device-plugin in the
  catalog — not as a general guide.
- No GPU workload has run to produce any receipt in this catalog. Every NIM
  claim here is config-plane: import, render, digest pinning, delivery wiring.

If one of the absences blocks you, say so with a
[problem chart report](https://github.com/confighub/helm-expt/issues/new?template=problem-chart.yml):
demand is what orders the queue.
