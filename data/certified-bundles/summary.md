# Certified bundle receipts

One receipt shape covers a bundle from every producer. These four reference receipts prove it: the catalog's flattened traefik render, a Kubara component definition, a bundle eks-inference published to its own registry, and the Sveltos example's literal ClusterProfile. The spec lives at docs/reference/certified-bundle-spec.md and the schema at schemas/certified-bundle-receipt.schema.json.

| producer | component | source | OCI | lane | status |
| --- | --- | --- | --- | --- | --- |
| config-workshop-catalog | traefik-traefik-41.0.2-default | traefik 41.0.2 | `europe-west1-docker.pkg.dev/nth-fort-499605-q5/helm-expt/bundles/catalog-traefik-traefik-41-0-2-default:latest` | flatten-with-routes | certified |
| kubara | current-platform-metrics-server | metrics-server 3.13.1 | not published | safe-to-flatten | certified |
| eks-inference | platform-profile | literal-yaml | `ghcr.io/confighub/configs/eks-inference/platform-profile:latest` | born-flattened | certified |
| eks-inference | ack-controllers | helm-chart | `ghcr.io/confighub/configs/eks-inference/ack-controllers:latest` | flatten-with-routes | certified |
| eks-inference | aws-network | literal-yaml | `ghcr.io/confighub/configs/eks-inference/aws-network:latest` | born-flattened | certified |
| eks-inference | eks-cluster | literal-yaml | `ghcr.io/confighub/configs/eks-inference/eks-cluster:latest` | born-flattened | certified |
| eks-inference | karpenter-aws | literal-yaml | `ghcr.io/confighub/configs/eks-inference/karpenter-aws:latest` | born-flattened | certified |
| eks-inference | karpenter | helm-chart | `ghcr.io/confighub/configs/eks-inference/karpenter:latest` | flatten-with-routes | certified |
| eks-inference | gpu-runtime | helm-chart | `ghcr.io/confighub/configs/eks-inference/gpu-runtime:latest` | safe-to-flatten | certified |
| eks-inference | inference-workloads | literal-yaml | `ghcr.io/confighub/configs/eks-inference/inference-workloads:latest` | born-flattened | certified |
| sveltos-example | kyverno-fleet-clusterprofile | confighub-unit | `oci://127.0.0.1:32807/sveltos-kyverno-staging:pilot` | born-flattened | certified |
| aicr | aicr-eks-h100-training-kubeflow | aicr-entry | not published | flatten-with-routes | certified |
| aicr | aicr-eks-h100-inference-nim | aicr-entry | not published | flatten-with-routes | certified |
| aicr | aicr-cpu-starter | aicr-entry | not published | flatten-with-routes | certified |
| aicr | aicr-kserve-nim-inference | retained-upstream-tree | not published | born-flattened | certified |

The OCI column states where the bundle is published, and says so plainly when it is not. A bundle without a published reference is still certified: the receipt describes committed bytes, and publication adds a digest to the same receipt shape rather than changing what it claims.

A provisional verdict states what current evidence supports and names its open questions in the receipt. The flattening-safety audit certifies lanes; a lane moves when its receipt changes, never by hand.

The eight eks-inference receipts certify artifacts this repository did not build. Each witness records the pulled manifest and layer digests, and every extracted file hashed identically to the producer's committed render at the recorded commit. Their five literal components are born flattened; the three chart-sourced ones carry the lane their charts' verdicts decided, and where a component wraps several charts the strictest lane governs.

The Kubara receipt reads the byte-faithful mirror under examples/kubara. Its canonicalHome block pins the maintained copy in kubara-confighub, so removing the mirror re-points the generator instead of breaking it silently.

Regenerate with `npm run certified-bundles`. Verify with `npm run certified-bundles:verify`.
