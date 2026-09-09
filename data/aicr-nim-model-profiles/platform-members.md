# Platform-to-model membership for the AICR inference catalog

This is a delivery-scoped join between every inference platform in the AICR
catalog and its retained model configurations. This catalog names
44 inference platforms, and 2 of them carry a member
today: the KServe reference entry with its sixteen retained model shapes,
and the one h100 NIM platform that carries an authored NIMService.
Attachment follows each model's own delivery mechanism. A KServe model
shape attaches only to the KServe platform. A NIMService attaches only to
the NIM platform it was authored against. No model ever crosses from one
delivery mechanism to another, and this contract's verifier checks that
boundary on every row it reads.

Membership describes authored delivery attachment, not verified execution or
hardware compatibility. GPU counts are requested resources, not observed available
capacity. This join does not check scheduling, GPU product or memory suitability,
registry access, model entitlement, controller readiness or inference responses.
Consult each member's source and its scoped receipts before selecting a target.

The remaining 42 platforms carry no member yet, and each one states why.
13 of them, the other NIM platforms and the Dynamo
platforms, are waiting on a model that has not yet been generated or
retained. The other 29 are base substrate with no serving layer
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

`eks-h100-inference-nim` (accelerator h100) carries 1 member.

| Model slug | GPU count | Accelerator | Member source | Source file |
| --- | --- | --- | --- | --- |
| `llama-3-1-8b-instruct` | 1 | h100 | authored-nimservice | `examples/aicr/eks-h100-inference-nim/authored/nimservice-llama-3-1-8b.yaml` |

The other 3 NIM platforms carry no members yet.

| Platform | Accelerator | Reason |
| --- | --- | --- |
| `h100-eks-ubuntu-inference-nim` | h100 | no NIMService models generated for this platform yet |
| `ocp-inference-nim` | any | no NIMService models generated for this platform yet |
| `rtx-pro-6000-eks-ubuntu-inference-nim` | rtx-pro-6000 | no NIMService models generated for this platform yet |

## Dynamo delivery (10 platforms)

None of the 10 Dynamo platforms carry a member yet.

| Platform | Accelerator | Reason |
| --- | --- | --- |
| `b200-gke-cos-inference-dynamo` | b200 | no Dynamo model shapes retained |
| `gb200-eks-ubuntu-inference-dynamo` | gb200 | no Dynamo model shapes retained |
| `gb200-oke-ubuntu-inference-dynamo` | gb200 | no Dynamo model shapes retained |
| `gb300-eks-ubuntu-inference-dynamo` | gb300 | no Dynamo model shapes retained |
| `h100-aks-ubuntu-inference-dynamo` | h100 | no Dynamo model shapes retained |
| `h100-eks-ubuntu-inference-dynamo` | h100 | no Dynamo model shapes retained |
| `h100-gke-cos-inference-dynamo` | h100 | no Dynamo model shapes retained |
| `h100-kind-inference-dynamo` | h100 | no Dynamo model shapes retained |
| `rtx-pro-6000-eks-ubuntu-inference-dynamo` | rtx-pro-6000 | no Dynamo model shapes retained |
| `vr200-rke2-ubuntu-inference-dynamo` | vr200 | no Dynamo model shapes retained |

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
