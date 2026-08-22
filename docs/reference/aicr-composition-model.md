# How AICR composes a platform, and where it overlaps this catalog

Maintained reference, first written from AICR v0.14.0 and updated with the
retained [v0.19.0 entry](../demo/aicr/eks-h100-training-kubeflow-v0-19-0.md).
The catalog keeps v0.14.0, v0.18.0, and v0.19.0 side by side. Version-specific
statements link to the corresponding receipt instead of being silently moved to
the newest release.

This page explains what AICR produces and how those outputs fit the ConfigHub
processing model. AICR owns source composition and its native recipe format.
ConfigHub retains, compares, changes, approves, promotes, and delivers the exact
configuration produced from that source.

## The composition model

AICR calls its resolved source document a **recipe**. That is AICR's native
term, not the general name for every configuration in this catalog. An AICR
recipe is a declarative document, not a script. Overlays inherit from each
other, mixins add capability groups, and the resolved result names its
components, its ordering, and its checks.

- **Overlays** live in `recipes/overlays/` and carry
  `kind: RecipeMetadata`, `apiVersion: aicr.nvidia.com/v1alpha1`. Each names a
  `base`, a set of `criteria`, `constraints`, and `componentRefs`. v0.14.0
  ships 79 of them, from `base.yaml` through `eks.yaml` and `eks-training.yaml`
  to `h100-eks-ubuntu-training-kubeflow.yaml`.
- **Mixins** live in `recipes/mixins/` and carry `kind: RecipeMixin`. v0.14.0
  ships four: `os-ubuntu`, `os-talos`, `platform-kubeflow`, and
  `platform-inference`. The inference mixin is what adds the agentgateway
  Gateway API and inference-extension components.
- **The component registry** in `recipes/registry.yaml` declares roughly
  thirty-eight components. Each entry names its Helm repository, chart, and
  default version, or its Kustomize source, plus a `healthCheck.assertFile`,
  a `testTier`, and `nodeScheduling` paths.
- **Resolution** merges base, overlay, mixins, and inline overrides. The
  generated recipe carries `criteria`, `constraints`, `componentRefs`,
  `validation`, and an explicit `deploymentOrder`.

Running the pinned binary makes the layering visible. Asking for the training
shape this catalog retains reports eight overlays resolved into thirteen
components for kind and seventeen for EKS, with a `deploymentOrder` list that
is the dependency order, not a rendering artifact.

## The command surface, and what it overlaps here

AICR is a larger tool than "generate a bundle", and several of its commands
address problems this catalog also addresses. Naming the overlaps is more
useful than discovering them later.

| AICR command | What it does | What it overlaps here |
| --- | --- | --- |
| `recipe` | Resolves criteria into components and order | The catalog's recipe and dossier records |
| `query` | Extracts a hydrated value by dot-path selector | Control points, expressed upstream and machine-readably |
| `bundle` | Generates the deployment bundle | Flattening and packaging |
| `verify` | Verifies bundle integrity and attestation chain | The signature verification lane |
| `trust` | Manages the Sigstore trusted root | The committed trust root decision |
| `evidence` | Inspects and verifies recipe-evidence v1 bundles | Receipts, almost exactly |
| `validate` | Runs containerized validators against a cluster | Live proofs |
| `snapshot` and `diff` | Capture cluster state and detect drift | Reverse reconcile and cub-scout |
| `mirror` | Discovers images and charts for air-gapped use | Remote dependency closure and image lists |
| `skill` | Writes an agent skill file for the CLI | Generated chart skills |

Two of these deserve emphasis. `aicr query` resolves a dot-path such as
`components.<name>.values.<path>` or `deploymentOrder` against the hydrated
recipe, which means AICR already publishes machine-readably what the catalog's
control-point records currently declare by hand. And `aicr evidence` operates
on evidence bundles produced by `aicr validate --emit-attestation`, described
upstream as letting maintainers and CI verify a contribution without re-running
validators against hardware they may not have. That is this project's own
receipts thesis, arrived at independently by the upstream project.

## What v0.19.0 adds to the field-ownership model

AICR v0.19.0 introduces named `gpuStack` profiles for its AKS and GKE source
families. A selected profile owns a related group of fields. Bundle generation
refuses a conflicting value and refuses to expose a profile-owned path as an
install-time parameter.

That maps directly to ConfigHub's protected-field decision:

1. Keep the selected AICR profile in the source-and-intent record.
2. Regenerate the base when a change belongs to that profile.
3. Use a derived ConfigHub variant only for a field the selected source leaves
   open to later change.
4. Review an overlap before promotion when a refreshed source and a retained
   variant both touch the same field.

The retained EKS H100 training recipe is unprofiled. Selecting the AKS
`gpuStack` profile for it is refused. We therefore record GPU-driver ownership
as unresolved target-specific work for this EKS entry rather than applying the
AKS rule to a different source family. The exact commands and results are in
the [field-policy assessment](../../examples/aicr/eks-h100-training-kubeflow-v0-19-0/field-policy-assessment.yaml).

This gives each record one job:

- the AICR recipe records the selected platform source;
- the generated Helm chart records the source package Argo CD can process;
- the exact Application revision records what ConfigHub can retain now;
- the route intent records lifecycle work around apply; and
- receipts record which generation, check, promotion, delivery, or runtime step
  actually ran.

## What the study settled about our entries

**The inference entry could have been AICR-native.** At v0.14.0, `platform: nim`
is a first-class criteria value with its own overlay, and `k8s-nim-operator` is
a registered component. Generating that recipe produces seventeen components
including the NIM operator at 3.1.0 and the agentgateway inference gateway. The
catalog instead retains the KServe subtree of NVIDIA/nim-deploy, which is a
legitimate NVIDIA reference implementation under Apache-2.0, but it is a
different repository and a different deployment approach. The choice was made
without knowing the native path existed, and the earlier description of
nim-deploy as the strongest upstream candidate for an inference shape is
therefore wrong and is corrected on the entry pages.

**The CPU starter is not a duplicate of an upstream path, and it is also a
shape AICR would never emit.** AICR's kind overlays exist, but they are for GPU
passthrough and assume host NVIDIA drivers. Asking for a recipe with no
accelerator at all still returns `gpu-operator`, `nvidia-dra-driver-gpu`, and
`nvsentinel`, because the GPU stack lives in `base.yaml`. There is no
accelerator-free recipe. The starter therefore fills a real gap rather than
duplicating one, and the honest framing is that it is this catalog's own
derivation rather than an AICR-supported configuration. The entry pages now
say so.

**The deployment order is upstream data.** Recipes carry an explicit
`deploymentOrder`. The rendered Applications encode that order as sync-waves,
and the delivery proof holds the application controller at zero because
ordering was treated as unearned. The ordering is not unearned; it is declared
upstream, and the proof can eventually cite it rather than avoid it.

## What this changes about the catalog's posture

The catalog's value proposition for AICR was retention, digest pinning, and
receipts. Retention and digest pinning remain unambiguously ours. Receipts
overlap upstream evidence bundles, and the honest position is that the catalog
governs configuration across producers while AICR validates its own recipes
against hardware. Those are complementary, but the difference should be stated
rather than assumed, and the wording on the public pages should not imply the
catalog invented provenance for a project that ships its own attestation chain.

## What was not studied

The `aicrd` daemon shipped in the release assets, the containerized validators,
the evidence bundle format in detail, the snapshot schema, and the validation
dashboard were all left for later. Nothing here claims knowledge of them.
