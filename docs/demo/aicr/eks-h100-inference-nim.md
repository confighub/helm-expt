# The AICR-native inference entry, held next to the KServe one

UNOFFICIAL/EXPERIMENTAL. This entry belongs to
[the AICR catalog overview](./index.md). It asks AICR itself for a NIM
inference platform, and it exists so the catalog holds both credible NVIDIA
answers to "how do I serve NIM" rather than quietly preferring one.

The catalog's other inference entry retains
[NVIDIA's nim-deploy KServe reference implementation](./kserve-nim-inference.md).
This one retains what AICR produces for the same intent. A
[study of AICR's composition model](../../reference/aicr-composition-model.md)
found the native path after the KServe entry was already built, and holding
both is the honest response.

## What it is

AICR v0.14.0 treats `nim` as a platform criteria value, the same way it treats
`kubeflow` for training. Asking for it resolves eight overlays into seventeen
components, including the NIM operator at 3.1.0 and an inference gateway, and
the Argo CD bundle renders into twenty Applications.

```bash
aicr recipe --service eks --accelerator h100 --os ubuntu \
  --intent inference --platform nim --output recipe.yaml
```

The [generation receipt](../../../examples/aicr/eks-h100-inference-nim/generation-receipt.yaml)
records the exact commands, the criteria, the generation inputs, and one thing
worth stating plainly: the binary that produced this entry was checked against
the checksums pinned in the training entry's own receipt before it was run.

## What changes between training and inference

This is the clearest picture of AICR's composition model the catalog has, and
it is a small diff on a large shared spine. Fifteen of the components are
identical to the training entry. Training adds the Kubeflow trainer and its
post-install Application. Inference removes those and adds the NIM operator
plus the agentgateway inference gateway.

| Shape | Applications | Distinct components |
| --- | --- | --- |
| Training, `platform: kubeflow` | 17 | `kubeflow-trainer`, `kubeflow-trainer-post` |
| Inference, `platform: nim` | 20 | `k8s-nim-operator`, `agentgateway`, `agentgateway-crds`, and their two post Applications |

One criteria value moves the platform from training to serving. That is the
argument for retaining recipes rather than hand-assembled YAML, made concrete.

## How the two inference entries differ

They are not competitors. They answer different questions at different
granularities, which only became visible once both were retained.

| | AICR-native (this entry) | nim-deploy KServe entry |
| --- | --- | --- |
| Source | AICR v0.14.0 itself | NVIDIA/nim-deploy at an exact commit |
| Granularity | Platform components | Model serving shapes |
| Retained documents | 20 Argo CD Applications | 26 KServe documents |
| Serving mechanism | The NIM operator reconciles NIM custom resources | KServe `InferenceService` against a `ClusterServingRuntime` |
| Model choice expressed as | A custom resource the operator consumes, not retained here | Sixteen retained model-by-GPU shapes |
| Gateway | agentgateway with the Gateway API inference extension | None retained |
| Answers | How do I stand up a cluster that can serve NIM | Which exact serving shape do I run for this model |

A team needs both halves. The platform entry gets an inference-capable cluster;
the KServe entry names the exact shape a given model runs in. The catalog
retains both and says which is which, rather than picking one and calling it
the inference story.

## One digest pins this entry too

```bash
npm run aicr-inference-nim:verify
```

The [digest index](../../../examples/aicr/eks-h100-inference-nim/digest-index/README.md)
pins the upstream source, the recipe criteria, and all twenty rendered
Applications under
`sha256:cc4ea0fb2347d3c74d77642bb930aa3caa48d4115e4a3017fe95b140b025c4a2`.
The compiler that produces it is the one the training entry uses, generalized
to serve any AICR entry.

## The operator's config surface, proven on a cluster

```bash
npm run aicr-nim-operator-delivery:verify
```

This entry installs the NIM operator, and the operator's custom resource
definitions are the surface a team actually writes against. Both definitions a
NIM deployment needs are retained here from the Apache-2.0 operator repository
at `v3.1.0`, which is the same version this entry's own rendered Application
installs. The proof refuses to run unless those agree, because definitions
that drift from the component they describe would accept shapes the deployed
operator rejects.

On a throwaway kind cluster the definitions were established and the catalog's
own authored NIMService was accepted with its gated image reference intact.
That resource is authored rather than retained, and the page says so, because
upstream ships no ready-made NIMService for this shape and inventing one
quietly would be the kind of manufactured content this catalog refuses.

The operator itself was never installed. With nothing reconciling a
NIMService, the run scheduled no pod and pulled no image, which is how the
config-plane boundary and the licensing boundary hold together rather than
separately.

## What is proven and what is not

Proven: the entry was generated by a binary verified against a committed
receipt, the recipe and every rendered Application are retained byte for byte,
and one digest pins the shape.

Not proven, and stated rather than implied: this entry was never published, so
it carries no public digest and no OCI transport receipts, and the repository
reference in its Applications is what a publication would use rather than a
record that one happened. No ConfigHub import or promotion exists for it yet,
and the delivery proof above covers the operator's config surface rather than
the whole platform. No NIM container ran, no model was fetched, and no NGC
surface was contacted. It exists first as a comparison, and the ladder the
other entries climbed is open to it next.
