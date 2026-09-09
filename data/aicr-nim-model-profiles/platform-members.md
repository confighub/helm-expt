# Platform-to-model membership for the AICR inference catalog

This is a delivery-scoped join between every inference platform in the AICR
catalog and its retained model configurations. This catalog names
44 inference platforms, and 15 of them carry a member
today: the KServe reference entry with its sixteen retained model shapes,
all four NIM platforms, which together carry one authored NIMService plus
the retained k8s-nim-operator sample corpus (accelerator-generic in this
corpus, so every retained sample reaches every NIM platform), and all ten
Dynamo platforms, which carry the retained ai-dynamo/dynamo recipes corpus
joined by an accelerator match rather than a blanket join. Attachment
follows each model's own delivery mechanism. A KServe model shape attaches
only to the KServe platform. A NIMService attaches only to a NIM platform,
either its authored home platform or, for the retained corpus, every NIM
platform its accelerator allows. A retained Dynamo recipe with no
accelerator pin attaches to every Dynamo platform; a recipe pinned to a GPU
product attaches only to the Dynamo platform(s) whose own accelerator that
product names, so an H200-pinned recipe, which has no matching platform
today, stays profiled but attaches nowhere. No model ever crosses from one
delivery mechanism to another, and this contract's verifier checks that
boundary on every row it reads.

Membership describes authored delivery attachment, not verified execution or
hardware compatibility. GPU counts are requested resources, not observed available
capacity. This join does not check scheduling, GPU product or memory suitability,
registry access, model entitlement, controller readiness or inference responses.
Consult each member's source and its scoped receipts before selecting a target.

The remaining 29 platforms carry no member yet, and each one states why.
They are all base substrate with no serving layer
bound at all.

## KServe delivery (1 platform)

`kserve-nim-inference` (accelerator any) carries 16 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `llama-3-1-70b-instruct-2xgpu` | 2 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/llama-3-1-70b-instruct-2xgpu.yaml` |
| `llama-3-1-8b-instruct-1xgpu` | 1 | gpu | authored-profile | `examples/aicr/kserve-nim-inference/profile/model-profile.yaml` |
| `llama-3-3-nemotron-49b-2xgpu` | 2 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/llama-3-3-nemotron-49b-2xgpu.yaml` |
| `llama3-70b-instruct-2xgpu` | 2 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-70b-instruct-2xgpu.yaml` |
| `llama3-70b-instruct-4xa100` | 4 | a100 | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-70b-instruct-4xa100.yaml` |
| `llama3-70b-instruct-4xgpu` | 4 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-70b-instruct-4xgpu.yaml` |
| `llama3-70b-instruct-4xh100` | 4 | h100 | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-70b-instruct-4xh100.yaml` |
| `llama3-8b-instruct-1xgpu` | 1 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-8b-instruct-1xgpu.yaml` |
| `llama3-8b-instruct-2xa100` | 2 | a100 | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-8b-instruct-2xa100.yaml` |
| `llama3-8b-instruct-2xgpu` | 2 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-8b-instruct-2xgpu.yaml` |
| `llama3-8b-instruct-2xh100` | 2 | h100 | generated-profile | `data/aicr-nim-model-profiles/profiles/llama3-8b-instruct-2xh100.yaml` |
| `mistral-7b-instruct-v03-1xgpu` | 1 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/mistral-7b-instruct-v03-1xgpu.yaml` |
| `mixtral-8x22b-instruct-v01-8xgpu` | 8 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/mixtral-8x22b-instruct-v01-8xgpu.yaml` |
| `mixtral-8x7b-instruct-v01-2xgpu` | 2 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/mixtral-8x7b-instruct-v01-2xgpu.yaml` |
| `nv-embedqa-e5-v5-1xgpu` | 1 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/nv-embedqa-e5-v5-1xgpu.yaml` |
| `nv-rerankqa-mistral-4b-v3-1xgpu` | 1 | gpu | generated-profile | `data/aicr-nim-model-profiles/profiles/nv-rerankqa-mistral-4b-v3-1xgpu.yaml` |

## NIM delivery (4 platforms)

`eks-h100-inference-nim` (accelerator h100) carries 39 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `llama-3-1-8b-instruct` | 1 | h100 | authored-nimservice | `examples/aicr/eks-h100-inference-nim/authored/nimservice-llama-3-1-8b.yaml` |
| `autoscaling-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-llm.yaml` |
| `autoscaling-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-model-free-llama-3-2-1b-instruct.yaml` |
| `confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox.yaml` |
| `epp-meta-llama3-8b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/epp-meta-llama3-8b-instruct.yaml` |
| `example0-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example0-meta-llama3-2-1b-instruct.yaml` |
| `example1-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example1-meta-llama3-2-1b-instruct.yaml` |
| `example2-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example2-meta-llama3-2-1b-instruct.yaml` |
| `full-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-llm.yaml` |
| `full-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `grpcroutes-riva-tts` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/grpcroutes-riva-tts.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-llm.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `manual-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/manual-meta-llama3-2-1b-instruct.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice-rdma` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice-rdma.yaml` |
| `multi-node-llama-3-1-8b-instruct-multinode` | 2 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-llama-3-1-8b-instruct-multinode.yaml` |
| `nim-3-nemotron-3-super-120b-a12b` | 4 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/nim-3-nemotron-3-super-120b-a12b.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-emptydir` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-emptydir.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-hostpath` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-hostpath.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-llm.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc.yaml` |
| `no-precaching-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-model-free-llama-3-2-1b-instruct.yaml` |
| `retriever-llama-nemotron-embed-vl-1b-v2` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/retriever-llama-nemotron-embed-vl-1b-v2.yaml` |
| `scheduling-meta-llama-3-2-1b-instruct-scheduling` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/scheduling-meta-llama-3-2-1b-instruct-scheduling.yaml` |
| `sidecars-meta-llama-3-2-1b-instruct-sidecars` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/sidecars-meta-llama-3-2-1b-instruct-sidecars.yaml` |
| `standard-meta-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-meta-llama-3-2-1b-instruct.yaml` |
| `standard-nim-service-model-free` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-model-free.yaml` |
| `standard-nim-service-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-multi-llm.yaml` |

`h100-eks-ubuntu-inference-nim` (accelerator h100) carries 38 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `autoscaling-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-llm.yaml` |
| `autoscaling-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-model-free-llama-3-2-1b-instruct.yaml` |
| `confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox.yaml` |
| `epp-meta-llama3-8b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/epp-meta-llama3-8b-instruct.yaml` |
| `example0-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example0-meta-llama3-2-1b-instruct.yaml` |
| `example1-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example1-meta-llama3-2-1b-instruct.yaml` |
| `example2-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example2-meta-llama3-2-1b-instruct.yaml` |
| `full-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-llm.yaml` |
| `full-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `grpcroutes-riva-tts` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/grpcroutes-riva-tts.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-llm.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `manual-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/manual-meta-llama3-2-1b-instruct.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice-rdma` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice-rdma.yaml` |
| `multi-node-llama-3-1-8b-instruct-multinode` | 2 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-llama-3-1-8b-instruct-multinode.yaml` |
| `nim-3-nemotron-3-super-120b-a12b` | 4 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/nim-3-nemotron-3-super-120b-a12b.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-emptydir` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-emptydir.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-hostpath` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-hostpath.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-llm.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc.yaml` |
| `no-precaching-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-model-free-llama-3-2-1b-instruct.yaml` |
| `retriever-llama-nemotron-embed-vl-1b-v2` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/retriever-llama-nemotron-embed-vl-1b-v2.yaml` |
| `scheduling-meta-llama-3-2-1b-instruct-scheduling` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/scheduling-meta-llama-3-2-1b-instruct-scheduling.yaml` |
| `sidecars-meta-llama-3-2-1b-instruct-sidecars` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/sidecars-meta-llama-3-2-1b-instruct-sidecars.yaml` |
| `standard-meta-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-meta-llama-3-2-1b-instruct.yaml` |
| `standard-nim-service-model-free` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-model-free.yaml` |
| `standard-nim-service-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-multi-llm.yaml` |

`ocp-inference-nim` (accelerator any) carries 38 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `autoscaling-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-llm.yaml` |
| `autoscaling-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-model-free-llama-3-2-1b-instruct.yaml` |
| `confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox.yaml` |
| `epp-meta-llama3-8b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/epp-meta-llama3-8b-instruct.yaml` |
| `example0-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example0-meta-llama3-2-1b-instruct.yaml` |
| `example1-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example1-meta-llama3-2-1b-instruct.yaml` |
| `example2-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example2-meta-llama3-2-1b-instruct.yaml` |
| `full-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-llm.yaml` |
| `full-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `grpcroutes-riva-tts` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/grpcroutes-riva-tts.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-llm.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `manual-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/manual-meta-llama3-2-1b-instruct.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice-rdma` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice-rdma.yaml` |
| `multi-node-llama-3-1-8b-instruct-multinode` | 2 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-llama-3-1-8b-instruct-multinode.yaml` |
| `nim-3-nemotron-3-super-120b-a12b` | 4 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/nim-3-nemotron-3-super-120b-a12b.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-emptydir` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-emptydir.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-hostpath` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-hostpath.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-llm.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc.yaml` |
| `no-precaching-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-model-free-llama-3-2-1b-instruct.yaml` |
| `retriever-llama-nemotron-embed-vl-1b-v2` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/retriever-llama-nemotron-embed-vl-1b-v2.yaml` |
| `scheduling-meta-llama-3-2-1b-instruct-scheduling` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/scheduling-meta-llama-3-2-1b-instruct-scheduling.yaml` |
| `sidecars-meta-llama-3-2-1b-instruct-sidecars` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/sidecars-meta-llama-3-2-1b-instruct-sidecars.yaml` |
| `standard-meta-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-meta-llama-3-2-1b-instruct.yaml` |
| `standard-nim-service-model-free` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-model-free.yaml` |
| `standard-nim-service-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-multi-llm.yaml` |

`rtx-pro-6000-eks-ubuntu-inference-nim` (accelerator rtx-pro-6000) carries 38 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `autoscaling-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-llm.yaml` |
| `autoscaling-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/autoscaling-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-llm.yaml` |
| `basic-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `basic-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/basic-model-free-llama-3-2-1b-instruct.yaml` |
| `confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/confidential-computing-meta-llama-3-2-1b-instruct-kata-sandbox.yaml` |
| `epp-meta-llama3-8b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/epp-meta-llama3-8b-instruct.yaml` |
| `example0-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example0-meta-llama3-2-1b-instruct.yaml` |
| `example1-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example1-meta-llama3-2-1b-instruct.yaml` |
| `example2-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/example2-meta-llama3-2-1b-instruct.yaml` |
| `full-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-llm.yaml` |
| `full-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/full-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `grpcroutes-riva-tts` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/grpcroutes-riva-tts.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-llm.yaml` |
| `httproutes-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/httproutes-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-llm.yaml` |
| `ingress-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/ingress-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-llm.yaml` |
| `knative-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/knative-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-llm.yaml` |
| `lora-meta-llama-3-2-1b-instruct-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/lora-meta-llama-3-2-1b-instruct-multi-llm.yaml` |
| `manual-meta-llama3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/manual-meta-llama3-2-1b-instruct.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice.yaml` |
| `multi-node-deepseek-r1-multi-node-nimservice-rdma` | 8 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-deepseek-r1-multi-node-nimservice-rdma.yaml` |
| `multi-node-llama-3-1-8b-instruct-multinode` | 2 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/multi-node-llama-3-1-8b-instruct-multinode.yaml` |
| `nim-3-nemotron-3-super-120b-a12b` | 4 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/nim-3-nemotron-3-super-120b-a12b.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-emptydir` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-emptydir.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-hostpath` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-hostpath.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-llm.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-hf.yaml` |
| `no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-meta-llama-3-2-1b-instruct-multi-llm-ngc.yaml` |
| `no-precaching-model-free-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/no-precaching-model-free-llama-3-2-1b-instruct.yaml` |
| `retriever-llama-nemotron-embed-vl-1b-v2` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/retriever-llama-nemotron-embed-vl-1b-v2.yaml` |
| `scheduling-meta-llama-3-2-1b-instruct-scheduling` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/scheduling-meta-llama-3-2-1b-instruct-scheduling.yaml` |
| `sidecars-meta-llama-3-2-1b-instruct-sidecars` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/sidecars-meta-llama-3-2-1b-instruct-sidecars.yaml` |
| `standard-meta-llama-3-2-1b-instruct` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-meta-llama-3-2-1b-instruct.yaml` |
| `standard-nim-service-model-free` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-model-free.yaml` |
| `standard-nim-service-multi-llm` | 1 | any | retained-nimservice | `data/aicr-nim-operator-models/profiles/standard-nim-service-multi-llm.yaml` |

## Dynamo delivery (10 platforms)

`b200-gke-cos-inference-dynamo` (accelerator b200) carries 89 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-b200-agentic` | 4 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-b200-agentic.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-flash-disagg-b200-agentic` | 12 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-disagg-b200-agentic.yaml` |
| `deepseek-v4-dsv4-pro-agg-b200-agentic` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-b200-agentic.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-b200-agentic` | 16 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-b200-agentic.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-b200-deploy` | 16 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-deploy` | 4 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gemma4-31b-gemma4-31b-agg-b200-agentic` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gemma4-31b-gemma4-31b-agg-b200-agentic.yaml` |
| `glm-5-2-glm52-agg-b200-agentic` | 16 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-2-glm52-agg-b200-agentic.yaml` |
| `glm-5-2-glm52-disagg-b200-agentic` | 20 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-2-glm52-disagg-b200-agentic.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `gpt-oss-120b-turbo-gptoss-120b-agg-b200-agentic` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-turbo-gptoss-120b-agg-b200-agentic.yaml` |
| `gpt-oss-120b-turbo-gptoss-120b-disagg-b200-agentic` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-turbo-gptoss-120b-disagg-b200-agentic.yaml` |
| `inkling-tml-inkling-sglang-agg` | 0 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/inkling-tml-inkling-sglang-agg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k2-6-kimi-k26-agg-b200-agentic` | 4 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-6-kimi-k26-agg-b200-agentic.yaml` |
| `kimi-k2-6-kimi-k26-agg-b200-chat` | 4 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-6-kimi-k26-agg-b200-chat.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-b200-bf16` | 1 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-b200-bf16.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-b200-mtp-bf16` | 1 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-b200-mtp-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-agg-b200-dspark-bf16` | 1 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-b200-dspark-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-agg-b200-dspark-kvr-bf16` | 4 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-b200-dspark-kvr-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-agg-b200-mtp-bf16` | 1 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-b200-mtp-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-b200-dspark-bf16` | 2 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-b200-dspark-bf16.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `nemotron-3-super-nemotron-3-super-b200-agentic` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-nemotron-3-super-b200-agentic.yaml` |
| `nemotron-3-super-nemotron-3-super-b200-chat` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-nemotron-3-super-b200-chat.yaml` |
| `nemotron-3-ultra-ultra-agg-b200-1m-kv-router` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-agg-b200-1m-kv-router.yaml` |
| `nemotron-3-ultra-ultra-agg-b200-256k-kv-router` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-agg-b200-256k-kv-router.yaml` |
| `nemotron-3-ultra-ultra-disagg-b200-1m` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-disagg-b200-1m.yaml` |
| `nemotron-3-ultra-ultra-disagg-b200-256k` | 12 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-disagg-b200-256k.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-5-122b-qwen35-122b-agg-b200-agentic` | 2 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-5-122b-qwen35-122b-agg-b200-agentic.yaml` |
| `qwen3-5-122b-qwen35-122b-disagg-b200-agentic` | 3 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-5-122b-qwen35-122b-disagg-b200-agentic.yaml` |
| `qwen3-6-35b-a3b-qwen36-35b-a3b-sglang-b200-agg-agentic` | 1 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-a3b-qwen36-35b-a3b-sglang-b200-agg-agentic.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-8-flash-next-qwen38fn-agg-b200-agentic` | 4 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-flash-next-qwen38fn-agg-b200-agentic.yaml` |
| `qwen3-8-flash-next-qwen38fn-agg-b200-agentic-12gpu` | 12 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-flash-next-qwen38fn-agg-b200-agentic-12gpu.yaml` |
| `qwen3-8-flash-next-qwen38fn-agg-b200-agentic-8gpu` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-flash-next-qwen38fn-agg-b200-agentic-8gpu.yaml` |
| `qwen3-8-flash-next-qwen38fn-disagg-2p1d-b200-agentic` | 12 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-flash-next-qwen38fn-disagg-2p1d-b200-agentic.yaml` |
| `qwen3-8-flash-next-qwen38fn-disagg-b200-agentic` | 8 | b200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-flash-next-qwen38fn-disagg-b200-agentic.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`gb200-eks-ubuntu-inference-dynamo` (accelerator gb200) carries 77 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-gb200-deploy` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-0813-agg-gb200-agentic` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-0813-agg-gb200-agentic.yaml` |
| `deepseek-v4-dsv4-pro-0813-disagg-gb200-agentic` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-0813-disagg-gb200-agentic.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gemma4-31b-gemma4-31b-agg-gb200-agentic` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gemma4-31b-gemma4-31b-agg-gb200-agentic.yaml` |
| `glm-5-3-flash-glm53-flash-agg-gb200-agentic` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-3-flash-glm53-flash-agg-gb200-agentic.yaml` |
| `glm-5-3-flash-glm53-flash-disagg-gb200` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-3-flash-glm53-flash-disagg-gb200.yaml` |
| `glm-5-nvfp4-glm5-sglang` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-nvfp4-glm5-sglang.yaml` |
| `glm-5-nvfp4-glm5-sglang-efa` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-nvfp4-glm5-sglang-efa.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-gb200-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-gb200-bf16.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-gb200-mtp-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-gb200-mtp-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-agg-gb200-dspark-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-gb200-dspark-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-agg-gb200-mtp-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-gb200-mtp-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-gb200-dflash-bf16` | 2 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-gb200-dflash-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-gb200-dspark-bf16` | 2 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-gb200-dspark-bf16.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `nemotron-3-ultra-ultra-agg-gb200-1m-kv-router` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-agg-gb200-1m-kv-router.yaml` |
| `nemotron-3-ultra-ultra-agg-gb200-256k-kv-router` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-agg-gb200-256k-kv-router.yaml` |
| `nemotron-3-ultra-ultra-disagg-gb200-1m` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-disagg-gb200-1m.yaml` |
| `nemotron-3-ultra-ultra-disagg-gb200-256k` | 12 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-disagg-gb200-256k.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-a3b-qwen36-35b-a3b-sglang-gb200-agg-agentic` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-a3b-qwen36-35b-a3b-sglang-gb200-agg-agentic.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-agg` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-agg.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-agg-agentic-vllm-agg-gb200-agentic-deploy` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-agg-agentic-vllm-agg-gb200-agentic-deploy.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-agg` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-agg.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-disagg` | 12 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-disagg.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`gb200-oke-ubuntu-inference-dynamo` (accelerator gb200) carries 77 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-gb200-deploy` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-0813-agg-gb200-agentic` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-0813-agg-gb200-agentic.yaml` |
| `deepseek-v4-dsv4-pro-0813-disagg-gb200-agentic` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-0813-disagg-gb200-agentic.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gemma4-31b-gemma4-31b-agg-gb200-agentic` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gemma4-31b-gemma4-31b-agg-gb200-agentic.yaml` |
| `glm-5-3-flash-glm53-flash-agg-gb200-agentic` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-3-flash-glm53-flash-agg-gb200-agentic.yaml` |
| `glm-5-3-flash-glm53-flash-disagg-gb200` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-3-flash-glm53-flash-disagg-gb200.yaml` |
| `glm-5-nvfp4-glm5-sglang` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-nvfp4-glm5-sglang.yaml` |
| `glm-5-nvfp4-glm5-sglang-efa` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/glm-5-nvfp4-glm5-sglang-efa.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-gb200-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-gb200-bf16.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-gb200-mtp-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-gb200-mtp-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-agg-gb200-dspark-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-gb200-dspark-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-agg-gb200-mtp-bf16` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-gb200-mtp-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-gb200-dflash-bf16` | 2 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-gb200-dflash-bf16.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-gb200-dspark-bf16` | 2 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-gb200-dspark-bf16.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `nemotron-3-ultra-ultra-agg-gb200-1m-kv-router` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-agg-gb200-1m-kv-router.yaml` |
| `nemotron-3-ultra-ultra-agg-gb200-256k-kv-router` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-agg-gb200-256k-kv-router.yaml` |
| `nemotron-3-ultra-ultra-disagg-gb200-1m` | 8 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-disagg-gb200-1m.yaml` |
| `nemotron-3-ultra-ultra-disagg-gb200-256k` | 12 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-ultra-ultra-disagg-gb200-256k.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-a3b-qwen36-35b-a3b-sglang-gb200-agg-agentic` | 1 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-a3b-qwen36-35b-a3b-sglang-gb200-agg-agentic.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-agg` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-agg.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-agg-agentic-vllm-agg-gb200-agentic-deploy` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-agg-agentic-vllm-agg-gb200-agentic-deploy.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-agg` | 4 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-agg.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-disagg` | 12 | gb200 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-sgl-disagg.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`gb300-eks-ubuntu-inference-dynamo` (accelerator gb300) carries 61 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `inkling-inkling-vllm-gb300-agg-agentic` | 8 | gb300 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/inkling-inkling-vllm-gb300-agg-agentic.yaml` |
| `inkling-inkling-vllm-gb300-disagg-agentic-vllm-disagg-gb300-agentic-deploy-aws-roce` | 8 | gb300 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/inkling-inkling-vllm-gb300-disagg-agentic-vllm-disagg-gb300-agentic-deploy-aws-roce.yaml` |
| `inkling-inkling-vllm-gb300-disagg-agentic-vllm-disagg-gb300-agentic-deploy-generic` | 8 | gb300 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/inkling-inkling-vllm-gb300-disagg-agentic-vllm-disagg-gb300-agentic-deploy-generic.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-agg-agentic-vllm-agg-gb300-agentic-deploy` | 4 | gb300 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-agg-agentic-vllm-agg-gb300-agentic-deploy.yaml` |
| `qwen3-8-2-4t-a95b-fp8-qwen38max-agg-chat` | 4 | gb300 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-qwen38max-agg-chat.yaml` |
| `qwen3-8-2-4t-a95b-fp8-sglang-qwen38max-1p1d` | 8 | gb300 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-sglang-qwen38max-1p1d.yaml` |
| `qwen3-8-2-4t-a95b-fp8-sglang-qwen38max-agg` | 4 | gb300 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-8-2-4t-a95b-fp8-sglang-qwen38max-agg.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`h100-aks-ubuntu-inference-dynamo` (accelerator h100) carries 61 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dflash` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router` | 4 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dflash` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dspark` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dspark.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`h100-eks-ubuntu-inference-dynamo` (accelerator h100) carries 61 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dflash` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router` | 4 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dflash` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dspark` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dspark.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`h100-gke-cos-inference-dynamo` (accelerator h100) carries 61 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dflash` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router` | 4 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dflash` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dspark` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dspark.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`h100-kind-inference-dynamo` (accelerator h100) carries 61 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-5-lightning-trtllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-trtllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dflash` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router` | 4 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-dspark-kv-router.yaml` |
| `nemotron-3-5-lightning-vllm-agg-h100-mtp` | 1 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-agg-h100-mtp.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dflash` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dflash.yaml` |
| `nemotron-3-5-lightning-vllm-disagg-h100-dspark` | 2 | h100 | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-5-lightning-vllm-disagg-h100-dspark.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`rtx-pro-6000-eks-ubuntu-inference-dynamo` (accelerator rtx-pro-6000) carries 54 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

`vr200-rke2-ubuntu-inference-dynamo` (accelerator vr200) carries 54 members.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `deepseek-r1-sgl-dsr1-16gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-16gpu.yaml` |
| `deepseek-r1-sgl-dsr1-8gpu` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-sgl-dsr1-8gpu.yaml` |
| `deepseek-r1-trtllm-disagg-multinode` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-trtllm-disagg-multinode.yaml` |
| `deepseek-r1-vllm-dsr1` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-r1-vllm-dsr1.yaml` |
| `deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-flash-agg-deepseek-v4-flash-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-b200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-agg-deepseek-v4-pro-vllm-agg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-sglang-disagg-gb200-deploy.yaml` |
| `deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-dsv4-pro-disagg-deepseek-v4-pro-vllm-disagg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-flash-deepseek-v4-flash-sglang-agg-gb200-deploy.yaml` |
| `deepseek-v4-sglang-dsv4-pro-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/deepseek-v4-sglang-dsv4-pro-agg.yaml` |
| `gpt-oss-120b-gpt-oss-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-agg.yaml` |
| `gpt-oss-120b-gpt-oss-disagg` | 5 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/gpt-oss-120b-gpt-oss-disagg.yaml` |
| `kimi-k2-5-kimi-k25-agg-kv-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-kv-eagle.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr.yaml` |
| `kimi-k2-5-kimi-k25-agg-rr-eagle` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-agg-rr-eagle.yaml` |
| `kimi-k2-5-kimi-k25-disagg-kv-eagle` | 24 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k2-5-kimi-k25-disagg-kv-eagle.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb200-disagg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb200-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-agg-agentic` | 12 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-sglang-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-sglang-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb200-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb200-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-agg-agentic` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-agg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-gb300-disagg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-gb300-disagg-agentic.yaml` |
| `kimi-k3-kimi-k3-vllm-h200-agg-agentic` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/kimi-k3-kimi-k3-vllm-h200-agg-agentic.yaml` |
| `nemotron-3-nano-omni-nemotron-omni-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-nano-omni-nemotron-omni-vllm-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-agg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-sglang-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-trtllm-disagg.yaml` |
| `nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg` | 4 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/nemotron-3-super-fp8-nemotron-super-fp8-vllm-agg.yaml` |
| `qwen3-0-6b-qwen3-0-6b-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-0-6b-qwen3-0-6b-agg.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-blackwell-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-agg-trtllm-agg-hopper-deploy.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-aws-p6-b200-48xlarge.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-gcp-roce.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-generic.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-blackwell-deploy-nscale-ib.yaml` |
| `qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-235b-a22b-fp8-qwen3-235b-a22b-disagg-trtllm-disagg-hopper-deploy.yaml` |
| `qwen3-32b-agg-8xtp2` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-8xtp2.yaml` |
| `qwen3-32b-agg-kvbm-qwen3-32b` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-agg-kvbm-qwen3-32b.yaml` |
| `qwen3-32b-disagg-router-6p-2d` | 16 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-disagg-router-6p-2d.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-agg` | 2 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-agg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-disagg.yaml` |
| `qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-fp8-qwen3-32b-fp8-vllm-disagg.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aks-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-aws-p5-48xlarge.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-gke-roce.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nebius-ib.yaml` |
| `qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib` | 8 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-32b-q32b-1p1d-cloud-provider-vllm-cloud-providers-deploy-nscale-ib.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd.yaml` |
| `qwen3-6-35b-qwen36-dynamo-fd-ec` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-6-35b-qwen36-dynamo-fd-ec.yaml` |
| `qwen3-vl-30b-qwen3-vl-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-30b-qwen3-vl-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg` | 1 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-agg.yaml` |
| `qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg` | 0 | generic | retained-dynamographdeployment | `data/aicr-dynamo-models/profiles/qwen3-vl-32b-fp8-qwen3-vl-32b-fp8-vllm-disagg.yaml` |

## Any delivery (29 platforms)

None of the 29 delivery-agnostic platforms carry a member yet.

| Platform | Accelerator | Reason |
| --- | --- | --- |
| `aks-inference` | any | base substrate, no serving layer bound |
| `b200-gke-cos-inference` | b200 | base substrate, no serving layer bound |
| `bcm-inference` | any | base substrate, no serving layer bound |
| `eks-inference` | any | base substrate, no serving layer bound |
| `gb200-eks-inference` | gb200 | base substrate, no serving layer bound |
| `gb200-eks-ubuntu-inference` | gb200 | base substrate, no serving layer bound |
| `gb200-oke-inference` | gb200 | base substrate, no serving layer bound |
| `gb200-oke-ubuntu-inference` | gb200 | base substrate, no serving layer bound |
| `gb300-eks-inference` | gb300 | base substrate, no serving layer bound |
| `gb300-eks-ubuntu-inference` | gb300 | base substrate, no serving layer bound |
| `gke-cos-inference` | any | base substrate, no serving layer bound |
| `h100-aks-inference` | h100 | base substrate, no serving layer bound |
| `h100-aks-ubuntu-inference` | h100 | base substrate, no serving layer bound |
| `h100-eks-inference` | h100 | base substrate, no serving layer bound |
| `h100-eks-ubuntu-inference` | h100 | base substrate, no serving layer bound |
| `h100-gke-cos-inference` | h100 | base substrate, no serving layer bound |
| `h100-kind-inference` | h100 | base substrate, no serving layer bound |
| `h200-eks-inference` | h200 | base substrate, no serving layer bound |
| `kind-inference` | any | base substrate, no serving layer bound |
| `l40s-oke-inference` | l40s | base substrate, no serving layer bound |
| `lke-inference` | any | base substrate, no serving layer bound |
| `ocp-inference` | any | base substrate, no serving layer bound |
| `oke-ol-inference` | any | base substrate, no serving layer bound |
| `rke2-inference` | any | base substrate, no serving layer bound |
| `rtx-pro-6000-eks-inference` | rtx-pro-6000 | base substrate, no serving layer bound |
| `rtx-pro-6000-eks-ubuntu-inference` | rtx-pro-6000 | base substrate, no serving layer bound |
| `rtx-pro-6000-lke-inference` | rtx-pro-6000 | base substrate, no serving layer bound |
| `rtx-pro-6000-lke-ubuntu-inference` | rtx-pro-6000 | base substrate, no serving layer bound |
| `vr200-rke2-ubuntu-inference` | vr200 | base substrate, no serving layer bound |

## Regenerate and verify

```sh
npm run aicr-platform-members:generate
npm run aicr-platform-members:verify
```
