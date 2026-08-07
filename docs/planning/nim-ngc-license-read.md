# The NGC/NIM license read for the inference entry

Status: research record, read 2026-08-07. This memo records what the NVIDIA
licensing surfaces permit and forbid for a config-plane inference entry in the
AICR catalog. It is an engineering read of public terms, not legal advice. Every
claim cites its source and the date it was read; NVIDIA revises these documents,
and per-artifact governing terms on NGC catalog pages override any general
statement here.

## Why this read happened before any build

The [AICR catalog brief](./aicr-catalog-brief.md) plans an inference entry
sourced from NVIDIA's NIM deployment surfaces, and the
[catalog overview](../demo/aicr/index.md) states the boundary in one line:
catalog the deployment shapes, never redistribute the gated artifacts. This
memo verifies that the line holds under the actual license text, and turns it
into a concrete contract the entry must follow.

## What the sources say

### The deployment scaffolding carries Apache-2.0

- [NVIDIA/nim-deploy](https://github.com/NVIDIA/nim-deploy) is Apache-2.0. The
  repository describes itself as reference implementations, holding YAML files,
  Helm charts, operator code, and guides, and warns that it is experimental and
  carries no enterprise support. It points long-term production users to the
  official releases on NGC.
- [NVIDIA/k8s-nim-operator](https://github.com/NVIDIA/k8s-nim-operator) is
  Apache-2.0. It provides the NIMCache, NIMService, and NIMPipeline custom
  resources, plus the NeMo customizer, evaluator, and guardrail resources.

Apache-2.0 permits retention, modification, and redistribution with attribution
and license preservation. The whole config plane of a NIM deployment, meaning
the charts, the CRDs, the values, and the manifests rendered from them, can be
retained in this catalog the same way the H100 training entry retains its
rendered Applications.

### The runtime artifacts sit behind NVIDIA's enterprise license

- The [NVIDIA Software License Agreement](https://www.nvidia.com/en-us/agreements/enterprise-software/nvidia-software-license-agreement/)
  governs enterprise software delivered through NGC. Section 8.5 forbids
  copying, reselling, renting, sublicensing, transferring, or distributing the
  software. Section 5 makes the customer responsible for securely maintaining
  log-in information, which covers NGC API keys. Section 8.9 forbids sharing
  benchmarking, competitive analysis, or performance data without written
  consent.
- The [Product-Specific Terms for AI Products](https://www.nvidia.com/en-us/agreements/enterprise-software/product-specific-terms-for-ai-products/)
  add the NIM-specific layer. Section B.2 separates trial and
  not-for-resale licenses from production use. Section E permits community NIMs
  on RTX and GeForce systems without a subscription only outside commercial
  multi-user serving; commercial deployment requires an NVIDIA AI Enterprise
  subscription. Section 1.7 attaches notice and usage-reporting duties to any
  distribution of derivative materials from enterprise products. Section G.1.1
  documents NIM telemetry and its `NIM_TELEMETRY_MODE` control.
- The [NVIDIA Deep Learning Container License](https://developer.download.nvidia.com/licenses/NVIDIA_Deep_Learning_Container_License.pdf)
  governs many general NGC containers and likewise forbids redistribution.
- [developer.nvidia.com/nim](https://developer.nvidia.com/nim) offers free
  hosted API endpoints for prototyping through the Developer Program and points
  production users to NVIDIA AI Enterprise. Third-party reports describe
  per-GPU AI Enterprise pricing and a free development tier for self-hosted
  NIMs; those figures did not come from an NVIDIA page during this read and
  stay out of the catalog's claims.
- Model weights carry their own per-model licenses that vary by model. An NGC
  catalog page can name governing terms per artifact, and those per-artifact
  terms are the authority for that artifact.

## The verdict for a config-plane entry

The planned boundary holds, and it is sharper than expected in our favor. The
license line and the config-plane line coincide: everything the catalog wants
to retain is Apache-2.0 scaffolding, and everything the licenses gate is
runtime material the catalog never touches anyway.

The entry may:

- Retain the nim-deploy charts and the NIM Operator CRDs from their Apache-2.0
  GitHub sources, with attribution and the upstream license preserved, pinned
  by exact commit the way the training entry pins AICR v0.14.0.
- Author and retain values, variants, and rendered manifests derived from that
  Apache-2.0 scaffolding, and pin them under a digest-bound platform index.
- Record `nvcr.io` image references and digests, model names, and per-model
  license names as configuration data. A reference is data about what the
  user's cluster would pull with the user's own entitlement; recording it
  redistributes nothing.
- Surface `NIM_TELEMETRY_MODE` as a first-class control point in variants,
  since the product terms document it as the telemetry control.

The entry must never:

- Mirror, re-publish, or cache NIM container images, model weights, or any
  NGC-delivered artifact in the catalog's OCI namespace. Section 8.5 forbids
  it, and the catalog has no need for it.
- Commit or embed an NGC API key anywhere. The key is the user's credential
  under Section 5 and enters the shape only as a target fact, the same way the
  training entry externalizes its secrets.
- Publish performance or benchmarking observations of NIM services. Section
  8.9 forbids it without consent. The catalog's config-plane-only boundary
  already keeps every receipt on this side of that line, because no NIM
  workload runs in any proof.
- Retain chart artifacts served from the NGC registry itself. The GitHub
  Apache-2.0 tree is the provenance the catalog uses; anything delivered
  through NGC is treated as gated unless that artifact's own governing terms
  say otherwise.
- State which license tier a user needs. The entry links NVIDIA's pages and
  says that production self-hosted NIM requires an NVIDIA AI Enterprise
  subscription per NVIDIA's terms, and leaves tier selection between the user
  and NVIDIA.

## What this means for the proof design

Config-plane proofs for the inference entry run exactly like the training
entry's proofs. They render the Apache-2.0 charts on kind with placeholder pull
secrets, exercise import, variant, promotion, and delivery wiring through
ConfigHub, and never pull from `nvcr.io`. This respects the license boundary
and the no-GPU boundary with one design: the gated pull happens only on the
user's cluster, with the user's key, under the user's entitlement. Every
receipt states that no NIM container ran and no model was fetched.

## Open items before the entry is built

1. Pick the exact nim-deploy chart and operator version to retain, and record
   their commits the way the training entry records its release pins.
2. Choose the first model profile to describe as data, and record that model's
   own license name from its NGC page as part of the entry.
3. Re-read the per-artifact governing terms on the specific NGC pages the entry
   references at build time, since per-artifact terms override this general
   read.
