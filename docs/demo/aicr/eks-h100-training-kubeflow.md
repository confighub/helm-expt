# AICR EKS H100 training example

This example asks NVIDIA AICR v0.14.0 for an EKS platform with H100 accelerators,
Ubuntu, Kubeflow, and a training workload. AICR selects 15 versioned components and
puts them in dependency order. The result includes storage, networking, certificates,
GPU support, monitoring, scheduling, and Kubeflow training.

ConfigHub does not replace AICR. AICR decides what belongs in the platform package.
ConfigHub records that decision as configuration a team can inspect, compare, approve,
and assign to clusters. Development, staging, production, or cluster-class changes can
then be kept as named variants instead of rebuilding the package by hand.

## What problem this solves

The recipe pins most of the platform before installation. Four choices shape this
example: the StorageClass, the selector for accelerated nodes, the selector for
training workloads, and the source the delivery controller reads. The first three are
fixed when the bundle is generated. The fourth must point at the published bundle.

Keeping the recipe, those four choices, and the generated files together answers two
practical questions later: what did we ask AICR to build, and what did each cluster
actually receive?

## What is committed

- [aicr.yaml](../../../examples/aicr/eks-h100-training-kubeflow/aicr.yaml) is the
  `AICRConfig` that describes the recipe and bundle commands.
- [recipe.yaml](../../../examples/aicr/eks-h100-training-kubeflow/recipe.yaml) is the
  generated component recipe.
- [flux-bundle/README.md](../../../examples/aicr/eks-h100-training-kubeflow/flux-bundle/README.md)
  describes AICR's original Git-oriented Flux resources.
- [flux-oci-bundle/kustomization.yaml](../../../examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle/kustomization.yaml)
  is the entry point for the Flux resources AICR generated for OCI delivery; its
  [checksums.txt](../../../examples/aicr/eks-h100-training-kubeflow/flux-oci-bundle/checksums.txt)
  records every generated file.
- [local-oci-manifest.json](../../../examples/aicr/eks-h100-training-kubeflow/local-oci-manifest.json)
  is the exact manifest from the temporary local OCI registry.
- [generation-receipt.yaml](../../../examples/aicr/eks-h100-training-kubeflow/generation-receipt.yaml)
  records the release commit, binary checksums, criteria, options, commands, local OCI
  digest, Flux requirements, and current proof boundary.
- [argocd-helm-bundle/Chart.yaml](../../../examples/aicr/eks-h100-training-kubeflow/argocd-helm-bundle/Chart.yaml)
  is AICR's portable Argo CD source chart.
- [argocd-rendered/checksums.txt](../../../examples/aicr/eks-h100-training-kubeflow/argocd-rendered/checksums.txt)
  records the 17 concrete Argo CD `Application` objects rendered from that chart.
- [argocd-oci-receipt.yaml](../../../examples/aicr/eks-h100-training-kubeflow/argocd-oci-receipt.yaml)
  joins the source chart, rendered objects, two tested local OCI artifacts, and their
  intended public references.
- [confighub-upload-receipt.yaml](../../../examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml)
  records the ConfigHub Space, Unit, source digest, policy, and exact-object comparison
  from the live upload.

The original Git-oriented bundle still contains
`https://github.com/YOUR_ORG/YOUR_REPO.git`. It is kept so the limitation is visible;
it is not deployable.

The OCI-oriented bundle has no repository placeholder. AICR replaces its two local
charts with `ArtifactGenerator` resources, and their `HelmRelease` objects refer to
`ExternalArtifact` outputs. The generated `checksums.txt` originally contained the
absolute output directory. The committed copy changes only those path prefixes to
paths relative to the bundle root, so the checksum list is portable and does not expose
a workstation path.

## Rebuild the example

Install AICR v0.14.0, then run these commands from the example directory:

```bash
aicr recipe \
  --service eks \
  --accelerator h100 \
  --os ubuntu \
  --intent training \
  --platform kubeflow \
  --output recipe.yaml

aicr bundle \
  --recipe recipe.yaml \
  --deployer flux \
  --output flux-bundle \
  --storage-class gp3 \
  --accelerated-node-selector nvidia.com/gpu.present=true \
  --workload-selector app.kubernetes.io/part-of=training
```

That command reproduces the Git-oriented bundle. For a usable Git bundle, add
`--repo https://github.com/ORG/REPOSITORY.git`, regenerate it, and review the resulting
GitRepository and HelmRelease objects before upload.

The OCI-oriented run used the same recipe and choices:

```bash
aicr bundle \
  --recipe recipe.yaml \
  --deployer flux \
  --output oci://REGISTRY/aicr-eks-h100-training-kubeflow:v0.14.0 \
  --image-refs oci-image-ref.txt \
  --storage-class gp3 \
  --accelerated-node-selector nvidia.com/gpu.present=true \
  --workload-selector app.kubernetes.io/part-of=training
```

For a local HTTP registry, add `--plain-http`. The recorded local manifest digest is
`sha256:b8089d6400833531c5d0d91177e70cf48f2b86896b0214c2b3318916ac4d29ba`.
This proves local packaging and pullability. It does not prove a public registry push
or a working GPU cluster.

Run `npm run aicr-example:verify` to check both bundles. The verifier checks the
criteria, command options, release and binary checksums, every generated file, the
local OCI manifest, the two `ArtifactGenerator` resources, and the matching
`ExternalArtifact` references.

## What Flux needs for the OCI bundle

AICR's OCI form requires Flux v2.7 or newer, the `source-watcher` controller, and
`ExternalArtifact=true` on `helm-controller`. The target also needs an
`OCIRepository` named `aicr-bundle` in `flux-system` that points at the published AICR
artifact. Those are part of the operating configuration, so the receipt records them
instead of leaving them as setup knowledge.

## The Argo CD path

AICR can also generate an `argocd-helm` bundle. This output is a Helm chart that
creates one parent Argo CD `Application` and 16 component `Application` objects. The
components use sync waves 0 through 15, so storage, certificates, GPU support,
monitoring, scheduling, and training are presented to Argo CD in the intended order.

Two OCI artifacts have different jobs:

| Artifact | What it contains | Who uses it |
| --- | --- | --- |
| AICR Argo source package | The generated Helm chart, values, local chart files, and Argo CD templates | Helm and Argo CD |
| Rendered Argo configuration | The 17 exact `Application` objects, one YAML layer per object | ConfigHub |

The source chart was pushed to and pulled from a temporary local registry at
`sha256:1120c9a17b23f2c885121034d55445f2d3948c95c23756d02fa2209e4baf8c2e`.
It was then rendered with the intended Google registry address. Those 17 files were
put in a second OCI artifact and pulled back at
`sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010`.
Both tested artifacts are also committed as small OCI layouts, so the same bytes can
be copied to the public registry after authentication.

Run `npm run aicr-argocd-example:verify` to check the source package, the 17
Applications, both OCI manifests and layouts, every file checksum, the source
references, and the complete set of sync waves.

## The ConfigHub base variant

The live demo used the literal Argo CD configuration artifact from a temporary local
registry:

```bash
cub variant upload \
  --component aicr-eks-h100-training-kubeflow \
  --variant v0-14-0-argocd \
  --space aicr-eks-h100-training-kubeflow-v0-14-0-argocd \
  --granularity minimal \
  oci://localhost:5002/aicr-eks-h100-training-kubeflow-argocd-config:0.14.0
```

ConfigHub pulled digest
`sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010`,
created one base Space, and stored all 17 `Application` objects in one Unit. A verifier
compared every live object with the committed AICR output and confirmed sync waves 0
through 15.

The upload also exposed two target requirements instead of hiding them: Argo CD needs
the `argocd` Namespace and the default AppProject before these Applications can run.
The live Space records those requirements in its README.

`cub variant upload` does not run AICR or render charts. It imports exact YAML and
records the source reference and resolved digest on the Space. ConfigHub can then show
changes to those files and manage derived variants for environments or cluster
classes.

After the publisher completes Google authentication and copies the artifact, the same
command can use the planned public reference without a registry login:

```bash
cub variant upload \
  --component aicr-eks-h100-training-kubeflow \
  --variant v0-14-0-argocd \
  --space aicr-eks-h100-training-kubeflow-v0-14-0-argocd \
  --granularity minimal \
  oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.14.0
```

The Google Artifact Registry pushes and anonymous pulls still need a fresh Google
login. Argo CD delivery and live GPU-cluster reconciliation have not run. The example
therefore proves generation, OCI packaging, exact ConfigHub upload, and policy
attachment, but remains partial for public distribution and live operation.
