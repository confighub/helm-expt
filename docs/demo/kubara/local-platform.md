# Kubara platform configuration

A platform team usually manages more than one Helm release. Argo CD,
certificates, Secrets, ingress, monitoring, and cluster services must be chosen
together and kept consistent across a fleet. Kubara provides that platform
description and generates the Helm source and cluster values.

This example uses Kubara v0.12.0 to describe one local test cluster and seven
enabled services. The generated Argo CD chart renders 77 Kubernetes objects,
including the ApplicationSets that assign those services to matching clusters.

ConfigHub adds a durable record of that result. The render can become a base
variant, while development, staging, production, region, or cluster-class
differences become reviewed variants. A platform change can then be compared,
checked, and promoted in waves instead of being repeated as an imperative
upgrade on every cluster.

## Follow the example

1. Read the [Kubara source config](../../../examples/kubara/local-platform/source/config.yaml)
   to see the cluster and enabled services.
2. Read the [portal values override](../../../examples/kubara/local-platform/source/values-homer-links.yaml)
   for a small example of changing Kubara output through its normal values path.
3. Open the [generated cluster values](../../../examples/kubara/local-platform/generated/platform-configs/test-cluster/helm/argo-cd/values.generated.yaml)
   to see what Kubara produced for Argo CD.
4. Inspect the [literal Kubernetes render](../../../examples/kubara/local-platform/rendered/release-objects.yaml)
   that ConfigHub can record.
5. Read the [route intent](../../../examples/kubara/local-platform/route-intent.yaml)
   for the CRDs, hook Job, Secret handling, and External Secrets prerequisite.
6. Check the [generation receipt](../../../examples/kubara/local-platform/generation-receipt.yaml)
   for the exact commands, checksums, OCI digest, and live-test boundary.
7. Check the [ConfigHub upload receipt](../../../examples/kubara/local-platform/confighub-upload-receipt.yaml)
   for the Space, Unit, matching object identities, omitted Secrets, and policy.

The [example README](../../../examples/kubara/local-platform/README.md) explains
how to regenerate and verify every committed file.

## Three different artifacts

| Artifact | Contents | Use |
| --- | --- | --- |
| Kubara source | Platform config, generated Helm charts, and cluster values | Regenerate or change the platform |
| Literal configuration OCI | The 77 rendered Kubernetes objects | Create a ConfigHub base variant |
| ConfigHub release OCI | A later approved revision | Deliver through Argo CD, Flux, or another controller |

The current example has the first two forms. ConfigHub pulled the local literal
OCI and recorded the 75 non-Secret objects in one Unit. It does not claim that a
ConfigHub release OCI or a live cluster rollout has run.

## The work around the render

The render includes three Argo CD CRDs. They must be installed and established
before the Argo CD custom resources. It also contains four resources marked as
a Helm pre-install and pre-upgrade hook; together they run the Job that creates
the Redis Secret.

The render also expects the External Secrets CRD, a `ClusterSecretStore`, and a
remote image-pull key. Two ordinary Secret objects are present, but
`cub variant upload` deliberately does not upload rendered Secrets. The route
record names each case and the action an implementation must take.

This is the part ConfigHub can make manageable: keep the special steps with the
base variant, check the target facts, execute the required work in order, and
record what happened.

## What has been checked

`npm run kubara-example:verify` checks the pinned Kubara release, every generated
file, Helm dependency lock, all 77 rendered objects, the three CRDs, four hook
resources, two Secrets, repository paths, route record, and literal OCI layout.

The ConfigHub upload passed. The Space requires approval because it contains
cluster-wide system configuration. Public registry publication, route execution,
Argo CD sync, and platform health remain separate checks. Until those receipts
exist, this example remains partial.
