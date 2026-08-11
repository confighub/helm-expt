# Read an EKS + H100 + Kubeflow platform before you build one

This is one entry in [the AI platform catalog](./index.md). You do not need to
know AICR to follow it. AICR is a tool from NVIDIA for
building AI-cluster platforms. You describe the platform you want, for example an
EKS cluster with H100 GPUs, Ubuntu, Kubeflow, and a training job. AICR then picks
15 components, puts them in the right install order, and hands you the files to
install them. It does not decide how your team reviews, approves, or promotes
those files.

That is where ConfigHub comes in, and the boundary is the whole point. AICR
decides what goes in the platform. It selects the 15 components, sets the install
order, and writes the exact files. ConfigHub then records that decision as data a
team can govern. It stores the files, checks them, requires approval for a
cluster-wide change, and keeps a copy per environment instead of rebuilding the
package by hand. Argo CD or Flux install the approved files onto the cluster.

This example asks NVIDIA AICR v0.14.0 for an EKS platform with H100 accelerators,
Ubuntu, Kubeflow, and a training workload. The result includes storage,
networking, certificates, GPU support, monitoring, scheduling, and Kubeflow
training.

One detail shows this was operated, not just read about. AICR fixes almost the
whole platform when it builds the files. Exactly four choices stay open: the
storage type, the selector for GPU nodes, the selector for the training job, and
where the installer reads the published package. The first three are set when the
files are built. The fourth points the installer at the built package.

## Why you would want this

The recipe pins most of the platform before installation. Four choices remain at
install time: the StorageClass, the selector for accelerated nodes, the selector
for training workloads, and the source the delivery controller reads. The first
three are fixed when the bundle is generated. The fourth must point at the
published bundle.

Keeping the recipe, those four choices, and the generated files together answers two
practical questions later: what did we ask AICR to build, and what did each cluster
actually receive?

## What is in the repository

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
  joins the source chart, rendered objects, OCI layouts, and public references.
- [public-oci-receipt.yaml](../../../examples/aicr/eks-h100-training-kubeflow/public-oci-receipt.yaml)
  records the public digests and anonymous pull checks for both artifacts.
- [confighub-upload-receipt.yaml](../../../examples/aicr/eks-h100-training-kubeflow/confighub-upload-receipt.yaml)
  records the ConfigHub Space, Unit, source digest, policy, and exact-object comparison
  from the live upload.
- [apply-policy-receipt.yaml](../../../examples/aicr/eks-h100-training-kubeflow/apply-policy-receipt.yaml)
  records what happened when the unapproved AICR Unit was submitted for a dry-run
  apply.
- [promotion-readiness-receipt.yaml](../../../examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml)
  records the persistent base, development, and staging Spaces and their exact
  configuration change.
- [digest-index/platform-index.json](../../../examples/aicr/eks-h100-training-kubeflow/digest-index/platform-index.json)
  pins the whole shape by one digest: the upstream source, the recipe criteria, the
  three OCI transport manifests, and one immutable payload per rendered Application.

The original Git-oriented bundle still contains
`https://github.com/YOUR_ORG/YOUR_REPO.git`. It is kept so the limitation is visible;
it is not deployable.

The OCI-oriented bundle has no repository placeholder. AICR replaces its two local
charts with `ArtifactGenerator` resources, and their `HelmRelease` objects refer to
`ExternalArtifact` outputs. The generated `checksums.txt` originally contained the
absolute output directory. The committed copy changes only those path prefixes to
paths relative to the bundle root, so the checksum list is portable and does not expose
a workstation path.

## How you know these are the files AICR wrote

The [digest-index](../../../examples/aicr/eks-h100-training-kubeflow/digest-index/README.md)
directory compiles the whole example into one digest-bound platform index, following
the pattern the Kubara importer proved: one immutable payload per component plus one
index that names every payload by its exact hash. The compiler reads only committed
bytes and refuses to compile if any rendered file drifts from its recorded checksum.

```bash
npm run aicr-digest-index:verify
npm run aicr-digest-index:self-test
```

The verify lane recompiles the index and compares every committed file byte for byte.
The self-test compiles fake surfaces only and proves determinism, digest sensitivity
to a single changed byte, tamper refusal, and the structural refusals: duplicate
Application names, broken sync-wave ranges, a second root, an off-version member.
The planned OCI references inside the index are plans, not publications; the index
records `compiled-offline` and claims no registry push. As everywhere in this
example, the index proves config-plane mechanics only. No GPU workload ran to
produce or verify it.

## Rebuild it yourself

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

## Deliver it with Flux

AICR's OCI form requires Flux v2.7 or newer, the `source-watcher` controller, and
`ExternalArtifact=true` on `helm-controller`. The target also needs an
`OCIRepository` named `aicr-bundle` in `flux-system` that points at the published AICR
artifact. Those are part of the operating configuration, so the receipt records them
instead of leaving them as setup knowledge.

## Deliver it with Argo CD

AICR can also generate an `argocd-helm` bundle. This output is a Helm chart that
creates one parent Argo CD `Application` and 16 component `Application` objects. The
components use sync waves 0 through 15, so storage, certificates, GPU support,
monitoring, scheduling, and training are presented to Argo CD in the intended order.

Two OCI artifacts have different jobs:

| Artifact | What it contains | Who uses it |
| --- | --- | --- |
| AICR Argo source package | The generated Helm chart, values, local chart files, and Argo CD templates | Helm and Argo CD |
| Rendered Argo configuration | The 17 exact `Application` objects, one YAML layer per object | ConfigHub |

Both artifacts are public in Google Artifact Registry:

```text
oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd:0.14.0
oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.14.0
```

The source package digest is
`sha256:1120c9a17b23f2c885121034d55445f2d3948c95c23756d02fa2209e4baf8c2e`.
The 17-object configuration digest is
`sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010`.
Both passed anonymous pull checks. The small OCI layouts are also committed, so the
verifier can compare the public artifacts with the exact source and rendered files.

Run `npm run aicr-argocd-example:verify` to check the source package, the 17
Applications, both OCI manifests and layouts, every file checksum, the source
references, and the complete set of sync waves. Run
`npm run aicr-argocd-example:public-verify` to pull both public artifacts without
registry credentials and check their recorded digests.

## Keep it in ConfigHub

The live demo imports the public literal configuration OCI:

```bash
cub variant upload \
  --component aicr-eks-h100-training-kubeflow \
  --variant v0-14-0-argocd \
  --space aicr-eks-h100-training-kubeflow-v0-14-0-argocd \
  --granularity minimal \
  oci://europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/aicr-eks-h100-training-kubeflow-argocd-config:0.14.0
```

ConfigHub pulled digest
`sha256:dcf7feeeeaece04cb5d55cbc1106862172b3ae77718154252b39db1ad8957010`,
created one base Space, and stored all 17 `Application` objects in one Unit. A verifier
compared every live object with the committed AICR output and confirmed sync waves 0
through 15.

The upload also names two requirements that must already exist: the `argocd`
Namespace and the default Argo CD AppProject. The live Space records both in its
README.

`cub variant upload` does not run AICR or render charts. It imports exact YAML and
records the source reference and resolved digest on the Space. ConfigHub can then show
changes to those files and manage derived variants for environments or cluster
classes.

## The whole round trip, start to finish

A separate live test checked the next boundary. It imported the same
17-Application literal configuration OCI into a temporary ConfigHub base, published
a ConfigHub release OCI, pulled that release back, and compared every Application
with the AICR input.

All 17 Applications matched. ConfigHub added its `confighub.com/origin` annotation
to each object so the released configuration can be traced back to its ConfigHub
record. The input and output OCI digests are different because they are different
artifacts; the object comparison proves that the Kubernetes configuration stayed the
same.

Read the [plain-English result](../../../data/aicr-oci-roundtrip-proof/summary.md) or
the [live receipt](../../../runs/aicr-oci-roundtrip-proof/receipt.yaml). The test used
a temporary local input registry and a throwaway cluster only to obtain a legitimate
ConfigHub release target and scoped OCI credential. It did not apply the Applications,
reconcile the AICR stack, create an EKS cluster, or run a GPU workload.

The public pull does not need a Google login. Argo CD delivery and live GPU-cluster
reconciliation have not run. The example proves generation, public OCI packaging,
exact ConfigHub upload, policy attachment, and promotion, but it does not claim a
working GPU platform.

The uploaded base requires approval because it changes cluster-wide GPU, monitoring,
and training-platform configuration. That rule applies before production too. A live
dry-run of the exact 17-Application Unit was rejected by the required-approval gate.
The Unit had no target attached, its revision and data hash stayed unchanged, and
nothing was sent to Kubernetes. Run
`npm run aicr-argocd-example:hub-policy-check` while authenticated to repeat that
check.

## Change one value and promote it

The generated AICR configuration includes the example Grafana setting
`adminPassword: admin` inside the `kube-prometheus-stack` Application. ConfigHub can
keep the AICR output as the base, while development and staging use an existing Secret
named `aicr-grafana-admin`.

The persistent `helm-catalog` demo follows four steps:

1. Import the exact 17-Application OCI bundle as a base variant.
2. Create development from the base and staging from development.
3. Preview and apply the Grafana Secret change in development. Only
   `Application argocd/kube-prometheus-stack` changed.
4. Preview the staging promotion, confirm that the preview changed nothing, then run
   the promotion and confirm that staging matched the reviewed development config.

[The persistent promotion receipt](../../../examples/aicr/eks-h100-training-kubeflow/promotion-readiness-receipt.yaml)
records the public OCI digests, three live Spaces, exact changed Application, dry-run
results, promotion revision, policy checks, and required approval. Each Space has one
short README that explains what to inspect.

The configuration Unit is promoted by itself so development and staging can keep
different README text. This is the same upstream upgrade operation used by a bulk
variant promotion, scoped to the one Unit that contains the 17 Applications.

Run the live check while authenticated:

```bash
CUB_CONTEXT=<context> npm run aicr-argocd-example:promotion-verify
```

A separate [scratch proof](../../../data/aicr-variant-promotion-proof/summary.md)
records an earlier temporary run of the same configuration change. Neither proof
started a Kubernetes cluster, so neither claims Argo CD delivery, application health,
or GPU workload health.
