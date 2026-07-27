# Review an AI change before it reaches a cluster

This example shows what an AI change review should look like in ConfigHub.
It starts with a real AICR PyTorch training runtime from this repository.

The request sounds simple: increase the runtime to eight H100 nodes and update
its image. The unchecked proposal is not safe to apply. It asks for twice the
recorded target capacity, replaces a digest-pinned image with `latest`, and
leaves the API key as an unfinished placeholder.

ConfigHub shows those exact changes and runs checks that understand this AICR
object. The mutable image produces a warning. Putting `AI_API_KEY` directly in
the object is blocked. The requested node count also fails the repository's
recorded target-capacity check. Nothing is sent to a cluster.

The reviewed candidate uses four nodes, keeps the pinned image, and reads the
API key from an existing Secret.

Open the [generated review summary](../../../data/ai-change-review/summary.md)
for the two complete YAML objects and the receipt. The receipt says which
checks ran locally.

A separate [live ConfigHub receipt](../../../data/ai-change-review-live-proof/summary.md)
uploads both versions to a temporary Space. ConfigHub reports the unsafe
AICR image and blocks the inline API key. The reviewed version clears both
checks. ConfigHub stores the same Kubernetes fields, blocks a dry run until the
exact head revision is approved, then allows the same dry run against an OCI
target. Nothing is applied to Kubernetes.

The ordinary Deployment image and probe checks do not run against the AICR
custom resource. They now name the Kubernetes workload kinds they understand.
The AICR checks read the deeper image and environment-variable fields used by
`trainer.kubeflow.org/v1alpha1` `ClusterTrainingRuntime`.

The four-node target limit is still checked outside ConfigHub. It depends on a
fact about one target, so it should not be hard-coded into a rule that every
cluster receives.

This is a deterministic example of an agent-produced change. It is not a
transcript from a named model, and it does not claim that the candidate was
deployed, promoted, rolled back, or observed on a GPU cluster.
