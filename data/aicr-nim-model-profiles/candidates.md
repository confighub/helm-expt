# NIM model-shape candidates from the KServe digest index

This is a candidate-and-readiness view over the 16 candidates
that carry `role: model-shape` in the kserve-nim-inference entry's
digest-bound member index, `examples/aicr/kserve-nim-inference/digest-index/platform-index.json`. It reads each
candidate's source InferenceService and its matched ClusterServingRuntime,
then checks three readiness gates against the files this repository already
commits: whether a model-profile record exists for the shape, whether a
retention receipt exists for it, and whether its governing terms have been
read from NGC.

Of the 16 candidates, 4 carry a model-profile
record. 3 of those also carry a retention receipt, and
governing terms have been read for 1 of them. The gradient
is deliberate: a profile record can exist before a receipt backs it, and a
receipt can exist before anyone reads the per-artifact license terms.

This view is decision-neutral. It adds no register entry, creates no catalog
entry, and changes no catalog count. Whether each shape later becomes its own
top-level catalog entry, or stays a member surfaced under the KServe
platform, is a decision for a later increment to make against this table.

## Candidates

| Slug | Model family | GPU profile | GPU count | Image | Profile record | Receipt | Terms read |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `llama-3-1-70b-instruct-2xgpu` | `llama-3-1-70b-instruct` | `2xgpu` | 2 | `nvcr.io/nim/meta/llama-3.1-70b-instruct:1.1.0` | yes | yes | no |
| `llama-3-1-8b-instruct-1xgpu` | `llama-3-1-8b-instruct` | `1xgpu` | 1 | `nvcr.io/nim/meta/llama-3.1-8b-instruct:1.1.0` | yes | no | yes |
| `llama-3-3-nemotron-49b-2xgpu` | `llama-3-3-nemotron-49b` | `2xgpu` | 2 | `nvcr.io/nim/nvidia/llama-3.3-nemotron-super-49b-v1:1.8.2` | no | no | no |
| `llama3-70b-instruct-2xgpu` | `llama3-70b-instruct` | `2xgpu` | 2 | `nvcr.io/nim/meta/llama3-70b-instruct:1.0.0` | no | no | no |
| `llama3-70b-instruct-4xa100` | `llama3-70b-instruct` | `4xa100` | 4 | `nvcr.io/nim/meta/llama3-70b-instruct:1.0.0` | no | no | no |
| `llama3-70b-instruct-4xgpu` | `llama3-70b-instruct` | `4xgpu` | 4 | `nvcr.io/nim/meta/llama3-70b-instruct:1.0.0` | no | no | no |
| `llama3-70b-instruct-4xh100` | `llama3-70b-instruct` | `4xh100` | 4 | `nvcr.io/nim/meta/llama3-70b-instruct:1.0.0` | no | no | no |
| `llama3-8b-instruct-1xgpu` | `llama3-8b-instruct` | `1xgpu` | 1 | `nvcr.io/nim/meta/llama3-8b-instruct:1.0.0` | no | no | no |
| `llama3-8b-instruct-2xa100` | `llama3-8b-instruct` | `2xa100` | 2 | `nvcr.io/nim/meta/llama3-8b-instruct:1.0.0` | no | no | no |
| `llama3-8b-instruct-2xgpu` | `llama3-8b-instruct` | `2xgpu` | 2 | `nvcr.io/nim/meta/llama3-8b-instruct:1.0.0` | no | no | no |
| `llama3-8b-instruct-2xh100` | `llama3-8b-instruct` | `2xh100` | 2 | `nvcr.io/nim/meta/llama3-8b-instruct:1.0.0` | no | no | no |
| `mistral-7b-instruct-v03-1xgpu` | `mistral-7b-instruct-v03` | `1xgpu` | 1 | `nvcr.io/nim/mistralai/mistral-7b-instruct-v03:1.0.0` | no | no | no |
| `mixtral-8x22b-instruct-v01-8xgpu` | `mixtral-8x22b-instruct-v01` | `8xgpu` | 8 | `nvcr.io/nim/mistralai/mixtral-8x22b-instruct-v01:1.0.0` | no | no | no |
| `mixtral-8x7b-instruct-v01-2xgpu` | `mixtral-8x7b-instruct-v01` | `2xgpu` | 2 | `nvcr.io/nim/mistralai/mixtral-8x7b-instruct-v01:1.0.0` | yes | yes | no |
| `nv-embedqa-e5-v5-1xgpu` | `nv-embedqa-e5-v5` | `1xgpu` | 1 | `nvcr.io/nim/nvidia/nv-embedqa-e5-v5:1.0.0` | yes | yes | no |
| `nv-rerankqa-mistral-4b-v3-1xgpu` | `nv-rerankqa-mistral-4b-v3` | `1xgpu` | 1 | `nvcr.io/nim/nvidia/nv-rerankqa-mistral-4b-v3:1.0.0` | no | no | no |

## Regenerate and verify

```sh
npm run aicr-nim-model-profile-catalog:generate
npm run aicr-nim-model-profile-catalog:verify
```
