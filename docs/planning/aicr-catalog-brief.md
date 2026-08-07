# Brief: an AICR catalog with an OCI digest spine

Status: proposal, 2026-08-06. Nothing here is built. This brief exists so the next session starts from decisions, not archaeology.

## Purpose

Extend the receipts-everywhere catalog discipline from single charts and the Kubara platform to whole AI-platform shapes. Ship a small catalog of AICR configurations where every entry has retained exact versions, every package is an immutable OCI digest, and every claim carries a receipt. Nobody in the AI-infrastructure space offers governed, provenance-carrying platform configuration; teams copy YAML from blog posts, and an H100 misconfiguration has a dollar sign attached.

## What exists today

- One example, `examples/aicr/eks-h100-training-kubeflow`, already packaged in every transport the doctrine wants: Argo rendered, Flux bundle, OCI layouts, Helm bundle.
- Twelve npm lanes (`aicr-*`) covering verify, publish, hub sync and record, policy check, and promotion.
- Two committed proofs: an OCI roundtrip receipt (pass) and a variant-promotion receipt that imported AICR v0.14.0's 17 Argo Applications with sync-wave order preserved, changed one Grafana credential to a real Secret in a development variant, previewed with a dry run that named the affected Application, and promoted to staging with matching data hashes.
- Honest UNOFFICIAL/EXPERIMENTAL labels throughout, and three AICR Spaces in the demo organization.

The mechanics are proven. The catalog, the digest spine, and the story are not built.

## Design

1. **Catalog taxonomy.** Three entry classes to start: a training shape (the existing H100/Kubeflow example), an inference or serving shape (KServe or vLLM on GPU nodes), and a CPU-only starter anyone can run. Training versus inference versus starter is a real buyer taxonomy.
2. **OCI digest spine.** Port the pattern the Kubara importer proved: one immutable OCI package per component plus a digest-bound platform index that pins the whole shape. The compiler code lives in github.com/confighub/kubara-confighub (`scripts/import-kubara-git-revision.mjs` and the app-release compilers) and generalizes.
3. **Retained versions.** Each catalog entry keeps its exact upstream versions retained, the way the chart catalog and the Kubara component catalog do.
4. **Variants where AI infrastructure actually varies.** GPU class and count, storage class, secrets handling, region. This is the natural fit for the Pilot ad-hoc variant model: variants generated on demand, gated by parity, author not authority (see `docs/planning` Pilot notes and PR #1082).

## Proof ladder

1. Deterministic self-tests against fake Git, OCI, and ConfigHub surfaces, in the importer's style.
2. Config-plane live proofs on kind: import, variant, promotion, delivery, and the changed/no-op idempotence pair.
3. An explicit boundary, stated in every receipt and caption: kind proves config mechanics, not GPU workloads. Workload-plane claims wait until a real GPU target exists, and stay absent rather than implied.

## Honest boundaries

- **Sourcing.** One credible AICR exists. More entries must come from upstream AICR versions or deliberately authored shapes with named provenance. Manufactured variety would be fake breadth; refuse it.
- **Labels.** UNOFFICIAL/EXPERIMENTAL stays on every surface until a proof earns its removal.

## Research findings

The three pre-build questions were answered on 2026-08-06 and 2026-08-07:

1. **AICR community trajectory.** AICR is NVIDIA's AI Cluster Runtime (github.com/NVIDIA/aicr), Apache-2.0, created January 2026, with roughly biweekly minor releases, thirty contributors, and daily pushes. Verdict: a young but rising NVIDIA-backed standard and a credible upstream; catalog breadth comes from its own recipe catalog (EKS, GKE, and self-managed, across H100 and GB200), never from manufactured variety. Our retained v0.14.0 against a moving upstream is itself the retained-versions story.
2. **NVIDIA NIM.** Deployment shapes are packagable from public surfaces (Helm charts, the NIM Operator CRDs, and the NVIDIA/nim-deploy reference repo). The boundary: NIM runtime images and models are NGC-gated under NVIDIA AI Enterprise licensing, so the catalog retains deployment shapes and records gated references as data, never redistributing artifacts, keys, or benchmark observations. The full license read lives in docs/planning/nim-ngc-license-read.md, and its refusals are enforced in the compiler.
3. **Inference-shape sourcing.** NVIDIA/nim-deploy's KServe path won: the nim-llm Helm chart moved to NGC-only distribution upstream, leaving the KServe subtree as the retainable Apache-2.0 surface. The retained entry lives at examples/aicr/kserve-nim-inference.

## First increment## First increment

Delivered: the digest-index compiler landed for the H100 example, followed by the catalog overview page, the NGC license read, the retained KServe/NIM inference entry, the CPU starter, and two live config-plane proofs of the starter against ConfigHub and kind. The original plan follows for the record. Port the digest-index compiler to AICR and produce the index for the existing H100 example, with self-tests. That alone upgrades the current story from "we imported an OCI" to "the whole shape is pinned by one digest," using code that already exists. Everything else follows the Kubara playbook: reference deployment, governed change story, receipts, frames, two-path page.
