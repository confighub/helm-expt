# AICR v0.20.0 source verification

The release archive matched NVIDIA's checksum list. The extracted CLI binary
matched the SHA-256 in its signed SLSA attestation. The retained SBOM matched
its signed subject. The recipe-catalog signature also verified, and the catalog
digest was reproduced from the retained registry and validator catalog.

All three signatures identify the exact NVIDIA release workflow for `v0.20.0`:

`https://github.com/NVIDIA/aicr/.github/workflows/on-tag.yaml@refs/tags/v0.20.0`

Verification used the pinned Cosign image with networking disabled. The same
binary check refused an unrelated signer identity.

This proves the source inputs used by the retained entry. It does not prove that
the generated platform ran on EKS or an H100, and it does not cover every AICR
overlay. The [generation receipt](../../examples/aicr/eks-h100-training-kubeflow-v0-20-0/generation-receipt.yaml)
and digest index bind the generated files separately.

Run `npm run aicr-provenance-v0200:verify` to check the committed receipt and
retained bytes without Docker or network access.
