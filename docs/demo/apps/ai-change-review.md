# Review an AI change before it reaches a cluster

This example shows what an AI change review should look like in ConfigHub.
It starts with a real AICR PyTorch training runtime from this repository.

The request sounds simple: increase the runtime to eight H100 nodes and update
its image. The unchecked proposal is not safe to apply. It asks for twice the
recorded target capacity, replaces a digest-pinned image with `latest`, and
leaves the API key as an unfinished placeholder.

ConfigHub should show those exact changes and run the checks attached to the
configuration. The placeholder is a blocking error. The mutable image produces
a warning. The requested node count fails the target-capacity check. Nothing is
sent to a cluster.

The reviewed candidate uses four nodes, keeps the pinned image, and reads the
API key from an existing Secret.

Open the [generated review summary](../../../data/ai-change-review/summary.md)
for the two complete YAML objects and the receipt. The receipt says which
checks ran locally.

A separate [live ConfigHub receipt](../../../data/ai-change-review-live-proof/summary.md)
uploads the reviewed object to a temporary Space. ConfigHub stores the same
Kubernetes fields, blocks a dry run until the exact head revision is approved,
then allows the same dry run against an OCI target. Nothing is applied to
Kubernetes.

The live run also found a policy limitation. The generic image and probe
checks look at ordinary workload-controller fields. This AICR custom resource
stores its container deeper in the object, so those two warnings do not tell us
whether this candidate is safe. The policy needs AICR-aware checks or narrower
generic checks.

This is a deterministic example of an agent-produced change. It is not a
transcript from a named model, and it does not claim that the candidate was
deployed, promoted, rolled back, or observed on a GPU cluster.
